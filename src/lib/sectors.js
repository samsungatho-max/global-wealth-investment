'use strict';
/** Catégories de projets, icônes associées, tranches de montant (en cents d'USD) et noms de pays traduits. */

const SECTORS = ['real_estate', 'commercial', 'agriculture', 'industry', 'energy', 'trade', 'infrastructure', 'tourism', 'technology', 'mining', 'development'];

const SECTOR_ICON = {
  real_estate: 'building', commercial: 'store', agriculture: 'leaf', industry: 'factory', energy: 'sun',
  trade: 'ship', infrastructure: 'road', tourism: 'bed', technology: 'cpu', mining: 'mine', development: 'globe'
};

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
  'France': { en: 'France', es: 'Francia', de: 'Frankreich' }
};

const countryName = (name, lang) => (COUNTRIES[name] && COUNTRIES[name][lang]) || name;

module.exports = { SECTORS, SECTOR_ICON, AMOUNT_RANGES, COUNTRIES, countryName };
