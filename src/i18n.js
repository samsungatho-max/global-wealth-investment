'use strict';
/**
 * Traductions de l'interface. Langue choisie parmi les langues activées : ?lang= → session → préférence utilisateur → navigateur.
 * L'espace d'administration reste toujours en français, quelle que soit la langue du site public.
 */
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
  if (s === undefined) s = lookup(dictionaries.en, key);
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
  const admin = /^\/admin(\/|$)/.test(req.path);
  const enabled = admin ? ['fr'] : enabledLanguages();
  let lang = admin ? 'fr' : null;
  if (!admin && req.query.lang && enabled.includes(req.query.lang)) {
    lang = req.query.lang;
    req.session.lang = lang;
  }
  lang = lang || req.session.lang || (req.user && req.user.lang);
  res.locals.colon = null;
  if (!lang || !enabled.includes(lang)) {
    const accepted = (req.acceptsLanguages(...enabled) || 'fr');
    lang = enabled.includes(accepted) ? accepted : enabled[0] || 'fr';
  }
  req.lang = lang;
  res.locals.lang = lang;
  res.locals.colon = lang === 'fr' ? ' :' : ':';
  res.locals.t = (key, vars) => t(lang, key, vars);
  res.locals.languages = enabled.map((code) => ({ code, name: dictionaries[code].lang_name }));
  next();
}

module.exports = { t, middleware, SUPPORTED, dictionaries };
