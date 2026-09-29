'use strict';
/**
 * Espace d'administration (interface en français). Accès réservé au rôle admin.
 * Toute opération sensible est tracée dans audit_log (table en ajout seul).
 */
const express = require('express');
const fs = require('fs');
const { one, all, run, tx } = require('../db');
const { requireAdmin, verifyCsrf, makeUploader, privatePath, PUBLIC_DIR } = require('../lib/security');
const { audit } = require('../lib/audit');
const { notify } = require('../lib/notify');
const { parseAmount } = require('../lib/money');
const { parseI18n, rawI18n, i18nFromBody, slugify, LANGS } = require('../lib/content');
const ledger = require('../lib/ledger');
const settings = require('../lib/settings');
const { refreshRates } = require('../lib/rates');
const { sendMail } = require('../lib/mailer');
const { wrapMail } = require('../lib/notify');
const { makeReference } = require('./account');
const { SECTORS } = require('./public');
const { countryName } = require('../lib/countries');

const router = express.Router();
router.use(requireAdmin);
router.use((req, res, next) => { res.locals.section = 'admin'; res.locals.countryName = (c) => countryName(c, 'fr'); next(); });

const PROJECT_FIELDS = ['title', 'summary', 'description', 'conditions', 'fees'];
const NEWS_FIELDS = ['title', 'summary', 'body'];
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(s));
const today = () => new Date().toISOString().slice(0, 10);
const back = (req, fallback) => { const r = req.get('referer'); return r && r.includes(req.get('host')) ? r : fallback; };

function removePublicFile(name) {
  if (!name) return;
  fs.rm(require('path').join(PUBLIC_DIR, require('path').basename(name)), { force: true }, () => {});
}

// ---------- Tableau de bord ----------
router.get('/', (req, res) => {
  const c = (sql, ...p) => one(sql, ...p).n;
  res.render('admin/dashboard', {
    title: 'Tableau de bord',
    stats: {
      investors: c(`SELECT COUNT(*) AS n FROM users WHERE role = 'investor'`),
      kyc: c(`SELECT COUNT(*) AS n FROM kyc_submissions WHERE status = 'pending'`),
      deposits: c(`SELECT COUNT(*) AS n FROM transactions WHERE type = 'deposit' AND status = 'pending'`),
      withdrawals: c(`SELECT COUNT(*) AS n FROM transactions WHERE type = 'withdrawal' AND status IN ('pending','processing')`),
      messages: c(`SELECT COUNT(*) AS n FROM messages WHERE status = 'new'`),
      interests: c(`SELECT COUNT(*) AS n FROM interests WHERE status = 'new'`),
      projects: c(`SELECT COUNT(*) AS n FROM projects WHERE status = 'open'`),
      demo: c(`SELECT COUNT(*) AS n FROM projects WHERE is_demo = 1 AND status IN ('open','closed')`),
      invested: one(`SELECT COALESCE(SUM(amount_cents),0) AS n FROM investments WHERE status = 'active'`).n,
      deposited: one(`SELECT COALESCE(SUM(amount_cents),0) AS n FROM transactions WHERE type = 'deposit' AND status = 'confirmed'`).n,
      failedLogins: c(`SELECT COUNT(*) AS n FROM login_attempts WHERE success = 0 AND created_at > datetime('now','-24 hours')`)
    },
    fundsEnabled: settings.get('funds_enabled'),
    audits: all('SELECT * FROM audit_log ORDER BY id DESC LIMIT 12')
  });
});

// ---------- Projets ----------
const projectUpload = makeUploader({ image: 'image' });

router.get('/projects', (req, res) => {
  const rows = all('SELECT * FROM projects ORDER BY status = \'archived\', updated_at DESC')
    .map((p) => ({ ...p, tr: parseI18n(p.i18n, 'fr'), raised: ledger.raisedForProject(p.id) }));
  res.render('admin/projects', { title: 'Projets d\'investissement', rows });
});

