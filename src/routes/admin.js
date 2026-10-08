'use strict';
/**
 * Espace d'administration (interface en français). Accès réservé au rôle admin.
 * Toute opération sensible est tracée dans audit_log (table en ajout seul).
 */
const express = require('express');
const { one, all, run, tx } = require('../db');
const { requireAdmin, verifyCsrf, makeUploader, sendStoredFile, removeFile } = require('../lib/security');
const { audit } = require('../lib/audit');
const { notify } = require('../lib/notify');
const { parseAmount } = require('../lib/money');
const { parseI18n, rawI18n, i18nFromBody, slugify, LANGS } = require('../lib/content');
const ledger = require('../lib/ledger');
const settings = require('../lib/settings');
const { refreshRates } = require('../lib/rates');
const mailer = require('../lib/mailer');
const { sendMail } = mailer;
const { render: renderEmail } = require('../lib/email-template');
const { checkDomain } = require('../lib/dns-check');
const verification = require('../lib/verification');
const newsLib = require('../lib/news');
const { makeReference } = require('./account');
const { SECTORS } = require('./public');
const { countryName } = require('../lib/countries');

const router = express.Router();
router.use(requireAdmin);
router.use(async (req, res, next) => { res.locals.section = 'admin'; res.locals.countryName = (c) => countryName(c, 'fr'); next(); });

const PROJECT_FIELDS = ['title', 'summary', 'location', 'objective', 'description', 'funding_type', 'stage', 'potential', 'conditions', 'fees'];
/** Origine et traçabilité d'un projet (informations internes : source, référence, date de vérification, note de contrôle). */
async function saveProjectOrigin(id, body) {
  const text = (v, max) => String(v || '').trim().slice(0, max) || null;
  let src = text(body.source_url, 500);
  if (src && !/^https?:\/\//i.test(src)) src = null;
  await run(`UPDATE projects SET kind = ?, promoter = ?, source_name = ?, source_url = ?, source_ref = ?, verified_at = ?, internal_note = ? WHERE id = ?`,
    body.kind === 'referenced' ? 'referenced' : 'own', text(body.promoter, 300), text(body.source_name, 200), src, text(body.source_ref, 80),
    isDateStr(body.verified_at) ? body.verified_at : null, text(body.internal_note, 4000), id);
}
const isDateStr = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(s));
const NEWS_FIELDS = ['title', 'summary', 'body', 'figures', 'chart_title', 'chart_unit', 'chart', 'takeaways', 'risks'];
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(s));
const today = () => new Date().toISOString().slice(0, 10);
const back = (req, fallback) => { const r = req.get('referer'); return r && r.includes(req.get('host')) ? r : fallback; };

const removePublicFile = (id) => removeFile(id).catch(() => {});

// ---------- Tableau de bord ----------
router.get('/', async (req, res) => {
  const s = await one(`SELECT
    (SELECT COUNT(*) FROM users WHERE role = 'investor') AS investors,
    (SELECT COUNT(*) FROM kyc_submissions WHERE status = 'pending') AS kyc,
    (SELECT COUNT(*) FROM transactions WHERE type = 'deposit' AND status = 'pending') AS deposits,
    (SELECT COUNT(*) FROM transactions WHERE type = 'withdrawal' AND status IN ('pending','processing')) AS withdrawals,
    (SELECT COUNT(*) FROM messages WHERE status = 'new') AS messages,
    (SELECT COUNT(*) FROM requests WHERE status = 'new') AS requests,
    (SELECT COUNT(*) FROM interests WHERE status = 'new') AS interests,
    (SELECT COUNT(*) FROM projects WHERE status = 'open') AS projects,
    (SELECT COUNT(*) FROM projects WHERE is_demo = 1 AND status IN ('open','closed')) AS demo,
    (SELECT COALESCE(SUM(amount_cents),0) FROM investments WHERE status = 'active') AS invested,
    (SELECT COALESCE(SUM(amount_cents),0) FROM transactions WHERE type = 'deposit' AND status = 'confirmed') AS deposited,
    (SELECT COUNT(*) FROM login_attempts WHERE success = 0 AND created_at > datetime('now','-24 hours')) AS "failedLogins"`);
  res.render('admin/dashboard', {
    title: 'Tableau de bord',
    stats: s,
    fundsEnabled: settings.get('funds_enabled'),
    mailEnabled: mailer.config().enabled,
    notifyEmails: settings.get('notify_emails'),
    audits: await all('SELECT * FROM audit_log ORDER BY id DESC LIMIT 12')
  });
});

// ---------- Projets ----------
const projectUpload = makeUploader({ image: 'image' });

router.get('/projects', async (req, res) => {
  const rows = await Promise.all((await all('SELECT * FROM projects ORDER BY status = \'archived\', updated_at DESC'))
    .map(async (p) => ({ ...p, tr: parseI18n(p.i18n, 'fr'), raised: await ledger.raisedForProject(p.id) })));
  res.render('admin/projects', { title: 'Projets d\'investissement', rows });
});

router.get('/projects/new', async (req, res) => {
  res.render('admin/project-form', { title: 'Nouveau projet', p: { i18n: {}, risk_level: 3, duration_months: 12, status: 'draft' }, docs: [], sectors: SECTORS, langs: LANGS, photoKeys: PHOTO_KEYS });
});

function projectFromBody(body) {
  return {
    sector: SECTORS.includes(body.sector) ? body.sector : null,
    country: String(body.country || '').trim().slice(0, 80),
    target: parseAmount(body.target),
    ticket: body.min_ticket ? parseAmount(body.min_ticket) : 0,
    duration: Math.max(1, Math.min(600, parseInt(body.duration_months, 10) || 0)),
    risk: Math.max(1, Math.min(5, parseInt(body.risk_level, 10) || 3)),
    i18n: i18nFromBody(body, PROJECT_FIELDS),
    photo_key: Object.prototype.hasOwnProperty.call(require('../lib/photos').PHOTOS, body.photo_key) ? body.photo_key : null,
    is_demo: body.is_demo === 'on' ? 1 : 0
  };
}

