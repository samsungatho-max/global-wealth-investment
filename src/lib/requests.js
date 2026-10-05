'use strict';
/**
 * Demandes déposées depuis la page Contact (porteurs de projets, demandes de financement, partenaires…).
 * Chaque demande reçoit un numéro de dossier unique, est confirmée par e-mail et notifiée à l'administration.
 */
const crypto = require('crypto');
const { one, all, run } = require('../db');
const { t } = require('../i18n');
const { parseAmount, money } = require('./money');
const { CODES, countryName } = require('./countries');
const { SECTORS } = require('./sectors');
const { sendMail } = require('./mailer');
const { render } = require('./email-template');
const settings = require('./settings');
const { baseUrl } = require('./notify');

const MOTIVES = ['project', 'funding', 'opportunity', 'investor', 'other'];
/** Motifs pour lesquels le dossier de financement complet est demandé. */
const FUNDING_MOTIVES = ['project', 'funding', 'opportunity'];
const STAGES = ['idea', 'plan', 'launch', 'operating', 'expansion'];
const STATUSES = ['new', 'review', 'info_requested', 'forwarded', 'closed'];
const SECTOR_CHOICES = [...SECTORS, 'other'];
const LANGS = ['fr', 'en', 'es', 'de'];

const isEmail = (s) => /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(s);
const clean = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const yesNo = (v) => (v === 'yes' ? 1 : v === 'no' ? 0 : null);

/** Valide le formulaire. Retourne { values (pour réaffichage), data (pour la base), errors (noms de champs) }. */
function validate(body, user) {
  const b = body || {};
  const motive = MOTIVES.includes(b.motive) ? b.motive : '';
  const funding = FUNDING_MOTIVES.includes(motive);
  const values = {
    motive,
    full_name: clean(b.full_name, 120),
    organisation: clean(b.organisation, 160),
    country: CODES.includes(b.country) ? b.country : '',
    city: clean(b.city, 100),
    email: clean(b.email, 200).toLowerCase(),
    phone: clean(b.phone, 30),
    sector: SECTOR_CHOICES.includes(b.sector) ? b.sector : '',
    nature: clean(b.nature, 200),
    amount: clean(b.amount, 30),
    own_funds: clean(b.own_funds, 30),
    duration: clean(b.duration, 4),
    description: String(b.description == null ? '' : b.description).trim().slice(0, 6000),
    stage: STAGES.includes(b.stage) ? b.stage : '',
    business_plan: ['yes', 'no'].includes(b.business_plan) ? b.business_plan : '',
    documents: ['yes', 'no'].includes(b.documents) ? b.documents : '',
    website: clean(b.website, 200),
    certify: b.certify === 'on'
  };
  const errors = [];
  const need = (field, ok) => { if (!ok) errors.push(field); };

  need('motive', motive);
  need('full_name', values.full_name.length >= 3);
  need('country', values.country);
  need('email', isEmail(values.email));
  need('description', values.description.length >= (funding ? 40 : 10));
  need('certify', values.certify);
  const phoneOk = /^\+?[\d\s().-]{6,28}$/.test(values.phone) && values.phone.replace(/\D/g, '').length >= 6;
  if (values.phone || funding) need('phone', phoneOk);

  let website = null;
  if (values.website) {
    const w = /^https?:\/\//i.test(values.website) ? values.website : `https://${values.website}`;
    try { const u = new URL(w); if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) throw new Error('url'); website = u.href.slice(0, 200); } catch { errors.push('website'); }
  }

  let amount = null, own = null, duration = null;
  if (funding) {
    need('city', values.city);
    need('sector', values.sector);
    need('nature', values.nature.length >= 3);
    amount = parseAmount(values.amount);
    need('amount', amount);
    if (values.own_funds === '' || /^0+([.,]0{1,2})?$/.test(values.own_funds)) own = 0;
    else { own = parseAmount(values.own_funds); need('own_funds', own); }
    duration = /^\d{1,3}$/.test(values.duration) ? Number(values.duration) : 0;
    need('duration', duration >= 1 && duration <= 600);
    need('stage', values.stage);
    need('business_plan', values.business_plan);
    need('documents', values.documents);
  }

  const data = {
    user_id: user ? user.id : null,
    motive,
    full_name: values.full_name,
    organisation: values.organisation || null,
    country: values.country,
    city: values.city || null,
    email: values.email,
    phone: values.phone || null,
    sector: funding ? values.sector : (values.sector || null),
    nature: funding ? values.nature : (values.nature || null),
    amount_cents: funding ? amount : null,
    own_funds_cents: funding ? own : null,
    duration_months: funding ? duration : null,
    description: values.description,
    stage: funding ? values.stage : null,
    has_business_plan: funding ? yesNo(values.business_plan) : null,
    has_documents: funding ? yesNo(values.documents) : null,
    website
  };
  return { values, data, errors };
}

