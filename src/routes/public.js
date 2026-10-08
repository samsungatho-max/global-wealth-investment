'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const { one, all, run } = require('../db');
const { parseI18n, markdown } = require('../lib/content');
const { raisedForProject } = require('../lib/ledger');
const { parseAmount } = require('../lib/money');
const { sendStoredFile } = require('../lib/security');
const settings = require('../lib/settings');
const newsLib = require('../lib/news');

const router = express.Router();
const { SECTORS, AMOUNT_RANGES } = require('../lib/sectors');
const requestsLib = require('../lib/requests');
const { countries } = require('../lib/countries');
const res_t = (req, key) => require('../i18n').t(req.lang, key);
const PUBLIC_STATUSES = ['open', 'closed'];

const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false,
  handler: (req, res) => res.status(429).render('error', { title: res.locals.t('common.too_many'), status: 429, message: res.locals.t('common.too_many') })
});

async function decorateProject(p, lang) {
  const raised = await raisedForProject(p.id);
  return {
    ...p,
    tr: parseI18n(p.i18n, lang),
    raised,
    pct: p.target_cents > 0 ? Math.min(100, Math.round((raised / p.target_cents) * 1000) / 10) : 0
  };
}

const isEmail = (s) => /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(String(s || ''));

router.get('/', async (req, res) => {
  const projects = await Promise.all((await all(`SELECT * FROM projects WHERE status = 'open' ORDER BY is_demo ASC, kind = 'referenced' ASC, created_at DESC, id DESC LIMIT 6`))
    .map((p) => decorateProject(p, req.lang)));
  const news = (await all(`SELECT * FROM news WHERE ${newsLib.VISIBLE} ORDER BY featured DESC, ${newsLib.ORDER} LIMIT 3`))
    .map((n) => newsLib.decorate(n, req.lang));
  res.render('public/home', { projects, news, sectors: SECTORS, featuredSectors: require('../lib/sectors').FEATURED_SECTORS, sim: settings.get('simulator') });
});

router.get('/opportunities', async (req, res) => {
  const base = `status IN ('open','closed')`;
  const countries = (await all(`SELECT DISTINCT country FROM projects WHERE ${base} ORDER BY country`)).map((r) => r.country);
  const f = {
    sector: SECTORS.includes(req.query.sector) ? req.query.sector : '',
    country: countries.includes(req.query.country) ? req.query.country : '',
    amount: AMOUNT_RANGES.some((r) => r[0] === req.query.amount) ? req.query.amount : '',
    risk: /^[1-5]$/.test(req.query.risk || '') ? Number(req.query.risk) : ''
  };
  const where = [base], params = [];
  if (f.sector) { where.push('sector = ?'); params.push(f.sector); }
  if (f.country) { where.push('country = ?'); params.push(f.country); }
  if (f.risk) { where.push('risk_level = ?'); params.push(f.risk); }
  if (f.amount) {
    const [, min, max] = AMOUNT_RANGES.find((r) => r[0] === f.amount);
    where.push('target_cents >= ?'); params.push(min);
    if (max) { where.push('target_cents < ?'); params.push(max); }
  }
  const rows = await all(`SELECT * FROM projects WHERE ${where.join(' AND ')} ORDER BY status = 'open' DESC, is_demo ASC, kind = 'referenced' ASC, created_at DESC, id DESC`, ...params);
  const total = (await one(`SELECT COUNT(*) AS n FROM projects WHERE ${base}`)).n;
  res.render('public/opportunities', {
    title: res.locals.t('opp.title'),
    projects: await Promise.all(rows.map((p) => decorateProject(p, req.lang))),
    sectors: SECTORS, countries, amounts: AMOUNT_RANGES.map((r) => r[0]), f, total,
    filtered: Boolean(f.sector || f.country || f.amount || f.risk), sector: f.sector
  });
});

async function findPublicProject(slug) {
  const p = await one('SELECT * FROM projects WHERE slug = ?', slug);
  return p && PUBLIC_STATUSES.includes(p.status) ? p : null;
}

const canSeeInvestorDocs = (user) => user && (user.role === 'admin' || user.kyc_status === 'approved');

