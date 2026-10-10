'use strict';
/** Rubriques institutionnelles : société, marchés financiers, solutions, gestion de fonds, dépôt de projet, contact, cookies. */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { one, all } = require('../db');
const { markdown, parseI18n } = require('../lib/content');
const { makeUploader, verifyCsrf, removeFile } = require('../lib/security');
const { countries } = require('../lib/countries');
const settings = require('../lib/settings');
const pages = require('../content/site-pages');
const markets = require('../lib/markets');
const requestsLib = require('../lib/requests');

const router = express.Router();
const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false,
  handler: (req, res) => res.status(429).render('error', { title: res.locals.t('common.too_many'), status: 429, message: res.locals.t('common.too_many') })
});
const T = (req, key, vars) => res_t(req)(key, vars);
const res_t = (req) => (key, vars) => require('../i18n').t(req.lang, key, vars);

router.use((req, res, next) => { res.locals.pick = (v) => pages.pick(v, req.lang); next(); });

// ---------- Notre société ----------
router.get('/company', async (req, res) => {
  const about = await one(`SELECT i18n FROM pages WHERE slug = 'about'`);
  const tr = about ? parseI18n(about.i18n, req.lang) : {};
  const leaders = (settings.get('leaders') || []).filter((l) => l && l.name && l.role);
  res.render('public/company', { title: T(req, 'site.company_title'), sections: pages.COMPANY, overviewHtml: markdown(tr.body || ''), leaders, notice: pages.REG_NOTICE });
});

// ---------- Solutions d'investissement ----------
const solutionsView = (req, extra = {}) => ({ title: T(req, 'site.solutions_title'), solutions: pages.SOLUTIONS, notice: pages.REG_NOTICE, values: {}, errors: [], ...extra });
router.get('/solutions', (req, res) => res.render('public/solutions', solutionsView(req, { values: { solution: pages.SOLUTIONS.some((s) => s.id === req.query.s) ? req.query.s : '' } })));
router.post('/solutions/request', formLimiter, async (req, res) => {
  if (String(req.body.fax_number || '').trim()) return res.redirect('/solutions');
  const sol = pages.SOLUTIONS.find((s) => s.id === req.body.solution);
  const { values, data, errors } = requestsLib.validateContact({ ...req.body, motive: 'solution' }, req.user);
  if (!sol) errors.push('solution');
  if (errors.length) return res.status(400).render('public/solutions', solutionsView(req, { values: { ...values, solution: sol ? sol.id : '' }, errors, error: T(req, 'req.err') }));
  data.nature = pages.pick(sol.title, 'en');
  await finish(req, res, data);
});

// ---------- Gestion de fonds ----------
router.get('/fund-management', (req, res) => res.render('public/fund', { title: T(req, 'site.fund_title'), fund: pages.FUND, notice: pages.REG_NOTICE }));

// ---------- Marchés financiers ----------
router.get('/markets', async (req, res) => {
  const overview = await markets.home(req.lang).catch(() => []);
  res.render('public/markets', { title: T(req, 'site.markets_title'), categories: markets.CATEGORIES, icons: markets.CATEGORY_ICON, info: pages.MARKETS, overview, spark: markets.sparkPath });
});
router.get('/markets/:cat', async (req, res, next) => {
  const cat = req.params.cat;
  if (!markets.CATEGORIES.includes(cat)) return next();
  const series = await markets.category(cat, req.lang).catch(() => []);
  res.render('public/market', { title: pages.pick(pages.MARKETS[cat].title, req.lang), cat, info: pages.MARKETS[cat], categories: markets.CATEGORIES, allInfo: pages.MARKETS, series, spark: markets.sparkPath });
});

// ---------- Cookies ----------
router.get('/cookies', (req, res) => res.render('public/simple', { title: T(req, 'site.cookies_title'), heroPhoto: 'bureaux', bodyHtml: markdown(pages.pick(pages.COOKIES, req.lang)) }));

