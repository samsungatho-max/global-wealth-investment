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
    project_name: clean(b.project_name, 160),
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
    project_name: values.project_name || null,
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

const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const yn = (v) => (v === 1 ? 'Oui' : v === 0 ? 'Non' : '—');
const attachmentsOf = (reqRow) => { try { return JSON.parse(reqRow.attachments || '[]'); } catch { return []; } };

/** Toutes les informations saisies par le demandeur, dans l'ordre du formulaire : [libellé, valeur]. */
function details(reqRow) {
  const when = new Date(String(reqRow.created_at).replace(' ', 'T') + 'Z');
  const date = Number.isNaN(when.getTime()) ? reqRow.created_at
    : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' }).format(when) + ' (UTC)';
  const files = attachmentsOf(reqRow);
  const usd = (c) => (c == null ? '—' : money(c, 'USD', 'fr'));
  return [
    ['Numéro de dossier', reqRow.ref],
    ['Date et heure de soumission', date],
    ['Type de demande', t('fr', `req.m_${reqRow.motive}`)],
    ['Nom et prénom', reqRow.full_name],
    ['Entreprise / organisation', reqRow.organisation || '—'],
    ['Pays', countryName(reqRow.country, 'fr')],
    ['Ville', reqRow.city || '—'],
    ['Adresse e-mail', reqRow.email],
    ['Téléphone / WhatsApp', reqRow.phone || '—'],
    ['Secteur d’activité', reqRow.sector ? (reqRow.sector === 'other' ? 'Autre secteur' : t('fr', `sector.${reqRow.sector}`)) : '—'],
    ['Nom du projet', reqRow.project_name || '—'],
    ['Nature du projet', reqRow.nature || '—'],
    ['Montant de financement recherché (USD)', usd(reqRow.amount_cents)],
    ['Apport ou financement déjà disponible (USD)', usd(reqRow.own_funds_cents)],
    ['Durée prévisionnelle', reqRow.duration_months ? `${reqRow.duration_months} mois` : '—'],
    ['Niveau d’avancement du projet', reqRow.stage ? t('fr', `req.st_${reqRow.stage}`) : '—'],
    ['Business plan disponible', yn(reqRow.has_business_plan)],
    ['Documents justificatifs disponibles', yn(reqRow.has_documents)],
    ['Site internet', reqRow.website || '—'],
    ['Documents joints', files.length ? files.map((f) => `${f.name} (${Math.max(1, Math.round(f.size / 1024))} Ko)`).join(', ') : 'Aucun'],
    ['Langue du formulaire', String(reqRow.lang || '').toUpperCase()]
  ];
}

/** Adresses qui reçoivent chaque demande : celles des Paramètres, sinon les administrateurs actifs. */
async function recipients() {
  const admins = await all(`SELECT id, email, full_name FROM users WHERE role = 'admin' AND status = 'active'`);
  const configured = String(settings.get('notify_emails') || '').split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(isEmail);
  return { admins, emails: configured.length ? [...new Set(configured)] : [...new Set(admins.map((x) => x.email))] };
}

/**
 * Nouvelle demande : notification interne aux administrateurs et e-mail complet (toutes les informations saisies,
 * documents en pièces jointes) à l'adresse de réception. Retourne { total, sent } pour signaler un échec d'envoi.
 */
