'use strict';
/** Notifications internes + e-mail, dans la langue de l'utilisateur. */
const { one, run } = require('../db');
const { t } = require('../i18n');
const { sendMail } = require('./mailer');
const { money } = require('./money');
const settings = require('./settings');

const baseUrl = () => (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');

function wrapMail(user, body) {
  const site = settings.get('site_name');
  return [
    t(user.lang, 'mail.greeting', { name: user.full_name }), '',
    body, '',
    t(user.lang, 'mail.security_note'), '',
    t(user.lang, 'mail.signature', { site })
  ].join('\n');
}

/**
 * Crée une notification pour l'utilisateur et lui envoie un e-mail.
 * `vars.amount_cents` est formaté automatiquement dans la langue du destinataire.
 */
function notify(userId, key, vars = {}, link = '/account') {
  const user = one('SELECT id, email, full_name, lang FROM users WHERE id = ?', userId);
  if (!user) return;
  const v = { note: '', ...vars };
  if (v.amount_cents != null) v.amount = money(v.amount_cents, 'EUR', user.lang);
  const message = t(user.lang, `notif.${key}`, v).trim();
  run('INSERT INTO notifications (user_id, message, link) VALUES (?, ?, ?)', user.id, message, link);
  const body = `${message}\n\n${t(user.lang, 'mail.open_account', { link: baseUrl() + link })}`;
  sendMail({ to: user.email, subject: `${settings.get('site_name')} — ${t(user.lang, 'mail.notif_subject')}`, text: wrapMail(user, body) });
}

module.exports = { notify, wrapMail, baseUrl };
