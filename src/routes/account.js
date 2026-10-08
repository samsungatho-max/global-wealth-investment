'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { one, all, run, tx } = require('../db');
const { t } = require('../i18n');
const { requireAuth, verifyCsrf, makeUploader, sendStoredFile } = require('../lib/security');
const ledger = require('../lib/ledger');
const { parseAmount, money } = require('../lib/money');
const { notify } = require('../lib/notify');
const { audit } = require('../lib/audit');
const { countries, CODES } = require('../lib/countries');
const totp = require('../lib/totp');
const settings = require('../lib/settings');
const { isStrongPassword, isPhone } = require('./auth');

const router = express.Router();
router.use(requireAuth);
router.use(async (req, res, next) => { res.locals.section = 'account'; next(); });

/** Référence unique lisible, ex. DEP-20260927-7K3QX9 */
function makeReference(prefix) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand = Array.from(crypto.randomBytes(6), (b) => alphabet[b % alphabet.length]).join('');
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${d}-${rand}`;
}

const normalizeName = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

function validAccountNumber(raw) {
  const s = String(raw || '').replace(/\s/g, '').toUpperCase();
  if (/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) {
    const moved = s.slice(4) + s.slice(0, 4);
    const digits = moved.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
    let rem = 0;
    for (const ch of digits) rem = (rem * 10 + Number(ch)) % 97;
    return rem === 1 ? s : null;
  }
  return /^[A-Z0-9]{6,34}$/.test(s) ? s : null;
}

function withdrawalFee(amountCents) {
  const w = settings.get('withdrawal');
  return Math.round((w.fee_fixed_cents || 0) + amountCents * (Number(w.fee_percent) || 0) / 100);
}

// ---------- Tableau de bord ----------
router.get('/', async (req, res) => {
  const s = await ledger.summary(req.user.id, req.lang);
  res.render('account/overview', {
    title: t(req.lang, 'account.title'),
    s,
    history: (await ledger.valuationHistory(req.user.id, req.lang)).slice(0, 8),
    recent: await all('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 6', req.user.id),
    withdrawals: await all(`SELECT * FROM transactions WHERE user_id = ? AND type = 'withdrawal' ORDER BY created_at DESC LIMIT 5`, req.user.id)
  });
});

router.get('/investments', async (req, res) => {
  res.render('account/investments', {
    title: t(req.lang, 'account.nav_investments'),
    s: await ledger.summary(req.user.id, req.lang),
    history: await ledger.valuationHistory(req.user.id, req.lang)
  });
});

router.get('/transactions', async (req, res) => {
  res.render('account/transactions', {
    title: t(req.lang, 'tx.title'),
    rows: await all('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC, id DESC', req.user.id),
    s: await ledger.summary(req.user.id, req.lang)
  });
});

router.post('/transactions/:id/cancel', async (req, res) => {
  const row = await one(`SELECT * FROM transactions WHERE id = ? AND user_id = ? AND type = 'withdrawal' AND status = 'pending'`, req.params.id, req.user.id);
  if (row) {
    await run(`UPDATE transactions SET status = 'cancelled', processed_at = datetime('now') WHERE id = ? AND status = 'pending'`, row.id);
    await audit(req, 'withdrawal.cancel_by_user', 'transaction', row.id, { reference: row.reference });
    await notify(req.user.id, 'withdrawal_cancelled', { ref: row.reference }, '/account/transactions');
    req.flash('success', t(req.lang, 'tx.cancelled_ok'));
  }
  res.redirect('/account/transactions');
});

// ---------- Dépôts ----------
// Aucune coordonnée bancaire n'est affichée : le client demande les instructions à l'administration,
// qui les lui communique après vérification. La demande est enregistrée et envoyée à l'adresse de réception.
const requestsLib = require('../lib/requests');

async function depositContext(req, extra = {}) {
  return {
    title: t(req.lang, 'deposit.title'),
    fundsEnabled: settings.get('funds_enabled'),
    pending: await all(`SELECT * FROM transactions WHERE user_id = ? AND type = 'deposit' ORDER BY created_at DESC LIMIT 10`, req.user.id),
    requests: await all(`SELECT ref, status, created_at FROM requests WHERE user_id = ? AND motive = 'deposit' ORDER BY created_at DESC LIMIT 10`, req.user.id),
    values: { phone: req.user.phone || '' }, sentRef: null, ...extra
  };
}

router.get('/deposit', async (req, res) => {
  const sentRef = req.session.depositRequestRef || null;
  delete req.session.depositRequestRef;
  res.render('account/deposit', await depositContext(req, { sentRef }));
});

router.post('/deposit', async (req, res) => {
  if (!settings.get('funds_enabled')) return res.status(403).render('account/deposit', await depositContext(req));
  const values = {
    amount: String(req.body.amount || '').trim().slice(0, 30),
    phone: String(req.body.phone || '').replace(/\s+/g, ' ').trim().slice(0, 30),
    message: String(req.body.message || '').trim().slice(0, 2000)
  };
  const fail = async (key) => res.status(400).render('account/deposit', await depositContext(req, { values, error: t(req.lang, key) }));
  const cents = values.amount ? parseAmount(values.amount) : null;
  if (values.amount && !cents) return fail('deposit.err_amount');
  if (values.phone && !/^\+?[\d\s().-]{6,28}$/.test(values.phone)) return fail('deposit.err_phone');
  const recent = await one(`SELECT COUNT(*) AS n FROM requests WHERE user_id = ? AND motive = 'deposit' AND created_at > datetime('now', '-1 day')`, req.user.id);
  if (Number(recent.n) >= 3) return fail('deposit.err_limit');

  const { id, ref } = await requestsLib.create({
    user_id: req.user.id, motive: 'deposit', full_name: req.user.full_name, country: req.user.country, email: req.user.email,
    phone: values.phone || req.user.phone || null, amount_cents: cents,
    description: values.message || t(req.lang, 'deposit.default_message')
  }, req.user.lang || req.lang);
  const row = await one('SELECT * FROM requests WHERE id = ?', id);
  await requestsLib.sendConfirmation(row);
  await requestsLib.notifyAdmins(row).catch((err) => console.error('[dépôt] notification', err));
  await audit(req, 'deposit.instructions_request', 'request', id, { ref, amount_cents: cents });
  req.session.depositRequestRef = ref;
  res.redirect('/account/deposit');
});

// Les anciennes pages d'instructions ne sont plus consultables : elles renvoient vers la page Dépôt.
router.get('/deposit/:ref', (req, res) => res.redirect('/account/deposit'));

// ---------- Retraits ----------
async function withdrawContext(req) {
  return {
    title: t(req.lang, 'withdraw.title'),
    kycOk: req.user.kyc_status === 'approved',
    w: settings.get('withdrawal'),
    available: await ledger.availableBalance(req.user.id),
    rows: await all(`SELECT * FROM transactions WHERE user_id = ? AND type = 'withdrawal' ORDER BY created_at DESC LIMIT 20`, req.user.id),
    values: {}
  };
}

router.get('/withdraw', async (req, res) => res.render('account/withdraw', await withdrawContext(req)));

router.post('/withdraw', async (req, res, next) => {
  const ctx = await withdrawContext(req);
  if (!ctx.kycOk) return res.status(403).render('account/withdraw', ctx);
  const v = {
    amount: String(req.body.amount || ''),
    holder: String(req.body.holder || '').trim().slice(0, 120),
    iban: String(req.body.iban || '').trim().slice(0, 50),
    bic: String(req.body.bic || '').trim().toUpperCase().slice(0, 11),
    bank: String(req.body.bank || '').trim().slice(0, 120)
  };
  const fail = (msg) => res.status(400).render('account/withdraw', { ...ctx, values: v, error: msg });
  const cents = parseAmount(v.amount);
  if (!cents || !v.holder || !v.iban || !v.bank) return fail(t(req.lang, 'auth.err_required'));
  if (cents < ctx.w.min_cents) return fail(t(req.lang, 'withdraw.min', { amount: money(ctx.w.min_cents, 'USD', req.lang) }));
  if (normalizeName(v.holder) !== normalizeName(req.user.full_name)) return fail(t(req.lang, 'withdraw.holder_mismatch'));
  const account = validAccountNumber(v.iban);
  if (!account) return fail(t(req.lang, 'withdraw.err_iban'));
  const fee = withdrawalFee(cents);
  if (fee >= cents) return fail(t(req.lang, 'withdraw.min', { amount: money(ctx.w.min_cents, 'USD', req.lang) }));

  try {
    const reference = makeReference('WDR');
    // Contrôle du solde et insertion dans la même transaction SQL (évite les doubles demandes concurrentes)
    const id = await tx(async () => {
      // Verrou sur le compte : deux demandes simultanées ne peuvent pas dépasser le solde
      await one('SELECT id FROM users WHERE id = ? FOR UPDATE', req.user.id);
      if (cents > await ledger.availableBalance(req.user.id)) return null;
      return (await run(`INSERT INTO transactions (user_id, type, amount_cents, fee_cents, status, reference, method, beneficiary)
        VALUES (?, 'withdrawal', ?, ?, 'pending', ?, 'bank_transfer', ?)`,
        req.user.id, cents, fee, reference, JSON.stringify({ holder: v.holder, account, bic: v.bic, bank: v.bank }))).lastInsertRowid;
    });
    if (!id) return fail(t(req.lang, 'withdraw.insufficient'));
    await audit(req, 'withdrawal.request', 'transaction', id, { reference, amount_cents: cents, fee_cents: fee });
    await notify(req.user.id, 'withdrawal_created', { ref: reference, amount_cents: cents }, '/account/withdraw');
    req.flash('success', t(req.lang, 'withdraw.created', { ref: reference }));
    res.redirect('/account/withdraw');
  } catch (e) { next(e); }
});

// ---------- Documents ----------
router.get('/documents', async (req, res) => {
  res.render('account/documents', {
    title: t(req.lang, 'docs.title'),
    docs: await all('SELECT * FROM user_documents WHERE user_id = ? ORDER BY created_at DESC', req.user.id)
  });
});

router.get('/documents/:id', async (req, res, next) => {
  const d = await one('SELECT * FROM user_documents WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  if (!d) return next();
  await sendStoredFile(res, d.file_path, d.original_name);
});

// ---------- KYC ----------
const kycUpload = makeUploader({ id_file: 'doc', address_file: 'doc' });

router.get('/kyc', async (req, res) => {
  res.render('account/kyc', {
    title: t(req.lang, 'kyc.title'),
    last: await one('SELECT * FROM kyc_submissions WHERE user_id = ? ORDER BY id DESC LIMIT 1', req.user.id)
  });
});

router.post('/kyc', kycUpload.fields([{ name: 'id_file', maxCount: 1 }, { name: 'address_file', maxCount: 1 }]), verifyCsrf, async (req, res) => {
  if (['pending', 'approved'].includes(req.user.kyc_status)) return res.redirect('/account/kyc');
  const idFile = req.files && req.files.id_file && req.files.id_file[0];
  const addrFile = req.files && req.files.address_file && req.files.address_file[0];
  const docType = ['passport', 'id_card', 'residence_permit'].includes(req.body.doc_type) ? req.body.doc_type : null;
  if (!idFile || !addrFile || !docType) {
    req.flash('error', t(req.lang, 'auth.err_required'));
    return res.redirect('/account/kyc');
  }
  const info = await run(`INSERT INTO kyc_submissions (user_id, doc_type, id_file, id_file_name, address_file, address_file_name) VALUES (?, ?, ?, ?, ?, ?)`,
    req.user.id, docType, idFile.filename, idFile.originalname.slice(0, 200), addrFile.filename, addrFile.originalname.slice(0, 200));
  await run(`UPDATE users SET kyc_status = 'pending' WHERE id = ?`, req.user.id);
  await audit(req, 'kyc.submit', 'kyc', info.lastInsertRowid);
  req.flash('success', t(req.lang, 'kyc.submitted'));
  res.redirect('/account/kyc');
});

// ---------- Profil et sécurité ----------
async function securityContext(req, extra = {}) {
  const ctx = { title: t(req.lang, 'security.title'), countries: countries(req.lang), setup: null, ...extra };
  if (req.session.totpSetup) {
    const uri = totp.uri(req.session.totpSetup, req.user.email, settings.get('site_name'));
    ctx.setup = { secret: req.session.totpSetup, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
  }
  return ctx;
}

router.get('/security', async (req, res, next) => {
  try { res.render('account/security', await securityContext(req)); } catch (e) { next(e); }
});

router.post('/security/profile', async (req, res) => {
  const phone = String(req.body.phone || '').trim();
  const lang = ['fr', 'en', 'es', 'de'].includes(req.body.lang) ? req.body.lang : req.user.lang;
  if (!isPhone(phone)) { req.flash('error', t(req.lang, 'auth.err_phone')); return res.redirect('/account/security'); }
  // Nom et pays ne sont modifiables qu'avant la validation de l'identité.
  const identityLocked = ['pending', 'approved'].includes(req.user.kyc_status);
  const fullName = identityLocked ? req.user.full_name : (String(req.body.full_name || '').trim().slice(0, 120) || req.user.full_name);
  const country = identityLocked || !CODES.includes(req.body.country) ? req.user.country : req.body.country;
  await run('UPDATE users SET phone = ?, lang = ?, full_name = ?, country = ? WHERE id = ?', phone, lang, fullName, country, req.user.id);
  req.session.lang = lang;
  await audit(req, 'profile.update', 'user', req.user.id);
  req.flash('success', t(lang, 'security.saved'));
  res.redirect('/account/security');
});

router.post('/security/password', async (req, res, next) => {
  try {
    if (!(await bcrypt.compare(String(req.body.current || ''), req.user.password_hash))) {
      req.flash('error', t(req.lang, 'security.err_current'));
    } else if (!isStrongPassword(req.body.password)) {
      req.flash('error', t(req.lang, 'auth.err_password_weak'));
    } else if (req.body.password !== req.body.password_confirm) {
      req.flash('error', t(req.lang, 'auth.err_password_mismatch'));
    } else {
      if (await bcrypt.compare(req.body.password, req.user.password_hash)) {
        req.flash('error', t(req.lang, 'security.err_same'));
        return res.redirect('/account/security#password');
      }
      await run('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?', await bcrypt.hash(req.body.password, 12), req.user.id);
      await run(`DELETE FROM sessions WHERE json_extract(sess, '$.userId') = ? AND sid != ?`, req.user.id, req.sessionID);
      await audit(req, 'password.change', 'user', req.user.id);
      await notify(req.user.id, 'password_changed', {}, '/account/security');
      req.flash('success', t(req.lang, 'security.password_changed'));
      if (req.user.must_change_password && req.user.role === 'admin') return res.redirect('/admin');
    }
    res.redirect('/account/security' + (req.user.must_change_password ? '#password' : ''));
  } catch (e) { next(e); }
});

router.post('/security/2fa/start', async (req, res) => {
  if (!req.user.totp_enabled) req.session.totpSetup = totp.generateSecret();
  res.redirect('/account/security#twofa');
});

router.post('/security/2fa/confirm', async (req, res) => {
  const secret = req.session.totpSetup;
  if (!secret || !totp.verify(secret, req.body.code)) {
    req.flash('error', t(req.lang, 'auth.err_code'));
    return res.redirect('/account/security#twofa');
  }
  await run('UPDATE users SET totp_secret = ?, totp_enabled = 1 WHERE id = ?', secret, req.user.id);
  delete req.session.totpSetup;
  await audit(req, '2fa.enable', 'user', req.user.id);
  await notify(req.user.id, 'twofa_changed', {}, '/account/security');
  req.flash('success', t(req.lang, 'security.twofa_enabled'));
  res.redirect('/account/security#twofa');
});

router.post('/security/2fa/disable', async (req, res, next) => {
  try {
    const okPass = await bcrypt.compare(String(req.body.current || ''), req.user.password_hash);
    if (!okPass || !totp.verify(req.user.totp_secret, req.body.code)) {
      req.flash('error', t(req.lang, 'auth.err_code'));
    } else {
      await run('UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?', req.user.id);
      await audit(req, '2fa.disable', 'user', req.user.id);
      await notify(req.user.id, 'twofa_changed', {}, '/account/security');
      req.flash('success', t(req.lang, 'security.twofa_disabled'));
    }
    res.redirect('/account/security#twofa');
  } catch (e) { next(e); }
});

// ---------- Notifications ----------
router.get('/notifications', async (req, res) => {
  res.render('account/notifications', {
    title: t(req.lang, 'account.nav_notifications'),
    rows: await all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 100', req.user.id)
  });
});

router.post('/notifications/read', async (req, res) => {
  await run(`UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL`, req.user.id);
  res.redirect('/account/notifications');
});

module.exports = router;
module.exports.makeReference = makeReference;
