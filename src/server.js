'use strict';
const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const express = require('express');
const session = require('express-session');
const helmet = require('helmet');

const { one, run, ensureSchema } = require('./db');
const i18n = require('./i18n');
const settings = require('./lib/settings');
const { money, LOCALES, CURRENCY_LABELS } = require('./lib/money');
const { refreshRates } = require('./lib/rates');
const security = require('./lib/security');
const photos = require('./lib/photos');
const sectorsLib = require('./lib/sectors');
const navLib = require('./lib/nav');

// Version des fichiers CSS / JS : change à chaque déploiement, pour que les navigateurs ne gardent pas une ancienne feuille de style.
const ASSET_VERSION = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 10) || Date.now().toString(36);
const { seed } = require('./seed');

// Sur Vercel (production et prévisualisations), le site est toujours servi en HTTPS.
const PROD = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
const SECRET_OK = !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length >= 32;
if (!SECRET_OK) console.error('SESSION_SECRET doit contenir au moins 32 caractères (ou être laissé vide : il est alors généré automatiquement).');

/**
 * Clé secrète des sessions : SESSION_SECRET si défini ; sinon générée aléatoirement au premier démarrage
 * et conservée dans la base (table meta), identique pour toutes les instances. Aucun secret à saisir.
 */
async function ensureSessionSecret() {
  if (process.env.SESSION_SECRET) return;
  const crypto = require('crypto');
  await run(`INSERT INTO meta (key, value) VALUES ('session_secret', ?) ON CONFLICT (key) DO NOTHING`, crypto.randomBytes(48).toString('hex'));
  const row = await one(`SELECT value FROM meta WHERE key = 'session_secret'`);
  if (!PROD && !row) return;
  process.env.SESSION_SECRET = row.value;
}

/** Initialisation unique par instance : schéma, clé des sessions, données de départ. */
let initPromise = null;
function init() {
  if (!initPromise) {
    initPromise = (async () => {
      await ensureSchema();
      await ensureSessionSecret();
      await seed();
      await settings.refresh({ force: true });
    })().catch((err) => { initPromise = null; throw err; });
  }
  return initPromise;
}

/** Taux de change : actualisés à la demande quand ils ont plus de 12 h (pas de tâche de fond en serverless). */
let ratesRefreshing = false;
function maybeRefreshRates() {
  const r = settings.get('rates');
  const age = r.fetched_at ? Date.now() - Date.parse(r.fetched_at) : Infinity;
  if (r.manual || age < 12 * 3600 * 1000 || ratesRefreshing) return;
  ratesRefreshing = true;
  refreshRates().catch(() => {}).finally(() => { ratesRefreshing = false; });
}

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.disable('x-powered-by');
// Derrière le proxy HTTPS de Vercel (ou TRUST_PROXY) : IP réelle et cookies « Secure » corrects
if (process.env.TRUST_PROXY || process.env.VERCEL) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: PROD ? [] : null
    }
  },
  hsts: PROD
}));

app.use('/static/img/photos', express.static(path.join(__dirname, '..', 'public', 'img', 'photos'), { maxAge: '30d', immutable: true }));
app.use('/static', express.static(path.join(__dirname, '..', 'public'), { maxAge: PROD ? '7d' : 0 }));

// Protection contre les robots qui sollicitent les pages en boucle : au-delà de 90 pages par minute depuis la même
// adresse, le site répond « 429 » sans interroger la base. Un visiteur normal n'atteint jamais ce seuil.
if (PROD) {
  app.use(require('express-rate-limit')({
    windowMs: 60 * 1000, limit: Number(process.env.PAGE_RATE_LIMIT) || 90, standardHeaders: 'draft-7', legacyHeaders: false,
    skip: (req) => req.method !== 'GET' || req.path === '/healthz',
    handler: (req, res) => res.status(429).set('Retry-After', '60').type('text/plain').send('Too many requests. Please try again in a minute.')
  }));
}
app.get('/healthz', (req, res) => res.json({ ok: true }));