router.get('/opportunities/:slug', async (req, res, next) => {
  const row = await findPublicProject(req.params.slug);
  if (!row) return next();
  const project = await decorateProject(row, req.lang);
  const docs = await all('SELECT * FROM project_documents WHERE project_id = ? ORDER BY created_at DESC', project.id);
  res.render('public/project', {
    title: project.tr.title,
    project,
    descriptionHtml: markdown(project.tr.description),
    conditionsHtml: markdown(project.tr.conditions),
    feesHtml: markdown(project.tr.fees),
    docs,
    canSeeInvestorDocs: canSeeInvestorDocs(req.user),
    sent: req.query.sent === '1'
  });
});

router.get('/opportunities/:slug/documents/:id', async (req, res, next) => {
  const project = await findPublicProject(req.params.slug);
  if (!project) return next();
  const doc = await one('SELECT * FROM project_documents WHERE id = ? AND project_id = ?', req.params.id, project.id);
  if (!doc) return next();
  if (doc.visibility !== 'public' && !canSeeInvestorDocs(req.user)) return res.redirect(req.user ? '/account/kyc' : '/login');
  await sendStoredFile(res, doc.file_path, doc.original_name);
});

router.post('/opportunities/:slug/interest', formLimiter, async (req, res, next) => {
  const project = await findPublicProject(req.params.slug);
  if (!project || project.status !== 'open') return next();
  const name = String(req.body.name || '').trim().slice(0, 120);
  const email = String(req.body.email || '').trim().slice(0, 200);
  const message = String(req.body.message || '').trim().slice(0, 3000);
  const amount = req.body.amount ? parseAmount(req.body.amount) : 0;
  if (!name || !isEmail(email) || amount === null) {
    req.flash('error', res.locals.t('auth.err_required'));
    return res.redirect(`/opportunities/${project.slug}#interest`);
  }
  await run('INSERT INTO interests (project_id, user_id, name, email, amount_cents, message) VALUES (?, ?, ?, ?, ?, ?)',
    project.id, req.user ? req.user.id : null, name, email, amount || 0, message);
  const tr = parseI18n(project.i18n, 'en');
  await requestsLib.notifyInterest({ project, title: tr.title || project.slug, name, email, amountCents: amount || 0, message, userId: req.user ? req.user.id : null })
    .catch((err) => console.error('[demande] notification (projet)', err));
  res.redirect(`/opportunities/${project.slug}?sent=1#interest`);
});

router.get('/simulator', (req, res) => {
  res.render('public/simulator', { title: res.locals.t('sim.title'), sim: settings.get('simulator') });
});

router.get('/news', async (req, res) => {
  const f = {
    region: newsLib.REGIONS.includes(req.query.region) ? req.query.region : null,
    sector: newsLib.SECTORS.includes(req.query.sector) ? req.query.sector : null,
    type: newsLib.INV_TYPES.includes(req.query.type) ? req.query.type : null,
    kind: ['news', 'report'].includes(req.query.kind) ? req.query.kind : null
  };
  let sql = `SELECT * FROM news WHERE ${newsLib.VISIBLE}`;
  const params = [];
  if (f.region) { sql += ' AND region = ?'; params.push(f.region); }
  if (f.sector) { sql += ' AND sector = ?'; params.push(f.sector); }
  if (f.type) { sql += ' AND inv_type = ?'; params.push(f.type); }
  if (f.kind) { sql += ' AND kind = ?'; params.push(f.kind); }
  sql += ` ORDER BY ${newsLib.ORDER} LIMIT 60`;
  const items = (await all(sql, ...params)).map((n) => newsLib.decorate(n, req.lang));
  const filtered = !!(f.region || f.sector || f.type || f.kind);
  // Sélection : publications mises en avant (seulement sans filtre)
  const featured = filtered ? [] : items.filter((n) => n.featured).slice(0, 3);
  const featuredIds = new Set(featured.map((n) => n.id));
  // Catégories réellement présentes (pour ne proposer que des filtres utiles)
  const present = await all(`SELECT DISTINCT region, sector, inv_type FROM news WHERE ${newsLib.VISIBLE}`);
  res.render('public/news', {
    title: res.locals.t('news.title'),
    featured,
    items: items.filter((n) => !featuredIds.has(n.id)),
    takeaways: filtered ? [] : items.filter((n) => n.takeaways.length).slice(0, 5).map((n) => ({ text: n.takeaways[0], slug: n.slug, title: n.tr.title, region: n.region })),
    f, filtered,
    options: {
      region: newsLib.REGIONS.filter((r) => present.some((p) => p.region === r)),
      sector: newsLib.SECTORS.filter((s) => present.some((p) => p.sector === s)),
      type: newsLib.INV_TYPES.filter((s) => present.some((p) => p.inv_type === s))
    }
  });
});

