'use strict';
/**
 * Textes de la page d'accueil. Aucun chiffre sur la société (encours, performance, clients, agrément) :
 * les seules données chiffrées affichées sur la page proviennent des sources de marché officielles et des projets publiés.
 * Chaque texte existe en anglais et en français ; les autres langues affichent l'anglais.
 */
const L = (en, fr) => ({ en, fr });

module.exports = {
  hero: {
    eyebrow: L('International investment · Markets · Project financing', 'Investissement international · Marchés · Financement de projets'),
    title: L('Global Investment. Strategic Capital. Long-Term Vision.', 'Investissement mondial. Capital stratégique. Vision de long terme.'),
    sub: L('Professional expertise across financial markets, capital management, investment opportunities and high-potential project financing.',
      'Une expertise professionnelle des marchés financiers, de la gestion de capitaux, des opportunités d’investissement et du financement de projets à fort potentiel.'),
    cta1: L('Explore Investment Solutions', 'Découvrir nos solutions'),
    cta2: L('Discover Opportunities', 'Voir les opportunités'),
    cta3: L('Submit a Project', 'Soumettre un projet'),
    snapshot: L('Market snapshot', 'Aperçu des marchés'),
    snapshotNote: L('Official data, published with a delay', 'Données officielles, publiées avec un délai')
  },
  bar: {
    label: L('Markets', 'Marchés'),
    source: L('Sources: European Central Bank, World Bank. Official data shown with its date, provided for information only.',
      'Sources : Banque centrale européenne, Banque mondiale. Données officielles affichées avec leur date, à titre d’information.'),
    all: L('All market data', 'Toutes les données de marché')
  },
  expertise: {
    eyebrow: L('Our areas of expertise', 'Nos domaines d’expertise'),
    title: L('One firm, six complementary fields', 'Une société, six domaines complémentaires'),
    sub: L('From listed markets to real-economy projects, each field is handled with the same method: analysis, documented risks and clear information.',
      'Des marchés cotés aux projets de l’économie réelle, chaque domaine est traité avec la même méthode : analyse, risques documentés et information claire.'),
    more: L('Learn more', 'En savoir plus'),
    cards: [
      { photo: 'graphiques', icon: 'chart', href: '/markets', title: L('Financial Markets', 'Marchés financiers'), text: L('Stocks, bonds, ETFs and international market analysis.', 'Actions, obligations, ETF et analyse des marchés internationaux.') },
      { photo: 'bureaux', icon: 'wallet', href: '/fund-management', title: L('Investment Funds', 'Fonds d’investissement'), text: L('Presentation and analysis of investment fund strategies where applicable.', 'Présentation et analyse des stratégies de fonds d’investissement, le cas échéant.') },
      { photo: 'reunion', icon: 'pie', href: '/solutions#allocation', title: L('Capital Management', 'Gestion de capitaux'), text: L('Capital allocation, portfolio strategy and risk analysis.', 'Allocation de capitaux, stratégie de portefeuille et analyse des risques.') },
      { photo: 'centre-affaires', icon: 'search', href: '/opportunities', title: L('Investment Opportunities', 'Opportunités d’investissement'), text: L('Identification and analysis of international business opportunities.', 'Identification et analyse d’opportunités d’affaires internationales.') },
      { photo: 'poignee-main', icon: 'file', href: '/submit-project', title: L('Project Financing', 'Financement de projets'), text: L('Analysis and presentation of high-potential projects seeking financing.', 'Analyse et présentation de projets à fort potentiel en recherche de financement.') },
      { photo: 'port', icon: 'globe', href: '/solutions#sectors', title: L('Strategic Investments', 'Investissements stratégiques'), text: L('Real estate, infrastructure, agriculture, energy, industry, logistics and other strategic sectors.', 'Immobilier, infrastructures, agriculture, énergie, industrie, logistique et autres secteurs stratégiques.') }
    ]
  },
  markets: {
    eyebrow: L('Financial markets', 'Marchés financiers'),
    title: L('International markets, read through official data', 'Les marchés internationaux, lus à travers des données officielles'),
    sub: L('Indices, interest rates, currencies and economic indicators are published with their date and their source, and explained in plain language.',
      'Indices, taux d’intérêt, devises et indicateurs économiques sont publiés avec leur date et leur source, et expliqués simplement.'),
    cta: L('Explore Financial Markets', 'Explorer les marchés financiers'),
    since: L('since', 'depuis'),
    asOf: L('As of', 'Au'),
    over: L('Change over the period shown', 'Variation sur la période affichée'),
    none: L('Market data is temporarily unavailable from our sources. No figure is shown rather than an unverified one.', 'Les données de marché sont momentanément indisponibles auprès de nos sources. Aucun chiffre n’est affiché plutôt qu’un chiffre non vérifié.')
  },
  opps: {
    eyebrow: L('Investment opportunities', 'Opportunités d’investissement'),
    sub: L('A selection of projects, each presented with its country, sector, amount, stage and review status.', 'Une sélection de projets, chacun présenté avec son pays, son secteur, son montant, son stade et son statut d’examen.')
  },
  approach: {
    eyebrow: L('Our approach', 'Notre approche'),
    title: L('A structured method, from analysis to reporting', 'Une méthode structurée, de l’analyse au suivi'),
    sub: L('Every opportunity follows the same five steps before and after it is presented.', 'Chaque opportunité suit les cinq mêmes étapes, avant et après sa présentation.'),
    steps: [
      { icon: 'search', title: L('Market & Opportunity Analysis', 'Analyse des marchés et des opportunités'), text: L('Economic context, sector dynamics and fundamentals of each opportunity.', 'Contexte économique, dynamique du secteur et fondamentaux de chaque opportunité.') },
      { icon: 'shield', title: L('Risk Assessment', 'Évaluation des risques'), text: L('Identification of the risks, documented and stated clearly.', 'Identification des risques, documentés et énoncés clairement.') },
      { icon: 'check', title: L('Strategic Selection', 'Sélection stratégique'), text: L('Only files that are complete and coherent are taken further.', 'Seuls les dossiers complets et cohérents sont poursuivis.') },
      { icon: 'swap', title: L('Capital & Project Matching', 'Rapprochement capitaux – projets'), text: L('Connecting projects with partners whose criteria they meet.', 'Mise en relation des projets avec les partenaires dont ils remplissent les critères.') },
      { icon: 'chart', title: L('Monitoring & Reporting', 'Suivi et reporting'), text: L('Dated information and regular follow-up in a secure client area.', 'Informations datées et suivi régulier dans un espace client sécurisé.') }
    ]
  },
  world: {
    eyebrow: L('International reach', 'Portée internationale'),
    title: L('Connecting Capital with Opportunities Worldwide', 'Relier les capitaux aux opportunités dans le monde entier'),
    sub: L('Opportunities are studied across regions and sectors, wherever sound projects and long-term capital can meet.', 'Les opportunités sont étudiées dans toutes les régions et tous les secteurs, là où des projets solides et des capitaux de long terme peuvent se rencontrer.'),
    statOpps: L('opportunities currently presented', 'opportunités actuellement présentées'),
    statCountries: L('countries represented', 'pays représentés'),
    statSectors: L('business sectors covered', 'secteurs d’activité couverts'),
    sectors: [
      { icon: 'chart', label: L('Finance', 'Finance') }, { icon: 'building', label: L('Real estate', 'Immobilier') }, { icon: 'leaf', label: L('Agriculture', 'Agriculture') },
      { icon: 'sun', label: L('Energy', 'Énergie') }, { icon: 'road', label: L('Infrastructure', 'Infrastructures') }, { icon: 'factory', label: L('Industry', 'Industrie') },
      { icon: 'ship', label: L('Transport', 'Transport') }, { icon: 'store', label: L('Logistics', 'Logistique') }, { icon: 'cpu', label: L('Technology', 'Technologies') }
    ]
  },
  news: {
    eyebrow: L('Financial news', 'Actualités financières'),
    title: L('Latest Financial Insights', 'Dernières analyses financières'),
    sub: L('Economic and financial information drawn from official sources, each cited.', 'Des informations économiques et financières issues de sources officielles, toujours citées.'),
    all: L('All insights', 'Toutes les actualités')
  },
  cta: {
    title: L('Looking for Investment Opportunities or Project Financing?', 'Vous recherchez des opportunités d’investissement ou un financement de projet ?'),
    sub: L('Tell us what you are looking for: every request is read and answered by our team.', 'Dites-nous ce que vous recherchez : chaque demande est lue et reçoit une réponse de notre équipe.'),
    b1: L('Explore Opportunities', 'Voir les opportunités'),
    b2: L('Submit Your Project', 'Soumettre votre projet'),
    b3: L('Contact Our Team', 'Contacter notre équipe')
  }
};