// Base prête (schéma + données de départ) et paramètres à jour avant tout traitement
app.use(async (req, res, next) => {
  try {
    if (!SECRET_OK) return res.status(503).type('text').send('Configuration incomplète : SESSION_SECRET trop court (32 caractères minimum) — supprimez-le pour qu’il soit généré automatiquement.');
    if (process.env.VERCEL && !process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
      return res.status(503).type('text').send('Configuration incomplète : aucune base de données. Ajoutez une base Neon (onglet Storage de Vercel) pour définir DATABASE_URL, puis redéployez.');
    }
    await init();
    await settings.refresh();
    maybeRefreshRates();
    next();
  } catch (err) { next(err); }
});

app.use(express.urlencoded({ extended: false, limit: '300kb' }));
// Un formulaire envoyé dans un format non pris en charge par la page visée est traité comme un formulaire vide (refusé à la validation).
app.use((req, res, next) => { if (!req.body) req.body = {}; next(); });

// Intergiciel de session créé après l'initialisation (la clé secrète peut venir de la base).
let sessionMiddleware = null;
app.use((req, res, next) => {
  if (!sessionMiddleware) {
    sessionMiddleware = session({
      name: 'sx.sid',
      secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me-in-production-please',
      store: new security.PgStore(),
      proxy: !!(process.env.TRUST_PROXY || process.env.VERCEL),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: { httpOnly: true, sameSite: 'lax', secure: PROD, maxAge: 2 * 60 * 60 * 1000 }
    });
  }
  sessionMiddleware(req, res, next);
});

app.use(security.loadUser);
// Adresses deformees par des robots (signe ¤ a la place de « &currency ») : renvoi definitif vers la page propre, pour ne pas alimenter une exploration sans fin.
app.use((req, res, next) => {
  if (req.method === 'GET' && /%C2%A4|%C2%A7|[¤§]/i.test(req.originalUrl)) return res.status(410).set('Cache-Control', 'public, max-age=86400').type('text/plain').send('Gone');
  next();
});

app.use(i18n.middleware);
app.use(security.csrfToken);

