'use strict';
/**
 * Contenus des rubriques institutionnelles (Notre société, Solutions d'investissement, Gestion de fonds, Marchés financiers).
 * Textes rédigés sans aucune donnée chiffrée sur la société : ni encours, ni performance, ni agrément, ni partenaire bancaire.
 * Chaque texte existe en anglais et en français ; les autres langues affichent l'anglais.
 */
const L = (en, fr) => ({ en, fr });
const pick = (v, lang) => (v && (v[lang] || v.en)) || '';

const COMPANY = [
  { id: 'mission', icon: 'growth', title: L('Our mission', 'Notre mission'), body: L(
    'We connect capital with projects and companies that have sound fundamentals, and we help investors and entrepreneurs make informed decisions. Our role is to analyse, structure and present opportunities clearly, so that every party understands what is proposed, on what terms and with what risks.',
    'Nous rapprochons les capitaux des projets et des entreprises aux fondamentaux solides, et nous aidons investisseurs et entrepreneurs à décider en connaissance de cause. Notre rôle est d’analyser, de structurer et de présenter les opportunités avec clarté, afin que chaque partie comprenne ce qui est proposé, à quelles conditions et avec quels risques.') },
  { id: 'vision', icon: 'globe', title: L('Our international vision', 'Notre vision internationale'), body: L(
    'Opportunities are not confined to one market. We follow developments across regions and sectors, compare them using the same criteria, and pay particular attention to country, currency and regulatory factors that affect cross-border projects.',
    'Les opportunités ne se limitent pas à un seul marché. Nous suivons les évolutions de plusieurs régions et secteurs, nous les comparons selon les mêmes critères et nous portons une attention particulière aux facteurs pays, de change et réglementaires qui pèsent sur les projets transfrontaliers.') },
  { id: 'approach', icon: 'search', title: L('Our approach to investment', 'Notre approche de l’investissement'), body: L(
    'We favour a disciplined, long-term approach: understanding the business model, checking the assumptions, diversifying exposures and documenting each decision. We do not chase short-term movements and we never present an expected outcome as certain.',
    'Nous privilégions une approche disciplinée et de long terme : comprendre le modèle économique, vérifier les hypothèses, diversifier les expositions et documenter chaque décision. Nous ne cherchons pas à suivre les mouvements de court terme et nous ne présentons jamais un résultat attendu comme acquis.') },
  { id: 'risk', icon: 'shield', title: L('Our risk analysis methodology', 'Notre méthodologie d’analyse des risques'), body: L(
    'Each file is reviewed along several dimensions: market and demand, financial structure, execution capacity of the sponsor, legal and regulatory framework, country and currency exposure, and liquidity. The risks identified are stated in writing on each opportunity sheet.',
    'Chaque dossier est examiné selon plusieurs dimensions : marché et demande, structure financière, capacité d’exécution du porteur, cadre juridique et réglementaire, exposition pays et change, liquidité. Les risques identifiés figurent par écrit sur chaque fiche d’opportunité.') },
  { id: 'transparency', icon: 'eye', title: L('Our transparency commitments', 'Nos engagements de transparence'), body: L(
    'We distinguish what has been verified from what is declared by a sponsor. Amounts, dates and sources are shown as they are, fees are stated before any commitment, and no return is ever guaranteed. Market data on this website always carries its source and date.',
    'Nous distinguons ce qui a été vérifié de ce qui est déclaré par un porteur de projet. Les montants, les dates et les sources sont présentés tels quels, les frais sont indiqués avant tout engagement et aucun rendement n’est jamais garanti. Les données de marché de ce site portent toujours leur source et leur date.') },
  { id: 'governance', icon: 'lock', title: L('Governance and regulatory compliance', 'Gouvernance et conformité réglementaire'), body: L(
    'The services actually offered depend on the regulatory authorisations applicable in each jurisdiction. Identity verification is required before any financial operation, administrative actions are logged, and access to client documents is restricted. Company information is published in the legal notice.',
    'Les services effectivement proposés dépendent des autorisations réglementaires applicables dans chaque juridiction. La vérification d’identité est exigée avant toute opération financière, les actions administratives sont journalisées et l’accès aux documents des clients est restreint. Les informations sur la société figurent dans les mentions légales.') }
];

