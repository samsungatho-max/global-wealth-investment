'use strict';
/** Paramètres du site, modifiables depuis l'administration (table settings, valeurs JSON). */
const { one, all, run } = require('../db');

const DEFAULTS = {
  site_name: 'GLOBACOR Partners INC',
  /** Adresse(s) qui reçoivent chaque demande déposée sur la page Contact (séparées par des virgules). Vide = administrateurs. */
  notify_emails: '',
  /** Dirigeants présentés sur la page « Notre société » : [{ name, role, bio }] — uniquement des informations professionnelles vérifiées. */
  leaders: [],
  company: {
    legal_name: '[Raison sociale à compléter]',
    legal_form: '[Forme juridique à compléter]',
    registration: "[Numéro d'immatriculation à compléter]",
    address: '[Adresse du siège à compléter]',
    email: 'contact@example.com',
    phone: '[Téléphone à compléter]',
    hours: '',
    linkedin: '',
    twitter: '',
    facebook: '',
    instagram: '',
    regulatory_status: "[Statut réglementaire et autorisations à compléter. Tant que ce champ n'est pas renseigné et que la réception de fonds n'est pas activée, la plateforme ne reçoit aucun fonds du public.]",
    director: '[Directeur de la publication à compléter]',
    host: '[Hébergeur à compléter]'
  },
  // Tant que false : les demandes de dépôt sont désactivées côté investisseur.
  funds_enabled: false,
  languages: ['fr', 'en', 'es', 'de'],
  currencies: ['USD', 'EUR', 'GBP', 'XOF'],
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
    base: 'USD',
    date: null,
    source: 'ECB · frankfurter.app — XOF 655.957 / EUR (fixed peg)',
    values: { USD: 1, EUR: null, GBP: null, XOF: null },
    manual: false
  }
};

/*
 * Cache mémoire rafraîchi depuis la base au plus toutes les TTL_MS (appel refresh() en début de requête),
 * pour que plusieurs instances (Vercel) voient rapidement les changements faits dans l'administration.
 * get() reste synchrone (utilisable dans les gabarits) ; set() est asynchrone.
 */
const TTL_MS = 5000;
let cache = new Map();
let loadedAt = 0;
let loading = null;

function isPlainObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }

function merge(key, raw) {
  let value = raw;
  if (isPlainObject(DEFAULTS[key]) && isPlainObject(value)) value = { ...DEFAULTS[key], ...value };
  return value;
}

async function refresh({ force = false } = {}) {
  if (!force && Date.now() - loadedAt < TTL_MS) return;
  if (!loading) {
    loading = all('SELECT key, value FROM settings').then((rows) => {
      const next = new Map();
      for (const r of rows) { try { next.set(r.key, merge(r.key, JSON.parse(r.value))); } catch { /* valeur corrompue ignorée */ } }
      cache = next;
      loadedAt = Date.now();
    }).finally(() => { loading = null; });
  }
  return loading;
}

function get(key) {
  return cache.has(key) ? cache.get(key) : DEFAULTS[key];
}

async function set(key, value) {
  await run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key, JSON.stringify(value));
  cache.set(key, merge(key, value));
}

function allSettings() {
  const out = {};
  for (const k of Object.keys(DEFAULTS)) out[k] = get(k);
  for (const k of cache.keys()) if (!(k in out)) out[k] = get(k);
  return out;
}

module.exports = { get, set, refresh, allSettings, DEFAULTS };
