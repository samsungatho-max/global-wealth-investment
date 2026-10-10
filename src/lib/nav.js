'use strict';
/**
 * Navigation du site : une seule définition pour l'en-tête (menus déroulants), le menu mobile et le pied de page.
 * Chaque page n'apparaît qu'une fois dans le menu principal. Intitulés en anglais et en français ; les autres langues affichent l'anglais.
 */
const pages = require('../content/site-pages');
const markets = require('./markets');

const L = (en, fr) => ({ en, fr });

const GROUPS = [
  { id: 'company', href: '/company', label: L('Company', 'Société'), match: ['/company', '/page/about', '/page/faq'],
    intro: L('An international investment and project financing firm.', 'Une société internationale d’investissement et de financement de projets.'),
    items: [
      { href: '/company', icon: 'building', label: L('About us', 'Qui sommes-nous'), note: L('Mission, vision and values', 'Mission, vision et valeurs') },
      { href: '/company#approach', icon: 'search', label: L('Our approach', 'Notre approche'), note: L('How we analyse and select', 'Notre méthode d’analyse et de sélection') },
      { href: '/company#governance', icon: 'lock', label: L('Governance & compliance', 'Gouvernance et conformité'), note: L('Rules, controls and transparency', 'Règles, contrôles et transparence') },
      { href: '/page/faq', icon: 'book', label: L('FAQ', 'Questions fréquentes'), note: L('Answers to common questions', 'Réponses aux questions courantes') }
    ] },
  { id: 'markets', href: '/markets', label: L('Markets', 'Marchés'), match: ['/markets'], wide: true,
    intro: L('International markets explained simply, with official dated data.', 'Les marchés internationaux expliqués simplement, avec des données officielles datées.'),
    items: [{ href: '/markets', icon: 'globe', label: L('Markets overview', 'Vue d’ensemble'), note: L('Key indicators at a glance', 'Les indicateurs clés en un coup d’œil') }]
      .concat(markets.CATEGORIES.map((c) => ({ href: '/markets/' + c, icon: markets.CATEGORY_ICON[c], label: pages.MARKETS[c].title }))) },
  { id: 'solutions', href: '/solutions', label: L('Solutions', 'Solutions'), match: ['/solutions', '/fund-management', '/simulator', '/page/strategies'], wide: true,
    intro: L('Four families of solutions, each presented with its conditions and risks.', 'Quatre familles de solutions, présentées avec leurs conditions et leurs risques.'),
    items: [{ href: '/solutions', icon: 'pie', label: L('All our solutions', 'Toutes nos solutions'), note: L('Overview and information request', 'Vue d’ensemble et demande d’information') }]
      .concat(pages.SOLUTIONS.map((s) => ({ href: '/solutions#' + s.id, icon: s.icon, label: s.title })))
      .concat([
        { href: '/fund-management', icon: 'wallet', label: L('Fund management', 'Gestion de fonds'), note: L('Our method and scenario simulator', 'Notre méthode et simulateur de scénarios') },
        { href: '/simulator', icon: 'growth', label: L('Investment simulator', 'Simulateur d’investissement'), note: L('Indicative projections only', 'Projections purement indicatives') }
      ]) },
  { id: 'opportunities', href: '/opportunities', label: L('Opportunities', 'Opportunités'), match: ['/opportunities', '/submit-project', '/page/sectors', '/page/risks'],
    intro: L('International projects presented with their source, stage and risks.', 'Des projets internationaux présentés avec leur source, leur stade et leurs risques.'),
    items: [
      { href: '/opportunities', icon: 'globe', label: L('Business opportunities', 'Opportunités d’affaires'), note: L('Browse the catalogue', 'Parcourir le catalogue') },
      { href: '/page/sectors', icon: 'factory', label: L('Business sectors', 'Secteurs d’activité'), note: L('Where we look for value', 'Les domaines que nous étudions') },
      { href: '/page/risks', icon: 'shield', label: L('Risk management', 'Gestion des risques'), note: L('How risks are assessed', 'L’évaluation des risques') },
      { href: '/submit-project', icon: 'file', label: L('Submit a project', 'Soumettre un projet'), note: L('Have your file reviewed', 'Faire étudier votre dossier') }
    ] },
  { id: 'news', href: '/news', label: L('News', 'Actualités'), match: ['/news'] },
  { id: 'contact', href: '/contact', label: L('Contact', 'Contact'), match: ['/contact'] }
];

const LEGAL = [
  { href: '/page/legal', label: L('Legal notice', 'Mentions légales') },
  { href: '/page/terms', label: L('Terms and conditions', 'Conditions générales') },
  { href: '/page/privacy', label: L('Privacy policy', 'Politique de confidentialité') },
  { href: '/cookies', label: L('Cookie policy', 'Politique de cookies') }
];

const TEXT = {
  submit: L('Submit a project', 'Soumettre un projet'),
  solutions: L('Our solutions', 'Nos solutions'),
  client: L('Client area', 'Espace client'),
  legal: L('Legal', 'Informations légales'),
  contact: L('Contact', 'Contact'),
  follow: L('Follow us', 'Nous suivre'),
  top: L('Back to top', 'Haut de page')
};

/** Navigation prête à afficher dans la langue demandée, avec la rubrique courante repérée. */
function build(lang, path) {
  const p = (v) => pages.pick(v, lang);
  const groups = GROUPS.map((g) => ({
    id: g.id, href: g.href, label: p(g.label), intro: p(g.intro), wide: !!g.wide,
    current: g.match.some((m) => path === m || path.indexOf(m + '/') === 0),
    items: (g.items || []).map((i) => ({ href: i.href, icon: i.icon, label: p(i.label), note: p(i.note) }))
  }));
  const text = Object.fromEntries(Object.entries(TEXT).map(([k, v]) => [k, p(v)]));
  return { groups, legal: LEGAL.map((l) => ({ href: l.href, label: p(l.label) })), text };
}

/** Réseaux sociaux : seules les adresses https complètes saisies dans les paramètres sont affichées. */
const SOCIAL = [['linkedin', 'LinkedIn'], ['twitter', 'X'], ['facebook', 'Facebook'], ['instagram', 'Instagram']];
function social(company) {
  return SOCIAL.map(([k, name]) => ({ key: k, name, url: String((company || {})[k] || '').trim() })).filter((s) => /^https:\/\/[^\s"'<>]+$/i.test(s.url));
}

module.exports = { build, social };
