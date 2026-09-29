'use strict';
/**
 * Codes de confirmation de compte (6 chiffres).
 *  - seul un HMAC-SHA256 du code est stocké (jamais le code en clair) ;
 *  - validité limitée (CODE_TTL_MIN), nombre d'essais limité (MAX_ATTEMPTS) ;
 *  - « Renvoyer le code » : délai minimal entre deux envois, plafond horaire,
 *    l'ancien code est invalidé et le nouveau est garanti différent des codes récents ;
 *  - le code n'est transmis que par e-mail : il n'est jamais renvoyé dans une page web.
 */
const crypto = require('crypto');
const { one, all, run, tx } = require('../db');
const { t } = require('../i18n');
const { sendMail } = require('./mailer');
const { render } = require('./email-template');
const settings = require('./settings');

const CODE_TTL_MIN = 15;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_S = 60;
const MAX_PER_HOUR = 5;

function pepper() {
  return process.env.CODE_PEPPER || process.env.SESSION_SECRET || 'dev-only-code-pepper';
}
const hashCode = (userId, code) => crypto.createHmac('sha256', pepper()).update(`${userId}:${code}`).digest('hex');

function secondsSince(sqliteDate) {
  return Math.floor((Date.now() - new Date(sqliteDate.replace(' ', 'T') + 'Z').getTime()) / 1000);
}

/** État courant pour la page de confirmation (sans jamais exposer le code). */
function state(userId) {
  const last = one(`SELECT v.*, l.status AS mail_status, l.error AS mail_error FROM email_verifications v
    LEFT JOIN email_log l ON l.id = v.email_log_id WHERE v.user_id = ? ORDER BY v.id DESC LIMIT 1`, userId);
  if (!last) return { issued: false, waitSeconds: 0 };
  const since = secondsSince(last.created_at);
  return {
    issued: true,
    mailStatus: last.mail_status || 'queued',
    waitSeconds: Math.max(0, RESEND_COOLDOWN_S - since),
    expired: new Date(last.expires_at.replace(' ', 'T') + 'Z').getTime() < Date.now() || !!last.invalidated_at || !!last.used_at
  };
}

/**
 * Génère un nouveau code, invalide les précédents et envoie l'e-mail.
 * Retourne { ok, error?: 'cooldown'|'limit'|'verified', wait?, mail? }.
 */
async function issueCode(user) {
  if (user.email_verified_at) return { ok: false, error: 'verified' };
  const recent = all(`SELECT code_hash, created_at FROM email_verifications
    WHERE user_id = ? AND created_at > datetime('now', '-1 hour') ORDER BY id DESC`, user.id);
  if (recent.length) {
    const since = secondsSince(recent[0].created_at);
    if (since < RESEND_COOLDOWN_S) return { ok: false, error: 'cooldown', wait: RESEND_COOLDOWN_S - since };
  }
  if (recent.length >= MAX_PER_HOUR) return { ok: false, error: 'limit' };

  // Nouveau code, différent de tous les codes émis dans l'heure pour ce compte.
  const used = new Set(recent.map((r) => r.code_hash));
  let code, hash;
  do {
    code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    hash = hashCode(user.id, code);
  } while (used.has(hash));

  const verificationId = tx(() => {
    run(`UPDATE email_verifications SET invalidated_at = datetime('now')
         WHERE user_id = ? AND used_at IS NULL AND invalidated_at IS NULL`, user.id);
    return run(`INSERT INTO email_verifications (user_id, code_hash, expires_at) VALUES (?, ?, datetime('now', ?))`,
      user.id, hash, `+${CODE_TTL_MIN} minutes`).lastInsertRowid;
  });

  const lang = user.lang || 'fr';
  const { text, html } = render({
    lang, name: user.full_name,
    paragraphs: [t(lang, 'mail.verify_code_intro')],
    code,
    after: [t(lang, 'mail.verify_code_after', { min: CODE_TTL_MIN })]
  });
  const mail = await sendMail({
    to: user.email,
    subject: `${t(lang, 'mail.verify_code_subject')} — ${settings.get('site_name')}`,
    text, html, kind: 'verify_code', userId: user.id
  });
  run('UPDATE email_verifications SET email_log_id = ? WHERE id = ?', mail.id, verificationId);
  return { ok: true, mail };
}

/** Vérifie un code saisi. Retourne { ok } ou { ok:false, error:'invalid'|'expired'|'too_many', remaining } */
function verifyCode(user, input) {
  const code = String(input || '').replace(/\D/g, '');
  const v = one(`SELECT * FROM email_verifications WHERE user_id = ? AND used_at IS NULL AND invalidated_at IS NULL
    AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1`, user.id);
  if (!v) return { ok: false, error: 'expired' };
  if (v.attempts >= MAX_ATTEMPTS) return { ok: false, error: 'too_many' };
  const expected = Buffer.from(v.code_hash, 'hex');
  const given = Buffer.from(hashCode(user.id, code), 'hex');
  if (code.length !== 6 || !crypto.timingSafeEqual(expected, given)) {
    run('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ?', v.id);
    const remaining = MAX_ATTEMPTS - v.attempts - 1;
    return { ok: false, error: remaining > 0 ? 'invalid' : 'too_many', remaining };
  }
  tx(() => {
    run(`UPDATE email_verifications SET used_at = datetime('now') WHERE id = ?`, v.id);
    run(`UPDATE users SET email_verified_at = datetime('now') WHERE id = ?`, user.id);
  });
  return { ok: true };
}

module.exports = { issueCode, verifyCode, state, hashCode, CODE_TTL_MIN, MAX_ATTEMPTS, RESEND_COOLDOWN_S, MAX_PER_HOUR };