const REG_NOTICE = L(
  'The products and services actually offered depend on the regulatory authorisations applicable in each jurisdiction. Nothing on this page is an offer, personalised investment advice or a promise of financing. All investments carry a risk of capital loss.',
  'Les produits et services effectivement proposés dépendent des autorisations réglementaires applicables dans chaque juridiction. Rien sur cette page ne constitue une offre, un conseil en investissement personnalisé ni une promesse de financement. Tout investissement comporte un risque de perte en capital.');

const SOLUTIONS = [
  { id: 'markets', icon: 'chart', title: L('Stock market investment', 'Investissement boursier'),
    intro: L('Exposure to listed markets through diversified instruments, selected according to objectives and risk tolerance.', 'Une exposition aux marchés cotés à travers des instruments diversifiés, choisis selon les objectifs et la tolérance au risque.'),
    items: [L('Equities', 'Actions'), L('Index funds and ETFs', 'Fonds indiciels et ETF'), L('Bonds', 'Obligations'), L('Portfolio diversification', 'Diversification de portefeuille')],
    conditions: L('Subject to an assessment of the investor’s knowledge, objectives and situation, and to the instruments authorised in the investor’s jurisdiction.', 'Sous réserve d’une évaluation des connaissances, des objectifs et de la situation de l’investisseur, et des instruments autorisés dans sa juridiction.'),
    risks: L('Market prices can fall as well as rise. Losses may be significant over short periods, and currency movements affect foreign holdings.', 'Les cours peuvent baisser comme monter. Les pertes peuvent être importantes sur de courtes périodes, et les variations de change affectent les avoirs étrangers.') },
  { id: 'allocation', icon: 'pie', title: L('Capital management and allocation', 'Gestion et allocation de capitaux'),
    intro: L('A structured framework for deciding how capital is spread between asset classes, sectors and horizons.', 'Un cadre structuré pour décider de la répartition des capitaux entre classes d’actifs, secteurs et horizons.'),
    items: [L('Analysis of financial objectives', 'Analyse des objectifs financiers'), L('Assessment of risk tolerance', 'Étude de la tolérance au risque'), L('Asset diversification', 'Diversification des actifs'), L('Performance monitoring', 'Suivi des performances')],
    conditions: L('An allocation is defined in writing with the investor and reviewed periodically. Fees are communicated before any commitment.', 'Une allocation est définie par écrit avec l’investisseur et revue périodiquement. Les frais sont communiqués avant tout engagement.'),
    risks: L('Diversification reduces but does not remove risk. Past performance is not a reliable indicator of future results.', 'La diversification réduit le risque sans le supprimer. Les performances passées ne préjugent pas des résultats futurs.') },
  { id: 'private', icon: 'building', title: L('Investment in companies', 'Investissement dans les entreprises'),
    intro: L('Support for unlisted companies and entrepreneurial projects, from the review of the file to the structuring of a participation.', 'L’accompagnement d’entreprises non cotées et de projets entrepreneuriaux, de l’étude du dossier à la structuration d’une participation.'),
    items: [L('Equity participation', 'Participation au capital'), L('Investment in SMEs', 'Investissement dans les PME'), L('Support for entrepreneurial projects', 'Accompagnement de projets entrepreneuriaux'), L('Analysis of international opportunities', 'Analyse des opportunités internationales')],
    conditions: L('Each file undergoes a prior analysis. Submitting a project or a financing request is not an acceptance and does not guarantee that funds will be obtained.', 'Chaque dossier fait l’objet d’une analyse préalable. Le dépôt d’un projet ou d’une demande de financement ne vaut pas acceptation et ne garantit pas l’obtention des fonds.'),
    risks: L('Unlisted investments are illiquid and may result in the total loss of the capital invested. Timelines are long and outcomes uncertain.', 'Les investissements non cotés sont peu liquides et peuvent entraîner la perte totale du capital investi. Les délais sont longs et l’issue incertaine.') },
  { id: 'sectors', icon: 'globe', title: L('Investments in strategic sectors', 'Investissements dans les secteurs stratégiques'),
    intro: L('Projects rooted in the real economy, studied sector by sector with their specific constraints.', 'Des projets ancrés dans l’économie réelle, étudiés secteur par secteur avec leurs contraintes propres.'),
    items: [L('Agriculture and agribusiness', 'Agriculture et agro-industrie'), L('Real estate', 'Immobilier'), L('Infrastructure and construction', 'Infrastructures et BTP'), L('Transport and logistics', 'Transport et logistique'), L('Industry and processing', 'Industrie et transformation'), L('Mining and raw materials', 'Mines et matières premières')],
    conditions: L('Opportunities are published only once the information provided has been reviewed; each sheet states its validation status and the documents available.', 'Les opportunités ne sont publiées qu’après examen des informations fournies ; chaque fiche indique son statut de validation et les documents disponibles.'),
    risks: L('Construction delays, cost overruns, commodity prices, weather, regulation and country risk can all affect a project.', 'Retards de chantier, dépassements de coûts, prix des matières premières, climat, réglementation et risque pays peuvent tous affecter un projet.') }
];

