'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { one, run } = require('../db');
const { t } = require('../i18n');
const { sha256, safeEqual } = require('../lib/security');
const { sendMail, mask } = require('../lib/mailer');
const { render: renderEmail } = require('../lib/email-template');
const { notify } = require('../lib/notify');
const verification = require('../lib/verification');
const { audit } = require('../lib/audit');
const totp = require('../lib/totp');
const settings = require('../lib/settings');
const { countries, CODES } = require('../lib/countries');

const router = express.Router();

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer', 12);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false,
  handler: (req, res) => res.status(429).render('error', { title: res.locals.t('common.too_many'), status: 429, message: res.locals.t('common.too_many') })
});

const isEmail = (s) => /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(s);
const isStrongPassword = (p) => typeof p === 'string' && p.length >= 10 && p.length <= 200 && /[A-Za-z]/.test(p) && /\d/.test(p);
const isPhone = (p) => /^\+?[0-9 ().-]{6,20}$/.test(p);

async function logAttempt(req, email, success, reason) {
  await run('INSERT INTO login_attempts (email, ip, success, reason, user_agent) VALUES (?, ?, ?, ?, ?)',
    email || null, req.ip, success ? 1 : 0, reason || null, String(req.get('user-agent') || '').slice(0, 300));
}

async function isLocked(email) {
  const r = await one(`SELECT COUNT(*) AS n FROM login_attempts WHERE lower(email) = lower(?) AND success = 0
    AND created_at > datetime('now', ?)`, email, `-${LOCK_MINUTES} minutes`);
  return r.n >= MAX_FAILS;
}


/** Ouvre la session après authentification complète (mot de passe + éventuellement 2FA). */
const regenerate = (req) => new Promise((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));

