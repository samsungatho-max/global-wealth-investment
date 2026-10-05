'use strict';
/** Conversion de devises et formatage. Devise de référence : USD. Les montants sont stockés en cents de dollar américain. */
const settings = require('./settings');

const LOCALES = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES', de: 'de-DE' };
const BASE = 'USD';
const CURRENCY_LABELS = { USD: '$ USD', EUR: '€ EUR', GBP: '£ GBP', XOF: 'FCFA' };

function rateFor(currency) {
  const v = settings.get('rates').values || {};
  return currency === BASE ? 1 : v[currency] || null;
}

function format(amount, currency, lang, digits) {
  if (amount == null || Number.isNaN(amount)) return '—';
  const locale = LOCALES[lang] || 'fr-FR';
  if (currency === 'XOF') {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(amount)) + ' FCFA';
  }
  return new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol', ...(digits === 0 ? { maximumFractionDigits: 0 } : {}) }).format(amount);
}

/** Formate un montant stocké en cents d'USD dans la devise d'affichage choisie. */
function money(cents, currency, lang, digits) {
  const rate = rateFor(currency || BASE);
  if (!rate) return format(cents / 100, BASE, lang, digits);
  return format((cents / 100) * rate, currency || BASE, lang, digits);
}

/** Convertit un montant saisi (ex: "1 250,50") en centimes. Retourne null si invalide. */
function parseAmount(input) {
  if (input == null) return null;
  const s = String(input).replace(/[\s  ]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(parseFloat(s) * 100);
  return cents > 0 && cents < 1e13 ? cents : null;
}

module.exports = { BASE, money, format, parseAmount, rateFor, LOCALES, CURRENCY_LABELS };
