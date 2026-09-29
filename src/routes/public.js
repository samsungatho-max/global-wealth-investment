'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const { one, all, run } = require('../db');
const { parseI18n, markdown } = require('../lib/content');
const { raisedForProject } = require('../lib/ledger');
const { parseAmount } = require('../lib/money');
const { privatePath } = require('../lib/security');
const settings = require('../lib/settings');

const router = express.Router();
const SECTORS = ['real_estate', 'agriculture', 'energy', 'trade'];
const PUBLIC_STATUSES = ['open', 'closed'];

const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false,
  handler: (req, res) => res.status(429).render('error', { title: res.locals.t('common.too_many'), status: 429, message: res.locals.t('common.too_many') })
});

function decorateProject(p, lang) {
  const raised = raisedForProject(p.id);
  return {
    ...p,
    tr: parseI18n(p.i18n, lang),
    raised,
    pct: p.target_cents > 0 ? Math.min(100, Math.round((raised / p.target_cents) * 1000) / 10) : 0
  };
}

const isEmail = (s) => /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(String(s || ''));

router.get('/', (req, res) => {
  const projects = all(`SELECT * FROM projects WHERE status = 'open' ORDER BY is_demo ASC, created_at DESC LIMIT 3`)
    .map((p) => decorateProject(p, req.lang));
  const news = all('SELECT * FROM news WHERE published = 1 ORDER BY published_at DESC LIMIT 3')
    .map((n) => ({ ...n, tr: parseI18n(n.i18n, req.lang) }));
  res.render('public/home', { projects, news, sectors: SECTORS, sim: settings.get('simulator') });
});

router.get('/opportunities', (req, res) => {
  const sector = SECTORS.includes(req.query.sector) ? req.query.sector : null;
  const rows = sector
    ? all(`SELECT * FROM projects WHERE status IN ('open','closed') AND sector = ? ORDER BY status = 'open' DESC, is_demo ASC, created_at DESC`, sector)
    : all(`SELECT * FROM projects WHERE status IN ('open','closed') ORDER BY status = 'open' DESC, is_demo ASC, created_at DESC`);
  res.render('public/opportunities', {
    title: res.locals.t('project.title'),
    projects: rows.map((p) => decorateProject(p, req.lang)),
    sectors: SECTORS, sector
  });
});

function findPublicProject(slug) {
  const p = one('SELECT * FROM projects WHERE slug = ?', slug);
  return p && PUBLIC_STATUSES.includes(p.status) ? p : null;
}

const canSeeInvestorDocs = (user) => user && (user.role === 'admin' || user.kyc_status === 'approved');

router.get('/opportunities/:slug', (req, res, next) => {
  const row = findPublicProject(req.params.slug);
  if (!row) return next();
  const project = decorateProject(row, req.lang);
  const docs = all('SELECT * FROM project_documents WHERE project_id = ? ORDER BY created_at DESC', project.id);
  res.render('public/project', {
    title: project.tr.title,
    project,
    descriptionHtml: markdown(project.tr.description),
    docs,
    canSeeInvestorDocs: canSeeInvestorDocs(req.user),
    sent: req.query.sent === '1'
  });
});

router.get('/opportunities/:slug/documents/:id', (req, res, next) => {
  const project = findPublicProject(req.params.slug);
  if (!project) return next();
  const doc = one('SELECT * FROM project_documents WHERE id = ? AND project_id = ?', req.params.id, project.id);
  if (!doc) return next();
  if (doc.visibility !== 'public' && !canSeeInvestorDocs(req.user)) return res.redirect(req.user ? '/account/kyc' : '/login');
  res.download(privatePath(doc.file_path), doc.original_name);
});

router.post('/opportunities/:slug/interest', formLimiter, (req, res, next) => {
  const project = findPublicProject(req.params.slug);
  if (!project || project.status !== 'open') return next();
  const name = String(req.body.name || '').trim().slice(0, 120);
  const email = String(req.body.email || '').trim().slice(0, 200);
  const message = String(req.body.message || '').trim().slice(0, 3000);
  const amount = req.body.amount ? parseAmount(req.body.amount) : 0;
  if (!name || !isEmail(email) || amount === null) {
    req.flash('error', res.locals.t('auth.err_required'));
    return res.redirect(`/opportunities/${project.slug}#interest`);
  }
  run('INSERT INTO interests (project_id, user_id, name, email, amount_cents, message) VALUES (?, ?, ?, ?, ?, ?)',
    project.id, req.user ? req.user.id : null, name, email, amount || 0, message);
  res.redirect(`/opportunities/${project.slug}?sent=1#interest`);
});

router.get('/simulator', (req, res) => {
  res.render('public/simulator', { title: res.locals.t('sim.title'), sim: settings.get('simulator') });
});

router.get('/news', (req, res) => {
  const news = all('SELECT * FROM news WHERE published = 1 ORDER BY published_at DESC')
    .map((n) => ({ ...n, tr: parseI18n(n.i18n, req.lang) }));
  res.render('public/news', { title: res.locals.t('news.title'), news });
});

router.get('/news/:slug', (req, res, next) => {
  const n = one('SELECT * FROM news WHERE slug = ? AND published = 1', req.params.slug);
  if (!n) return next();
  const tr = parseI18n(n.i18n, req.lang);
  res.render('public/news-item', { title: tr.title, item: n, tr, bodyHtml: markdown(tr.body) });
});

router.get('/news/:slug/file', (req, res, next) => {
  const n = one('SELECT * FROM news WHERE slug = ? AND published = 1', req.params.slug);
  if (!n || !n.file_path) return next();
  res.download(privatePath(n.file_path), n.file_name || 'rapport.pdf');
});

router.get('/page/:slug', (req, res, next) => {
  const page = one('SELECT * FROM pages WHERE slug = ?', req.params.slug);
  if (!page) return next();
  const tr = parseI18n(page.i18n, req.lang);
  res.render('public/page', { title: tr.title, slug: page.slug, tr, bodyHtml: markdown(tr.body), updated: page.updated_at });
});

router.get('/contact', (req, res) => {
  const mine = req.user ? all('SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 20', req.user.id) : [];
  res.render('public/contact', { title: res.locals.t('contact.title'), mine, values: {} });
});

router.post('/contact', formLimiter, (req, res) => {
  const v = {
    name: String(req.body.name || (req.user && req.user.full_name) || '').trim().slice(0, 120),
    email: String(req.body.email || (req.user && req.user.email) || '').trim().slice(0, 200),
    subject: String(req.body.subject || '').trim().slice(0, 200),
    body: String(req.body.body || '').trim().slice(0, 5000)
  };
  if (!v.name || !isEmail(v.email) || !v.subject || !v.body) {
    return res.status(400).render('public/contact', { title: res.locals.t('contact.title'), mine: [], values: v, error: res.locals.t('auth.err_required') });
  }
  run('INSERT INTO messages (user_id, name, email, subject, body) VALUES (?, ?, ?, ?, ?)',
    req.user ? req.user.id : null, v.name, v.email, v.subject, v.body);
  req.flash('success', res.locals.t('contact.sent'));
  res.redirect('/contact');
});

router.get('/credits', (req, res) => {
  res.render('public/credits', { title: res.locals.t('ux.credits'), list: require('../lib/photos').credits() });
});

router.get('/healthz', (req, res) => res.json({ ok: true }));

module.exports = router;
module.exports.decorateProject = decorateProject;
module.exports.SECTORS = SECTORS;