router.get('/news/:slug', async (req, res, next) => {
  const row = await one(`SELECT * FROM news WHERE slug = ? AND ${newsLib.VISIBLE}`, req.params.slug);
  if (!row) return next();
  const n = newsLib.decorate(row, req.lang);
  const related = (await all(`SELECT * FROM news WHERE ${newsLib.VISIBLE} AND id <> ? AND (region = ? OR sector = ?) ORDER BY ${newsLib.ORDER} LIMIT 3`, row.id, row.region, row.sector))
    .map((r) => newsLib.decorate(r, req.lang));
  res.render('public/news-item', { title: n.tr.title, n, bodyHtml: markdown(n.tr.body), related });
});

// Veille planifiée (appelée chaque jour par Vercel Cron). Sans secret : l'opération est sans danger
// (elle ne fait qu'alimenter la file de suggestions à vérifier) et limitée à une exécution toutes les 6 h.
router.get('/cron/news-watch', async (req, res) => {
  const r = await newsLib.runWatchThrottled(6);
  res.json({ ok: true, skipped: r.skipped, sources: r.report ? r.report.length : 0, added: r.report ? r.report.reduce((s, x) => s + x.added, 0) : 0 });
});

router.get('/news/:slug/file', async (req, res, next) => {
  const n = await one(`SELECT * FROM news WHERE slug = ? AND ${newsLib.VISIBLE}`, req.params.slug);
  if (!n || !n.file_path) return next();
  await sendStoredFile(res, n.file_path, n.file_name || 'rapport.pdf');
});

// Images publiques téléversées (projets, actualités) — seuls les fichiers marqués « public » sont servis.
router.get('/media/:id', async (req, res, next) => {
  const f = await one(`SELECT id FROM files WHERE id = ? AND visibility = 'public'`, req.params.id);
  if (!f) return next();
  await sendStoredFile(res, f.id, null, { inline: true, cache: true });
});

router.get('/page/:slug', async (req, res, next) => {
  const page = await one('SELECT * FROM pages WHERE slug = ?', req.params.slug);
  if (!page) return next();
  const tr = parseI18n(page.i18n, req.lang);
  res.render('public/page', { title: tr.title, slug: page.slug, tr, bodyHtml: markdown(tr.body), updated: page.updated_at });
});

const contactView = async (req, extra) => ({
  title: res_t(req, 'req.title'),
  motives: requestsLib.MOTIVES, fundingMotives: requestsLib.FUNDING_MOTIVES, stages: requestsLib.STAGES, sectorChoices: requestsLib.SECTOR_CHOICES,
  countries: countries(req.lang),
  mine: req.user ? await all('SELECT ref, motive, status, created_at FROM requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 20', req.user.id) : [],
  errors: [], ...extra
});

router.get('/contact', async (req, res) => {
  const motive = requestsLib.MOTIVES.includes(req.query.motif) ? req.query.motif : 'project';
  const values = { motive, full_name: req.user ? req.user.full_name : '', email: req.user ? req.user.email : '', country: (req.user && req.user.country) || '' };
  res.render('public/contact', await contactView(req, { values }));
});

router.get('/contact/confirmation', (req, res) => {
  const done = req.session.requestDone;
  if (!done) return res.redirect('/contact');
  res.render('public/contact-sent', { title: res.locals.t('req.sent_title'), done });
});