const FUND = {
  /** Simulateur de scénarios : calcul purement arithmétique sur des variations hypothétiques, à la hausse comme à la baisse. */
  sim: {
    tag: L('Illustrative simulation', 'Simulation illustrative'),
    title: L('Scenario simulator', 'Simulateur de scénarios'),
    lead: L('Enter an amount, choose a currency, a hypothetical daily variation and a number of days: the simulator instantly applies compound growth and shows how the capital would change, day by day.',
      'Saisissez un montant, choisissez une devise, une variation journalière hypothétique et un nombre de jours : le simulateur applique aussitôt la capitalisation composée et montre l’évolution du capital, jour après jour.'),
    settings: L('Your simulation', 'Votre simulation'),
    amount: L('Initial capital', 'Capital initial'),
    currency: L('Currency', 'Devise'),
    pct: L('Hypothetical variation per day', 'Variation hypothétique par jour'),
    pctHint: L('From −100 % to +100 % per day. You choose the figure: it is an assumption, not a forecast.', 'De −100 % à +100 % par jour. Vous choisissez le chiffre : c’est une hypothèse, pas une prévision.'),
    duration: L('Number of days', 'Nombre de jours'),
    daysHint: L('Pick a duration or type any number of days, from 1 to 60.', 'Choisissez une durée ou saisissez un nombre de jours, de 1 à 60.'),
    dayOptions: [1, 2, 3, 7, 15, 30],
    day: L('day', 'jour'), days: L('days', 'jours'), dayCap: L('Day', 'Jour'),
    total: L('Theoretical total amount', 'Montant total théorique'),
    initial: L('Initial capital', 'Capital initial'),
    gain: L('Cumulative gain', 'Gain cumulé'),
    loss: L('Cumulative loss', 'Perte cumulée'),
    cum: L('Cumulative percentage', 'Pourcentage cumulé'),
    rate: L('Daily rate', 'Taux journalier'),
    span: L('Duration', 'Durée'),
    chart: L('Mathematical change in capital over the selected number of days', 'Évolution mathématique du capital sur le nombre de jours sélectionné'),
    chartCap: L('Mathematical curve: initial capital × (1 + daily rate) ^ number of days. No real investment grows at a constant rate every day.',
      'Courbe mathématique : capital initial × (1 + taux journalier) ^ nombre de jours. Aucun placement réel ne progresse à taux constant chaque jour.'),
    short: L('Hypothetical figures: neither a forecast nor a guaranteed return. Investing involves a risk of capital loss.', 'Chiffres hypothétiques : ni prévision ni rendement garanti. Investir comporte un risque de perte en capital.'),
    table: L('Day-by-day detail', 'Détail jour par jour'),
    tableLead: L('Each day, the variation applies to the capital reached the day before.', 'Chaque jour, la variation s’applique au capital atteint la veille.'),
    thDay: L('Day', 'Jour'), thStart: L('Capital at start', 'Capital en début de journée'), thChange: L('Change of the day', 'Variation du jour'), thEnd: L('Capital at end', 'Capital en fin de journée'), thCum: L('Cumulative', 'Cumul'),
    compare: L('Compare several daily rates', 'Comparer plusieurs taux journaliers'),
    compareLead: L('The same capital over the same number of days, under five different daily variations. Change any percentage to see its effect, or apply it to the chart.',
      'Le même capital sur le même nombre de jours, soumis à cinq variations journalières différentes. Modifiez un pourcentage pour en voir l’effet, ou appliquez-le au graphique.'),
    scenario: L('Scenario', 'Scénario'),
    change: L('Gain or loss', 'Gain ou perte'),
    final: L('Total', 'Total'),
    apply: L('Show on the chart', 'Afficher sur le graphique')
  },
  intro: L('Fund and capital management is a regulated activity. This page explains how we approach it; any management service is provided only within the limits of the authorisations held in the jurisdiction concerned.',
    'La gestion de fonds et de capitaux est une activité réglementée. Cette page explique notre approche ; tout service de gestion n’est fourni que dans la limite des autorisations détenues dans la juridiction concernée.'),
  steps: [
    { icon: 'user', title: L('Understanding objectives', 'Comprendre les objectifs'), body: L('Horizon, liquidity needs, constraints and tolerance for loss are established before anything else.', 'Horizon, besoins de liquidité, contraintes et tolérance à la perte sont établis avant toute chose.') },
    { icon: 'pie', title: L('Defining an allocation', 'Définir une allocation'), body: L('Capital is spread between asset classes and sectors so that no single event determines the outcome.', 'Les capitaux sont répartis entre classes d’actifs et secteurs pour qu’aucun événement isolé ne décide du résultat.') },
    { icon: 'search', title: L('Selecting and documenting', 'Sélectionner et documenter'), body: L('Each position is supported by an analysis, and the reasons for each decision are recorded.', 'Chaque position s’appuie sur une analyse, et les raisons de chaque décision sont consignées.') },
    { icon: 'chart', title: L('Monitoring and reporting', 'Suivre et rendre compte'), body: L('Valuations are dated and their source stated; the investor can consult them in a secure area.', 'Les valorisations sont datées et leur source indiquée ; l’investisseur les consulte dans un espace sécurisé.') }
  ]
};

