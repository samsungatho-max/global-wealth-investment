'use strict';
/** Paramètres du site, modifiables depuis l'administration (table settings, valeurs JSON). */
const { one, all, run } = require('../db');

const DEFAULTS = {
  site_name: 'Global Wealth Investment',
  company: {
    legal_name: '[Raison sociale à compléter]',
    legal_form: '[Forme juridique à compléter]',
    registration: "[Numéro d'immatriculation à compléter]",
    address: '[Adresse du siège à compléter]',
    email: 'contact@example.com',
    phone: '[Téléphone à compléter]',
    regulatory_status: "[Statut réglementaire et autorisations à compléter. Tant que ce champ n'est pas renseigné et que la réception de fonds n'est pas activée, la plateforme ne reçoit aucun fonds du public.]",
    director: '[Directeur de la publication à compléter]',
    host: '[Hébergeur à compléter]'
  },
  // Tant que false : les demandes de dépôt sont désactivées côté investisseur.
  funds_enabled: false,
  languages: ['fr', 'en', 'es', 'de'],
  currencies: ['EUR', 'USD', 'GBP', 'XOF'],
  simulator: {
    capital: 10000,
    rate: 5,
    years: 5,
    presets: [-5, 2, 5, 8],
    min_rate: -20,
    max_rate: 20,
    max_years: 30,
    max_capital: 10000000
  },
  payment_instructions: {
    fr: "Les coordonnées bancaires officielles vous seront communiquées par l'administration après validation de votre identité. N'effectuez aucun virement vers un compte qui ne figure pas dans votre espace personnel.",
    en: 'Official bank details will be provided by the administration once your identity has been verified. Never transfer funds to an account that is not shown in your personal area.',
    es: 'Los datos bancarios oficiales le serán comunicados por la administración tras la verificación de su identidad. No realice ninguna transferencia a una cuenta que no figure en su espacio personal.',
    de: 'Die offiziellen Bankdaten werden Ihnen nach der Überprüfung Ihrer Identität von der Verwaltung mitgeteilt. Überweisen Sie niemals Geld auf ein Konto, das nicht in Ihrem persönlichen Bereich angezeigt wird.'
  },
  withdrawal: {
    fee_fixed_cents: 0,
    fee_percent: 0,
    min_cents: 5000,
    delay_days: 5
  },
  deposit: { min_cents: 10000 },
  rates: {
    base: 'EUR',
    date: null,
    source: 'ECB · frankfurter.app — XOF 655.957 (fixed peg)',
    values: { EUR: 1, USD: null, GBP: null, XOF: 655.957 },
    manual: false
  }
};

const cache = new Map();

function isPlainObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }

function get(key) {
  if (cache.has(key)) return cache.get(key);
  const row = one('SELECT value FROM settings WHERE key = ?', key);
  let value = row ? JSON.parse(row.value) : DEFAULTS[key];
  if (row && isPlainObject(DEFAULTS[key]) && isPlainObject(value)) value = { ...DEFAULTS[key], ...value };
  cache.set(key, value);
  return value;
}

function set(key, value) {
  run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key, JSON.stringify(value));
  cache.set(key, value);
}

function allSettings() {
  const out = {};
  for (const k of Object.keys(DEFAULTS)) out[k] = get(k);
  for (const r of all('SELECT key FROM settings')) if (!(r.key in out)) out[r.key] = get(r.key);
  return out;
}

module.exports = { get, set, allSettings, DEFAULTS };