// Variables communes aux vues
app.use(async (req, res, next) => {
  const currencies = settings.get('currencies');
  if (req.query.currency && currencies.includes(req.query.currency)) req.session.currency = req.query.currency;
  const currency = currencies.includes(req.session.currency) ? req.session.currency : 'USD';
  const lang = req.lang;

  res.locals.site = settings.get('site_name');
  res.locals.assetV = ASSET_VERSION;
  res.locals.fundsEnabled = !!settings.get('funds_enabled');
  require('./lib/notify').rememberHost(req);
  res.locals.baseUrl = require('./lib/notify').baseUrl();
  // Les informations de société non encore renseignées (valeurs d'origine entre crochets) ne sont pas affichées.
  res.locals.company = Object.fromEntries(Object.entries(settings.get('company') || {}).map(([k, v]) => [k, typeof v === 'string' && (/^\s*\[/.test(v) || /@example\.(com|org|net)$/i.test(v.trim())) ? '' : v]));
  res.locals.rates = settings.get('rates');
  res.locals.currency = currency;
  res.locals.currencies = currencies.map((c) => ({ code: c, label: CURRENCY_LABELS[c] || c }));
  res.locals.money = (cents, cur) => money(cents, cur || currency, lang);
  res.locals.moneyRound = (cents) => money(cents, currency, lang, 0);
  res.locals.usd = (cents) => money(cents, 'USD', lang);
  res.locals.fmtDate = (d, withTime) => {
    if (!d) return '—';
    const date = new Date(/\d{2}:\d{2}/.test(d) && !/Z|[+-]\d{2}:?\d{2}$/.test(d) ? d.replace(' ', 'T') + 'Z' : d);
    if (Number.isNaN(date.getTime())) return d;
    return new Intl.DateTimeFormat(LOCALES[lang], withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(date);
  };
  res.locals.pct = (x) => (x == null ? '—' : new Intl.NumberFormat(LOCALES[lang], { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(x));
  res.locals.photo = (key) => photos.photo(key, lang);
  res.locals.sectorPhoto = (sector) => photos.photo(photos.SECTOR_PHOTO[sector] || 'hero', lang);
  res.locals.projectPhoto = (p) => photos.photo(photos.projectPhotoKey(p), lang);
  res.locals.oppRef = (p) => 'OPP-' + String(p.id).padStart(4, '0');
  res.locals.sectorIcon = (sector) => sectorsLib.SECTOR_ICON[sector] || 'globe';
  res.locals.countryName = (name) => sectorsLib.countryName(name, lang);
  res.locals.num =(x, digits = 1) => new Intl.NumberFormat(LOCALES[lang], { maximumFractionDigits: digits }).format(x);
  res.locals.path = req.path;
  res.locals.nav = navLib.build(lang, req.path);
  res.locals.socialLinks = navLib.social(res.locals.company);
  // Le parametre choisi est place en tete de l'adresse : la suite de caracteres « &curren » (lue comme le signe ¤ par certains robots) n'apparait jamais.
  const withParam = (name, code) => { const u = new URL(req.originalUrl, 'http://x'); u.searchParams.delete(name); for (const k of [...u.searchParams.keys()]) if (!/^(sector|country|amount|risk|q|region|kind|type|inv_type|page|motif|status|motive|currency|lang)$/.test(k)) u.searchParams.delete(k); const rest = u.searchParams.toString(); return u.pathname + '?' + name + '=' + encodeURIComponent(code) + (rest ? '&' + rest : ''); };
  res.locals.langUrl = (code) => withParam('lang', code);
  res.locals.curUrl = (code) => withParam('currency', code);
  res.locals.flash = req.session.flash || [];
  delete req.session.flash;
  req.flash = (type, msg) => { (req.session.flash = req.session.flash || []).push({ type, msg }); };
  res.locals.title = null;
  try {
    res.locals.unread = req.user ? (await one('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', req.user.id)).n : 0;
    next();
  } catch (err) { next(err); }
});

// Webhooks des services d'envoi : authentifiés par jeton, hors protection CSRF (appels serveur à serveur).
app.use('/webhooks', require('./routes/webhooks'));
app.use(security.csrfGuard);
app.use(security.enforcePasswordChange);

app.use('/', require('./routes/site'));
app.use('/', require('./routes/public'));
app.use('/', require('./routes/auth'));
app.use('/account', require('./routes/account'));
app.use('/admin', require('./routes/admin'));

app.use((req, res) => {
  res.status(404).render('error', { title: res.locals.t('common.not_found'), status: 404, message: res.locals.t('common.not_found') });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const t = res.locals.t || ((k) => k);
  let status = err.status || 500;
  let message = t('common.error_title');
  if (err.code === 'CSRF') message = t('common.csrf');
  else if (err.code === 'FILE_TYPE') message = t('common.file_type');
  else if (err.code === 'LIMIT_FILE_SIZE') { status = 400; message = t('common.file_size'); }
  else if (err.code === '22P02' || err.code === '22003') { status = 404; message = t('common.not_found'); } // identifiant invalide dans l'URL
  else if (status === 403) message = t('common.forbidden');
  else if (status === 404) message = t('common.not_found');
  if (status >= 500) console.error(err);
  if (res.headersSent) return;
  res.status(status).render('error', { title: message, status, message }, (renderErr, html) => {
    if (renderErr) return res.type('text').send(`${status} — ${message}`);
    res.send(html);
  });
});

const PORT = Number(process.env.PORT || 3000);
if (require.main === module) {
  init()
    .then(() => app.listen(PORT, () => console.log(`GLOBACOR Partners INC — http://localhost:${PORT}`)))
    .catch((err) => { console.error('Initialisation impossible :', err); process.exit(1); });
}

module.exports = app;