/** Numéro de dossier : GP-AAMM-XXXXXX (alphabet sans caractères ambigus). */
function makeRef() {
  const d = new Date();
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[crypto.randomInt(alphabet.length)];
  return `GP-${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}-${s}`;
}

/** Enregistre la demande et retourne { id, ref }. L'unicité du numéro est garantie par la base. */
async function create(data, lang) {
  const cols = Object.keys(data);
  for (let attempt = 0; attempt < 6; attempt++) {
    const ref = makeRef();
    if (await one('SELECT id FROM requests WHERE ref = ?', ref)) continue;
    const info = await run(
      `INSERT INTO requests (ref, lang, certified_at, ${cols.join(', ')}) VALUES (?, ?, datetime('now'), ${cols.map(() => '?').join(', ')})`,
      ref, LANGS.includes(lang) ? lang : 'fr', ...cols.map((c) => data[c]));
    return { id: info.lastInsertRowid, ref };
  }
  throw new Error('Impossible d’attribuer un numéro de dossier');
}

/** E-mail de confirmation au demandeur. Retourne true si le message a été accepté par le serveur d'envoi. */
async function sendConfirmation(reqRow) {
  const lang = reqRow.lang;
  const { text, html } = render({
    lang, name: reqRow.full_name,
    paragraphs: [t(lang, 'req.mail_ref', { ref: reqRow.ref }), t(lang, 'req.sent_text')]
  });
  try {
    const log = await sendMail({ to: reqRow.email, subject: `${t(lang, 'req.mail_subject', { ref: reqRow.ref })} — ${settings.get('site_name')}`, text, html, kind: 'request_confirm', userId: reqRow.user_id || null });
    return !!log && ['relay_accepted', 'delivered'].includes(log.status);
  } catch (err) { console.error('[mail] confirmation de demande', err); return false; }
}

/** Notification interne + e-mail à chaque administrateur actif. */
async function notifyAdmins(reqRow) {
  const admins = await all(`SELECT id, email, full_name FROM users WHERE role = 'admin' AND status = 'active'`);
  const link = `/admin/requests/${reqRow.id}`;
  const motive = t('fr', `req.m_${reqRow.motive}`);
  const summary = `Nouvelle demande ${reqRow.ref} — ${motive} — ${reqRow.full_name}${reqRow.organisation ? ` (${reqRow.organisation})` : ''}, ${countryName(reqRow.country, 'fr')}`;
  for (const a of admins) {
    await run('INSERT INTO notifications (user_id, message, link) VALUES (?, ?, ?)', a.id, summary, link);
    const paragraphs = [summary + '.'];
    if (reqRow.amount_cents) paragraphs.push(`Montant recherché : ${money(reqRow.amount_cents, 'USD', 'fr')}.`);
    const { text, html } = render({ lang: 'fr', name: a.full_name, paragraphs, cta: { label: 'Ouvrir le dossier', url: baseUrl() + link } });
    try {
      await sendMail({ to: a.email, subject: `Nouvelle demande ${reqRow.ref} — ${settings.get('site_name')}`, text, html, kind: 'request_admin', userId: a.id });
    } catch (err) { console.error('[mail] notification de demande', err); }
  }
}

/** E-mail au demandeur lors d'un changement de statut accompagné d'un message de l'administration. */
async function sendUpdate(reqRow, message) {
  const lang = reqRow.lang;
  const { text, html } = render({
    lang, name: reqRow.full_name,
    paragraphs: [t(lang, 'req.mail_update_intro', { ref: reqRow.ref, status: t(lang, `req.s_${reqRow.status}`) }), ...String(message).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)]
  });
  return sendMail({ to: reqRow.email, subject: `${t(lang, 'req.mail_update_subject', { ref: reqRow.ref })} — ${settings.get('site_name')}`, text, html, kind: 'request_update', userId: reqRow.user_id || null });
}

module.exports = { MOTIVES, FUNDING_MOTIVES, STAGES, STATUSES, SECTOR_CHOICES, validate, create, sendConfirmation, notifyAdmins, sendUpdate };