// Documents joints à une demande : 3 fichiers au plus, enregistrés en base (accès réservé à l'administration).
const { makeUploader, verifyCsrf, removeFile } = require('../lib/security');
const requestUpload = makeUploader({ attachments: 'attachment' }).fields([{ name: 'attachments', maxCount: 3 }]);
const requestFiles = (req, res, next) => requestUpload[0](req, res, (err) => {
  if (err) { req.uploadError = err; return next(); }
  requestUpload[1](req, res, next);
});
const MAX_ATTACH_BYTES = 4 * 1024 * 1024;

router.post('/contact', formLimiter, requestFiles, verifyCsrf, async (req, res) => {
  const files = ((req.files && req.files.attachments) || []).map((f) => ({ id: f.filename, name: String(f.originalname || 'document').slice(0, 160), size: f.size, mime: f.mimetype }));
  const dropFiles = () => Promise.all(files.map((f) => removeFile(f.id).catch(() => {})));
  // Champ piège invisible : rempli uniquement par les robots, la demande est alors ignorée sans message d'erreur.
  if (String(req.body.fax_number || '').trim()) { await dropFiles(); return res.redirect('/contact'); }
  const { values, data, errors } = requestsLib.validate(req.body, req.user);
  const filesError = req.uploadError || files.reduce((n, f) => n + f.size, 0) > MAX_ATTACH_BYTES;
  if (filesError) errors.push('attachments');
  if (errors.length) {
    await dropFiles();
    const messages = [];
    if (errors.some((e) => e !== 'attachments')) messages.push(res.locals.t('req.err'));
    if (filesError) messages.push(res.locals.t('req.err_files'));
    else if (files.length) messages.push(res.locals.t('req.err_files_again'));
    return res.status(400).render('public/contact', await contactView(req, { values, errors, error: messages.join(' ') }));
  }
  data.attachments = JSON.stringify(files.map(({ id, name, size }) => ({ id, name, size })));
  const { id, ref } = await requestsLib.create(data, req.lang);
  const row = await one('SELECT * FROM requests WHERE id = ?', id);
  const mailed = await requestsLib.sendConfirmation(row);
  await requestsLib.notifyAdmins(row).catch((err) => console.error('[demande] notification', err));
  req.session.requestDone = { ref, email: row.email, mailed };
  res.redirect('/contact/confirmation');
});

router.get('/credits', (req, res) => {
  res.render('public/credits', { title: res.locals.t('ux.credits'), list: require('../lib/photos').credits() });
});

// Fichiers attendus par les navigateurs et les moteurs de recherche
router.get('/favicon.ico', (req, res) => res.redirect(301, '/static/img/brand/globacor-icone-192.png'));
router.get('/robots.txt', (req, res) => {
  const base = require('../lib/notify').baseUrl();
  res.type('text/plain').send(['User-agent: *', 'Disallow: /admin', 'Disallow: /account', 'Disallow: /webhooks', 'Disallow: /cron', 'Disallow: /*currency=', 'Disallow: /*lang=', '', 'Sitemap: ' + base + '/sitemap.xml', ''].join('\n'));
});
router.get('/sitemap.xml', async (req, res) => {
  const base = require('../lib/notify').baseUrl();
  const urls = ['/', '/opportunities', '/simulator', '/news', '/contact', '/page/about', '/page/strategies', '/page/sectors', '/page/risks', '/page/faq', '/page/legal', '/page/terms', '/page/privacy'];
  for (const p of await all("SELECT slug FROM projects WHERE status IN ('open','closed') ORDER BY id")) urls.push('/opportunities/' + p.slug);
  for (const n of await all('SELECT slug FROM news WHERE ' + newsLib.VISIBLE + ' ORDER BY id')) urls.push('/news/' + n.slug);
  res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.map((u) => '  <url><loc>' + base + u + '</loc></url>').join('\n') + '\n</urlset>\n');
});

router.get('/healthz', (req, res) => res.json({ ok: true }));

module.exports = router;
module.exports.decorateProject = decorateProject;
module.exports.SECTORS = SECTORS;
