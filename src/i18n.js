'use strict';
/** Traductions de l'interface. Langue choisie : ?lang= → session → préférence utilisateur → navigateur → fr. */
const settings = require('./lib/settings');

const dictionaries = {
  fr: require('./locales/fr'),
  en: require('./locales/en'),
  es: require('./locales/es'),
  de: require('./locales/de')
};
const SUPPORTED = Object.keys(dictionaries);

function lookup(dict, key) {
  return key.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), dict);
}

function t(lang, key, vars) {
  let s = lookup(dictionaries[lang] || dictionaries.fr, key);
  if (s === undefined) s = lookup(dictionaries.fr, key);
  if (s === undefined) return key;
  if (vars) s = String(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
  return s;
}

function enabledLanguages() {
  const list = settings.get('languages');
  return SUPPORTED.filter((l) => list.includes(l));
}

function middleware(req, res, next) {
  const enabled = enabledLanguages();
  let lang = null;
  if (req.query.lang && enabled.includes(req.query.lang)) {
    lang = req.query.lang;
    req.session.lang = lang;
  }
  lang = lang || req.session.lang || (req.user && req.user.lang);
  if (!lang || !enabled.includes(lang)) {
    const accepted = (req.acceptsLanguages(...enabled) || 'fr');
    lang = enabled.includes(accepted) ? accepted : enabled[0] || 'fr';
  }
  req.lang = lang;
  res.locals.lang = lang;
  res.locals.t = (key, vars) => t(lang, key, vars);
  res.locals.languages = enabled.map((code) => ({ code, name: dictionaries[code].lang_name }));
  next();
}

module.exports = { t, middleware, SUPPORTED, dictionaries };
