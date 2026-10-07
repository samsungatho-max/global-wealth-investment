'use strict';
/** Notifications internes + e-mail, dans la langue de l'utilisateur. */
const { one, run } = require('../db');
const { t } = require('../i18n');
const { sendMail } = require('./mailer');
const { render } = require('./email-template');
const { money } = require('./money');
const settings = require('./settings');

/** Adresse publique : BASE_URL, sinon domaine de production fourni par Vercel, sinon local. */
let publicHost = null;
/** Retient le nom de domaine public sur lequel le site est consulté (domaine personnalisé), pour les liens des e-mails. */
function rememberHost(req) {
  const host = String(req.get('host') || '').toLowerCase();
  if (/^[a-z0-9.-]+.[a-z]{2,}$/.test(host) && !/.vercel.app$|^localhost|^127./.test(host)) publicHost = host;
}
const baseUrl = () => (process.env.BASE_URL
  || (publicHost && `https://${publicHost}`)
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
  || (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`)
  || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');

/**
 * Crée une notification pour l'utilisateur et lui envoie un e-mail (journalisé).
 * `vars.amount_cents` est formaté automatiquement dans la langue du destinataire.
 */
async function notify(userId, key, vars = {}, link = '/account') {
  const user = await one('SELECT id, email, full_name, lang FROM users WHERE id = ?', userId);
  if (!user) return;
  const v = { note: '', ...vars };
  if (v.amount_cents != null) v.amount = money(v.amount_cents, 'USD', user.lang);
  const message = t(user.lang, `notif.${key}`, v).trim();
  await run('INSERT INTO notifications (user_id, message, link) VALUES (?, ?, ?)', user.id, message, link);
  const { text, html } = render({
    lang: user.lang, name: user.full_name,
    paragraphs: [message],
    cta: { label: t(user.lang, 'mail.open_account_btn'), url: baseUrl() + link }
  });
  // Envoi attendu (en serverless, une tâche non attendue peut être interrompue) ; le résultat est journalisé.
  try {
    await sendMail({ to: user.email, subject: `${settings.get('site_name')} — ${t(user.lang, 'mail.notif_subject')}`, text, html, kind: `notif:${key}`, userId: user.id });
  } catch (err) { console.error('[mail] notification', err); }
}

module.exports = { notify, baseUrl, rememberHost };
