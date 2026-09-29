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
const { makeReference } = require('./account');
const { SECTORS } = require('./public');
const { countryName } = require('../lib/countries');

const router = express.Router();
router.use(requireAdmin);
router.use(async (req, res, next) => { res.locals.section = 'admin'; res.locals.countryName = (c) => countryName(c, 'fr'); next(); });

const PROJECT_FIELDS = ['title', 'summary', 'description', 'conditions', 'fees'];
const NEWS_FIELDS = ['title', 'summary', 'body'];
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
  res.render('admin/project-form', { title: 'Nouveau projet', p: { i18n: {}, risk_level: 3, duration_months: 12, status: 'draft' }, docs: [], sectors: SECTORS, langs: LANGS });
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
    is_demo: body.is_demo === 'on' ? 1 : 0
  };
}

router.post('/projects', projectUpload.single('image'), verifyCsrf, async (req, res) => {
  const d = projectFromBody(req.body);
  if (!d.sector || !d.country || !d.target || d.ticket === null || !d.i18n.fr.title) {
    if (req.file) removePublicFile(req.file.filename);
    req.flash('error', 'Secteur, pays, montant recherché et titre (FR) sont obligatoires.');
    return res.redirect('/admin/projects/new');
  }
  let slug = slugify(d.i18n.fr.title);
  if (await one('SELECT id FROM projects WHERE slug = ?', slug)) slug += '-' + Date.now().toString(36);
  const info = await run(`INSERT INTO projects (slug, sector, country, i18n, target_cents, min_ticket_cents, duration_months, risk_level, image_path, status, is_demo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
    slug, d.sector, d.country, JSON.stringify(d.i18n), d.target, d.ticket, d.duration, d.risk, req.file ? req.file.filename : null, d.is_demo);
  await audit(req, 'project.create', 'project', info.lastInsertRowid, { slug });
  req.flash('success', 'Projet créé (brouillon). Publiez-le lorsqu\'il est prêt.');
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
    sectors: SECTORS, langs: LANGS
  });
});

router.post('/projects/:id', projectUpload.single('image'), verifyCsrf, async (req, res, next) => {
  const p = await one('SELECT * FROM projects WHERE id = ?', req.params.id);
  if (!p) return next();
  const d = projectFromBody(req.body);
  if (!d.sector || !d.country || !d.target || d.ticket === null || !d.i18n.fr.title) {
    if (req.file) removePublicFile(req.file.filename);
    req.flash('error', 'Secteur, pays, montant recherché et titre (FR) sont obligatoires.');
    return res.redirect(`/admin/projects/${p.id}/edit`);
  }
  let image = p.image_path;
  if (req.file) { removePublicFile(p.image_path); image = req.file.filename; }
  if (req.body.remove_image === 'on' && !req.file) { removePublicFile(p.image_path); image = null; }
  await run(`UPDATE projects SET sector = ?, country = ?, i18n = ?, target_cents = ?, min_ticket_cents = ?, duration_months = ?, risk_level = ?,
       image_path = ?, is_demo = ?, updated_at = datetime('now') WHERE id = ?`,
    d.sector, d.country, JSON.stringify(d.i18n), d.target, d.ticket, d.duration, d.risk, image, d.is_demo, p.id);
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

router.get('/news', async (req, res) => {
  const rows = (await all('SELECT * FROM news ORDER BY created_at DESC')).map((n) => ({ ...n, tr: parseI18n(n.i18n, 'fr') }));
  res.render('admin/news', { title: 'Actualités et rapports', rows });
});

router.get('/news/new', async (req, res) => res.render('admin/news-form', { title: 'Nouvelle publication', n: { i18n: {}, kind: 'news' }, langs: LANGS }));

router.get('/news/:id/edit', async (req, res, next) => {
  const n = await one('SELECT * FROM news WHERE id = ?', req.params.id);
  if (!n) return next();
  res.render('admin/news-form', { title: 'Modifier la publication', n: { ...n, i18n: rawI18n(n.i18n) }, langs: LANGS });
});

router.post(['/news', '/news/:id'], newsUpload.fields([{ name: 'image', maxCount: 1 }, { name: 'file', maxCount: 1 }]), verifyCsrf, async (req, res, next) => {
  const existing = req.params.id ? await one('SELECT * FROM news WHERE id = ?', req.params.id) : null;
  if (req.params.id && !existing) return next();
  const i18n = i18nFromBody(req.body, NEWS_FIELDS);
  const kind = req.body.kind === 'report' ? 'report' : 'news';
  const published = req.body.published === 'on' ? 1 : 0;
  const image = req.files && req.files.image && req.files.image[0];
  const file = req.files && req.files.file && req.files.file[0];
  if (!i18n.fr.title) { req.flash('error', 'Le titre (FR) est obligatoire.'); return res.redirect(back(req, '/admin/news')); }
  if (existing) {
    if (image) removePublicFile(existing.image_path);
    await run(`UPDATE news SET kind = ?, i18n = ?, image_path = ?, file_path = ?, file_name = ?, published = ?,
         published_at = CASE WHEN ? = 1 AND published_at IS NULL THEN datetime('now') ELSE published_at END WHERE id = ?`,
      kind, JSON.stringify(i18n), image ? image.filename : existing.image_path,
      file ? file.filename : existing.file_path, file ? file.originalname.slice(0, 200) : existing.file_name,
      published, published, existing.id);
    await audit(req, 'news.update', 'news', existing.id, { published });
    req.flash('success', 'Publication enregistrée.');
    return res.redirect(`/admin/news/${existing.id}/edit`);
  }
  let slug = slugify(i18n.fr.title);
  if (await one('SELECT id FROM news WHERE slug = ?', slug)) slug += '-' + Date.now().toString(36);
  const info = await run(`INSERT INTO news (slug, kind, i18n, image_path, file_path, file_name, published, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN datetime('now') END)`,
    slug, kind, JSON.stringify(i18n), image ? image.filename : null, file ? file.filename : null,
    file ? file.originalname.slice(0, 200) : null, published, published);
  await audit(req, 'news.create', 'news', info.lastInsertRowid, { published });
  req.flash('success', 'Publication créée.');
  res.redirect(`/admin/news/${info.lastInsertRowid}/edit`);
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
  const currencies = ['EUR', 'USD', 'GBP', 'XOF'].filter((c) => c === 'EUR' || req.body[`cur_${c}`] === 'on');
  const fundsEnabled = req.body.funds_enabled === 'on';
  if (fundsEnabled && req.body.funds_ack !== 'on') {
    req.flash('error', 'Pour activer la réception de fonds, confirmez que les autorisations réglementaires sont obtenues.');
    return res.redirect('/admin/settings');
  }
  await settings.set('site_name', String(req.body.site_name || '').trim().slice(0, 120) || settings.DEFAULTS.site_name);
  await settings.set('company', company);
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
      const values = { EUR: 1, USD: f(req.body.USD), GBP: f(req.body.GBP), XOF: f(req.body.XOF) || 655.957 };
      const date = isDate(req.body.date) ? req.body.date : today();
      await settings.set('rates', { ...settings.get('rates'), manual: true, date, values, source: String(req.body.source || 'Saisie manuelle').slice(0, 200) });
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
      webhookUrl: `${(process.env.BASE_URL || '').replace(/\/$/, '') || 'https://votre-domaine'}/webhooks/email?token=…`
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
