'use strict';
/** Catégories de projets, icônes associées, tranches de montant (en cents d'USD) et noms de pays traduits. */

const SECTORS = ['real_estate', 'commercial', 'tourism', 'agriculture', 'livestock', 'fishing', 'industry', 'trade', 'infrastructure', 'energy', 'mining', 'technology', 'health', 'education', 'import_export', 'business', 'maritime', 'development'];

const SECTOR_ICON = {
  real_estate: 'building', commercial: 'store', tourism: 'bed', agriculture: 'leaf', livestock: 'cattle', fishing: 'fish', industry: 'factory',
  trade: 'ship', infrastructure: 'road', energy: 'sun', mining: 'mine', technology: 'cpu', health: 'health', education: 'book',
  import_export: 'swap', business: 'growth', maritime: 'anchor', development: 'globe'
};

/** Secteurs mis en avant (avec photo) sur la page d'accueil. */
const FEATURED_SECTORS = ['real_estate', 'commercial', 'tourism', 'agriculture', 'industry', 'infrastructure', 'energy', 'maritime'];

/** Tranches de montant recherché : [clé, minimum inclus, maximum exclu] en cents d'USD. */
const AMOUNT_RANGES = [
  ['a1', 0, 100000000],
  ['a2', 100000000, 500000000],
  ['a3', 500000000, 2000000000],
  ['a4', 2000000000, null]
];

/** Les pays sont saisis en français dans l'administration ; traduction d'affichage pour les plus courants. */
const COUNTRIES = {
  'Portugal': { en: 'Portugal', es: 'Portugal', de: 'Portugal' },
  'Côte d\'Ivoire': { en: 'Côte d\'Ivoire', es: 'Costa de Marfil', de: 'Elfenbeinküste' },
  'Espagne': { en: 'Spain', es: 'España', de: 'Spanien' },
  'Sénégal': { en: 'Senegal', es: 'Senegal', de: 'Senegal' },
  'Maroc': { en: 'Morocco', es: 'Marruecos', de: 'Marokko' },
  'Ghana': { en: 'Ghana', es: 'Ghana', de: 'Ghana' },
  'Canada': { en: 'Canada', es: 'Canadá', de: 'Kanada' },
  'Kenya': { en: 'Kenya', es: 'Kenia', de: 'Kenia' },
  'Vietnam': { en: 'Vietnam', es: 'Vietnam', de: 'Vietnam' },
  'Brésil': { en: 'Brazil', es: 'Brasil', de: 'Brasilien' },
  'Émirats arabes unis': { en: 'United Arab Emirates', es: 'Emiratos Árabes Unidos', de: 'Vereinigte Arabische Emirate' },
  'Indonésie': { en: 'Indonesia', es: 'Indonesia', de: 'Indonesien' },
  'Mexique': { en: 'Mexico', es: 'México', de: 'Mexiko' },
  'États-Unis': { en: 'United States', es: 'Estados Unidos', de: 'Vereinigte Staaten' },
  'Nigeria': { en: 'Nigeria', es: 'Nigeria', de: 'Nigeria' },
  'Maurice': { en: 'Mauritius', es: 'Mauricio', de: 'Mauritius' },
  'Équateur': { en: 'Ecuador', es: 'Ecuador', de: 'Ecuador' },
  'Sierra Leone': { en: 'Sierra Leone', es: 'Sierra Leona', de: 'Sierra Leone' },
  'Zambie': { en: 'Zambia', es: 'Zambia', de: 'Sambia' },
  'Tchad': { en: 'Chad', es: 'Chad', de: 'Tschad' },
  'Niger': { en: 'Niger', es: 'Níger', de: 'Niger' },
  'Philippines': { en: 'Philippines', es: 'Filipinas', de: 'Philippinen' },
  'Turquie': { en: 'Türkiye', es: 'Turquía', de: 'Türkei' },
  'Rwanda': { en: 'Rwanda', es: 'Ruanda', de: 'Ruanda' },
  'Honduras': { en: 'Honduras', es: 'Honduras', de: 'Honduras' },
  'Botswana': { en: 'Botswana', es: 'Botsuana', de: 'Botswana' },
  'Guinée': { en: 'Guinea', es: 'Guinea', de: 'Guinea' },
  'Togo': { en: 'Togo', es: 'Togo', de: 'Togo' },
  'Inde': { en: 'India', es: 'India', de: 'Indien' },
  'Bangladesh': { en: 'Bangladesh', es: 'Bangladés', de: 'Bangladesch' },
  'Angola': { en: 'Angola', es: 'Angola', de: 'Angola' },
  'France': { en: 'France', es: 'Francia', de: 'Frankreich' }
};

const countryName = (name, lang) => (COUNTRIES[name] && COUNTRIES[name][lang]) || name;

module.exports = { SECTORS, SECTOR_ICON, FEATURED_SECTORS, AMOUNT_RANGES, COUNTRIES, countryName };