/** Marchés financiers : présentation et risques de chaque catégorie. */
const MARKETS = {
  indices: { title: L('International stock indices', 'Indices boursiers internationaux'),
    intro: L('A stock index summarises the performance of a group of listed companies. It is used as a reference to follow a market, not as a product that can be bought directly.', 'Un indice boursier résume l’évolution d’un ensemble de sociétés cotées. Il sert de référence pour suivre un marché, et non de produit que l’on achète directement.'),
    risks: L('Indices can fall sharply and stay below a previous peak for years. A monthly average smooths daily movements and is not a tradable price.', 'Les indices peuvent chuter fortement et rester des années sous un précédent sommet. Une moyenne mensuelle lisse les mouvements quotidiens et n’est pas un cours négociable.') },
  equities: { title: L('Listed equities', 'Actions cotées en bourse'),
    intro: L('A share is a fraction of the capital of a company. Its price reflects expectations about future profits, and it may pay a dividend, which is never guaranteed.', 'Une action est une fraction du capital d’une société. Son cours reflète les anticipations de bénéfices futurs, et elle peut verser un dividende, qui n’est jamais garanti.'),
    risks: L('A single share can lose most or all of its value. Concentration in a few names increases risk.', 'Une action isolée peut perdre l’essentiel ou la totalité de sa valeur. La concentration sur quelques titres accroît le risque.') },
  bonds: { title: L('Bond markets', 'Marchés obligataires'),
    intro: L('A bond is a loan to a government or a company in exchange for interest. Its yield moves in the opposite direction to its price.', 'Une obligation est un prêt consenti à un État ou à une entreprise contre intérêts. Son rendement évolue en sens inverse de son prix.'),
    risks: L('When interest rates rise, existing bonds lose value. The issuer may default, and inflation erodes fixed payments.', 'Quand les taux montent, les obligations existantes perdent de la valeur. L’émetteur peut faire défaut, et l’inflation érode les paiements fixes.') },
  currencies: { title: L('International currencies', 'Devises internationales'),
    intro: L('Exchange rates determine the value of one currency in another. They affect every investment or project carried out in a foreign currency.', 'Les taux de change déterminent la valeur d’une monnaie dans une autre. Ils affectent tout investissement ou projet réalisé dans une devise étrangère.'),
    risks: L('Exchange rates can move quickly for economic or political reasons and can cancel out the return of an otherwise sound investment.', 'Les taux de change peuvent varier rapidement pour des raisons économiques ou politiques et annuler le rendement d’un investissement par ailleurs solide.') },
  commodities: { title: L('Commodities', 'Matières premières'),
    intro: L('Agricultural products, industrial metals and other raw materials are traded worldwide. Their prices depend on supply, demand, weather and transport.', 'Produits agricoles, métaux industriels et autres matières premières s’échangent dans le monde entier. Leurs prix dépendent de l’offre, de la demande, du climat et du transport.'),
    risks: L('Commodity prices are among the most volatile. They directly affect the profitability of agricultural, industrial and mining projects.', 'Les prix des matières premières comptent parmi les plus volatils. Ils pèsent directement sur la rentabilité des projets agricoles, industriels et miniers.') },
  metals: { title: L('Gold and precious metals', 'Or et métaux précieux'),
    intro: L('Gold, silver and platinum are held both as industrial inputs and as stores of value. They pay no income.', 'L’or, l’argent et le platine sont détenus à la fois comme intrants industriels et comme réserves de valeur. Ils ne versent aucun revenu.'),
    risks: L('Precious metals can remain flat or fall for long periods, and their price in a given currency also depends on exchange rates.', 'Les métaux précieux peuvent stagner ou baisser durablement, et leur prix dans une monnaie donnée dépend aussi des taux de change.') },
  energy: { title: L('Energy', 'Énergie'),
    intro: L('Oil, natural gas, coal and electricity prices shape production and transport costs across the economy.', 'Les prix du pétrole, du gaz naturel, du charbon et de l’électricité façonnent les coûts de production et de transport de toute l’économie.'),
    risks: L('Energy prices react strongly to geopolitical events, production decisions and regulation, including climate policy.', 'Les prix de l’énergie réagissent fortement aux événements géopolitiques, aux décisions de production et à la réglementation, notamment climatique.') },
  indicators: { title: L('Economic indicators', 'Indicateurs économiques'),
    intro: L('Growth, inflation and unemployment describe the economic environment in which markets and projects operate. They are published with a delay.', 'Croissance, inflation et chômage décrivent l’environnement économique dans lequel évoluent marchés et projets. Ils sont publiés avec retard.'),
    risks: L('Indicators are revised after publication and describe the past. They do not predict the behaviour of markets.', 'Les indicateurs sont révisés après publication et décrivent le passé. Ils ne prédisent pas le comportement des marchés.') }
};