router.get('/projects/new', (req, res) => {
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

router.post('/projects', projectUpload.single('image'), verifyCsrf, (req, res) => {
  const d = projectFromBody(req.body);
  if (!d.sector || !d.country || !d.target || d.ticket === null || !d.i18n.fr.title) {
    if (req.file) removePublicFile(req.file.filename);
    req.flash('error', 'Secteur, pays, montant recherché et titre (FR) sont obligatoires.');
    return res.redirect('/admin/projects/new');
  }
  let slug = slugify(d.i18n.fr.title);
  if (one('SELECT id FROM projects WHERE slug = ?', slug)) slug += '-' + Date.now().toString(36);
  const info = run(`INSERT INTO projects (slug, sector, country, i18n, target_cents, min_ticket_cents, duration_months, risk_level, image_path, status, is_demo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
    slug, d.sector, d.country, JSON.stringify(d.i18n), d.target, d.ticket, d.duration, d.risk, req.file ? req.file.filename : null, d.is_demo);
  audit(req, 'project.create', 'project', info.lastInsertRowid, { slug });
  req.flash('success', 'Projet créé (brouillon). Publiez-le lorsqu\'il est prêt.');
  res.redirect(`/admin/projects/${info.lastInsertRowid}/edit`);
});

router.get('/projects/:id/edit', (req, res, next) => {
  const p = one('SELECT * FROM projects WHERE id = ?', req.params.id);
  if (!p) return next();
  res.render('admin/project-form', {
    title: 'Modifier le projet',
    p: { ...p, i18n: rawI18n(p.i18n) },
    raised: ledger.raisedForProject(p.id),
    docs: all('SELECT * FROM project_documents WHERE project_id = ? ORDER BY created_at DESC', p.id),
    sectors: SECTORS, langs: LANGS
  });
});

router.post('/projects/:id', projectUpload.single('image'), verifyCsrf, (req, res, next) => {
  const p = one('SELECT * FROM projects WHERE id = ?', req.params.id);
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
  run(`UPDATE projects SET sector = ?, country = ?, i18n = ?, target_cents = ?, min_ticket_cents = ?, duration_months = ?, risk_level = ?,
       image_path = ?, is_demo = ?, updated_at = datetime('now') WHERE id = ?`,
    d.sector, d.country, JSON.stringify(d.i18n), d.target, d.ticket, d.duration, d.risk, image, d.is_demo, p.id);
  audit(req, 'project.update', 'project', p.id, { target_cents: d.target, risk: d.risk });
  req.flash('success', 'Projet enregistré.');
  res.redirect(`/admin/projects/${p.id}/edit`);
});

router.post('/projects/:id/status', (req, res, next) => {
  const p = one('SELECT * FROM projects WHERE id = ?', req.params.id);
  const status = String(req.body.status || '');
  if (!p || !['draft', 'open', 'suspended', 'closed', 'archived'].includes(status)) return next();
  run(`UPDATE projects SET status = ?, updated_at = datetime('now') WHERE id = ?`, status, p.id);
  audit(req, 'project.status', 'project', p.id, { from: p.status, to: status });
  req.flash('success', `Statut du projet mis à jour : ${status}.`);
  res.redirect(back(req, '/admin/projects'));
});

const docUpload = makeUploader({ file: 'doc' });

router.post('/projects/:id/documents', docUpload.single('file'), verifyCsrf, (req, res, next) => {
  const p = one('SELECT id FROM projects WHERE id = ?', req.params.id);
  if (!p) return next();
  const title = String(req.body.title || '').trim().slice(0, 200);
  if (!req.file || !title) { req.flash('error', 'Titre et fichier obligatoires.'); return res.redirect(`/admin/projects/${p.id}/edit#docs`); }
  const visibility = req.body.visibility === 'public' ? 'public' : 'investors';
  const info = run('INSERT INTO project_documents (project_id, title, file_path, original_name, visibility) VALUES (?, ?, ?, ?, ?)',
    p.id, title, req.file.filename, req.file.originalname.slice(0, 200), visibility);
  audit(req, 'project.document.add', 'project', p.id, { doc: info.lastInsertRowid, title });
  req.flash('success', 'Document ajouté.');
  res.redirect(`/admin/projects/${p.id}/edit#docs`);
});

router.post('/projects/:id/documents/:docId/delete', (req, res, next) => {
  const d = one('SELECT * FROM project_documents WHERE id = ? AND project_id = ?', req.params.docId, req.params.id);
  if (!d) return next();
  run('DELETE FROM project_documents WHERE id = ?', d.id);
  fs.rm(privatePath(d.file_path), { force: true }, () => {});
  audit(req, 'project.document.remove', 'project', d.project_id, { title: d.title });
  req.flash('success', 'Document retiré.');
  res.redirect(`/admin/projects/${d.project_id}/edit#docs`);
});

// ---------- Manifestations d'intérêt ----------
router.get('/interests', (req, res) => {
  const rows = all(`SELECT i.*, p.i18n AS p_i18n, p.slug FROM interests i JOIN projects p ON p.id = i.project_id ORDER BY i.created_at DESC LIMIT 300`)
    .map((r) => ({ ...r, project: parseI18n(r.p_i18n, 'fr').title }));
  res.render('admin/interests', { title: 'Manifestations d\'intérêt', rows });
});

router.post('/interests/:id/status', (req, res) => {
  const status = ['new', 'contacted', 'converted', 'declined'].includes(req.body.status) ? req.body.status : null;
  if (status) {
    run('UPDATE interests SET status = ? WHERE id = ?', status, req.params.id);
    audit(req, 'interest.status', 'interest', req.params.id, { status });
  }
  res.redirect('/admin/interests');
});

// ---------- Investisseurs ----------
router.get('/users', (req, res) => {
  const q = String(req.query.q || '').trim();
  const kyc = ['none', 'pending', 'approved', 'rejected'].includes(req.query.kyc) ? req.query.kyc : null;
  let sql = 'SELECT * FROM users WHERE 1=1';
  const params = [];
  if (q) { sql += ' AND (email LIKE ? OR full_name LIKE ? OR phone LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (kyc) { sql += ' AND kyc_status = ?'; params.push(kyc); }
  sql += ' ORDER BY created_at DESC LIMIT 300';
  const rows = all(sql, ...params).map((u) => ({ ...u, cash: ledger.cashBalance(u.id) }));
  res.render('admin/users', { title: 'Investisseurs', rows, q, kyc });
});

router.get('/users/:id', (req, res, next) => {
  const u = one('SELECT * FROM users WHERE id = ?', req.params.id);
  if (!u) return next();
  const openProjects = all(`SELECT id, i18n, duration_months, min_ticket_cents FROM projects WHERE status = 'open' ORDER BY created_at DESC`)
    .map((p) => ({ ...p, title: parseI18n(p.i18n, 'fr').title }));
  res.render('admin/user', {
    title: u.full_name,
    u,
    s: ledger.summary(u.id, 'fr'),
    history: ledger.valuationHistory(u.id, 'fr'),
    txs: all('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 100', u.id),
    kycs: all('SELECT * FROM kyc_submissions WHERE user_id = ? ORDER BY id DESC', u.id),
    docs: all('SELECT * FROM user_documents WHERE user_id = ? ORDER BY created_at DESC', u.id),
    logins: all('SELECT * FROM login_attempts WHERE email = ? COLLATE NOCASE ORDER BY id DESC LIMIT 15', u.email),
    openProjects,
    today: today()
  });
});

router.post('/users/:id/status', (req, res, next) => {
  const u = one('SELECT * FROM users WHERE id = ?', req.params.id);
  const status = req.body.status === 'suspended' ? 'suspended' : 'active';
  if (!u) return next();
  if (u.id === req.user.id) { req.flash('error', 'Vous ne pouvez pas suspendre votre propre compte.'); return res.redirect(`/admin/users/${u.id}`); }
  run('UPDATE users SET status = ? WHERE id = ?', status, u.id);
  if (status === 'suspended') run(`DELETE FROM sessions WHERE json_extract(sess, '$.userId') = ?`, u.id);
  audit(req, 'user.status', 'user', u.id, { status });
  req.flash('success', status === 'suspended' ? 'Compte suspendu.' : 'Compte réactivé.');
  res.redirect(`/admin/users/${u.id}`);
});

router.post('/users/:id/role', (req, res, next) => {
  const u = one('SELECT * FROM users WHERE id = ?', req.params.id);
  const role = req.body.role === 'admin' ? 'admin' : 'investor';
  if (!u) return next();
  if (u.id === req.user.id) { req.flash('error', 'Vous ne pouvez pas modifier votre propre rôle.'); return res.redirect(`/admin/users/${u.id}`); }
  run('UPDATE users SET role = ? WHERE id = ?', role, u.id);
  run(`DELETE FROM sessions WHERE json_extract(sess, '$.userId') = ?`, u.id);
  audit(req, 'user.role', 'user', u.id, { role });
  req.flash('success', `Rôle mis à jour : ${role}.`);
  res.redirect(`/admin/users/${u.id}`);
});

router.post('/users/:id/verify-email', (req, res, next) => {
  const u = one('SELECT * FROM users WHERE id = ?', req.params.id);
  if (!u) return next();
  run(`UPDATE users SET email_verified_at = COALESCE(email_verified_at, datetime('now')), email_verify_token_hash = NULL WHERE id = ?`, u.id);
  audit(req, 'user.verify_email_manual', 'user', u.id);
  req.flash('success', 'Adresse e-mail marquée comme vérifiée.');
  res.redirect(`/admin/users/${u.id}`);
});

router.post('/users/:id/documents', docUpload.single('file'), verifyCsrf, (req, res, next) => {
  const u = one('SELECT id FROM users WHERE id = ?', req.params.id);
  if (!u) return next();
  const title = String(req.body.title || '').trim().slice(0, 200);
  const category = ['contract', 'statement', 'other'].includes(req.body.category) ? req.body.category : 'other';
  if (!req.file || !title) { req.flash('error', 'Titre et fichier obligatoires.'); return res.redirect(`/admin/users/${u.id}#docs`); }
  const info = run('INSERT INTO user_documents (user_id, title, category, file_path, original_name, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
    u.id, title, category, req.file.filename, req.file.originalname.slice(0, 200), req.user.id);
  audit(req, 'user.document.add', 'user', u.id, { doc: info.lastInsertRowid, title, category });
  notify(u.id, 'document_added', { title }, '/account/documents');
  req.flash('success', 'Document ajouté et investisseur notifié.');
  res.redirect(`/admin/users/${u.id}#docs`);
});

router.get('/users/:id/documents/:docId', (req, res, next) => {
  const d = one('SELECT * FROM user_documents WHERE id = ? AND user_id = ?', req.params.docId, req.params.id);
  if (!d) return next();
  res.download(privatePath(d.file_path), d.original_name);
});

// Enregistrement d'un investissement : débite le solde disponible du client (écriture confirmée).
router.post('/users/:id/investments', (req, res, next) => {
  const u = one('SELECT * FROM users WHERE id = ?', req.params.id);
  if (!u) return next();
  const project = one(`SELECT * FROM projects WHERE id = ? AND status = 'open'`, req.body.project_id);
  const cents = parseAmount(req.body.amount);
  const start = isDate(req.body.start_date) ? req.body.start_date : null;
  const end = isDate(req.body.end_date) ? req.body.end_date : null;
  const fail = (m) => { req.flash('error', m); res.redirect(`/admin/users/${u.id}#invest`); };
  if (u.kyc_status !== 'approved') return fail('L\'identité de l\'investisseur doit être vérifiée.');
  if (!project || !cents || !start || !end || end <= start) return fail('Projet ouvert, montant et dates valides obligatoires.');
  if (project.is_demo) return fail('Impossible d\'investir dans une fiche de démonstration.');
  if (cents < project.min_ticket_cents) return fail('Montant inférieur au ticket minimum du projet.');
  const title = parseI18n(project.i18n, 'fr').title;
  const invId = tx(() => {
    if (cents > ledger.availableBalance(u.id)) return null;
    const inv = run(`INSERT INTO investments (user_id, project_id, amount_cents, start_date, end_date, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
      u.id, project.id, cents, start, end, req.user.id).lastInsertRowid;
    run(`INSERT INTO transactions (user_id, type, amount_cents, status, reference, method, investment_id, admin_note, processed_at, processed_by)
         VALUES (?, 'investment', ?, 'confirmed', ?, 'internal', ?, ?, datetime('now'), ?)`,
      u.id, cents, makeReference('INV'), inv, title, req.user.id);
    return inv;
  });
  if (!invId) return fail('Solde disponible insuffisant : le dépôt correspondant doit d\'abord être confirmé.');
  audit(req, 'investment.create', 'investment', invId, { user: u.id, project: project.id, amount_cents: cents });
  notify(u.id, 'investment_created', { amount_cents: cents, project: parseI18n(project.i18n, u.lang).title }, '/account/investments');
  req.flash('success', 'Investissement enregistré.');
  res.redirect(`/admin/users/${u.id}#invest`);
});

// Valorisation datée (valeur réelle constatée) d'un investissement.
router.post('/investments/:id/valuations', (req, res, next) => {
  const inv = one('SELECT i.*, p.i18n AS p_i18n FROM investments i JOIN projects p ON p.id = i.project_id WHERE i.id = ?', req.params.id);
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
  const info = run('INSERT INTO valuations (investment_id, value_cents, valuation_date, note, created_by) VALUES (?, ?, ?, ?, ?)',
    inv.id, value, date, note, req.user.id);
  audit(req, 'valuation.create', 'investment', inv.id, { valuation: info.lastInsertRowid, value_cents: value, date });
  const u = one('SELECT lang FROM users WHERE id = ?', inv.user_id);
  notify(inv.user_id, 'valuation', { project: parseI18n(inv.p_i18n, u.lang).title, date }, '/account/investments');
  req.flash('success', 'Valorisation enregistrée.');
  res.redirect(`/admin/users/${inv.user_id}#invest`);
});

// Échéance : versement confirmé du montant final sur le compte du client.
router.post('/investments/:id/mature', (req, res, next) => {
  const inv = one(`SELECT i.*, p.i18n AS p_i18n FROM investments i JOIN projects p ON p.id = i.project_id WHERE i.id = ? AND i.status = 'active'`, req.params.id);
  if (!inv) return next();
  const payout = req.body.payout === '0' ? 0 : parseAmount(req.body.payout);
  const date = isDate(req.body.date) ? req.body.date : today();
  const note = String(req.body.note || '').trim().slice(0, 500);
  if (payout === null || !note || req.body.verified !== 'on') {
    req.flash('error', 'Montant final, justification et confirmation de contrôle obligatoires.');
    return res.redirect(`/admin/users/${inv.user_id}#invest`);
  }
  tx(() => {
    run(`UPDATE investments SET status = 'matured' WHERE id = ?`, inv.id);
    run('INSERT INTO valuations (investment_id, value_cents, valuation_date, note, created_by) VALUES (?, ?, ?, ?, ?)',
      inv.id, payout, date, `Valeur finale à l'échéance — ${note}`, req.user.id);
    if (payout > 0) {
      run(`INSERT INTO transactions (user_id, type, amount_cents, status, reference, method, investment_id, admin_note, processed_at, processed_by)
           VALUES (?, 'payout', ?, 'confirmed', ?, 'internal', ?, ?, datetime('now'), ?)`,
        inv.user_id, payout, makeReference('PAY'), inv.id, note, req.user.id);
    }
  });
  audit(req, 'investment.mature', 'investment', inv.id, { payout_cents: payout, date });
  const u = one('SELECT lang FROM users WHERE id = ?', inv.user_id);
  notify(inv.user_id, 'investment_matured', { amount_cents: payout, project: parseI18n(inv.p_i18n, u.lang).title }, '/account/investments');
  req.flash('success', 'Investissement clôturé à l\'échéance.');
  res.redirect(`/admin/users/${inv.user_id}#invest`);
});

// ---------- KYC ----------
router.get('/kyc', (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  const rows = all(`SELECT k.*, u.full_name, u.email, u.country FROM kyc_submissions k JOIN users u ON u.id = k.user_id
    WHERE k.status = ? ORDER BY k.created_at ${status === 'pending' ? 'ASC' : 'DESC'} LIMIT 200`, status);
  res.render('admin/kyc', { title: 'Vérifications d\'identité', rows, status });
});

router.get('/kyc/:id/file/:which', (req, res, next) => {
  const k = one('SELECT * FROM kyc_submissions WHERE id = ?', req.params.id);
  if (!k || !['id', 'address'].includes(req.params.which)) return next();
  const file = req.params.which === 'id' ? k.id_file : k.address_file;
  const name = req.params.which === 'id' ? k.id_file_name : k.address_file_name;
  audit(req, 'kyc.document.view', 'kyc', k.id, { which: req.params.which });
  res.download(privatePath(file), name || file);
});

router.post('/kyc/:id/review', (req, res, next) => {
  const k = one(`SELECT * FROM kyc_submissions WHERE id = ? AND status = 'pending'`, req.params.id);
  if (!k) return next();
  const decision = req.body.decision === 'approve' ? 'approved' : req.body.decision === 'reject' ? 'rejected' : null;
  const note = String(req.body.note || '').trim().slice(0, 1000);
  if (!decision || (decision === 'rejected' && !note)) {
    req.flash('error', 'Décision requise ; un motif est obligatoire en cas de refus.');
    return res.redirect('/admin/kyc');
  }
  tx(() => {
    run(`UPDATE kyc_submissions SET status = ?, reviewer_id = ?, review_note = ?, reviewed_at = datetime('now') WHERE id = ?`,
      decision, req.user.id, note || null, k.id);
    run('UPDATE users SET kyc_status = ? WHERE id = ?', decision, k.user_id);
  });
  audit(req, `kyc.${decision}`, 'kyc', k.id, { user: k.user_id, note });
  notify(k.user_id, decision === 'approved' ? 'kyc_approved' : 'kyc_rejected', { note }, '/account/kyc');
  req.flash('success', decision === 'approved' ? 'Identité validée.' : 'Vérification refusée.');
  res.redirect('/admin/kyc');
});

// ---------- Transactions (dépôts / retraits) ----------
router.get('/transactions', (req, res) => {
  const type = ['deposit', 'withdrawal', 'investment', 'payout', 'fee'].includes(req.query.type) ? req.query.type : null;
  const status = ['pending', 'processing', 'confirmed', 'rejected', 'cancelled'].includes(req.query.status) ? req.query.status : null;
  let sql = 'SELECT t.*, u.full_name, u.email, u.kyc_status FROM transactions t JOIN users u ON u.id = t.user_id WHERE 1=1';
  const p = [];
  if (type) { sql += ' AND t.type = ?'; p.push(type); }
  if (status) { sql += ' AND t.status = ?'; p.push(status); }
  sql += ' ORDER BY t.created_at DESC, t.id DESC LIMIT 500';
  res.render('admin/transactions', { title: 'Transactions', rows: all(sql, ...p), type, status });
});

router.post('/transactions/:id/action', (req, res, next) => {
  const row = one('SELECT * FROM transactions WHERE id = ?', req.params.id);
  if (!row || !['deposit', 'withdrawal'].includes(row.type)) return next();
  const action = String(req.body.action || '');
  const note = String(req.body.note || '').trim().slice(0, 1000);
  const extRef = String(req.body.external_ref || '').trim().slice(0, 120);
  const fail = (m) => { req.flash('error', m); res.redirect(back(req, '/admin/transactions')); };
  const user = one('SELECT * FROM users WHERE id = ?', row.user_id);

  if (action === 'confirm') {
    if (!['pending', 'processing'].includes(row.status)) return fail('Transaction déjà traitée.');
    if (req.body.verified !== 'on' || !extRef) return fail('Confirmez la vérification effective et indiquez la référence bancaire / du prestataire.');
    if (user.kyc_status !== 'approved') return fail('Identité de l\'investisseur non vérifiée.');
    if (row.type === 'withdrawal' && row.amount_cents > ledger.cashBalance(user.id)) return fail('Solde insuffisant pour exécuter ce retrait.');
    run(`UPDATE transactions SET status = 'confirmed', external_ref = ?, admin_note = ?, processed_at = datetime('now'), processed_by = ? WHERE id = ?`,
      extRef, note || null, req.user.id, row.id);
    audit(req, `${row.type}.confirm`, 'transaction', row.id, { reference: row.reference, amount_cents: row.amount_cents, external_ref: extRef });
    notify(user.id, `${row.type}_confirmed`, { ref: row.reference, amount_cents: row.amount_cents }, '/account/transactions');
    req.flash('success', `Transaction ${row.reference} confirmée.`);
  } else if (action === 'processing' && row.type === 'withdrawal') {
    if (row.status !== 'pending') return fail('Transaction déjà traitée.');
    run(`UPDATE transactions SET status = 'processing', admin_note = ?, processed_by = ? WHERE id = ?`, note || null, req.user.id, row.id);
    audit(req, 'withdrawal.processing', 'transaction', row.id, { reference: row.reference });
    notify(user.id, 'withdrawal_processing', { ref: row.reference }, '/account/withdraw');
    req.flash('success', `Retrait ${row.reference} passé en traitement.`);
  } else if (action === 'reject') {
    if (!['pending', 'processing'].includes(row.status)) return fail('Transaction déjà traitée.');
    if (!note) return fail('Un motif est obligatoire pour refuser une transaction.');
    run(`UPDATE transactions SET status = 'rejected', admin_note = ?, processed_at = datetime('now'), processed_by = ? WHERE id = ?`,
      note, req.user.id, row.id);
    audit(req, `${row.type}.reject`, 'transaction', row.id, { reference: row.reference, note });
    notify(user.id, `${row.type}_rejected`, { ref: row.reference, note }, '/account/transactions');
    req.flash('success', `Transaction ${row.reference} refusée.`);
  } else {
    return fail('Action inconnue.');
  }
  res.redirect(back(req, '/admin/transactions'));
});

// ---------- Messages ----------
router.get('/messages', (req, res) => {
  res.render('admin/messages', { title: 'Messages clients', rows: all('SELECT * FROM messages ORDER BY status = \'new\' DESC, created_at DESC LIMIT 300') });
});

router.get('/messages/:id', (req, res, next) => {
  const m = one('SELECT * FROM messages WHERE id = ?', req.params.id);
  if (!m) return next();
  if (m.status === 'new') run(`UPDATE messages SET status = 'read' WHERE id = ?`, m.id);
  res.render('admin/message', { title: m.subject, m });
});

router.post('/messages/:id/reply', async (req, res, next) => {
  try {
    const m = one('SELECT * FROM messages WHERE id = ?', req.params.id);
    if (!m) return next();
    const reply = String(req.body.reply || '').trim().slice(0, 5000);
    if (!reply) { req.flash('error', 'Réponse vide.'); return res.redirect(`/admin/messages/${m.id}`); }
    run(`UPDATE messages SET reply = ?, status = 'answered', replied_by = ?, replied_at = datetime('now') WHERE id = ?`, reply, req.user.id, m.id);
    audit(req, 'message.reply', 'message', m.id);
    const u = m.user_id ? one('SELECT * FROM users WHERE id = ?', m.user_id) : null;
    if (u) notify(u.id, 'message_replied', { subject: m.subject }, '/contact');
    const recipient = u || { full_name: m.name, lang: 'fr' };
    await sendMail({ to: m.email, subject: `Re: ${m.subject}`, text: wrapMail(recipient, `${reply}\n\n---\n> ${m.body.replace(/\n/g, '\n> ')}`) });
    req.flash('success', 'Réponse envoyée.');
    res.redirect(`/admin/messages/${m.id}`);
  } catch (e) { next(e); }
});

router.post('/messages/:id/close', (req, res) => {
  run(`UPDATE messages SET status = 'closed' WHERE id = ?`, req.params.id);
  audit(req, 'message.close', 'message', req.params.id);
  res.redirect('/admin/messages');
});

// ---------- Actualités et rapports ----------
const newsUpload = makeUploader({ image: 'image', file: 'doc' });

router.get('/news', (req, res) => {
  const rows = all('SELECT * FROM news ORDER BY created_at DESC').map((n) => ({ ...n, tr: parseI18n(n.i18n, 'fr') }));
  res.render('admin/news', { title: 'Actualités et rapports', rows });
});

router.get('/news/new', (req, res) => res.render('admin/news-form', { title: 'Nouvelle publication', n: { i18n: {}, kind: 'news' }, langs: LANGS }));

router.get('/news/:id/edit', (req, res, next) => {
  const n = one('SELECT * FROM news WHERE id = ?', req.params.id);
  if (!n) return next();
  res.render('admin/news-form', { title: 'Modifier la publication', n: { ...n, i18n: rawI18n(n.i18n) }, langs: LANGS });
});

router.post(['/news', '/news/:id'], newsUpload.fields([{ name: 'image', maxCount: 1 }, { name: 'file', maxCount: 1 }]), verifyCsrf, (req, res, next) => {
  const existing = req.params.id ? one('SELECT * FROM news WHERE id = ?', req.params.id) : null;
  if (req.params.id && !existing) return next();
  const i18n = i18nFromBody(req.body, NEWS_FIELDS);
  const kind = req.body.kind === 'report' ? 'report' : 'news';
  const published = req.body.published === 'on' ? 1 : 0;
  const image = req.files && req.files.image && req.files.image[0];
  const file = req.files && req.files.file && req.files.file[0];
  if (!i18n.fr.title) { req.flash('error', 'Le titre (FR) est obligatoire.'); return res.redirect(back(req, '/admin/news')); }
  if (existing) {
    if (image) removePublicFile(existing.image_path);
    run(`UPDATE news SET kind = ?, i18n = ?, image_path = ?, file_path = ?, file_name = ?, published = ?,
         published_at = CASE WHEN ? = 1 AND published_at IS NULL THEN datetime('now') ELSE published_at END WHERE id = ?`,
      kind, JSON.stringify(i18n), image ? image.filename : existing.image_path,
      file ? file.filename : existing.file_path, file ? file.originalname.slice(0, 200) : existing.file_name,
      published, published, existing.id);
    audit(req, 'news.update', 'news', existing.id, { published });
    req.flash('success', 'Publication enregistrée.');
    return res.redirect(`/admin/news/${existing.id}/edit`);
  }
  let slug = slugify(i18n.fr.title);
  if (one('SELECT id FROM news WHERE slug = ?', slug)) slug += '-' + Date.now().toString(36);
  const info = run(`INSERT INTO news (slug, kind, i18n, image_path, file_path, file_name, published, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN datetime('now') END)`,
    slug, kind, JSON.stringify(i18n), image ? image.filename : null, file ? file.filename : null,
    file ? file.originalname.slice(0, 200) : null, published, published);
  audit(req, 'news.create', 'news', info.lastInsertRowid, { published });
  req.flash('success', 'Publication créée.');
  res.redirect(`/admin/news/${info.lastInsertRowid}/edit`);
});

// ---------- Pages institutionnelles ----------
router.get('/pages', (req, res) => {
  const rows = all('SELECT * FROM pages ORDER BY slug').map((p) => ({ ...p, tr: parseI18n(p.i18n, 'fr') }));
  res.render('admin/pages', { title: 'Pages institutionnelles', rows });
});

router.get('/pages/:slug/edit', (req, res, next) => {
  const p = one('SELECT * FROM pages WHERE slug = ?', req.params.slug);
  if (!p) return next();
  res.render('admin/page-form', { title: 'Modifier la page', p: { ...p, i18n: rawI18n(p.i18n) }, langs: LANGS });
});

router.post('/pages/:slug', (req, res, next) => {
  const p = one('SELECT * FROM pages WHERE slug = ?', req.params.slug);
  if (!p) return next();
  const i18n = i18nFromBody(req.body, ['title', 'body']);
  if (!i18n.fr.title) { req.flash('error', 'Le titre (FR) est obligatoire.'); return res.redirect(`/admin/pages/${p.slug}/edit`); }
  run(`UPDATE pages SET i18n = ?, updated_at = datetime('now') WHERE slug = ?`, JSON.stringify(i18n), p.slug);
  audit(req, 'page.update', 'page', p.slug);
  req.flash('success', 'Page enregistrée.');
  res.redirect(`/admin/pages/${p.slug}/edit`);
});

// ---------- Paramètres ----------
router.get('/settings', (req, res) => {
  res.render('admin/settings', { title: 'Paramètres du site', s: settings.allSettings(), langs: LANGS });
});

router.post('/settings/general', (req, res) => {
  const company = {};
  for (const k of Object.keys(settings.DEFAULTS.company)) company[k] = String(req.body[`company_${k}`] || '').trim().slice(0, 2000);
  const languages = LANGS.filter((l) => req.body[`lang_${l}`] === 'on');
  const currencies = ['EUR', 'USD', 'GBP', 'XOF'].filter((c) => c === 'EUR' || req.body[`cur_${c}`] === 'on');
  const fundsEnabled = req.body.funds_enabled === 'on';
  if (fundsEnabled && req.body.funds_ack !== 'on') {
    req.flash('error', 'Pour activer la réception de fonds, confirmez que les autorisations réglementaires sont obtenues.');
    return res.redirect('/admin/settings');
  }
  settings.set('site_name', String(req.body.site_name || '').trim().slice(0, 120) || settings.DEFAULTS.site_name);
  settings.set('company', company);
  settings.set('languages', languages.length ? languages : ['fr']);
  settings.set('currencies', currencies);
  if (fundsEnabled !== settings.get('funds_enabled')) audit(req, 'settings.funds_enabled', 'settings', 'funds_enabled', { value: fundsEnabled });
  settings.set('funds_enabled', fundsEnabled);
  audit(req, 'settings.general', 'settings', 'general', { languages, currencies });
  req.flash('success', 'Paramètres enregistrés.');
  res.redirect('/admin/settings');
});

router.post('/settings/simulator', (req, res) => {
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
  settings.set('simulator', sim);
  audit(req, 'settings.simulator', 'settings', 'simulator', sim);
  req.flash('success', 'Hypothèses du simulateur enregistrées.');
  res.redirect('/admin/settings#simulator');
});

router.post('/settings/payments', (req, res) => {
  const instr = {};
  for (const l of LANGS) instr[l] = String(req.body[`instr_${l}`] || '').trim().slice(0, 5000);
  const w = {
    fee_fixed_cents: parseAmount(req.body.fee_fixed) || 0,
    fee_percent: Math.max(0, Math.min(20, parseFloat(String(req.body.fee_percent || '0').replace(',', '.')) || 0)),
    min_cents: parseAmount(req.body.withdraw_min) || 100,
    delay_days: Math.max(0, parseInt(req.body.delay_days, 10) || 0)
  };
  settings.set('payment_instructions', instr);
  settings.set('withdrawal', w);
  settings.set('deposit', { min_cents: parseAmount(req.body.deposit_min) || 100 });
  audit(req, 'settings.payments', 'settings', 'payments', { withdrawal: w });
  req.flash('success', 'Paramètres de paiement enregistrés.');
  res.redirect('/admin/settings#payments');
});

router.post('/settings/rates', async (req, res, next) => {
  try {
    if (req.body.mode === 'refresh') {
      const r = await refreshRates({ force: true });
      audit(req, 'settings.rates.refresh', 'settings', 'rates', { date: r.date });
      req.flash(r.date ? 'success' : 'error', r.date ? `Taux mis à jour (${r.date}).` : 'Échec de la mise à jour automatique.');
    } else {
      const f = (v) => { const n = parseFloat(String(v || '').replace(',', '.')); return n > 0 ? n : null; };
      const values = { EUR: 1, USD: f(req.body.USD), GBP: f(req.body.GBP), XOF: f(req.body.XOF) || 655.957 };
      const date = isDate(req.body.date) ? req.body.date : today();
      settings.set('rates', { ...settings.get('rates'), manual: true, date, values, source: String(req.body.source || 'Saisie manuelle').slice(0, 200) });
      audit(req, 'settings.rates.manual', 'settings', 'rates', { values, date });
      req.flash('success', 'Taux saisis manuellement (la mise à jour automatique est suspendue jusqu\'à la prochaine actualisation manuelle).');
    }
    res.redirect('/admin/settings#rates');
  } catch (e) { next(e); }
});

// ---------- Journaux ----------
router.get('/audit', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const q = String(req.query.q || '').trim();
  const rows = q
    ? all('SELECT * FROM audit_log WHERE action LIKE ? OR actor_email LIKE ? OR target_id = ? ORDER BY id DESC LIMIT 100 OFFSET ?', `%${q}%`, `%${q}%`, q, (page - 1) * 100)
    : all('SELECT * FROM audit_log ORDER BY id DESC LIMIT 100 OFFSET ?', (page - 1) * 100);
  res.render('admin/audit', { title: 'Journal d\'audit', rows, page, q });
});

router.get('/logins', (req, res) => {
  const failed = req.query.failed === '1';
  const rows = all(`SELECT * FROM login_attempts ${failed ? 'WHERE success = 0' : ''} ORDER BY id DESC LIMIT 300`);
  res.render('admin/logins', { title: 'Tentatives de connexion', rows, failed });
});

module.exports = router;