async function completeLogin(req, res, user, returnTo) {
  await regenerate(req);
  req.session.userId = user.id;
  req.session.lang = user.lang;
  await run(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`, user.id);
  await logAttempt(req, user.email, true, user.totp_enabled ? 'password+2fa' : 'password');
  if (user.role === 'admin') { req.user = user; await audit(req, 'admin.login', 'user', user.id); }
  const safeReturn = typeof returnTo === 'string' && /^\/(?!\/)/.test(returnTo) ? returnTo : null;
  res.redirect(safeReturn || (user.role === 'admin' ? '/admin' : '/account'));
}

// ---------- Inscription ----------
router.get('/register', async (req, res) => {
  if (req.user) return res.redirect('/account');
  res.render('auth/register', { title: t(req.lang, 'auth.register_title'), values: {}, countries: countries(req.lang) });
});

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const v = {
      full_name: String(req.body.full_name || '').trim().slice(0, 120),
      email: String(req.body.email || '').trim().toLowerCase().slice(0, 200),
      country: String(req.body.country || ''),
      phone: String(req.body.phone || '').trim().slice(0, 20)
    };
    const render = (key) => res.status(400).render('auth/register', {
      title: t(req.lang, 'auth.register_title'), values: v, countries: countries(req.lang), error: t(req.lang, key)
    });
    if (!v.full_name || !v.email || !v.country || !v.phone || !req.body.password) return render('auth.err_required');
    if (!isEmail(v.email)) return render('auth.err_email');
    if (!CODES.includes(v.country)) return render('auth.err_required');
    if (!isPhone(v.phone)) return render('auth.err_phone');
    if (!isStrongPassword(req.body.password)) return render('auth.err_password_weak');
    if (req.body.password !== req.body.password_confirm) return render('auth.err_password_mismatch');
    if (req.body.accept !== 'on') return render('auth.err_accept');
    if (await one('SELECT id FROM users WHERE email = ?', v.email)) return render('auth.err_email_taken');

    const hash = await bcrypt.hash(req.body.password, 12);
    const info = await run('INSERT INTO users (email, password_hash, full_name, country, phone, lang) VALUES (?, ?, ?, ?, ?, ?)',
      v.email, hash, v.full_name, v.country, v.phone, req.lang);
    const user = await one('SELECT * FROM users WHERE id = ?', info.lastInsertRowid);
    // Étape 1 : code généré ; étape 2 : e-mail soumis au serveur SMTP (statut réel enregistré).
    await verification.issueCode(user);
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = user.id;
      req.session.lang = user.lang;
      res.redirect('/verify-email');
    });
  } catch (e) { next(e); }
});

// ---------- Confirmation de l'adresse e-mail par code ----------
async function renderVerify(req, res, extra = {}) {
  const st = await verification.state(req.user.id);
  res.status(extra.status || 200).render('auth/verify', {
    title: t(req.lang, 'auth.verify_title'),
    st,
    maskedEmail: mask(req.user.email),
    ttl: verification.CODE_TTL_MIN,
    error: extra.error || null
  });
}

router.get(['/verify-email', '/verify-email/pending'], async (req, res) => {
  if (!req.user) return res.redirect('/login');
  if (req.user.email_verified_at) return res.redirect('/account');
  if (req.path !== '/verify-email') return res.redirect('/verify-email');
  await renderVerify(req, res);
});

router.post('/verify-email', authLimiter, async (req, res) => {
  if (!req.user) return res.redirect('/login');
  if (req.user.email_verified_at) return res.redirect('/account');
  const r = await verification.verifyCode(req.user, req.body.code);
  if (!r.ok) {
    const key = { invalid: 'auth.verify_invalid_code', expired: 'auth.verify_expired', too_many: 'auth.verify_too_many' }[r.error];
    return await renderVerify(req, res, { status: 400, error: t(req.lang, key, { n: r.remaining }) });
  }
  await audit(req, 'account.email_confirmed', 'user', req.user.id);
  req.flash('success', t(req.lang, 'auth.verified'));
  res.redirect('/account');
});

router.post('/verify-email/resend', authLimiter, async (req, res, next) => {
  try {
    if (!req.user) return res.redirect('/login');
    if (req.user.email_verified_at) return res.redirect('/account');
    const r = await verification.issueCode(req.user);
    if (!r.ok && r.error === 'cooldown') req.flash('error', t(req.lang, 'auth.verify_wait', { s: r.wait }));
    else if (!r.ok && r.error === 'limit') req.flash('error', t(req.lang, 'auth.verify_limit'));
    else if (r.ok && ['relay_accepted', 'delivered'].includes(r.mail.status)) req.flash('success', t(req.lang, 'auth.verify_resent'));
    // En cas d'échec d'envoi, la page affiche elle-même l'erreur (statut réel du journal).
    res.redirect('/verify-email');
  } catch (e) { next(e); }
});

// ---------- Connexion ----------
function renderLogin(req, res, opts = {}) {
  const admin = req.path.startsWith('/admin');
  res.status(opts.status || 200).render('auth/login', {
    title: t(req.lang, admin ? 'auth.admin_login_title' : 'auth.login_title'),
    admin, action: admin ? '/admin/login' : '/login', email: opts.email || '', error: opts.error
  });
}

router.get(['/login', '/admin/login'], async (req, res) => {
  if (req.user) return res.redirect(req.user.role === 'admin' && req.path.startsWith('/admin') ? '/admin' : '/account');
  renderLogin(req, res);
});

router.post(['/login', '/admin/login'], authLimiter, async (req, res, next) => {
  try {
    const admin = req.path.startsWith('/admin');
    const email = String(req.body.email || '').trim().toLowerCase().slice(0, 200);
    const password = String(req.body.password || '');
    if (!email || !password) return renderLogin(req, res, { status: 400, email, error: t(req.lang, 'auth.err_required') });
    if (await isLocked(email)) {
      await logAttempt(req, email, false, 'locked');
      return renderLogin(req, res, { status: 429, email, error: t(req.lang, 'auth.err_locked') });
    }
    const user = await one('SELECT * FROM users WHERE email = ?', email);
    const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok || (admin && user.role !== 'admin')) {
      await logAttempt(req, email, false, !user ? 'unknown_user' : !ok ? 'bad_password' : 'not_admin');
      return renderLogin(req, res, { status: 401, email, error: t(req.lang, 'auth.err_credentials') });
    }
    if (user.status !== 'active') {
      await logAttempt(req, email, false, 'suspended');
      return renderLogin(req, res, { status: 403, email, error: t(req.lang, 'auth.err_suspended') });
    }
    const returnTo = req.session.returnTo;
    if (user.totp_enabled) {
      req.session.pending2fa = { userId: user.id, at: Date.now(), returnTo };
      return res.redirect('/login/2fa');
    }
    await completeLogin(req, res, user, returnTo);
  } catch (e) { next(e); }
});

router.get('/login/2fa', async (req, res) => {
  if (!req.session.pending2fa) return res.redirect('/login');
  res.render('auth/twofa', { title: t(req.lang, 'auth.twofa_title') });
});

router.post('/login/2fa', authLimiter, async (req, res) => {
  const pending = req.session.pending2fa;
  if (!pending || Date.now() - pending.at > 5 * 60 * 1000) {
    delete req.session.pending2fa;
    return res.redirect('/login');
  }
  const user = await one('SELECT * FROM users WHERE id = ?', pending.userId);
  if (!user || await isLocked(user.email)) {
    delete req.session.pending2fa;
    return renderLogin(req, res, { status: 429, error: t(req.lang, 'auth.err_locked') });
  }
  if (!totp.verify(user.totp_secret, req.body.code)) {
    await logAttempt(req, user.email, false, 'bad_2fa');
    return res.status(401).render('auth/twofa', { title: t(req.lang, 'auth.twofa_title'), error: t(req.lang, 'auth.err_code') });
  }
  delete req.session.pending2fa;
  await completeLogin(req, res, user, pending.returnTo);
});

router.post('/logout', async (req, res) => {
  const lang = req.lang;
  req.session.regenerate(() => {
    req.session.lang = lang;
    req.session.flash = [{ type: 'success', msg: t(lang, 'auth.logged_out') }];
    res.redirect('/');
  });
});

// ---------- Mot de passe oublié (code à 6 chiffres par e-mail) ----------
router.get('/forgot-password', async (req, res) => res.render('auth/forgot', { title: t(req.lang, 'auth.forgot_title') }));

router.post('/forgot-password', authLimiter, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase().slice(0, 200);
    const user = email ? await one(`SELECT * FROM users WHERE email = ? AND status = 'active'`, email) : null;
    if (user) {
      await run('UPDATE password_resets SET used_at = datetime(\'now\') WHERE user_id = ? AND used_at IS NULL', user.id);
      const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
      await run(`INSERT INTO password_resets (user_id, code_hash, expires_at) VALUES (?, ?, datetime('now', '+15 minutes'))`,
        user.id, sha256(`${user.id}:${code}`));
      const mail = renderEmail({
        lang: user.lang, name: user.full_name,
        paragraphs: [t(user.lang, 'mail.reset_code_intro')], code,
        after: [t(user.lang, 'mail.reset_code_after')]
      });
      await sendMail({
        to: user.email,
        subject: `${t(user.lang, 'mail.reset_subject')} — ${settings.get('site_name')}`,
        text: mail.text, html: mail.html, kind: 'password_reset', userId: user.id
      });
    }
    req.session.resetEmail = email;
    req.flash('success', t(req.lang, 'auth.reset_sent'));
    res.redirect('/reset-password');
  } catch (e) { next(e); }
});

router.get('/reset-password', async (req, res) => {
  res.render('auth/reset', { title: t(req.lang, 'auth.reset_title'), email: req.session.resetEmail || '' });
});

router.post('/reset-password', authLimiter, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const code = String(req.body.code || '').replace(/\s/g, '');
    const fail = (key) => res.status(400).render('auth/reset', { title: t(req.lang, 'auth.reset_title'), email, error: t(req.lang, key) });
    if (!isStrongPassword(req.body.password)) return fail('auth.err_password_weak');
    if (req.body.password !== req.body.password_confirm) return fail('auth.err_password_mismatch');
    const user = await one('SELECT * FROM users WHERE email = ?', email);
    const reset = user && await one(`SELECT * FROM password_resets WHERE user_id = ? AND used_at IS NULL
      AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1`, user.id);
    if (!reset || reset.attempts >= 5) return fail('auth.err_code');
    if (!safeEqual(reset.code_hash, sha256(`${user.id}:${code}`))) {
      await run('UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?', reset.id);
      return fail('auth.err_code');
    }
    const hash = await bcrypt.hash(req.body.password, 12);
    await run('UPDATE users SET password_hash = ? WHERE id = ?', hash, user.id);
    await run(`UPDATE password_resets SET used_at = datetime('now') WHERE id = ?`, reset.id);
    // Invalide toutes les sessions existantes de cet utilisateur
    await run(`DELETE FROM sessions WHERE json_extract(sess, '$.userId') = ?`, user.id);
    await notify(user.id, 'password_changed', {}, '/account/security');
    delete req.session.resetEmail;
    req.flash('success', t(req.lang, 'auth.reset_ok'));
    res.redirect(user.role === 'admin' ? '/admin/login' : '/login');
  } catch (e) { next(e); }
});

module.exports = router;
module.exports.isStrongPassword = isStrongPassword;
module.exports.isPhone = isPhone;