const COOKIES = L(
  `## Cookies used on this website
This website uses a single technical cookie, required for it to work: a session cookie that keeps you signed in and protects forms against misuse. It contains no advertising identifier and is deleted when it expires.

## No tracking or advertising cookies
We do not use advertising cookies or third-party audience measurement cookies. No consent banner is therefore required for the cookie described above.

## Managing cookies
You can delete or block cookies in your browser settings. If you block the session cookie, the client area and the forms will no longer work.`,
  `## Cookies utilisés sur ce site
Ce site utilise un seul cookie technique, indispensable à son fonctionnement : un cookie de session qui vous maintient connecté et protège les formulaires contre les usages abusifs. Il ne contient aucun identifiant publicitaire et il est supprimé à son expiration.

## Aucun cookie publicitaire ou de suivi
Nous n’utilisons ni cookie publicitaire ni cookie tiers de mesure d’audience. Aucun bandeau de consentement n’est donc requis pour le cookie décrit ci-dessus.

## Gérer les cookies
Vous pouvez supprimer ou bloquer les cookies dans les réglages de votre navigateur. Si vous bloquez le cookie de session, l’espace client et les formulaires ne fonctionneront plus.`);

module.exports = { pick, COMPANY, REG_NOTICE, SOLUTIONS, FUND, MARKETS, COOKIES };