// ---------- Enregistrement commun d'une demande ----------
async function finish(req, res, data) {
  const { id, ref } = await requestsLib.create(data, req.lang);
  const row = await one('SELECT * FROM requests WHERE id = ?', id);
  const mailed = await requestsLib.sendConfirmation(row);
  await requestsLib.notifyAdmins(row).catch((err) => console.error('[demande] notification', err));
  req.session.requestDone = { ref, email: row.email, mailed };
  res.redirect('/contact/confirmation');
}

// ---------- Soumettre un projet ----------
const upload = makeUploader({ attachments: 'attachment' }).fields([{ name: 'attachments', maxCount: 3 }]);
const files = (req, res, next) => upload[0](req, res, (err) => { if (err) { req.uploadError = err; return next(); } upload[1](req, res, next); });
const MAX_ATTACH_BYTES = 4 * 1024 * 1024;
const projectView = async (req, extra = {}) => ({
  title: T(req, 'site.submit_title'), motives: requestsLib.FUNDING_MOTIVES, fundingMotives: requestsLib.FUNDING_MOTIVES, stages: requestsLib.STAGES, sectorChoices: requestsLib.SECTOR_CHOICES,
  countries: countries(req.lang), errors: [],
  mine: req.user ? await all('SELECT ref, motive, status, created_at FROM requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 10', req.user.id) : [],
  ...extra
});
router.get('/submit-project', async (req, res) => {
  const u = req.user;
  res.render('public/submit', await projectView(req, { values: { motive: 'project', full_name: u ? u.full_name : '', email: u ? u.email : '', phone: u ? u.phone : '', country: (u && u.country) || '' } }));
});
router.post('/submit-project', formLimiter, files, verifyCsrf, async (req, res) => {
  const list = ((req.files && req.files.attachments) || []).map((f) => ({ id: f.filename, name: String(f.originalname || 'document').slice(0, 160), size: f.size }));
  const drop = () => Promise.all(list.map((f) => removeFile(f.id).catch(() => {})));
  if (String(req.body.fax_number || '').trim()) { await drop(); return res.redirect('/submit-project'); }
  const { values, data, errors } = requestsLib.validate(req.body, req.user);
  if (!requestsLib.FUNDING_MOTIVES.includes(values.motive)) errors.push('motive');
  const filesError = req.uploadError || list.reduce((n, f) => n + f.size, 0) > MAX_ATTACH_BYTES;
  if (filesError) errors.push('attachments');
  if (errors.length) {
    await drop();
    const messages = [];
    if (errors.some((e) => e !== 'attachments')) messages.push(T(req, 'req.err'));
    if (filesError) messages.push(T(req, 'req.err_files')); else if (list.length) messages.push(T(req, 'req.err_files_again'));
    return res.status(400).render('public/submit', await projectView(req, { values, errors, error: messages.join(' ') }));
  }
  data.attachments = JSON.stringify(list);
  await finish(req, res, data);
});

// ---------- Contact ----------
const contactView = (req, extra = {}) => ({ title: T(req, 'site.contact_title'), motives: requestsLib.CONTACT_MOTIVES, values: {}, errors: [], ...extra });
router.get('/contact', (req, res) => {
  const u = req.user;
  const motive = requestsLib.CONTACT_MOTIVES.includes(req.query.motif) ? req.query.motif : 'information';
  res.render('public/contact', contactView(req, { values: { motive, full_name: u ? u.full_name : '', email: u ? u.email : '', phone: u ? u.phone : '' } }));
});
router.post('/contact', formLimiter, async (req, res) => {
  if (String(req.body.fax_number || '').trim()) return res.redirect('/contact');
  const { values, data, errors } = requestsLib.validateContact(req.body, req.user);
  if (!requestsLib.CONTACT_MOTIVES.includes(values.motive)) errors.push('motive');
  if (errors.length) return res.status(400).render('public/contact', contactView(req, { values, errors, error: T(req, 'req.err') }));
  await finish(req, res, data);
});

module.exports = router;
module.exports.all = all;
