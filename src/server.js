'use strict';
const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const express = require('express');
const session = require('express-session');
const helmet = require('helmet');

const { one } = require('./db');
const i18n = require('./i18n');
const settings = require('./lib/settings');
const { money, LOCALES, CURRENCY_LABELS } = require('./lib/money');
const { refreshRates } = require('./lib/rates');
const security = require('./lib/security');
const photos = require('./lib/photos');
const { seed } = require('./seed');

const PROD = process.env.NODE_ENV === 'production';
if (PROD && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  console.error('SESSION_SECRET (32 caractères minimum) est obligatoire en production.');
  process.exit(1);
}

seed();

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

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
app.use('/media', express.static(security.PUBLIC_DIR, { maxAge: '7d', index: false }));
app.use(express.urlencoded({ extended: false, limit: '300kb' }));

app.use(session({
  name: 'gwi.sid',
  secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me-in-production-please',
  store: new security.SQLiteStore(),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: { httpOnly: true, sameSite: 'lax', secure: PROD, maxAge: 2 * 60 * 60 * 1000 }
}));

app.use(security.loadUser);
app.use(i18n.middleware);
app.use(security.csrfToken);

// Variables communes aux vues
app.use((req, res, next) => {
  const currencies = settings.get('currencies');
  if (req.query.currency && currencies.includes(req.query.currency)) req.session.currency = req.query.currency;
  const currency = currencies.includes(req.session.currency) ? req.session.currency : 'EUR';
  const lang = req.lang;

  res.locals.site = settings.get('site_name');
  res.locals.company = settings.get('company');
  res.locals.rates = settings.get('rates');
  res.locals.currency = currency;
  res.locals.currencies = currencies.map((c) => ({ code: c, label: CURRENCY_LABELS[c] || c }));
  res.locals.money = (cents, cur) => money(cents, cur || currency, lang);
  res.locals.eur = (cents) => money(cents, 'EUR', lang);
  res.locals.fmtDate = (d, withTime) => {
    if (!d) return '—';
    const date = new Date(/\d{2}:\d{2}/.test(d) && !/Z|[+-]\d{2}:?\d{2}$/.test(d) ? d.replace(' ', 'T') + 'Z' : d);
    if (Number.isNaN(date.getTime())) return d;
    return new Intl.DateTimeFormat(LOCALES[lang], withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(date);
  };
  res.locals.pct = (x) => (x == null ? '—' : new Intl.NumberFormat(LOCALES[lang], { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(x));
  res.locals.photo = (key) => photos.photo(key, lang);
  res.locals.sectorPhoto = (sector) => photos.photo(photos.SECTOR_PHOTO[sector] || 'hero', lang);
  res.locals.num =(x, digits = 1) => new Intl.NumberFormat(LOCALES[lang], { maximumFractionDigits: digits }).format(x);
  res.locals.path = req.path;
  res.locals.langUrl = (code) => { const u = new URL(req.originalUrl, 'http://x'); u.searchParams.set('lang', code); return u.pathname + u.search; };
  res.locals.curUrl = (code) => { const u = new URL(req.originalUrl, 'http://x'); u.searchParams.set('currency', code); return u.pathname + u.search; };
  res.locals.flash = req.session.flash || [];
  delete req.session.flash;
  req.flash = (type, msg) => { (req.session.flash = req.session.flash || []).push({ type, msg }); };
  res.locals.unread = req.user ? one('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', req.user.id).n : 0;
  res.locals.title = null;
  next();
});

// Webhooks des services d'envoi : authentifiés par jeton, hors protection CSRF (appels serveur à serveur).
app.use('/webhooks', require('./routes/webhooks'));
app.use(security.csrfGuard);
app.use(security.enforcePasswordChange);

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
  app.listen(PORT, () => console.log(`Global Wealth Investment — http://localhost:${PORT}`));
  refreshRates();
  setInterval(refreshRates, 12 * 60 * 60 * 1000).unref();
}

module.exports = app;