router.post('/projects', projectUpload.single('image'), verifyCsrf, async (req, res) => {
  const d = projectFromBody(req.body);
  if (!d.sector || !d.country || !d.target || d.ticket === null || !(d.i18n.en.title || d.i18n.fr.title)) {
    if (req.file) removePublicFile(req.file.filename);
    req.flash('error', 'Secteur, pays, montant recherché et nom du projet (onglet EN) sont obligatoires.');
    return res.redirect('/admin/projects/new');
  }
  const publish = req.body.publish === '1';
  let slug = slugify(d.i18n.en.title || d.i18n.fr.title);
  if (await one('SELECT id FROM projects WHERE slug = ?', slug)) slug += '-' + Date.now().toString(36);
  const info = await run(`INSERT INTO projects (slug, sector, country, i18n, target_cents, min_ticket_cents, duration_months, risk_level, image_path, photo_key, status, is_demo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    slug, d.sector, d.country, JSON.stringify(d.i18n), d.target, d.ticket, d.duration, d.risk, req.file ? req.file.filename : null, d.photo_key, publish ? 'open' : 'draft', d.is_demo);
  await saveProjectOrigin(info.lastInsertRowid, req.body);
  await audit(req, 'project.create', 'project', info.lastInsertRowid, { slug, status: publish ? 'open' : 'draft' });
  req.flash('success', publish ? 'Projet créé et publié : il est visible sur le site.' : 'Projet enregistré en brouillon : il n\'est PAS encore visible sur le site. Cliquez sur « Publier / ouvrir » pour l\'afficher.');
  res.redirect(`/admin/projects/${info.lastInsertRowid}/edit`);
});

router.get('/projects/:id/edit', async (req, res, next) => {
  const p = await one('SELECT * FROM projects WHERE id = ?', req.params.id);
  if (!p) return next();
  res.render('admin/project-form', {
    title: 'Modifier le projet',
    p: { ...p, i18n: rawI18n(p.i18n) },
    raised: await ledger.raisedForProject(p.id),
    docs: await all('SELECT * FROM project_documents WHERE project_id = ? ORDER BY created_at DESC', p.id),
    sectors: SECTORS, langs: LANGS, photoKeys: PHOTO_KEYS
  });
});

router.post('/projects/:id', projectUpload.single('image'), verifyCsrf, async (req, res, next) => {
  const p = await one('SELECT * FROM projects WHERE id = ?', req.params.id);
  if (!p) return next();
  const d = projectFromBody(req.body);
  if (!d.sector || !d.country || !d.target || d.ticket === null || !(d.i18n.en.title || d.i18n.fr.title)) {
    if (req.file) removePublicFile(req.file.filename);
    req.flash('error', 'Secteur, pays, montant recherché et nom du projet (onglet EN) sont obligatoires.');
    return res.redirect(`/admin/projects/${p.id}/edit`);
  }
  let image = p.image_path;
  if (req.file) { removePublicFile(p.image_path); image = req.file.filename; }
  if (req.body.remove_image === 'on' && !req.file) { removePublicFile(p.image_path); image = null; }
  await run(`UPDATE projects SET sector = ?, country = ?, i18n = ?, target_cents = ?, min_ticket_cents = ?, duration_months = ?, risk_level = ?,
       image_path = ?, photo_key = ?, is_demo = ?, updated_at = datetime('now') WHERE id = ?`,
    d.sector, d.country, JSON.stringify(d.i18n), d.target, d.ticket, d.duration, d.risk, image, d.photo_key, d.is_demo, p.id);
  await saveProjectOrigin(p.id, req.body);
  await audit(req, 'project.update', 'project', p.id, { target_cents: d.target, risk: d.risk });
  req.flash('success', 'Projet enregistré.');
  res.redirect(`/admin/projects/${p.id}/edit`);
});

router.post('/projects/:id/status', async (req, res, next) => {
  const p = await one('SELECT * FROM projects WHERE id = ?', req.params.id);
  const status = String(req.body.status || '');
  if (!p || !['draft', 'open', 'suspended', 'closed', 'archived'].includes(status)) return next();
  await run(`UPDATE projects SET status = ?, updated_at = datetime('now') WHERE id = ?`, status, p.id);
  await audit(req, 'project.status', 'project', p.id, { from: p.status, to: status });
  req.flash('success', `Statut du projet mis à jour : ${status}.`);
  res.redirect(back(req, '/admin/projects'));
});

const docUpload = makeUploader({ file: 'doc' });

router.post('/projects/:id/documents', docUpload.single('file'), verifyCsrf, async (req, res, next) => {
  const p = await one('SELECT id FROM projects WHERE id = ?', req.params.id);
  if (!p) return next();
  const title = String(req.body.title || '').trim().slice(0, 200);
  if (!req.file || !title) { req.flash('error', 'Titre et fichier obligatoires.'); return res.redirect(`/admin/projects/${p.id}/edit#docs`); }
  const visibility = req.body.visibility === 'public' ? 'public' : 'investors';
  const info = await run('INSERT INTO project_documents (project_id, title, file_path, original_name, visibility) VALUES (?, ?, ?, ?, ?)',
    p.id, title, req.file.filename, req.file.originalname.slice(0, 200), visibility);
  await audit(req, 'project.document.add', 'project', p.id, { doc: info.lastInsertRowid, title });
  req.flash('success', 'Document ajouté.');
  res.redirect(`/admin/projects/${p.id}/edit#docs`);
});

router.post('/projects/:id/documents/:docId/delete', async (req, res, next) => {
  const d = await one('SELECT * FROM project_documents WHERE id = ? AND project_id = ?', req.params.docId, req.params.id);
  if (!d) return next();
  await run('DELETE FROM project_documents WHERE id = ?', d.id);
  await removeFile(d.file_path);
  await audit(req, 'project.document.remove', 'project', d.project_id, { title: d.title });
  req.flash('success', 'Document retiré.');
  res.redirect(`/admin/projects/${d.project_id}/edit#docs`);
});

// ---------- Manifestations d'intérêt ----------
router.get('/interests', async (req, res) => {
  const rows = (await all(`SELECT i.*, p.i18n AS p_i18n, p.slug FROM interests i JOIN projects p ON p.id = i.project_id ORDER BY i.created_at DESC LIMIT 300`))
    .map((r) => ({ ...r, project: parseI18n(r.p_i18n, 'fr').title }));
  res.render('admin/interests', { title: 'Manifestations d\'intérêt', rows });
});

router.post('/interests/:id/status', async (req, res) => {
  const status = ['new', 'contacted', 'converted', 'declined'].includes(req.body.status) ? req.body.status : null;
  if (status) {
    await run('UPDATE interests SET status = ? WHERE id = ?', status, req.params.id);
    await audit(req, 'interest.status', 'interest', req.params.id, { status });
  }
  res.redirect('/admin/interests');
});

// ---------- Investisseurs ----------
router.get('/users', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const kyc = ['none', 'pending', 'approved', 'rejected'].includes(req.query.kyc) ? req.query.kyc : null;
  let sql = 'SELECT * FROM users WHERE 1=1';
  const params = [];
  if (q) { sql += ' AND (email ILIKE ? OR full_name ILIKE ? OR phone ILIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (kyc) { sql += ' AND kyc_status = ?'; params.push(kyc); }
  sql += ' ORDER BY created_at DESC LIMIT 300';
  const rows = await Promise.all((await all(sql, ...params)).map(async (u) => ({ ...u, cash: await ledger.cashBalance(u.id) })));
  res.render('admin/users', { title: 'Investisseurs', rows, q, kyc });
});

router.get('/users/:id', async (req, res, next) => {
  const u = await one('SELECT * FROM users WHERE id = ?', req.params.id);
  if (!u) return next();
  const openProjects = (await all(`SELECT id, i18n, duration_months, min_ticket_cents FROM projects WHERE status = 'open' ORDER BY created_at DESC`))
    .map((p) => ({ ...p, title: parseI18n(p.i18n, 'fr').title }));
  res.render('admin/user', {
    title: u.full_name,
    u,
    s: await ledger.summary(u.id, 'fr'),
    history: await ledger.valuationHistory(u.id, 'fr'),
    txs: await all('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 100', u.id),
    kycs: await all('SELECT * FROM kyc_submissions WHERE user_id = ? ORDER BY id DESC', u.id),
    docs: await all('SELECT * FROM user_documents WHERE user_id = ? ORDER BY created_at DESC', u.id),
    logins: await all('SELECT * FROM login_attempts WHERE lower(email) = lower(?) ORDER BY id DESC LIMIT 15', u.email),
    openProjects,
    today: today()
  });
});

router.post('/users/:id/status', async (req, res, next) => {
  const u = await one('SELECT * FROM users WHERE id = ?', req.params.id);
  const status = req.body.status === 'suspended' ? 'suspended' : 'active';
  if (!u) return next();
  if (u.id === req.user.id) { req.flash('error', 'Vous ne pouvez pas suspendre votre propre compte.'); return res.redirect(`/admin/users/${u.id}`); }
  await run('UPDATE users SET status = ? WHERE id = ?', status, u.id);
  if (status === 'suspended') await run(`DELETE FROM sessions WHERE json_extract(sess, '$.userId') = ?`, u.id);
  await audit(req, 'user.status', 'user', u.id, { status });
  req.flash('success', status === 'suspended' ? 'Compte suspendu.' : 'Compte réactivé.');
  res.redirect(`/admin/users/${u.id}`);
});

router.post('/users/:id/role', async (req, res, next) => {
  const u = await one('SELECT * FROM users WHERE id = ?', req.params.id);
  const role = req.body.role === 'admin' ? 'admin' : 'investor';
  if (!u) return next();
  if (u.id === req.user.id) { req.flash('error', 'Vous ne pouvez pas modifier votre propre rôle.'); return res.redirect(`/admin/users/${u.id}`); }
  await run('UPDATE users SET role = ? WHERE id = ?', role, u.id);
  await run(`DELETE FROM sessions WHERE json_extract(sess, '$.userId') = ?`, u.id);
  await audit(req, 'user.role', 'user', u.id, { role });
  req.flash('success', `Rôle mis à jour : ${role}.`);
  res.redirect(`/admin/users/${u.id}`);
});

router.post('/users/:id/verify-email', async (req, res, next) => {
  const u = await one('SELECT * FROM users WHERE id = ?', req.params.id);
  if (!u) return next();
  await run(`UPDATE users SET email_verified_at = COALESCE(email_verified_at, datetime('now')), email_verify_token_hash = NULL WHERE id = ?`, u.id);
  await audit(req, 'user.verify_email_manual', 'user', u.id);
  req.flash('success', 'Adresse e-mail marquée comme vérifiée.');
  res.redirect(`/admin/users/${u.id}`);
});

router.post('/users/:id/resend-code', async (req, res, next) => {
  try {
    const u = await one('SELECT * FROM users WHERE id = ?', req.params.id);
    if (!u) return next();
    const r = await verification.issueCode(u);
    await audit(req, 'user.verification_code_resend', 'user', u.id, { result: r.ok ? r.mail.status : r.error });
    if (!r.ok) req.flash('error', r.error === 'cooldown' ? `Patientez ${r.wait} s avant un nouvel envoi.` : r.error === 'limit' ? 'Plafond de 5 codes par heure atteint.' : 'Adresse déjà confirmée.');
    else if (['relay_accepted', 'delivered'].includes(r.mail.status)) req.flash('success', `Nouveau code envoyé : accepté par le serveur SMTP (journal #${r.mail.id}).`);
    else req.flash('error', `Code généré mais e-mail NON envoyé (${r.mail.status}) : ${r.mail.error || ''}`);
    res.redirect(`/admin/users/${u.id}`);
  } catch (e) { next(e); }
});

router.post('/users/:id/documents', docUpload.single('file'), verifyCsrf, async (req, res, next) => {
  const u = await one('SELECT id FROM users WHERE id = ?', req.params.id);
  if (!u) return next();
  const title = String(req.body.title || '').trim().slice(0, 200);
  const category = ['contract', 'statement', 'other'].includes(req.body.category) ? req.body.category : 'other';
  if (!req.file || !title) { req.flash('error', 'Titre et fichier obligatoires.'); return res.redirect(`/admin/users/${u.id}#docs`); }
  const info = await run('INSERT INTO user_documents (user_id, title, category, file_path, original_name, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
    u.id, title, category, req.file.filename, req.file.originalname.slice(0, 200), req.user.id);
  await audit(req, 'user.document.add', 'user', u.id, { doc: info.lastInsertRowid, title, category });
  await notify(u.id, 'document_added', { title }, '/account/documents');
  req.flash('success', 'Document ajouté et investisseur notifié.');
  res.redirect(`/admin/users/${u.id}#docs`);
});

router.get('/users/:id/documents/:docId', async (req, res, next) => {
  const d = await one('SELECT * FROM user_documents WHERE id = ? AND user_id = ?', req.params.docId, req.params.id);
  if (!d) return next();
  await sendStoredFile(res, d.file_path, d.original_name);
});

// Enregistrement d'un investissement : débite le solde disponible du client (écriture confirmée).
// Dépôt reçu hors ligne : l'administration l'enregistre « en attente », puis le confirme après contrôle du relevé bancaire.
router.post('/users/:id/deposits', async (req, res, next) => {
  try {
    const u = await one('SELECT * FROM users WHERE id = ?', req.params.id);
    if (!u) return next();
    const cents = parseAmount(req.body.amount);
    if (!cents) { req.flash('error', 'Montant du dépôt invalide.'); return res.redirect(`/admin/users/${u.id}`); }
    if (!settings.get('funds_enabled')) { req.flash('error', 'La réception de fonds n\'est pas activée dans les Paramètres.'); return res.redirect(`/admin/users/${u.id}`); }
    const reference = makeReference('DEP');
    const info = await run(`INSERT INTO transactions (user_id, type, amount_cents, status, reference, method) VALUES (?, 'deposit', ?, 'pending', ?, 'bank_transfer')`, u.id, cents, reference);
    await audit(req, 'deposit.record', 'transaction', info.lastInsertRowid, { reference, amount_cents: cents, user_id: u.id });
    req.flash('success', `Dépôt ${reference} enregistré « en attente ». Confirmez-le dans « Dépôts & retraits » après contrôle du relevé bancaire.`);
    res.redirect('/admin/transactions?type=deposit&status=pending');
  } catch (e) { next(e); }
});

router.post('/users/:id/investments', async (req, res, next) => {
  const u = await one('SELECT * FROM users WHERE id = ?', req.params.id);
  if (!u) return next();
  const project = await one(`SELECT * FROM projects WHERE id = ? AND status = 'open'`, req.body.project_id);
  const cents = parseAmount(req.body.amount);
  const start = isDate(req.body.start_date) ? req.body.start_date : null;
  const end = isDate(req.body.end_date) ? req.body.end_date : null;
  const fail = (m) => { req.flash('error', m); res.redirect(`/admin/users/${u.id}#invest`); };
  if (u.kyc_status !== 'approved') return fail('L\'identité de l\'investisseur doit être vérifiée.');
  if (!project || !cents || !start || !end || end <= start) return fail('Projet ouvert, montant et dates valides obligatoires.');
  if (project.is_demo) return fail('Impossible d\'investir dans une fiche de démonstration.');
  if (project.kind === 'referenced') return fail('Impossible d\'investir dans un projet international référencé : la plateforme n\'en est pas le promoteur.');
  if (cents < project.min_ticket_cents) return fail('Montant inférieur au ticket minimum du projet.');
  const title = parseI18n(project.i18n, 'fr').title;
  const invId = await tx(async () => {
    await one('SELECT id FROM users WHERE id = ? FOR UPDATE', u.id);
    if (cents > await ledger.availableBalance(u.id)) return null;
    const inv = (await run(`INSERT INTO investments (user_id, project_id, amount_cents, start_date, end_date, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
      u.id, project.id, cents, start, end, req.user.id)).lastInsertRowid;
    await run(`INSERT INTO transactions (user_id, type, amount_cents, status, reference, method, investment_id, admin_note, processed_at, processed_by)
         VALUES (?, 'investment', ?, 'confirmed', ?, 'internal', ?, ?, datetime('now'), ?)`,
      u.id, cents, makeReference('INV'), inv, title, req.user.id);
    return inv;
  });
  if (!invId) return fail('Solde disponible insuffisant : le dépôt correspondant doit d\'abord être confirmé.');
  await audit(req, 'investment.create', 'investment', invId, { user: u.id, project: project.id, amount_cents: cents });
  await notify(u.id, 'investment_created', { amount_cents: cents, project: parseI18n(project.i18n, u.lang).title }, '/account/investments');
  req.flash('success', 'Investissement enregistré.');
  res.redirect(`/admin/users/${u.id}#invest`);
});

// Valorisation datée (valeur réelle constatée) d'un investissement.
router.post('/investments/:id/valuations', async (req, res, next) => {
  const inv = await one('SELECT i.*, p.i18n AS p_i18n FROM investments i JOIN projects p ON p.id = i.project_id WHERE i.id = ?', req.params.id);
  if (!inv) return next();
  const value = req.body.value === '0' ? 0 : parseAmount(req.body.value);
  const date = isDate(req.body.date) ? req.body.date : null;
  const note = String(req.body.note || '').trim().slice(0, 500);
  if (value === null || !date || date < inv.start_date || date > today()) {
    req.flash('error', 'Valeur et date valides obligatoires (date comprise entre le début de l\'investissement et aujourd\'hui).');
    return res.redirect(`/admin/users/${inv.user_id}#invest`);
  }
  if (!note) {
    req.flash('error', 'Indiquez la source ou la justification de la valorisation.');
    return res.redirect(`/admin/users/${inv.user_id}#invest`);
  }
  const info = await run('INSERT INTO valuations (investment_id, value_cents, valuation_date, note, created_by) VALUES (?, ?, ?, ?, ?)',
    inv.id, value, date, note, req.user.id);
  await audit(req, 'valuation.create', 'investment', inv.id, { valuation: info.lastInsertRowid, value_cents: value, date });
  const u = await one('SELECT lang FROM users WHERE id = ?', inv.user_id);
  await notify(inv.user_id, 'valuation', { project: parseI18n(inv.p_i18n, u.lang).title, date }, '/account/investments');
  req.flash('success', 'Valorisation enregistrée.');
  res.redirect(`/admin/users/${inv.user_id}#invest`);
});

// Échéance : versement confirmé du montant final sur le compte du client.
router.post('/investments/:id/mature', async (req, res, next) => {
  const inv = await one(`SELECT i.*, p.i18n AS p_i18n FROM investments i JOIN projects p ON p.id = i.project_id WHERE i.id = ? AND i.status = 'active'`, req.params.id);
  if (!inv) return next();
  const payout = req.body.payout === '0' ? 0 : parseAmount(req.body.payout);
  const date = isDate(req.body.date) ? req.body.date : today();
  const note = String(req.body.note || '').trim().slice(0, 500);
  if (payout === null || !note || req.body.verified !== 'on') {
    req.flash('error', 'Montant final, justification et confirmation de contrôle obligatoires.');
    return res.redirect(`/admin/users/${inv.user_id}#invest`);
  }
  await tx(async () => {
    await run(`UPDATE investments SET status = 'matured' WHERE id = ?`, inv.id);
    await run('INSERT INTO valuations (investment_id, value_cents, valuation_date, note, created_by) VALUES (?, ?, ?, ?, ?)',
      inv.id, payout, date, `Valeur finale à l'échéance — ${note}`, req.user.id);
    if (payout > 0) {
      await run(`INSERT INTO transactions (user_id, type, amount_cents, status, reference, method, investment_id, admin_note, processed_at, processed_by)
           VALUES (?, 'payout', ?, 'confirmed', ?, 'internal', ?, ?, datetime('now'), ?)`,
        inv.user_id, payout, makeReference('PAY'), inv.id, note, req.user.id);
    }
  });
  await audit(req, 'investment.mature', 'investment', inv.id, { payout_cents: payout, date });
  const u = await one('SELECT lang FROM users WHERE id = ?', inv.user_id);
  await notify(inv.user_id, 'investment_matured', { amount_cents: payout, project: parseI18n(inv.p_i18n, u.lang).title }, '/account/investments');
  req.flash('success', 'Investissement clôturé à l\'échéance.');
  res.redirect(`/admin/users/${inv.user_id}#invest`);
});

// ---------- KYC ----------
router.get('/kyc', async (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  const rows = await all(`SELECT k.*, u.full_name, u.email, u.country FROM kyc_submissions k JOIN users u ON u.id = k.user_id
    WHERE k.status = ? ORDER BY k.created_at ${status === 'pending' ? 'ASC' : 'DESC'} LIMIT 200`, status);
  res.render('admin/kyc', { title: 'Vérifications d\'identité', rows, status });
});

router.get('/kyc/:id/file/:which', async (req, res, next) => {
  const k = await one('SELECT * FROM kyc_submissions WHERE id = ?', req.params.id);
  if (!k || !['id', 'address'].includes(req.params.which)) return next();
  const file = req.params.which === 'id' ? k.id_file : k.address_file;
  const name = req.params.which === 'id' ? k.id_file_name : k.address_file_name;
  await audit(req, 'kyc.document.view', 'kyc', k.id, { which: req.params.which });
  await sendStoredFile(res, file, name || file);
});

router.post('/kyc/:id/review', async (req, res, next) => {
  const k = await one(`SELECT * FROM kyc_submissions WHERE id = ? AND status = 'pending'`, req.params.id);
  if (!k) return next();
  const decision = req.body.decision === 'approve' ? 'approved' : req.body.decision === 'reject' ? 'rejected' : null;
  const note = String(req.body.note || '').trim().slice(0, 1000);
  if (!decision || (decision === 'rejected' && !note)) {
    req.flash('error', 'Décision requise ; un motif est obligatoire en cas de refus.');
    return res.redirect('/admin/kyc');
  }
  await tx(async () => {
    await run(`UPDATE kyc_submissions SET status = ?, reviewer_id = ?, review_note = ?, reviewed_at = datetime('now') WHERE id = ?`,
      decision, req.user.id, note || null, k.id);
    await run('UPDATE users SET kyc_status = ? WHERE id = ?', decision, k.user_id);
  });
  await audit(req, `kyc.${decision}`, 'kyc', k.id, { user: k.user_id, note });
  await notify(k.user_id, decision === 'approved' ? 'kyc_approved' : 'kyc_rejected', { note }, '/account/kyc');
  req.flash('success', decision === 'approved' ? 'Identité validée.' : 'Vérification refusée.');
  res.redirect('/admin/kyc');
});

// ---------- Transactions (dépôts / retraits) ----------
router.get('/transactions', async (req, res) => {
  const type = ['deposit', 'withdrawal', 'investment', 'payout', 'fee'].includes(req.query.type) ? req.query.type : null;
  const status = ['pending', 'processing', 'confirmed', 'rejected', 'cancelled'].includes(req.query.status) ? req.query.status : null;
  let sql = 'SELECT t.*, u.full_name, u.email, u.kyc_status FROM transactions t JOIN users u ON u.id = t.user_id WHERE 1=1';
  const p = [];
  if (type) { sql += ' AND t.type = ?'; p.push(type); }
  if (status) { sql += ' AND t.status = ?'; p.push(status); }
  sql += ' ORDER BY t.created_at DESC, t.id DESC LIMIT 500';
  res.render('admin/transactions', { title: 'Transactions', rows: await all(sql, ...p), type, status });
});

router.post('/transactions/:id/action', async (req, res, next) => {
  const row = await one('SELECT * FROM transactions WHERE id = ?', req.params.id);
  if (!row || !['deposit', 'withdrawal'].includes(row.type)) return next();
  const action = String(req.body.action || '');
  const note = String(req.body.note || '').trim().slice(0, 1000);
  const extRef = String(req.body.external_ref || '').trim().slice(0, 120);
  const fail = (m) => { req.flash('error', m); res.redirect(back(req, '/admin/transactions')); };
  const user = await one('SELECT * FROM users WHERE id = ?', row.user_id);

  if (action === 'confirm') {
    if (!['pending', 'processing'].includes(row.status)) return fail('Transaction déjà traitée.');
    if (req.body.verified !== 'on' || !extRef) return fail('Confirmez la vérification effective et indiquez la référence bancaire / du prestataire.');
    if (user.kyc_status !== 'approved') return fail('Identité de l\'investisseur non vérifiée.');
    if (row.type === 'withdrawal' && row.amount_cents > await ledger.cashBalance(user.id)) return fail('Solde insuffisant pour exécuter ce retrait.');
    await run(`UPDATE transactions SET status = 'confirmed', external_ref = ?, admin_note = ?, processed_at = datetime('now'), processed_by = ? WHERE id = ?`,
      extRef, note || null, req.user.id, row.id);
    await audit(req, `${row.type}.confirm`, 'transaction', row.id, { reference: row.reference, amount_cents: row.amount_cents, external_ref: extRef });
    await notify(user.id, `${row.type}_confirmed`, { ref: row.reference, amount_cents: row.amount_cents }, '/account/transactions');
    req.flash('success', `Transaction ${row.reference} confirmée.`);
  } else if (action === 'processing' && row.type === 'withdrawal') {
    if (row.status !== 'pending') return fail('Transaction déjà traitée.');
    await run(`UPDATE transactions SET status = 'processing', admin_note = ?, processed_by = ? WHERE id = ?`, note || null, req.user.id, row.id);
    await audit(req, 'withdrawal.processing', 'transaction', row.id, { reference: row.reference });
    await notify(user.id, 'withdrawal_processing', { ref: row.reference }, '/account/withdraw');
    req.flash('success', `Retrait ${row.reference} passé en traitement.`);
  } else if (action === 'reject') {
    if (!['pending', 'processing'].includes(row.status)) return fail('Transaction déjà traitée.');
    if (!note) return fail('Un motif est obligatoire pour refuser une transaction.');
    await run(`UPDATE transactions SET status = 'rejected', admin_note = ?, processed_at = datetime('now'), processed_by = ? WHERE id = ?`,
      note, req.user.id, row.id);
    await audit(req, `${row.type}.reject`, 'transaction', row.id, { reference: row.reference, note });
    await notify(user.id, `${row.type}_rejected`, { ref: row.reference, note }, '/account/transactions');
    req.flash('success', `Transaction ${row.reference} refusée.`);
  } else {
    return fail('Action inconnue.');
  }
  res.redirect(back(req, '/admin/transactions'));
});

// ---------- Messages ----------
// ---------- Demandes (page Contact) ----------
const requestsLib = require('../lib/requests');
const REQ_STATUS = { new: 'Nouveau', review: 'En étude', info_requested: 'Informations complémentaires demandées', forwarded: 'Transmis pour examen', closed: 'Clôturé' };
const REQ_MOTIVE = { project: 'Porteur de projet', funding: 'Recherche de financement', opportunity: 'Opportunité d\'affaires', investor: 'Investisseur / partenaire', other: 'Autre demande', deposit: 'Instructions de dépôt (client)' };
const reqLabels = { statusLabels: REQ_STATUS, motiveLabels: REQ_MOTIVE, countryName: (c) => countryName(c, 'fr') };

router.get('/requests', async (req, res) => {
  const f = {
    q: String(req.query.q || '').trim().slice(0, 100),
    status: requestsLib.STATUSES.includes(req.query.status) ? req.query.status : '',
    motive: requestsLib.ALL_MOTIVES.includes(req.query.motive) ? req.query.motive : '',
    sector: requestsLib.SECTOR_CHOICES.includes(req.query.sector) ? req.query.sector : ''
  };
  const where = [], params = [];
  if (f.status) { where.push('status = ?'); params.push(f.status); }
  if (f.motive) { where.push('motive = ?'); params.push(f.motive); }
  if (f.sector) { where.push('sector = ?'); params.push(f.sector); }
  if (f.q) {
    const like = `%${f.q.toLowerCase().replace(/[\\%_]/g, (c) => '\\' + c)}%`;
    where.push(`(lower(ref) LIKE ? OR lower(full_name) LIKE ? OR lower(COALESCE(organisation, '')) LIKE ? OR lower(email) LIKE ? OR lower(COALESCE(city, '')) LIKE ? OR lower(COALESCE(nature, '')) LIKE ?)`);
    params.push(like, like, like, like, like, like);
  }
  const rows = await all(`SELECT * FROM requests ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY status = 'new' DESC, created_at DESC, id DESC LIMIT 300`, ...params);
  const counts = {};
  (await all('SELECT status, COUNT(*) AS n FROM requests GROUP BY status')).forEach((r) => { counts[r.status] = Number(r.n); });
  res.render('admin/requests', { title: 'Demandes et dossiers', rows, f, counts, statuses: requestsLib.STATUSES, motives: requestsLib.ALL_MOTIVES, sectors: requestsLib.SECTOR_CHOICES, ...reqLabels });
});

router.get('/requests/:id', async (req, res, next) => {
  const r = await one('SELECT * FROM requests WHERE id = ?', req.params.id);
  if (!r) return next();
  const emails = await all(`SELECT id, kind, status, to_email, created_at FROM email_log WHERE kind LIKE 'request_%' AND (to_email = ? OR subject LIKE ?) ORDER BY id DESC LIMIT 30`, r.email, `%${r.ref}%`).catch(() => []);
  res.render('admin/request', { title: `Dossier ${r.ref}`, r, emails, statuses: requestsLib.STATUSES, ...reqLabels });
});

router.get('/requests/:id/files/:file', async (req, res, next) => {
  const r = await one('SELECT attachments FROM requests WHERE id = ?', req.params.id);
  let list = []; try { list = JSON.parse((r && r.attachments) || '[]'); } catch { list = []; }
  const f = list.find((x) => x.id === req.params.file);
  if (!f) return next();
  await sendStoredFile(res, f.id, f.name);
});

router.post('/requests/:id', async (req, res, next) => {
  try {
    const r = await one('SELECT * FROM requests WHERE id = ?', req.params.id);
    if (!r) return next();
    const status = requestsLib.STATUSES.includes(req.body.status) ? req.body.status : r.status;
    const note = String(req.body.admin_note || '').trim().slice(0, 5000);
    const message = String(req.body.message || '').trim().slice(0, 5000);
    await run(`UPDATE requests SET status = ?, admin_note = ?, handled_by = ?, updated_at = datetime('now') WHERE id = ?`, status, note || null, req.user.id, r.id);
    await audit(req, 'request.update', 'request', r.id, { ref: r.ref, from: r.status, to: status, message: !!message });
    if (message) {
      const log = await requestsLib.sendUpdate({ ...r, status }, message).catch((err) => { console.error('[mail] dossier', err); return null; });
      const ok = log && ['relay_accepted', 'delivered'].includes(log.status);
      req.flash(ok ? 'success' : 'error', ok ? 'Dossier mis à jour et message envoyé au demandeur.' : 'Dossier mis à jour, mais le message n\'a pas pu être envoyé (voir E-mails / Journal d\'envoi).');
    } else {
      req.flash('success', 'Dossier mis à jour.');
    }
    res.redirect(`/admin/requests/${r.id}`);
  } catch (e) { next(e); }
});

router.get('/messages', async (req, res) => {
  res.render('admin/messages', { title: 'Messages clients', rows: await all('SELECT * FROM messages ORDER BY status = \'new\' DESC, created_at DESC LIMIT 300') });
});

router.get('/messages/:id', async (req, res, next) => {
  const m = await one('SELECT * FROM messages WHERE id = ?', req.params.id);
  if (!m) return next();
  if (m.status === 'new') await run(`UPDATE messages SET status = 'read' WHERE id = ?`, m.id);
  res.render('admin/message', { title: m.subject, m });
});

router.post('/messages/:id/reply', async (req, res, next) => {
  try {
    const m = await one('SELECT * FROM messages WHERE id = ?', req.params.id);
    if (!m) return next();
    const reply = String(req.body.reply || '').trim().slice(0, 5000);
    if (!reply) { req.flash('error', 'Réponse vide.'); return res.redirect(`/admin/messages/${m.id}`); }
    await run(`UPDATE messages SET reply = ?, status = 'answered', replied_by = ?, replied_at = datetime('now') WHERE id = ?`, reply, req.user.id, m.id);
    await audit(req, 'message.reply', 'message', m.id);
    const u = m.user_id ? await one('SELECT * FROM users WHERE id = ?', m.user_id) : null;
    if (u) await notify(u.id, 'message_replied', { subject: m.subject }, '/contact');
    const recipient = u || { full_name: m.name, lang: 'fr' };
    const mail = renderEmail({ lang: recipient.lang, name: recipient.full_name, paragraphs: reply.split(/\n{2,}/), after: [`« ${m.body.slice(0, 1500)} »`] });
    const log = await sendMail({ to: m.email, subject: `Re: ${m.subject}`, text: mail.text, html: mail.html, kind: 'support_reply', userId: m.user_id });
    if (['relay_accepted', 'delivered'].includes(log.status)) req.flash('success', 'Réponse enregistrée et e-mail accepté par le serveur SMTP.');
    else req.flash('error', `Réponse enregistrée, mais l'e-mail n'est pas parti (${log.status}) : ${log.error || ''} — voir E-mails / Journal d'envoi.`);
    res.redirect(`/admin/messages/${m.id}`);
  } catch (e) { next(e); }
});

router.post('/messages/:id/close', async (req, res) => {
  await run(`UPDATE messages SET status = 'closed' WHERE id = ?`, req.params.id);
  await audit(req, 'message.close', 'message', req.params.id);
  res.redirect('/admin/messages');
});

// ---------- Actualités et rapports ----------
const newsUpload = makeUploader({ image: 'image', file: 'doc' });
const PHOTO_KEYS = Object.keys(require('../lib/photos').PHOTOS);

const newsFormData = () => ({ langs: LANGS, regions: newsLib.REGIONS, sectors: newsLib.SECTORS, invTypes: newsLib.INV_TYPES, photoKeys: PHOTO_KEYS });

router.get('/news', async (req, res) => {
  const rows = (await all(`SELECT n.*, (${newsLib.VISIBLE}) AS visible FROM news n ORDER BY COALESCE(publish_at, published_at, created_at) DESC, id DESC`))
    .map((n) => ({ ...n, tr: parseI18n(n.i18n, 'fr'), sourceList: newsLib.parseSources(n.sources) }));
  const pending = (await one(`SELECT COUNT(*) AS n FROM news_suggestions WHERE status = 'new'`)).n;
  res.render('admin/news', { title: 'Actualités et rapports', rows, pending });
});

router.get('/news/new', async (req, res) => {
  const n = { i18n: {}, kind: 'news', region: 'world', sector: 'macro', inv_type: 'markets', sources: '' };
  let suggestion = null;
  if (req.query.suggestion) {
    suggestion = await one('SELECT * FROM news_suggestions WHERE id = ?', req.query.suggestion);
    if (suggestion) n.sources = `${suggestion.source_name} | ${suggestion.url} | ${(suggestion.published_at || '').slice(0, 10)}`;
  }
  res.render('admin/news-form', { title: 'Nouvelle publication', n, suggestion, ...newsFormData() });
});

router.get('/news/:id/edit', async (req, res, next) => {
  const n = await one(`SELECT n.*, (${newsLib.VISIBLE}) AS visible FROM news n WHERE id = ?`, req.params.id);
  if (!n) return next();
  res.render('admin/news-form', { title: 'Modifier la publication', n: { ...n, i18n: rawI18n(n.i18n) }, suggestion: null, ...newsFormData() });
});

router.post(['/news', '/news/:id'], newsUpload.fields([{ name: 'image', maxCount: 1 }, { name: 'file', maxCount: 1 }]), verifyCsrf, async (req, res, next) => {
  const existing = req.params.id ? await one('SELECT * FROM news WHERE id = ?', req.params.id) : null;
  if (req.params.id && !existing) return next();
  const b = req.body;
  const i18n = i18nFromBody(b, NEWS_FIELDS);
  const image = req.files && req.files.image && req.files.image[0];
  const file = req.files && req.files.file && req.files.file[0];
  if (!i18n.fr.title) { req.flash('error', 'Le titre (FR) est obligatoire.'); return res.redirect(back(req, '/admin/news')); }

  const d = {
    kind: b.kind === 'report' ? 'report' : 'news',
    region: newsLib.REGIONS.includes(b.region) ? b.region : 'world',
    sector: newsLib.SECTORS.includes(b.sector) ? b.sector : 'macro',
    inv_type: newsLib.INV_TYPES.includes(b.inv_type) ? b.inv_type : 'markets',
    photo_key: PHOTO_KEYS.includes(b.photo_key) ? b.photo_key : null,
    featured: b.featured === 'on' ? 1 : 0,
    sources: String(b.sources || '').trim().slice(0, 4000),
    report_url: /^https?:\/\/[^\s"'<>]+$/i.test(String(b.report_url || '').trim()) ? String(b.report_url).trim().slice(0, 500) : null,
    // Date de mise en ligne planifiée (UTC). Vide = immédiate.
    publish_at: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(b.publish_at || '')) ? b.publish_at.replace('T', ' ') + ':00' : null
  };
  let published = b.published === 'on' ? 1 : 0;
  // Contrôle des sources : aucune mise en ligne sans source consultable, résumé et vérification explicite.
  let blocked = null;
  if (published && !newsLib.parseSources(d.sources).length) blocked = 'au moins une source « Nom | https://… | date » est obligatoire';
  else if (published && !i18n.fr.summary) blocked = 'le résumé (FR) est obligatoire';
  else if (published && b.verified !== 'on') blocked = 'cochez la case de vérification des sources';
  if (blocked) published = 0;

  let id;
  if (existing) {
    id = existing.id;
    if (image) removePublicFile(existing.image_path);
    if (b.remove_image === 'on' && !image) removePublicFile(existing.image_path);
    await run(`UPDATE news SET kind = ?, i18n = ?, region = ?, sector = ?, inv_type = ?, photo_key = ?, featured = ?, sources = ?, report_url = ?, publish_at = ?,
         image_path = ?, file_path = ?, file_name = ?, published = ?, reviewed_by = CASE WHEN ? = 1 THEN ? ELSE reviewed_by END, updated_at = datetime('now'),
         published_at = CASE WHEN ? = 1 AND published_at IS NULL THEN datetime('now') ELSE published_at END WHERE id = ?`,
      d.kind, JSON.stringify(i18n), d.region, d.sector, d.inv_type, d.photo_key, d.featured, d.sources, d.report_url, d.publish_at,
      image ? image.filename : (b.remove_image === 'on' ? null : existing.image_path),
      file ? file.filename : existing.file_path, file ? file.originalname.slice(0, 200) : existing.file_name,
      published, published, req.user.id, published, id);
    await audit(req, 'news.update', 'news', id, { published, publish_at: d.publish_at });
  } else {
    let slug = slugify(i18n.fr.title);
    if (await one('SELECT id FROM news WHERE slug = ?', slug)) slug += '-' + Date.now().toString(36);
    id = (await run(`INSERT INTO news (slug, kind, i18n, region, sector, inv_type, photo_key, featured, sources, report_url, publish_at, image_path, file_path, file_name,
        published, published_at, reviewed_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN datetime('now') END, ?, datetime('now'))`,
      slug, d.kind, JSON.stringify(i18n), d.region, d.sector, d.inv_type, d.photo_key, d.featured, d.sources, d.report_url, d.publish_at,
      image ? image.filename : null, file ? file.filename : null, file ? file.originalname.slice(0, 200) : null,
      published, published, published ? req.user.id : null)).lastInsertRowid;
    if (b.suggestion_id) await run(`UPDATE news_suggestions SET status = 'used' WHERE id = ?`, b.suggestion_id);
    await audit(req, 'news.create', 'news', id, { published, publish_at: d.publish_at });
  }
  if (blocked) req.flash('error', `Enregistré comme brouillon, non publié : ${blocked}.`);
  else req.flash('success', published ? (d.publish_at ? `Publication planifiée pour le ${d.publish_at} (UTC).` : 'Publication en ligne.') : 'Brouillon enregistré.');
  res.redirect(`/admin/news/${id}/edit`);
});

router.post('/news/:id/delete', async (req, res, next) => {
  const n = await one('SELECT * FROM news WHERE id = ?', req.params.id);
  if (!n) return next();
  await run('DELETE FROM news WHERE id = ?', n.id);
  await removePublicFile(n.image_path);
  await removeFile(n.file_path).catch(() => {});
  await audit(req, 'news.delete', 'news', n.id, { slug: n.slug });
  req.flash('success', 'Publication supprimée.');
  res.redirect('/admin/news');
});

// ---------- Veille : sources officielles et publications détectées ----------
router.get('/news-watch', async (req, res) => {
  res.render('admin/news-watch', {
    title: 'Veille des sources',
    sources: await all('SELECT * FROM news_sources ORDER BY active DESC, name'),
    suggestions: await all(`SELECT * FROM news_suggestions WHERE status = 'new' ORDER BY COALESCE(published_at, created_at) DESC LIMIT 150`),
    last: await one(`SELECT value FROM meta WHERE key = 'news_watch_last'`)
  });
});

router.post('/news-watch/run', async (req, res) => {
  const report = await newsLib.runWatch();
  const added = report.reduce((s, r) => s + r.added, 0);
  const errors = report.filter((r) => r.status.startsWith('erreur')).length;
  await audit(req, 'news.watch.run', 'news', null, { added, errors });
  req.flash(errors === report.length && report.length ? 'error' : 'success', `Veille terminée : ${added} nouvelle(s) publication(s) détectée(s) sur ${report.length} source(s)${errors ? `, ${errors} en erreur` : ''}.`);
  res.redirect('/admin/news-watch');
});

router.post('/news-watch/sources', async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 150);
  const feed = String(req.body.feed_url || '').trim().slice(0, 500);
  const site = String(req.body.site_url || '').trim().slice(0, 500);
  if (!name || !/^https:\/\/[^\s"'<>]+$/i.test(feed)) { req.flash('error', 'Nom et adresse de flux en https:// obligatoires.'); return res.redirect('/admin/news-watch'); }
  await run('INSERT INTO news_sources (name, feed_url, site_url) VALUES (?, ?, ?) ON CONFLICT (feed_url) DO NOTHING', name, feed, /^https?:\/\//i.test(site) ? site : null);
  await audit(req, 'news.source.add', 'news_source', null, { name, feed });
  req.flash('success', 'Source ajoutée. Lancez la veille pour la tester.');
  res.redirect('/admin/news-watch');
});

router.post('/news-watch/sources/:id/toggle', async (req, res) => {
  await run('UPDATE news_sources SET active = 1 - active WHERE id = ?', req.params.id);
  await audit(req, 'news.source.toggle', 'news_source', req.params.id);
  res.redirect('/admin/news-watch');
});

router.post('/news-watch/sources/:id/delete', async (req, res) => {
  await run('DELETE FROM news_sources WHERE id = ?', req.params.id);
  await audit(req, 'news.source.delete', 'news_source', req.params.id);
  req.flash('success', 'Source supprimée.');
  res.redirect('/admin/news-watch');
});

router.post('/news-watch/suggestions/:id/dismiss', async (req, res) => {
  await run(`UPDATE news_suggestions SET status = 'dismissed' WHERE id = ?`, req.params.id);
  res.redirect('/admin/news-watch#suggestions');
});

// ---------- Pages institutionnelles ----------
router.get('/pages', async (req, res) => {
  const rows = (await all('SELECT * FROM pages ORDER BY slug')).map((p) => ({ ...p, tr: parseI18n(p.i18n, 'fr') }));
  res.render('admin/pages', { title: 'Pages institutionnelles', rows });
});

router.get('/pages/:slug/edit', async (req, res, next) => {
  const p = await one('SELECT * FROM pages WHERE slug = ?', req.params.slug);
  if (!p) return next();
  res.render('admin/page-form', { title: 'Modifier la page', p: { ...p, i18n: rawI18n(p.i18n) }, langs: LANGS });
});

router.post('/pages/:slug', async (req, res, next) => {
  const p = await one('SELECT * FROM pages WHERE slug = ?', req.params.slug);
  if (!p) return next();
  const i18n = i18nFromBody(req.body, ['title', 'body']);
  if (!i18n.fr.title) { req.flash('error', 'Le titre (FR) est obligatoire.'); return res.redirect(`/admin/pages/${p.slug}/edit`); }
  await run(`UPDATE pages SET i18n = ?, updated_at = datetime('now') WHERE slug = ?`, JSON.stringify(i18n), p.slug);
  await audit(req, 'page.update', 'page', p.slug);
  req.flash('success', 'Page enregistrée.');
  res.redirect(`/admin/pages/${p.slug}/edit`);
});

// ---------- Paramètres ----------
router.get('/settings', async (req, res) => {
  res.render('admin/settings', { title: 'Paramètres du site', s: settings.allSettings(), langs: LANGS });
});

router.post('/settings/general', async (req, res) => {
  const company = {};
  for (const k of Object.keys(settings.DEFAULTS.company)) company[k] = String(req.body[`company_${k}`] || '').trim().slice(0, 2000);
  const languages = LANGS.filter((l) => req.body[`lang_${l}`] === 'on');
  const currencies = ['USD', 'EUR', 'GBP', 'XOF'].filter((c) => c === 'USD' || req.body[`cur_${c}`] === 'on');
  const fundsEnabled = req.body.funds_enabled === 'on';
  if (fundsEnabled && req.body.funds_ack !== 'on') {
    req.flash('error', 'Pour activer la réception de fonds, confirmez que les autorisations réglementaires sont obtenues.');
    return res.redirect('/admin/settings');
  }
  await settings.set('site_name', String(req.body.site_name || '').trim().slice(0, 120) || settings.DEFAULTS.site_name);
  await settings.set('company', company);
  await settings.set('notify_emails', String(req.body.notify_emails || '').split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter((s) => /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(s)).slice(0, 5).join(', '));
  await settings.set('languages', languages.length ? languages : ['fr']);
  await settings.set('currencies', currencies);
  if (fundsEnabled !== settings.get('funds_enabled')) await audit(req, 'settings.funds_enabled', 'settings', 'funds_enabled', { value: fundsEnabled });
  await settings.set('funds_enabled', fundsEnabled);
  await audit(req, 'settings.general', 'settings', 'general', { languages, currencies });
  req.flash('success', 'Paramètres enregistrés.');
  res.redirect('/admin/settings');
});

router.post('/settings/simulator', async (req, res) => {
  const num = (v, d) => (Number.isFinite(parseFloat(v)) ? parseFloat(String(v).replace(',', '.')) : d);
  const cur = settings.get('simulator');
  const presets = String(req.body.presets || '').split(/[;\s]+/).map((x) => parseFloat(x.replace(',', '.'))).filter(Number.isFinite).slice(0, 8);
  const sim = {
    capital: Math.max(1, num(req.body.capital, cur.capital)),
    rate: num(req.body.rate, cur.rate),
    years: Math.max(1, Math.round(num(req.body.years, cur.years))),
    presets: presets.length ? presets : cur.presets,
    min_rate: num(req.body.min_rate, cur.min_rate),
    max_rate: num(req.body.max_rate, cur.max_rate),
    max_years: Math.max(1, Math.round(num(req.body.max_years, cur.max_years))),
    max_capital: Math.max(1, num(req.body.max_capital, cur.max_capital))
  };
  await settings.set('simulator', sim);
  await audit(req, 'settings.simulator', 'settings', 'simulator', sim);
  req.flash('success', 'Hypothèses du simulateur enregistrées.');
  res.redirect('/admin/settings#simulator');
});

router.post('/settings/payments', async (req, res) => {
  const instr = {};
  for (const l of LANGS) instr[l] = String(req.body[`instr_${l}`] || '').trim().slice(0, 5000);
  const w = {
    fee_fixed_cents: parseAmount(req.body.fee_fixed) || 0,
    fee_percent: Math.max(0, Math.min(20, parseFloat(String(req.body.fee_percent || '0').replace(',', '.')) || 0)),
    min_cents: parseAmount(req.body.withdraw_min) || 100,
    delay_days: Math.max(0, parseInt(req.body.delay_days, 10) || 0)
  };
  await settings.set('payment_instructions', instr);
  await settings.set('withdrawal', w);
  await settings.set('deposit', { min_cents: parseAmount(req.body.deposit_min) || 100 });
  await audit(req, 'settings.payments', 'settings', 'payments', { withdrawal: w });
  req.flash('success', 'Paramètres de paiement enregistrés.');
  res.redirect('/admin/settings#payments');
});

router.post('/settings/rates', async (req, res, next) => {
  try {
    if (req.body.mode === 'refresh') {
      const r = await refreshRates({ force: true });
      await audit(req, 'settings.rates.refresh', 'settings', 'rates', { date: r.date });
      req.flash(r.date ? 'success' : 'error', r.date ? `Taux mis à jour (${r.date}).` : 'Échec de la mise à jour automatique.');
    } else {
      const f = (v) => { const n = parseFloat(String(v || '').replace(',', '.')); return n > 0 ? n : null; };
      const values = { USD: 1, EUR: f(req.body.EUR), GBP: f(req.body.GBP), XOF: f(req.body.XOF) };
      const date = isDate(req.body.date) ? req.body.date : today();
      await settings.set('rates', { ...settings.get('rates'), manual: true, base: 'USD', date, values, source: String(req.body.source || 'Saisie manuelle').slice(0, 200) });
      await audit(req, 'settings.rates.manual', 'settings', 'rates', { values, date });
      req.flash('success', 'Taux saisis manuellement (la mise à jour automatique est suspendue jusqu\'à la prochaine actualisation manuelle).');
    }
    res.redirect('/admin/settings#rates');
  } catch (e) { next(e); }
});

// ---------- E-mails / Journal d'envoi ----------
const EMAIL_STATUSES = ['queued', 'not_sent', 'relay_accepted', 'deferred', 'delivered', 'failed', 'bounced', 'complained'];

router.get('/emails', async (req, res, next) => {
  try {
    const status = EMAIL_STATUSES.includes(req.query.status) ? req.query.status : null;
    const kind = String(req.query.kind || '').slice(0, 40);
    const q = String(req.query.q || '').trim().slice(0, 200);
    let sql = `SELECT l.*, u.email_verified_at, u.full_name FROM email_log l LEFT JOIN users u ON u.id = l.user_id WHERE 1=1`;
    const p = [];
    if (status) { sql += ' AND l.status = ?'; p.push(status); }
    if (kind) { sql += ' AND l.kind = ?'; p.push(kind); }
    if (q) { sql += ' AND l.to_email ILIKE ?'; p.push(`%${q}%`); }
    sql += ' ORDER BY l.id DESC LIMIT 200';
    const cfg = mailer.config();
    const dnsDomain = req.query.dns !== undefined ? String(req.query.dns || cfg.fromDomain) : null;
    const dnsResult = dnsDomain ? await checkDomain(dnsDomain, [String(req.query.selector || ''), cfg.dkimSelector]) : null;
    res.render('admin/emails', {
      title: 'E-mails / Journal d\'envoi',
      cfg,
      rows: await all(sql, ...p),
      counts: await all(`SELECT status, COUNT(*) AS n FROM email_log WHERE created_at > datetime('now','-7 days') GROUP BY status`),
      kinds: (await all('SELECT DISTINCT kind FROM email_log ORDER BY kind')).map((r) => r.kind),
      filters: { status, kind, q },
      dnsResult,
      webhookUrl: `${require('../lib/notify').baseUrl()}/webhooks/email?token=…`
    });
  } catch (e) { next(e); }
});

router.get('/emails/:id', async (req, res, next) => {
  const m = await one('SELECT l.*, u.email_verified_at, u.full_name FROM email_log l LEFT JOIN users u ON u.id = l.user_id WHERE l.id = ?', req.params.id);
  if (!m) return next();
  const verif = m.kind === 'verify_code' ? await one('SELECT * FROM email_verifications WHERE email_log_id = ?', m.id) : null;
  res.render('admin/email', { title: `E-mail #${m.id}`, m, events: JSON.parse(m.events || '[]'), verif });
});

router.post('/emails/verify-connection', async (req, res, next) => {
  try {
    const r = await mailer.verifyConnection();
    await audit(req, 'email.smtp_check', 'settings', 'smtp', { ok: r.ok, error: r.error });
    req.flash(r.ok ? 'success' : 'error', r.ok ? 'Connexion et authentification SMTP réussies.' : `Échec de la connexion SMTP : ${r.error}`);
    res.redirect('/admin/emails');
  } catch (e) { next(e); }
});

router.post('/emails/test', async (req, res, next) => {
  try {
    const to = String(req.body.to || '').trim().toLowerCase();
    if (!/^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(to)) { req.flash('error', 'Adresse e-mail invalide.'); return res.redirect('/admin/emails'); }
    const cfg = mailer.config();
    const mail = renderEmail({
      lang: 'fr', name: req.user.full_name,
      paragraphs: [
        'Ceci est un e-mail de test envoyé depuis l’espace d’administration.',
        `Expéditeur : ${cfg.from} — serveur : ${cfg.host || 'aucun'}:${cfg.port} — DKIM (application) : ${cfg.dkim ? 'oui' : 'non'}.`,
        'S’il est arrivé en « Spam » ou « Courrier indésirable », vérifiez SPF, DKIM et DMARC dans le diagnostic du domaine.'
      ]
    });
    const log = await sendMail({ to, subject: `Test d’envoi — ${new Date().toLocaleString('fr-FR')}`, text: mail.text, html: mail.html, kind: 'test' });
    await audit(req, 'email.test', 'email', log.id, { to, status: log.status });
    if (['relay_accepted', 'delivered'].includes(log.status)) req.flash('success', `E-mail de test accepté par le serveur SMTP (${log.smtp_response}). Vérifiez maintenant la boîte de réception ET le dossier spam de ${to}.`);
    else req.flash('error', `Échec de l’e-mail de test (${log.status}) : ${log.error}`);
    res.redirect(`/admin/emails/${log.id}`);
  } catch (e) { next(e); }
});

// ---------- Journaux ----------
router.get('/audit', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const q = String(req.query.q || '').trim();
  const rows = q
    ? await all('SELECT * FROM audit_log WHERE action ILIKE ? OR actor_email ILIKE ? OR target_id = ? ORDER BY id DESC LIMIT 100 OFFSET ?', `%${q}%`, `%${q}%`, q, (page - 1) * 100)
    : await all('SELECT * FROM audit_log ORDER BY id DESC LIMIT 100 OFFSET ?', (page - 1) * 100);
  res.render('admin/audit', { title: 'Journal d\'audit', rows, page, q });
});

router.get('/logins', async (req, res) => {
  const failed = req.query.failed === '1';
  const rows = await all(`SELECT * FROM login_attempts ${failed ? 'WHERE success = 0' : ''} ORDER BY id DESC LIMIT 300`);
  res.render('admin/logins', { title: 'Tentatives de connexion', rows, failed });
});

module.exports = router;