async function notifyAdmins(reqRow) {
  const { admins, emails } = await recipients();
  const link = `/admin/requests/${reqRow.id}`;
  const site = settings.get('site_name');
  const motive = t('fr', `req.m_${reqRow.motive}`);
  const summary = `Nouvelle demande ${reqRow.ref} — ${motive} — ${reqRow.full_name}${reqRow.organisation ? ` (${reqRow.organisation})` : ''}, ${countryName(reqRow.country, 'fr')}`;
  for (const adm of admins) await run('INSERT INTO notifications (user_id, message, link) VALUES (?, ?, ?)', adm.id, summary, link);

  const rows = details(reqRow);
  const label = reqRow.amount_cents != null ? 'Description du projet' : 'Message du demandeur';
  const intro = `Une nouvelle demande vient d’être reçue via le formulaire Contact du site ${site}.`;
  const url = baseUrl() + link;
  const text = [
    `NOUVELLE DEMANDE REÇUE VIA LE SITE — ${reqRow.ref}`, '', intro, '',
    ...rows.map(([k, v]) => `${k} : ${v}`), '',
    `${label} :`, reqRow.description, '',
    `Ouvrir le dossier dans l’administration : ${url}`,
    `Pour répondre au demandeur, répondez simplement à cet e-mail (${reqRow.email}).`
  ].join('\n');
  const font = 'font-family:Arial,Helvetica,sans-serif;';
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(reqRow.ref)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;background:#ffffff;border-radius:10px;">
<tr><td style="background:#0a1628;padding:22px 28px;border-radius:10px 10px 0 0;">
  <div style="${font}font-size:12px;letter-spacing:2px;color:#d7bd8a;text-transform:uppercase;">Nouvelle demande reçue via le site</div>
  <div style="${font}font-size:22px;font-weight:bold;color:#ffffff;margin-top:6px;">Dossier ${esc(reqRow.ref)}</div>
</td></tr>
<tr><td style="padding:26px 28px 8px;">
  <p style="margin:0 0 18px;${font}font-size:15px;line-height:1.6;color:#1f2937;">${esc(intro)}</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
  ${rows.map(([k, v]) => `<tr><td style="padding:8px 10px 8px 0;border-bottom:1px solid #e5e7eb;${font}font-size:13px;color:#6b7280;width:44%;vertical-align:top;">${esc(k)}</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;${font}font-size:14px;color:#0a1628;font-weight:bold;vertical-align:top;">${esc(v)}</td></tr>`).join('\n  ')}
  </table>
  <p style="margin:22px 0 8px;${font}font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">${esc(label)}</p>
  <div style="${font}font-size:14px;line-height:1.6;color:#1f2937;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;white-space:pre-wrap;">${esc(reqRow.description)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 10px;"><tr><td style="background:#c9a96e;border-radius:6px;"><a href="${esc(url)}" style="display:inline-block;padding:12px 24px;${font}font-size:15px;font-weight:bold;color:#0a1628;text-decoration:none;">Ouvrir le dossier</a></td></tr></table>
  <p style="margin:0 0 18px;${font}font-size:12px;line-height:1.5;color:#6b7280;">Pour répondre au demandeur, répondez simplement à cet e-mail : votre réponse partira vers ${esc(reqRow.email)}. Informations déclarées par le demandeur, non vérifiées à ce stade.</p>
</td></tr></table></td></tr></table></body></html>`;

  const attachments = [];
  for (const f of attachmentsOf(reqRow)) {
    const file = await one('SELECT mime, data FROM files WHERE id = ?', f.id);
    if (file) attachments.push({ filename: f.name, content: Buffer.from(file.data), contentType: file.mime });
  }
  let sent = 0;
  for (const to of emails) {
    const adm = admins.find((x) => x.email === to);
    try {
      const log = await sendMail({ to, subject: `Nouvelle demande ${reqRow.ref} reçue via le site — ${reqRow.full_name}`, text, html, kind: 'request_admin', userId: adm ? adm.id : null, attachments, replyTo: reqRow.email });
      if (log && ['relay_accepted', 'delivered'].includes(log.status)) sent++;
    } catch (err) { console.error('[mail] notification de demande', err); }
  }
  if (sent < emails.length) console.error(`[demande] ${reqRow.ref} : ${emails.length - sent} e-mail(s) de notification non envoyé(s) sur ${emails.length} — la demande reste enregistrée et visible dans l'administration.`);
  return { total: emails.length, sent };
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
