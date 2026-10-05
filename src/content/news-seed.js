'use strict';
/**
 * Publications initiales de la rubrique « Actualités et rapports ».
 *
 * RÈGLE : chaque chiffre ci-dessous provient de la source officielle citée (pages consultées le 5 octobre 2026).
 * Les textes sont des synthèses originales ; ils ne reproduisent pas les articles d'origine.
 * Ne rien ajouter ici qui ne soit pas vérifiable dans la source indiquée.
 *
 * Format d'un chiffre : { l: libellé par langue, n: nombre, d: décimales, u: unité, plus: afficher le signe, p: période par langue }
 *                    ou { l, v: valeur textuelle par langue, p }
 */

const L = (fr, en, es, de) => ({ fr, en, es, de });
const PT = L('points', 'points', 'puntos', 'Punkte');
const BN = L('Md USD', 'USD bn', 'mil M USD', 'Mrd. USD');

const ARTICLES = [
  // ------------------------------------------------------------------ FAO
  {
    slug: 'fao-indice-prix-alimentaires-septembre-2026', kind: 'news', region: 'world', sector: 'agriculture', inv_type: 'commodities',
    photo: 'champs', featured: 1, published_at: '2026-10-05 09:00:00',
    sources: [['FAO — FAO Food Price Index', 'https://www.fao.org/worldfoodsituation/foodpricesindex/en/', '2026-10-02']],
    figures: [
      { l: L('Indice FAO des prix alimentaires', 'FAO Food Price Index', 'Índice de precios de los alimentos de la FAO', 'FAO-Nahrungsmittelpreisindex'), n: 136.0, d: 1, u: PT, p: L('septembre 2026', 'September 2026', 'septiembre de 2026', 'September 2026') },
      { l: L('Variation sur un mois', 'Month-on-month change', 'Variación mensual', 'Veränderung zum Vormonat'), n: 1.5, d: 1, u: '%', plus: true, p: L('septembre / août 2026', 'September vs August 2026', 'septiembre / agosto de 2026', 'September ggü. August 2026') },
      { l: L('Variation sur un an', 'Year-on-year change', 'Variación interanual', 'Veränderung zum Vorjahr'), n: 5.8, d: 1, u: '%', plus: true, p: L('septembre 2026 / septembre 2025', 'September 2026 vs September 2025', 'septiembre de 2026 / septiembre de 2025', 'September 2026 ggü. September 2025') },
      { l: L('Écart avec le sommet de mars 2022', 'Gap to the March 2022 peak', 'Diferencia con el máximo de marzo de 2022', 'Abstand zum Höchststand vom März 2022'), n: -15.1, d: 1, u: '%', plus: true, p: L('septembre 2026', 'September 2026', 'septiembre de 2026', 'September 2026') },
      { l: L('Céréales : variation sur un an', 'Cereals: year-on-year change', 'Cereales: variación interanual', 'Getreide: Veränderung zum Vorjahr'), n: 17.2, d: 1, u: '%', plus: true, p: L('septembre 2026', 'September 2026', 'septiembre de 2026', 'September 2026') },
      { l: L('Sucre : variation sur un mois', 'Sugar: month-on-month change', 'Azúcar: variación mensual', 'Zucker: Veränderung zum Vormonat'), n: 6.1, d: 1, u: '%', plus: true, p: L('septembre 2026', 'September 2026', 'septiembre de 2026', 'September 2026') }
    ],
    chart: {
      title: L('Indices FAO par famille de produits — septembre 2026', 'FAO price indices by commodity group — September 2026', 'Índices de la FAO por grupo de productos — septiembre de 2026', 'FAO-Preisindizes nach Produktgruppe — September 2026'),
      unit: PT, d: 1,
      items: [
        [L('Huiles végétales', 'Vegetable oils', 'Aceites vegetales', 'Pflanzenöle'), 198.6],
        [L('Viande', 'Meat', 'Carne', 'Fleisch'), 127.9],
        [L('Céréales', 'Cereals', 'Cereales', 'Getreide'), 122.8],
        [L('Produits laitiers', 'Dairy', 'Lácteos', 'Milchprodukte'), 119.1],
        [L('Sucre', 'Sugar', 'Azúcar', 'Zucker'), 114.0]
      ]
    },
    t: {
      fr: {
        title: 'Prix alimentaires mondiaux : l’indice FAO repart à la hausse en septembre',
        summary: 'L’indice FAO des prix des produits alimentaires atteint 136,0 points en septembre 2026, en hausse de 1,5 % sur un mois, tiré par les céréales et le sucre.',
        body: 'L’Organisation des Nations unies pour l’alimentation et l’agriculture (FAO) a publié le 2 octobre 2026 son indice mensuel des prix alimentaires. Il s’établit à 136,0 points en septembre, soit 1,5 % de plus qu’en août et 5,8 % de plus qu’un an plus tôt. Il reste toutefois 15,1 % sous son sommet de mars 2022.\n\nLes céréales (+5,1 % sur un mois) et le sucre (+6,1 %) expliquent l’essentiel de la hausse. La FAO cite des contraintes logistiques en mer Noire, un temps sec dans certaines régions d’Amérique du Nord et de fortes pluies qui perturbent la récolte dans le Centre-Sud du Brésil. Les huiles végétales progressent légèrement, la viande recule de 1,1 % et les produits laitiers sont quasi stables.',
        takeaways: ['Les céréales sont 17,2 % plus chères qu’en septembre 2025 : un soutien pour les revenus des producteurs, un coût supplémentaire pour les transformateurs.', 'Les produits laitiers évoluent à l’inverse : leur indice est 19,1 % sous son niveau d’il y a un an.', 'Prochaine publication de l’indice : 6 novembre 2026.'],
        risks: 'L’indice mesure des prix internationaux de matières premières, pas les prix de détail ni la rentabilité d’un projet agricole. Il est révisé chaque mois et reste très sensible à la météo, à la logistique et au contexte géopolitique.'
      },
      en: {
        title: 'World food prices: the FAO index rises again in September',
        summary: 'The FAO Food Price Index reached 136.0 points in September 2026, up 1.5% on the month, driven by cereals and sugar.',
        body: 'The Food and Agriculture Organization of the United Nations (FAO) released its monthly food price index on 2 October 2026. It stood at 136.0 points in September, 1.5% above August and 5.8% higher than a year earlier, while remaining 15.1% below its March 2022 peak.\n\nCereals (+5.1% on the month) and sugar (+6.1%) account for most of the increase. FAO points to logistical constraints in the Black Sea region, dry weather in parts of North America and heavy rains disrupting the harvest in Brazil’s Centre-South. Vegetable oils edged up, meat fell by 1.1% and dairy was almost unchanged.',
        takeaways: ['Cereals are 17.2% more expensive than in September 2025: support for producers’ incomes, an extra cost for processors.', 'Dairy is moving the other way: its index is 19.1% below its level a year ago.', 'Next release of the index: 6 November 2026.'],
        risks: 'The index tracks international commodity prices, not retail prices or the profitability of a farming project. It is revised every month and remains highly sensitive to weather, logistics and geopolitics.'
      },
      es: {
        title: 'Precios mundiales de los alimentos: el índice de la FAO vuelve a subir en septiembre',
        summary: 'El índice de precios de los alimentos de la FAO alcanzó 136,0 puntos en septiembre de 2026, un 1,5 % más que el mes anterior, impulsado por los cereales y el azúcar.',
        body: 'La Organización de las Naciones Unidas para la Alimentación y la Agricultura (FAO) publicó el 2 de octubre de 2026 su índice mensual de precios de los alimentos. Se situó en 136,0 puntos en septiembre, un 1,5 % por encima de agosto y un 5,8 % más que un año antes, aunque sigue un 15,1 % por debajo de su máximo de marzo de 2022.\n\nLos cereales (+5,1 % mensual) y el azúcar (+6,1 %) explican la mayor parte de la subida. La FAO menciona limitaciones logísticas en la región del mar Negro, tiempo seco en zonas de América del Norte y fuertes lluvias que dificultan la cosecha en el Centro-Sur de Brasil. Los aceites vegetales suben ligeramente, la carne baja un 1,1 % y los lácteos se mantienen casi estables.',
        takeaways: ['Los cereales son un 17,2 % más caros que en septiembre de 2025: apoyo para los ingresos de los productores, coste adicional para los transformadores.', 'Los lácteos evolucionan en sentido contrario: su índice está un 19,1 % por debajo del nivel de hace un año.', 'Próxima publicación del índice: 6 de noviembre de 2026.'],
        risks: 'El índice mide precios internacionales de materias primas, no precios al por menor ni la rentabilidad de un proyecto agrícola. Se revisa cada mes y es muy sensible al clima, la logística y la geopolítica.'
      },
      de: {
        title: 'Weltweite Nahrungsmittelpreise: FAO-Index steigt im September wieder',
        summary: 'Der FAO-Nahrungsmittelpreisindex erreichte im September 2026 136,0 Punkte, 1,5 % mehr als im Vormonat – getrieben von Getreide und Zucker.',
        body: 'Die Ernährungs- und Landwirtschaftsorganisation der Vereinten Nationen (FAO) hat am 2. Oktober 2026 ihren monatlichen Nahrungsmittelpreisindex veröffentlicht. Er lag im September bei 136,0 Punkten, 1,5 % über dem Augustwert und 5,8 % über dem Vorjahr, bleibt aber 15,1 % unter dem Höchststand vom März 2022.\n\nGetreide (+5,1 % zum Vormonat) und Zucker (+6,1 %) erklären den größten Teil des Anstiegs. Die FAO nennt logistische Engpässe in der Schwarzmeerregion, Trockenheit in Teilen Nordamerikas und starke Regenfälle, die die Ernte im brasilianischen Zentrum-Süden behindern. Pflanzenöle legten leicht zu, Fleisch gab um 1,1 % nach, Milchprodukte blieben nahezu stabil.',
        takeaways: ['Getreide ist 17,2 % teurer als im September 2025: Rückenwind für Erzeugererlöse, Mehrkosten für Verarbeiter.', 'Milchprodukte entwickeln sich gegenläufig: Ihr Index liegt 19,1 % unter dem Vorjahresniveau.', 'Nächste Veröffentlichung des Index: 6. November 2026.'],
        risks: 'Der Index misst internationale Rohstoffpreise, nicht Verbraucherpreise oder die Rentabilität eines Agrarprojekts. Er wird monatlich revidiert und reagiert stark auf Wetter, Logistik und Geopolitik.'
      }
    }
  },

  // ------------------------------------------------------------------ BAsD
  {
    slug: 'asie-developpement-croissance-2026-basd', kind: 'news', region: 'asia', sector: 'macro', inv_type: 'markets',
    photo: 'hero', featured: 1, published_at: '2026-10-05 08:50:00',
    sources: [['Asian Development Bank — Asian Development Outlook, September 2026', 'https://www.adb.org/news/growth-developing-asia-and-pacific-slow-remain-resilient', '2026-09-23']],
    report_url: 'https://www.adb.org/publications/asian-development-outlook-september-2026',
    figures: [
      { l: L('Croissance de l’Asie-Pacifique en développement', 'Growth in developing Asia and the Pacific', 'Crecimiento de Asia y el Pacífico en desarrollo', 'Wachstum im sich entwickelnden Asien-Pazifik-Raum'), n: 5.0, d: 1, u: '%', p: L('prévision 2026', '2026 forecast', 'previsión 2026', 'Prognose 2026') },
      { l: L('Croissance enregistrée', 'Growth recorded', 'Crecimiento registrado', 'Verzeichnetes Wachstum'), n: 5.5, d: 1, u: '%', p: L('2025', '2025', '2025', '2025') },
      { l: L('Croissance attendue', 'Expected growth', 'Crecimiento previsto', 'Erwartetes Wachstum'), n: 5.1, d: 1, u: '%', p: L('prévision 2027', '2027 forecast', 'previsión 2027', 'Prognose 2027') },
      { l: L('Inflation régionale', 'Regional inflation', 'Inflación regional', 'Regionale Inflation'), n: 4.2, d: 1, u: '%', p: L('prévision 2026 (3 % en 2025)', '2026 forecast (3% in 2025)', 'previsión 2026 (3 % en 2025)', 'Prognose 2026 (3 % in 2025)') },
      { l: L('Asie du Sud', 'South Asia', 'Asia Meridional', 'Südasien'), n: 6.4, d: 1, u: '%', p: L('prévision de croissance 2026', '2026 growth forecast', 'previsión de crecimiento 2026', 'Wachstumsprognose 2026') }
    ],
    chart: {
      title: L('Prévisions de croissance 2026 par sous-région', '2026 growth forecasts by subregion', 'Previsiones de crecimiento 2026 por subregión', 'Wachstumsprognosen 2026 nach Teilregion'),
      unit: '%', d: 1,
      items: [
        [L('Asie du Sud', 'South Asia', 'Asia Meridional', 'Südasien'), 6.4],
        [L('Asie-Pacifique en développement', 'Developing Asia and Pacific', 'Asia-Pacífico en desarrollo', 'Entwicklungsländer Asien-Pazifik'), 5.0],
        [L('Asie du Sud-Est', 'Southeast Asia', 'Sudeste Asiático', 'Südostasien'), 4.7],
        [L('Caucase et Asie centrale', 'Caucasus and Central Asia', 'Cáucaso y Asia Central', 'Kaukasus und Zentralasien'), 3.7],
        [L('Pacifique', 'Pacific', 'Pacífico', 'Pazifik'), 3.0]
      ]
    },
    t: {
      fr: {
        title: 'Asie en développement : la croissance ralentirait à 5,0 % en 2026',
        summary: 'La Banque asiatique de développement prévoit 5,0 % de croissance en 2026 pour l’Asie-Pacifique en développement, contre 5,5 % en 2025, avec une inflation en hausse à 4,2 %.',
        body: 'Dans ses perspectives publiées le 23 septembre 2026, la Banque asiatique de développement (BAsD) attend une croissance de 5,0 % en 2026 pour les économies en développement d’Asie et du Pacifique, puis 5,1 % en 2027. C’est moins que les 5,5 % de 2025, mais 0,1 point au-dessus de sa prévision de juillet.\n\nUn investissement soutenu, les mesures de relance publiques et les exportations de technologies portées par le cycle d’investissement dans l’intelligence artificielle soutiennent l’activité. La BAsD cite deux risques principaux : une escalade des conflits, qui pourrait maintenir les prix de l’énergie élevés et volatils, et un épisode El Niño très marqué, attendu jusqu’au premier trimestre 2027. L’Asie du Sud reste la sous-région la plus dynamique (6,4 %), devant l’Asie du Sud-Est (4,7 %).',
        takeaways: ['La région reste parmi les plus dynamiques du monde malgré le ralentissement.', 'L’inflation remonterait à 4,2 % en 2026 avant de revenir à 3,5 % en 2027.', 'Les écarts sont importants entre sous-régions : de 3,0 % dans le Pacifique à 6,4 % en Asie du Sud.'],
        risks: 'Ce sont des prévisions, révisées plusieurs fois par an. La BAsD cite comme risques une escalade géopolitique, un El Niño plus sévère que prévu, un durcissement des conditions financières, une correction des valorisations liées à l’IA et un regain d’incertitude commerciale.'
      },
      en: {
        title: 'Developing Asia: growth expected to slow to 5.0% in 2026',
        summary: 'The Asian Development Bank forecasts 5.0% growth in 2026 for developing Asia and the Pacific, down from 5.5% in 2025, with inflation rising to 4.2%.',
        body: 'In its outlook published on 23 September 2026, the Asian Development Bank (ADB) expects growth of 5.0% in 2026 for the developing economies of Asia and the Pacific, then 5.1% in 2027. That is below the 5.5% recorded in 2025, but 0.1 percentage point above its July projection.\n\nStrong investment, government stimulus and technology exports driven by the artificial intelligence investment cycle are supporting activity. ADB cites two main risks: escalating conflict, which could keep energy prices elevated and volatile, and a very strong El Niño, forecast to persist through the first quarter of 2027. South Asia remains the fastest-growing subregion (6.4%), ahead of Southeast Asia (4.7%).',
        takeaways: ['The region remains among the most dynamic in the world despite the slowdown.', 'Inflation is expected to rise to 4.2% in 2026 before easing to 3.5% in 2027.', 'Gaps between subregions are wide: from 3.0% in the Pacific to 6.4% in South Asia.'],
        risks: 'These are forecasts, revised several times a year. ADB lists as risks further geopolitical escalation, a worse-than-expected El Niño, tighter financial conditions, a correction in AI-related valuations and renewed trade policy uncertainty.'
      },
      es: {
        title: 'Asia en desarrollo: el crecimiento se moderaría al 5,0 % en 2026',
        summary: 'El Banco Asiático de Desarrollo prevé un crecimiento del 5,0 % en 2026 para Asia y el Pacífico en desarrollo, frente al 5,5 % de 2025, con una inflación al alza hasta el 4,2 %.',
        body: 'En sus perspectivas publicadas el 23 de septiembre de 2026, el Banco Asiático de Desarrollo (BAsD) espera un crecimiento del 5,0 % en 2026 para las economías en desarrollo de Asia y el Pacífico, y del 5,1 % en 2027. Es menos que el 5,5 % registrado en 2025, pero 0,1 puntos por encima de su previsión de julio.\n\nUna inversión sólida, los estímulos públicos y las exportaciones tecnológicas impulsadas por el ciclo de inversión en inteligencia artificial sostienen la actividad. El BAsD cita dos riesgos principales: una escalada de los conflictos, que podría mantener los precios de la energía altos y volátiles, y un episodio de El Niño muy intenso, previsto hasta el primer trimestre de 2027. Asia Meridional sigue siendo la subregión más dinámica (6,4 %), por delante del Sudeste Asiático (4,7 %).',
        takeaways: ['La región sigue entre las más dinámicas del mundo pese a la desaceleración.', 'La inflación subiría al 4,2 % en 2026 antes de bajar al 3,5 % en 2027.', 'Las diferencias entre subregiones son amplias: del 3,0 % en el Pacífico al 6,4 % en Asia Meridional.'],
        risks: 'Son previsiones, revisadas varias veces al año. El BAsD cita como riesgos una escalada geopolítica, un El Niño peor de lo previsto, un endurecimiento de las condiciones financieras, una corrección de las valoraciones ligadas a la IA y una nueva incertidumbre comercial.'
      },
      de: {
        title: 'Entwicklungsländer Asiens: Wachstum dürfte 2026 auf 5,0 % nachlassen',
        summary: 'Die Asiatische Entwicklungsbank erwartet für die Entwicklungsländer Asiens und des Pazifiks 2026 ein Wachstum von 5,0 % nach 5,5 % im Jahr 2025 – bei einer auf 4,2 % steigenden Inflation.',
        body: 'In ihrem am 23. September 2026 veröffentlichten Ausblick erwartet die Asiatische Entwicklungsbank (ADB) für die Entwicklungsländer Asiens und des Pazifiks ein Wachstum von 5,0 % im Jahr 2026 und 5,1 % im Jahr 2027. Das liegt unter den 5,5 % von 2025, aber 0,1 Prozentpunkte über der Juli-Prognose.\n\nKräftige Investitionen, staatliche Konjunkturmaßnahmen und Technologieexporte im Zuge des KI-Investitionszyklus stützen die Konjunktur. Die ADB nennt zwei Hauptrisiken: eine Eskalation der Konflikte, die die Energiepreise hoch und volatil halten könnte, und einen sehr starken El Niño, der bis ins erste Quartal 2027 anhalten dürfte. Südasien bleibt die dynamischste Teilregion (6,4 %), vor Südostasien (4,7 %).',
        takeaways: ['Die Region zählt trotz der Abschwächung weiterhin zu den dynamischsten der Welt.', 'Die Inflation dürfte 2026 auf 4,2 % steigen und 2027 auf 3,5 % zurückgehen.', 'Die Unterschiede zwischen den Teilregionen sind groß: von 3,0 % im Pazifik bis 6,4 % in Südasien.'],
        risks: 'Es handelt sich um Prognosen, die mehrmals jährlich revidiert werden. Als Risiken nennt die ADB eine geopolitische Eskalation, einen stärkeren El Niño als erwartet, straffere Finanzierungsbedingungen, eine Korrektur KI-bezogener Bewertungen und neue handelspolitische Unsicherheit.'
      }
    }
  },

  // ------------------------------------------------------------------ BCE
  {
    slug: 'zone-euro-bce-hausse-taux-septembre-2026', kind: 'news', region: 'europe', sector: 'macro', inv_type: 'monetary',
    photo: 'immeuble-2', featured: 0, published_at: '2026-10-05 08:40:00',
    sources: [['European Central Bank — Monetary policy decisions', 'https://www.ecb.europa.eu/press/pr/date/2026/html/ecb.mp260910~314e508016.en.html', '2026-09-10']],
    figures: [
      { l: L('Taux de la facilité de dépôt', 'Deposit facility rate', 'Tipo de la facilidad de depósito', 'Zinssatz der Einlagefazilität'), n: 2.50, d: 2, u: '%', p: L('à compter du 16 septembre 2026', 'effective 16 September 2026', 'desde el 16 de septiembre de 2026', 'ab 16. September 2026') },
      { l: L('Taux des opérations principales de refinancement', 'Main refinancing operations rate', 'Tipo de las operaciones principales de financiación', 'Zinssatz der Hauptrefinanzierungsgeschäfte'), n: 2.65, d: 2, u: '%', p: L('à compter du 16 septembre 2026', 'effective 16 September 2026', 'desde el 16 de septiembre de 2026', 'ab 16. September 2026') },
      { l: L('Taux de la facilité de prêt marginal', 'Marginal lending facility rate', 'Tipo de la facilidad marginal de crédito', 'Zinssatz der Spitzenrefinanzierungsfazilität'), n: 2.90, d: 2, u: '%', p: L('à compter du 16 septembre 2026', 'effective 16 September 2026', 'desde el 16 de septiembre de 2026', 'ab 16. September 2026') },
      { l: L('Inflation projetée en zone euro', 'Projected euro area inflation', 'Inflación prevista en la zona del euro', 'Projizierte Inflation im Euroraum'), n: 3.0, d: 1, u: '%', p: L('2026 (puis 2,5 % en 2027 et 2,1 % en 2028)', '2026 (then 2.5% in 2027 and 2.1% in 2028)', '2026 (luego 2,5 % en 2027 y 2,1 % en 2028)', '2026 (danach 2,5 % 2027 und 2,1 % 2028)') },
      { l: L('Croissance du PIB projetée', 'Projected GDP growth', 'Crecimiento del PIB previsto', 'Projiziertes BIP-Wachstum'), n: 0.9, d: 1, u: '%', p: L('2026 (puis 1,4 % en 2027 et 1,5 % en 2028)', '2026 (then 1.4% in 2027 and 1.5% in 2028)', '2026 (luego 1,4 % en 2027 y 1,5 % en 2028)', '2026 (danach 1,4 % 2027 und 1,5 % 2028)') }
    ],
    chart: {
      title: L('Inflation projetée en zone euro (projections des services de la BCE, septembre 2026)', 'Projected euro area inflation (ECB staff projections, September 2026)', 'Inflación prevista en la zona del euro (proyecciones de los expertos del BCE, septiembre de 2026)', 'Projizierte Inflation im Euroraum (Projektionen der EZB-Fachleute, September 2026)'),
      unit: '%', d: 1,
      items: [[L('2026', '2026', '2026', '2026'), 3.0], [L('2027', '2027', '2027', '2027'), 2.5], [L('2028', '2028', '2028', '2028'), 2.1]]
    },
    t: {
      fr: {
        title: 'Zone euro : la BCE relève ses taux directeurs de 0,25 point',
        summary: 'Le 10 septembre 2026, la Banque centrale européenne a relevé ses trois taux directeurs de 25 points de base. Elle prévoit 3,0 % d’inflation et 0,9 % de croissance en 2026.',
        body: 'Le Conseil des gouverneurs de la Banque centrale européenne (BCE) a décidé le 10 septembre 2026 de relever ses trois taux directeurs de 25 points de base. Depuis le 16 septembre, le taux de la facilité de dépôt est de 2,50 %, celui des opérations principales de refinancement de 2,65 % et celui de la facilité de prêt marginal de 2,90 %.\n\nLa BCE explique que le conflit au Moyen-Orient continue de générer des pressions inflationnistes et que l’inflation devrait rester nettement au-dessus de sa cible pendant une période prolongée. Ses services projettent une inflation de 3,0 % en 2026, 2,5 % en 2027 et 2,1 % en 2028, et une croissance du PIB de 0,9 % en 2026, 1,4 % en 2027 et 1,5 % en 2028.',
        takeaways: ['Le coût du crédit augmente en zone euro : un paramètre direct pour les projets financés par emprunt, notamment immobiliers.', 'L’inflation ne reviendrait vers 2 % qu’en 2028 selon les projections.', 'La croissance attendue reste modeste : 0,9 % en 2026.'],
        risks: 'Les projections dépendent fortement de l’évolution des prix de l’énergie. La BCE juge que les risques sont orientés à la hausse pour l’inflation et à la baisse pour la croissance, avec une forte incertitude sur l’intensité et la durée du choc énergétique.'
      },
      en: {
        title: 'Euro area: the ECB raises its key interest rates by 0.25 point',
        summary: 'On 10 September 2026 the European Central Bank raised its three key interest rates by 25 basis points. It projects 3.0% inflation and 0.9% growth in 2026.',
        body: 'The Governing Council of the European Central Bank (ECB) decided on 10 September 2026 to raise its three key interest rates by 25 basis points. Since 16 September the deposit facility rate has been 2.50%, the main refinancing operations rate 2.65% and the marginal lending facility rate 2.90%.\n\nThe ECB explains that the conflict in the Middle East continues to generate inflation pressures and that inflation is set to remain well above target for an extended period. Its staff project inflation of 3.0% in 2026, 2.5% in 2027 and 2.1% in 2028, and GDP growth of 0.9% in 2026, 1.4% in 2027 and 1.5% in 2028.',
        takeaways: ['Borrowing costs are rising in the euro area: a direct parameter for debt-financed projects, real estate in particular.', 'According to the projections, inflation would only return to around 2% in 2028.', 'Expected growth remains modest: 0.9% in 2026.'],
        risks: 'The projections depend heavily on energy prices. The ECB sees risks tilted to the upside for inflation and to the downside for growth, with high uncertainty about the intensity and duration of the energy shock.'
      },
      es: {
        title: 'Zona del euro: el BCE sube sus tipos de interés oficiales 0,25 puntos',
        summary: 'El 10 de septiembre de 2026 el Banco Central Europeo subió sus tres tipos de interés oficiales 25 puntos básicos. Prevé una inflación del 3,0 % y un crecimiento del 0,9 % en 2026.',
        body: 'El Consejo de Gobierno del Banco Central Europeo (BCE) decidió el 10 de septiembre de 2026 subir sus tres tipos de interés oficiales 25 puntos básicos. Desde el 16 de septiembre, el tipo de la facilidad de depósito es del 2,50 %, el de las operaciones principales de financiación del 2,65 % y el de la facilidad marginal de crédito del 2,90 %.\n\nEl BCE explica que el conflicto en Oriente Medio sigue generando presiones inflacionistas y que la inflación se mantendrá muy por encima del objetivo durante un periodo prolongado. Sus expertos proyectan una inflación del 3,0 % en 2026, el 2,5 % en 2027 y el 2,1 % en 2028, y un crecimiento del PIB del 0,9 % en 2026, el 1,4 % en 2027 y el 1,5 % en 2028.',
        takeaways: ['El coste del crédito aumenta en la zona del euro: un parámetro directo para los proyectos financiados con deuda, en especial los inmobiliarios.', 'Según las proyecciones, la inflación no volvería a situarse en torno al 2 % hasta 2028.', 'El crecimiento previsto sigue siendo modesto: 0,9 % en 2026.'],
        risks: 'Las proyecciones dependen en gran medida de los precios de la energía. El BCE considera que los riesgos apuntan al alza para la inflación y a la baja para el crecimiento, con gran incertidumbre sobre la intensidad y la duración de la perturbación energética.'
      },
      de: {
        title: 'Euroraum: EZB erhöht ihre Leitzinsen um 0,25 Prozentpunkte',
        summary: 'Am 10. September 2026 hat die Europäische Zentralbank ihre drei Leitzinsen um 25 Basispunkte angehoben. Sie erwartet für 2026 eine Inflation von 3,0 % und ein Wachstum von 0,9 %.',
        body: 'Der EZB-Rat hat am 10. September 2026 beschlossen, die drei Leitzinsen um 25 Basispunkte anzuheben. Seit dem 16. September liegt der Zinssatz der Einlagefazilität bei 2,50 %, der der Hauptrefinanzierungsgeschäfte bei 2,65 % und der der Spitzenrefinanzierungsfazilität bei 2,90 %.\n\nDie EZB begründet dies damit, dass der Konflikt im Nahen Osten weiterhin Inflationsdruck erzeugt und die Inflation über einen längeren Zeitraum deutlich über dem Zielwert bleiben dürfte. Ihre Fachleute projizieren eine Inflation von 3,0 % für 2026, 2,5 % für 2027 und 2,1 % für 2028 sowie ein BIP-Wachstum von 0,9 % für 2026, 1,4 % für 2027 und 1,5 % für 2028.',
        takeaways: ['Kredite werden im Euroraum teurer: ein unmittelbarer Faktor für fremdfinanzierte Projekte, insbesondere Immobilien.', 'Den Projektionen zufolge kehrt die Inflation erst 2028 in die Nähe von 2 % zurück.', 'Das erwartete Wachstum bleibt verhalten: 0,9 % im Jahr 2026.'],
        risks: 'Die Projektionen hängen stark von den Energiepreisen ab. Die EZB sieht Aufwärtsrisiken für die Inflation und Abwärtsrisiken für das Wachstum, bei hoher Unsicherheit über Stärke und Dauer des Energieschocks.'
      }
    }
  },

  // ------------------------------------------------------------------ OMC baromètre
  {
    slug: 'omc-barometre-commerce-marchandises-septembre-2026', kind: 'news', region: 'world', sector: 'trade', inv_type: 'markets',
    photo: 'cargo', featured: 0, published_at: '2026-10-05 08:30:00',
    sources: [['WTO — Goods Trade Barometer', 'https://www.wto.org/english/news_e/news26_e/wtoi_09sep26_481_e.htm', '2026-09-09']],
    figures: [
      { l: L('Baromètre du commerce des marchandises', 'Goods Trade Barometer', 'Barómetro sobre el comercio de mercancías', 'Warenhandelsbarometer'), n: 102.0, d: 1, u: PT, p: L('septembre 2026 (101,7 en juin 2026)', 'September 2026 (101.7 in June 2026)', 'septiembre de 2026 (101,7 en junio de 2026)', 'September 2026 (101,7 im Juni 2026)') },
      { l: L('Composants électroniques', 'Electronic components', 'Componentes electrónicos', 'Elektronische Bauteile'), n: 104.9, d: 1, u: PT, p: L('septembre 2026', 'September 2026', 'septiembre de 2026', 'September 2026') },
      { l: L('Commandes à l’exportation', 'Export orders', 'Pedidos de exportación', 'Exportaufträge'), n: 103.5, d: 1, u: PT, p: L('septembre 2026', 'September 2026', 'septiembre de 2026', 'September 2026') },
      { l: L('Transport maritime par conteneurs', 'Container shipping', 'Transporte marítimo en contenedores', 'Containerschifffahrt'), n: 99.6, d: 1, u: PT, p: L('septembre 2026 — seul indice sous 100', 'September 2026 — only index below 100', 'septiembre de 2026 — único índice por debajo de 100', 'September 2026 — einziger Index unter 100') }
    ],
    chart: {
      title: L('Composantes du baromètre de l’OMC — septembre 2026 (valeur de référence : 100)', 'WTO barometer components — September 2026 (baseline: 100)', 'Componentes del barómetro de la OMC — septiembre de 2026 (valor de referencia: 100)', 'Komponenten des WTO-Barometers — September 2026 (Basiswert: 100)'),
      unit: PT, d: 1,
      items: [
        [L('Composants électroniques', 'Electronic components', 'Componentes electrónicos', 'Elektronische Bauteile'), 104.9],
        [L('Commandes à l’exportation', 'Export orders', 'Pedidos de exportación', 'Exportaufträge'), 103.5],
        [L('Fret aérien international', 'International air freight', 'Carga aérea internacional', 'Internationale Luftfracht'), 102.8],
        [L('Matières premières agricoles', 'Agricultural raw materials', 'Materias primas agrícolas', 'Agrarrohstoffe'), 102.6],
        [L('Produits automobiles', 'Automotive products', 'Productos de automoción', 'Automobilprodukte'), 101.5],
        [L('Transport par conteneurs', 'Container shipping', 'Transporte en contenedores', 'Containerschifffahrt'), 99.6]
      ]
    },
    t: {
      fr: {
        title: 'Commerce mondial : le baromètre de l’OMC reste au-dessus de 100',
        summary: 'Le baromètre du commerce des marchandises de l’OMC s’établit à 102,0 en septembre 2026, contre 101,7 en juin : les échanges résistent malgré un contexte difficile.',
        body: 'L’Organisation mondiale du commerce (OMC) a publié le 9 septembre 2026 son baromètre du commerce des marchandises. À 102,0, il se situe au-dessus de sa valeur de référence de 100 et légèrement au-dessus du niveau de juin (101,7). L’OMC y voit le signe d’une croissance des échanges qui résiste malgré les vents contraires.\n\nLes composants électroniques affichent l’indice le plus élevé (104,9), devant les commandes à l’exportation (103,5) et le fret aérien international (102,8). Seul le transport maritime par conteneurs passe sous 100 (99,6). L’OMC rappelle sa prévision de mars 2026 : une croissance du volume du commerce des marchandises de 1,9 % en 2026 dans son scénario central.',
        takeaways: ['L’électronique, portée par les investissements liés à l’intelligence artificielle, tire les échanges.', 'Le transport par conteneurs est le point faible du moment.', 'La prévision centrale de l’OMC pour 2026 reste une croissance modeste de 1,9 % en volume.'],
        risks: 'Le baromètre est un indicateur avancé de court terme, pas une prévision chiffrée. Dans le scénario de prix de l’énergie élevés de l’OMC, la croissance du commerce des marchandises tomberait à 1,4 % en 2026.'
      },
      en: {
        title: 'World trade: the WTO barometer stays above 100',
        summary: 'The WTO Goods Trade Barometer stood at 102.0 in September 2026, up from 101.7 in June: trade is holding up despite headwinds.',
        body: 'The World Trade Organization (WTO) published its Goods Trade Barometer on 9 September 2026. At 102.0, it stands above its baseline of 100 and slightly above the June reading (101.7). The WTO sees this as a sign of resilient trade growth despite headwinds.\n\nElectronic components show the highest index (104.9), ahead of export orders (103.5) and international air freight (102.8). Only container shipping falls below 100 (99.6). The WTO recalls its March 2026 forecast: merchandise trade volume growth of 1.9% in 2026 in its baseline scenario.',
        takeaways: ['Electronics, driven by investment related to artificial intelligence, are pulling trade.', 'Container shipping is the weak spot for now.', 'The WTO baseline forecast for 2026 remains modest growth of 1.9% in volume.'],
        risks: 'The barometer is a short-term leading indicator, not a numerical forecast. In the WTO high-energy-price scenario, merchandise trade growth would fall to 1.4% in 2026.'
      },
      es: {
        title: 'Comercio mundial: el barómetro de la OMC se mantiene por encima de 100',
        summary: 'El barómetro sobre el comercio de mercancías de la OMC se situó en 102,0 en septiembre de 2026, frente a 101,7 en junio: el comercio resiste pese a las dificultades.',
        body: 'La Organización Mundial del Comercio (OMC) publicó el 9 de septiembre de 2026 su barómetro sobre el comercio de mercancías. Con 102,0, se sitúa por encima de su valor de referencia de 100 y ligeramente por encima del nivel de junio (101,7). La OMC lo interpreta como señal de un crecimiento del comercio que resiste pese a los vientos en contra.\n\nLos componentes electrónicos presentan el índice más alto (104,9), por delante de los pedidos de exportación (103,5) y de la carga aérea internacional (102,8). Solo el transporte marítimo en contenedores queda por debajo de 100 (99,6). La OMC recuerda su previsión de marzo de 2026: un crecimiento del volumen del comercio de mercancías del 1,9 % en 2026 en su escenario central.',
        takeaways: ['La electrónica, impulsada por la inversión ligada a la inteligencia artificial, tira del comercio.', 'El transporte en contenedores es el punto débil del momento.', 'La previsión central de la OMC para 2026 sigue siendo un crecimiento modesto del 1,9 % en volumen.'],
        risks: 'El barómetro es un indicador adelantado de corto plazo, no una previsión numérica. En el escenario de precios elevados de la energía de la OMC, el crecimiento del comercio de mercancías bajaría al 1,4 % en 2026.'
      },
      de: {
        title: 'Welthandel: WTO-Barometer bleibt über 100',
        summary: 'Das Warenhandelsbarometer der WTO lag im September 2026 bei 102,0 nach 101,7 im Juni: Der Handel zeigt sich trotz Gegenwinds widerstandsfähig.',
        body: 'Die Welthandelsorganisation (WTO) hat am 9. September 2026 ihr Warenhandelsbarometer veröffentlicht. Mit 102,0 liegt es über dem Basiswert von 100 und leicht über dem Juniwert (101,7). Die WTO wertet dies als Zeichen für ein trotz Gegenwinds robustes Handelswachstum.\n\nElektronische Bauteile weisen den höchsten Index auf (104,9), vor Exportaufträgen (103,5) und internationaler Luftfracht (102,8). Nur die Containerschifffahrt liegt unter 100 (99,6). Die WTO erinnert an ihre Prognose vom März 2026: ein Wachstum des Warenhandelsvolumens von 1,9 % im Jahr 2026 im Basisszenario.',
        takeaways: ['Elektronik, getragen von Investitionen rund um künstliche Intelligenz, treibt den Handel.', 'Die Containerschifffahrt ist derzeit die Schwachstelle.', 'Die WTO-Basisprognose für 2026 bleibt ein verhaltenes Volumenwachstum von 1,9 %.'],
        risks: 'Das Barometer ist ein kurzfristiger Frühindikator, keine bezifferte Prognose. Im WTO-Szenario hoher Energiepreise würde das Wachstum des Warenhandels 2026 auf 1,4 % sinken.'
      }
    }
  },

  // ------------------------------------------------------------------ CNUCED
  {
    slug: 'investissement-direct-etranger-2025-cnuced', kind: 'news', region: 'world', sector: 'investment', inv_type: 'fdi',
    photo: 'skyline', featured: 1, published_at: '2026-10-05 08:20:00',
    sources: [['UNCTAD — World Investment Report 2026', 'https://unctad.org/news/global-investment-rises-6-16-trillion-development-gains-remain-uneven', '2026-07-08']],
    report_url: 'https://unctad.org/publication/world-investment-report-2026',
    figures: [
      { l: L('Investissement direct étranger mondial', 'Global foreign direct investment', 'Inversión extranjera directa mundial', 'Weltweite ausländische Direktinvestitionen'), v: L('1 600 Md USD (+6 %)', 'USD 1.6 trillion (+6%)', '1,6 billones USD (+6 %)', '1,6 Billionen USD (+6 %)'), p: L('2025', '2025', '2025', '2025') },
      { l: L('Flux vers les économies en développement', 'Flows to developing economies', 'Flujos hacia las economías en desarrollo', 'Zuflüsse in Entwicklungsländer'), v: L('901 Md USD (+2 %)', 'USD 901 billion (+2%)', '901 000 M USD (+2 %)', '901 Mrd. USD (+2 %)'), p: L('2025', '2025', '2025', '2025') },
      { l: L('Flux vers les économies développées', 'Flows to developed economies', 'Flujos hacia las economías desarrolladas', 'Zuflüsse in Industrieländer'), n: 11, d: 0, u: '%', plus: true, p: L('2025 / 2024', '2025 vs 2024', '2025 / 2024', '2025 ggü. 2024') },
      { l: L('Part des 20 premières économies d’accueil', 'Share of the top 20 host economies', 'Cuota de las 20 principales economías receptoras', 'Anteil der 20 größten Empfängerländer'), v: L('plus de 80 %', 'more than 80%', 'más del 80 %', 'mehr als 80 %'), p: L('2025', '2025', '2025', '2025') },
      { l: L('Afrique', 'Africa', 'África', 'Afrika'), v: L('environ 70 Md USD', 'about USD 70 billion', 'unos 70 000 M USD', 'rund 70 Mrd. USD'), p: L('2025', '2025', '2025', '2025') },
      { l: L('Secteurs stratégiques dans les projets nouveaux', 'Strategic sectors in greenfield projects', 'Sectores estratégicos en proyectos nuevos', 'Strategische Sektoren bei Neuansiedlungen'), v: L('44 % de la valeur (16 % en 2020)', '44% of value (16% in 2020)', '44 % del valor (16 % en 2020)', '44 % des Werts (16 % im Jahr 2020)'), p: L('2025', '2025', '2025', '2025') }
    ],
    chart: {
      title: L('Investissement direct étranger reçu en 2025, régions en développement', 'Foreign direct investment received in 2025, developing regions', 'Inversión extranjera directa recibida en 2025, regiones en desarrollo', 'Erhaltene Direktinvestitionen 2025, Entwicklungsregionen'),
      unit: BN, d: 0,
      items: [
        [L('Asie en développement', 'Developing Asia', 'Asia en desarrollo', 'Entwicklungsländer Asiens'), 644],
        [L('Amérique latine et Caraïbes', 'Latin America and the Caribbean', 'América Latina y el Caribe', 'Lateinamerika und Karibik'), 188],
        [L('Afrique (environ)', 'Africa (approx.)', 'África (aprox.)', 'Afrika (ca.)'), 70]
      ]
    },
    t: {
      fr: {
        title: 'Investissement étranger : rebond de 6 % en 2025, mais très concentré',
        summary: 'Selon la CNUCED, l’investissement direct étranger mondial a progressé de 6 % en 2025, à 1 600 milliards de dollars. Les 20 premières économies d’accueil en captent plus de 80 %.',
        body: 'Le Rapport sur l’investissement dans le monde 2026 de la CNUCED, publié en juillet 2026, fait état d’un investissement direct étranger (IDE) mondial de 1 600 milliards de dollars en 2025, en hausse de 6 % après deux années de baisse.\n\nLa reprise est inégale. Les flux vers les économies développées ont augmenté de 11 %, contre 2 % seulement pour les économies en développement (901 milliards de dollars). L’Asie en développement reste la première région d’accueil avec 644 milliards, l’Amérique latine et les Caraïbes progressent de 14 % à 188 milliards, et l’Afrique reçoit environ 70 milliards. Les pays les moins avancés n’attirent que 43 milliards, soit 2,7 % du total mondial.\n\nLes secteurs dits stratégiques (infrastructures d’intelligence artificielle, semi-conducteurs, technologies de la transition énergétique, minerais critiques) représentent 44 % de la valeur des projets nouveaux, contre 16 % en 2020.',
        takeaways: ['Les capitaux internationaux repartent, mais vers un petit nombre de pays et de secteurs.', 'L’Afrique reçoit environ 70 milliards de dollars : une part modeste du total mondial.', 'Technologies, énergie et minerais critiques concentrent une part croissante des nouveaux projets.'],
        risks: 'La CNUCED souligne que l’incertitude commerciale, les tensions géopolitiques, les conflits, le coût élevé du financement et la fragmentation économique continuent de peser sur les décisions d’investissement. Les données d’IDE sont régulièrement révisées.'
      },
      en: {
        title: 'Foreign investment: a 6% rebound in 2025, but highly concentrated',
        summary: 'According to UNCTAD, global foreign direct investment rose 6% in 2025 to USD 1.6 trillion. The top 20 host economies attracted more than 80% of it.',
        body: 'UNCTAD’s World Investment Report 2026, published in July 2026, reports global foreign direct investment (FDI) of USD 1.6 trillion in 2025, up 6% after two years of decline.\n\nThe recovery is uneven. Flows to developed economies rose by 11%, against only 2% for developing economies (USD 901 billion). Developing Asia remains the largest recipient region with USD 644 billion, Latin America and the Caribbean rose 14% to USD 188 billion, and Africa received about USD 70 billion. Least developed countries attracted only USD 43 billion, or 2.7% of the global total.\n\nSo-called strategic sectors (AI infrastructure, semiconductors, energy transition technologies, critical minerals) account for 44% of the value of greenfield projects, up from 16% in 2020.',
        takeaways: ['International capital is flowing again, but to a small number of countries and sectors.', 'Africa received about USD 70 billion: a modest share of the global total.', 'Technology, energy and critical minerals account for a growing share of new projects.'],
        risks: 'UNCTAD stresses that trade policy uncertainty, geopolitical tensions, conflicts, high financing costs and economic fragmentation continue to weigh on investment decisions. FDI data are regularly revised.'
      },
      es: {
        title: 'Inversión extranjera: repunte del 6 % en 2025, pero muy concentrado',
        summary: 'Según la UNCTAD, la inversión extranjera directa mundial aumentó un 6 % en 2025, hasta 1,6 billones de dólares. Las 20 principales economías receptoras captaron más del 80 %.',
        body: 'El Informe sobre las inversiones en el mundo 2026 de la UNCTAD, publicado en julio de 2026, cifra la inversión extranjera directa (IED) mundial en 1,6 billones de dólares en 2025, un 6 % más tras dos años de descenso.\n\nLa recuperación es desigual. Los flujos hacia las economías desarrolladas aumentaron un 11 %, frente a solo un 2 % para las economías en desarrollo (901 000 millones de dólares). Asia en desarrollo sigue siendo la principal región receptora con 644 000 millones, América Latina y el Caribe creció un 14 % hasta 188 000 millones y África recibió unos 70 000 millones. Los países menos adelantados solo atrajeron 43 000 millones, el 2,7 % del total mundial.\n\nLos llamados sectores estratégicos (infraestructura de inteligencia artificial, semiconductores, tecnologías de la transición energética, minerales críticos) representan el 44 % del valor de los proyectos nuevos, frente al 16 % en 2020.',
        takeaways: ['El capital internacional vuelve a fluir, pero hacia un número reducido de países y sectores.', 'África recibió unos 70 000 millones de dólares: una parte modesta del total mundial.', 'Tecnología, energía y minerales críticos concentran una parte creciente de los nuevos proyectos.'],
        risks: 'La UNCTAD subraya que la incertidumbre comercial, las tensiones geopolíticas, los conflictos, el alto coste de la financiación y la fragmentación económica siguen pesando en las decisiones de inversión. Los datos de IED se revisan periódicamente.'
      },
      de: {
        title: 'Auslandsinvestitionen: Erholung um 6 % im Jahr 2025, aber stark konzentriert',
        summary: 'Laut UNCTAD stiegen die weltweiten ausländischen Direktinvestitionen 2025 um 6 % auf 1,6 Billionen US-Dollar. Die 20 größten Empfängerländer zogen mehr als 80 % davon an.',
        body: 'Der im Juli 2026 veröffentlichte World Investment Report 2026 der UNCTAD beziffert die weltweiten ausländischen Direktinvestitionen (ADI) für 2025 auf 1,6 Billionen US-Dollar, ein Plus von 6 % nach zwei Jahren des Rückgangs.\n\nDie Erholung verläuft ungleich. Die Zuflüsse in Industrieländer stiegen um 11 %, in Entwicklungsländer nur um 2 % (901 Mrd. US-Dollar). Die Entwicklungsländer Asiens bleiben mit 644 Mrd. die größte Empfängerregion, Lateinamerika und die Karibik legten um 14 % auf 188 Mrd. zu, Afrika erhielt rund 70 Mrd. Die am wenigsten entwickelten Länder zogen nur 43 Mrd. an, 2,7 % der weltweiten Summe.\n\nSogenannte strategische Sektoren (KI-Infrastruktur, Halbleiter, Technologien der Energiewende, kritische Mineralien) machen 44 % des Werts neuer Projekte aus, nach 16 % im Jahr 2020.',
        takeaways: ['Internationales Kapital fließt wieder, aber in wenige Länder und Sektoren.', 'Afrika erhielt rund 70 Mrd. US-Dollar: ein bescheidener Anteil am weltweiten Gesamtvolumen.', 'Technologie, Energie und kritische Mineralien machen einen wachsenden Anteil der neuen Projekte aus.'],
        risks: 'Die UNCTAD betont, dass handelspolitische Unsicherheit, geopolitische Spannungen, Konflikte, hohe Finanzierungskosten und wirtschaftliche Fragmentierung die Investitionsentscheidungen weiter belasten. ADI-Daten werden regelmäßig revidiert.'
      }
    }
  },

  // ------------------------------------------------------------------ FMI
  {
    slug: 'fmi-croissance-mondiale-2026-2027', kind: 'news', region: 'world', sector: 'macro', inv_type: 'markets',
    photo: 'graphiques', featured: 0, published_at: '2026-10-05 08:10:00',
    sources: [['IMF — World Economic Outlook Update, July 2026', 'https://www.imf.org/en/Publications/WEO/Issues/2026/07/08/world-economic-outlook-update-july-2026', '2026-07-08']],
    figures: [
      { l: L('Croissance mondiale projetée', 'Projected global growth', 'Crecimiento mundial previsto', 'Projiziertes Weltwirtschaftswachstum'), n: 3.0, d: 1, u: '%', p: L('2026', '2026', '2026', '2026') },
      { l: L('Croissance mondiale projetée', 'Projected global growth', 'Crecimiento mundial previsto', 'Projiziertes Weltwirtschaftswachstum'), n: 3.4, d: 1, u: '%', p: L('2027', '2027', '2027', '2027') },
      { l: L('Inflation mondiale globale', 'Global headline inflation', 'Inflación general mundial', 'Weltweite Gesamtinflation'), n: 4.7, d: 1, u: '%', p: L('2026 (révisée à la hausse)', '2026 (revised up)', '2026 (revisada al alza)', '2026 (nach oben revidiert)') }
    ],
    chart: {
      title: L('Croissance mondiale projetée par le FMI (juillet 2026)', 'Global growth projected by the IMF (July 2026)', 'Crecimiento mundial previsto por el FMI (julio de 2026)', 'Vom IWF projiziertes Weltwirtschaftswachstum (Juli 2026)'),
      unit: '%', d: 1,
      items: [[L('2026', '2026', '2026', '2026'), 3.0], [L('2027', '2027', '2027', '2027'), 3.4]]
    },
    t: {
      fr: {
        title: 'FMI : croissance mondiale attendue à 3,0 % en 2026, l’inflation repart',
        summary: 'Dans sa mise à jour de juillet 2026, le FMI projette une croissance mondiale de 3,0 % en 2026 et 3,4 % en 2027, avec une inflation mondiale révisée à 4,7 % cette année.',
        body: 'Le Fonds monétaire international (FMI) a publié en juillet 2026 la mise à jour de ses Perspectives de l’économie mondiale. Il projette une croissance mondiale de 3,0 % en 2026 et de 3,4 % en 2027, un total globalement inchangé par rapport à ses prévisions d’avril.\n\nLe FMI note que l’économie mondiale a mieux absorbé le choc lié au conflit que ce qui était d’abord redouté. En revanche, la désinflation engagée début 2024 s’est interrompue : l’inflation mondiale globale est révisée à la hausse, à 4,7 % en 2026, tandis que la prévision d’inflation sous-jacente est globalement inchangée.\n\nLe FMI publie ses prochaines Perspectives complètes en octobre 2026 ; les chiffres ci-dessus sont ceux de la mise à jour de juillet.',
        takeaways: ['La croissance mondiale tient autour de 3 %, avec une accélération attendue en 2027.', 'Le retour de l’inflation est le principal changement par rapport au début d’année.', 'De nouvelles prévisions du FMI sont attendues en octobre 2026.'],
        risks: 'Ces projections sont antérieures aux Perspectives d’octobre 2026 et peuvent avoir été révisées depuis. Le FMI signale la persistance de l’inflation et l’évolution du conflit parmi les principaux risques.'
      },
      en: {
        title: 'IMF: global growth expected at 3.0% in 2026 as inflation picks up',
        summary: 'In its July 2026 update, the IMF projects global growth of 3.0% in 2026 and 3.4% in 2027, with global inflation revised up to 4.7% this year.',
        body: 'The International Monetary Fund (IMF) published its World Economic Outlook Update in July 2026. It projects global growth of 3.0% in 2026 and 3.4% in 2027, broadly unchanged on a cumulative basis from its April forecasts.\n\nThe IMF notes that the global economy weathered the war-related shock better than initially feared. However, the disinflation that began in early 2024 has stalled: global headline inflation is revised up to 4.7% in 2026, while the core inflation forecast is broadly unchanged.\n\nThe IMF publishes its next full Outlook in October 2026; the figures above are those of the July update.',
        takeaways: ['Global growth is holding at around 3%, with an acceleration expected in 2027.', 'The return of inflation is the main change since the start of the year.', 'New IMF forecasts are expected in October 2026.'],
        risks: 'These projections pre-date the October 2026 Outlook and may have been revised since. The IMF flags inflation persistence and developments in the conflict among the main risks.'
      },
      es: {
        title: 'FMI: crecimiento mundial previsto del 3,0 % en 2026, repunta la inflación',
        summary: 'En su actualización de julio de 2026, el FMI proyecta un crecimiento mundial del 3,0 % en 2026 y del 3,4 % en 2027, con una inflación mundial revisada al 4,7 % este año.',
        body: 'El Fondo Monetario Internacional (FMI) publicó en julio de 2026 la actualización de sus Perspectivas de la economía mundial. Proyecta un crecimiento mundial del 3,0 % en 2026 y del 3,4 % en 2027, un total prácticamente sin cambios respecto a sus previsiones de abril.\n\nEl FMI señala que la economía mundial resistió la perturbación derivada del conflicto mejor de lo que se temía. Sin embargo, la desinflación iniciada a comienzos de 2024 se ha estancado: la inflación general mundial se revisa al alza, al 4,7 % en 2026, mientras que la previsión de inflación subyacente apenas varía.\n\nEl FMI publica sus próximas Perspectivas completas en octubre de 2026; las cifras anteriores corresponden a la actualización de julio.',
        takeaways: ['El crecimiento mundial se mantiene en torno al 3 %, con una aceleración prevista en 2027.', 'El repunte de la inflación es el principal cambio desde comienzos de año.', 'Se esperan nuevas previsiones del FMI en octubre de 2026.'],
        risks: 'Estas proyecciones son anteriores a las Perspectivas de octubre de 2026 y pueden haber sido revisadas. El FMI señala la persistencia de la inflación y la evolución del conflicto entre los principales riesgos.'
      },
      de: {
        title: 'IWF: Weltwirtschaft soll 2026 um 3,0 % wachsen, Inflation zieht an',
        summary: 'In seiner Aktualisierung vom Juli 2026 erwartet der IWF ein Weltwirtschaftswachstum von 3,0 % für 2026 und 3,4 % für 2027; die weltweite Inflation wird für dieses Jahr auf 4,7 % nach oben revidiert.',
        body: 'Der Internationale Währungsfonds (IWF) hat im Juli 2026 die Aktualisierung seines Weltwirtschaftsausblicks veröffentlicht. Er projiziert ein globales Wachstum von 3,0 % für 2026 und 3,4 % für 2027 – kumuliert weitgehend unverändert gegenüber den April-Prognosen.\n\nDer IWF stellt fest, dass die Weltwirtschaft den kriegsbedingten Schock besser verkraftet hat als zunächst befürchtet. Die Anfang 2024 begonnene Disinflation ist jedoch ins Stocken geraten: Die weltweite Gesamtinflation wird für 2026 auf 4,7 % nach oben revidiert, während die Prognose für die Kerninflation weitgehend unverändert bleibt.\n\nDer IWF veröffentlicht seinen nächsten vollständigen Ausblick im Oktober 2026; die genannten Zahlen stammen aus der Juli-Aktualisierung.',
        takeaways: ['Das globale Wachstum hält sich bei rund 3 %, für 2027 wird eine Beschleunigung erwartet.', 'Die Rückkehr der Inflation ist die wichtigste Veränderung seit Jahresbeginn.', 'Neue IWF-Prognosen werden im Oktober 2026 erwartet.'],
        risks: 'Diese Projektionen liegen vor dem Ausblick vom Oktober 2026 und können inzwischen revidiert worden sein. Der IWF nennt die Hartnäckigkeit der Inflation und die Entwicklung des Konflikts als wesentliche Risiken.'
      }
    }
  },

  // ------------------------------------------------------------------ AIE
  {
    slug: 'aie-investissement-energie-2026', kind: 'news', region: 'world', sector: 'energy', inv_type: 'infrastructure',
    photo: 'eolien', featured: 1, published_at: '2026-10-05 08:00:00',
    sources: [['International Energy Agency — World Energy Investment 2026', 'https://www.iea.org/reports/world-energy-investment-2026/executive-summary', '2026-05-28']],
    report_url: 'https://www.iea.org/reports/world-energy-investment-2026',
    figures: [
      { l: L('Investissement énergétique mondial attendu', 'Expected global energy investment', 'Inversión energética mundial prevista', 'Erwartete weltweite Energieinvestitionen'), v: L('3 400 Md USD (+5 %)', 'USD 3.4 trillion (+5%)', '3,4 billones USD (+5 %)', '3,4 Billionen USD (+5 %)'), p: L('2026 / 2025', '2026 vs 2025', '2026 / 2025', '2026 ggü. 2025') },
      { l: L('Niveau de référence', 'Reference level', 'Nivel de referencia', 'Vergleichswert'), v: L('2 700 Md USD', 'USD 2.7 trillion', '2,7 billones USD', '2,7 Billionen USD'), p: L('2015', '2015', '2015', '2015') },
      { l: L('Offre et infrastructures électriques', 'Electricity supply and infrastructure', 'Suministro e infraestructuras eléctricas', 'Stromversorgung und -infrastruktur'), v: L('1 600 Md USD', 'USD 1.6 trillion', '1,6 billones USD', '1,6 Billionen USD'), p: L('2026', '2026', '2026', '2026') },
      { l: L('Part des dépenses liées à l’électricité', 'Share of electricity-related spending', 'Cuota del gasto relacionado con la electricidad', 'Anteil der strombezogenen Ausgaben'), v: L('près de 60 %', 'nearly 60%', 'cerca del 60 %', 'knapp 60 %'), p: L('2026', '2026', '2026', '2026') },
      { l: L('Afrique', 'Africa', 'África', 'Afrika'), n: 110, d: 0, u: BN, p: L('2026', '2026', '2026', '2026') }
    ],
    chart: {
      title: L('Investissement énergétique attendu en 2026 par région', 'Expected energy investment in 2026 by region', 'Inversión energética prevista en 2026 por región', 'Erwartete Energieinvestitionen 2026 nach Region'),
      unit: BN, d: 0,
      items: [
        [L('Chine', 'China', 'China', 'China'), 940],
        [L('États-Unis', 'United States', 'Estados Unidos', 'USA'), 615],
        [L('Union européenne', 'European Union', 'Unión Europea', 'Europäische Union'), 440],
        [L('Moyen-Orient', 'Middle East', 'Oriente Medio', 'Naher Osten'), 195],
        [L('Amérique latine', 'Latin America', 'América Latina', 'Lateinamerika'), 190],
        [L('Inde', 'India', 'India', 'Indien'), 170],
        [L('Eurasie', 'Eurasia', 'Eurasia', 'Eurasien'), 130],
        [L('Japon et Corée', 'Japan and Korea', 'Japón y Corea', 'Japan und Korea'), 120],
        [L('Afrique', 'Africa', 'África', 'Afrika'), 110],
        [L('Asie du Sud-Est', 'Southeast Asia', 'Sudeste Asiático', 'Südostasien'), 105]
      ]
    },
    t: {
      fr: {
        title: 'Énergie : 3 400 milliards de dollars d’investissements attendus en 2026',
        summary: 'Selon l’Agence internationale de l’énergie, l’investissement énergétique mondial atteindrait 3 400 milliards de dollars en 2026 (+5 %), dont près de 60 % liés à l’électricité.',
        body: 'Dans son rapport World Energy Investment 2026, publié le 28 mai 2026, l’Agence internationale de l’énergie (AIE) estime que les investissements mondiaux dans l’énergie atteindront 3 400 milliards de dollars en 2026, soit 5 % de plus qu’en 2025. Ils étaient de 2 700 milliards en 2015.\n\nLes dépenses liées à l’électricité représentent déjà près de 60 % du total : 1 600 milliards de dollars pour l’offre et les infrastructures électriques, et 2 000 milliards en ajoutant l’électrification des usages. La Chine arrive en tête (940 milliards), devant les États-Unis (615) et l’Union européenne (440). L’Afrique totalise 110 milliards de dollars.\n\nL’AIE précise qu’environ les trois quarts des investissements prévus en 2026 reposent sur des décisions prises bien avant le début du conflit au Moyen-Orient : comme lors des chocs précédents, de nombreux effets ne seront visibles que plus tard.',
        takeaways: ['L’électricité (production, réseaux, électrification) concentre la majorité des investissements énergétiques.', 'L’Afrique ne reçoit que 110 milliards de dollars sur 3 400 : un écart important avec ses besoins.', 'La sécurité d’approvisionnement devient un critère de choix des projets, en plus des coûts.'],
        risks: 'Les montants 2026 sont des estimations publiées en mai 2026. L’AIE avertit que les effets du conflit au Moyen-Orient sur les décisions d’investissement n’apparaîtront que progressivement.'
      },
      en: {
        title: 'Energy: USD 3.4 trillion of investment expected in 2026',
        summary: 'According to the International Energy Agency, global energy investment is set to reach USD 3.4 trillion in 2026 (+5%), nearly 60% of it related to electricity.',
        body: 'In its World Energy Investment 2026 report, published on 28 May 2026, the International Energy Agency (IEA) estimates that global energy investment will reach USD 3.4 trillion in 2026, 5% more than in 2025. It stood at USD 2.7 trillion in 2015.\n\nElectricity-related spending already makes up nearly 60% of the total: USD 1.6 trillion for electricity supply and infrastructure, rising to USD 2 trillion when end-use electrification is included. China leads (USD 940 billion), ahead of the United States (615) and the European Union (440). Africa totals USD 110 billion.\n\nThe IEA notes that around three-quarters of the investment anticipated in 2026 is based on decisions made well before the Middle East conflict began: as with previous shocks, many impacts will only become visible later.',
        takeaways: ['Electricity (generation, grids, electrification) accounts for the majority of energy investment.', 'Africa receives only USD 110 billion out of 3.4 trillion: a wide gap with its needs.', 'Security of supply is becoming a criterion for choosing projects, alongside costs.'],
        risks: 'The 2026 amounts are estimates published in May 2026. The IEA warns that the effects of the Middle East conflict on investment decisions will only appear gradually.'
      },
      es: {
        title: 'Energía: se esperan 3,4 billones de dólares de inversión en 2026',
        summary: 'Según la Agencia Internacional de la Energía, la inversión energética mundial alcanzaría 3,4 billones de dólares en 2026 (+5 %), cerca del 60 % relacionada con la electricidad.',
        body: 'En su informe World Energy Investment 2026, publicado el 28 de mayo de 2026, la Agencia Internacional de la Energía (AIE) estima que la inversión mundial en energía alcanzará 3,4 billones de dólares en 2026, un 5 % más que en 2025. En 2015 era de 2,7 billones.\n\nEl gasto relacionado con la electricidad representa ya cerca del 60 % del total: 1,6 billones de dólares para el suministro y las infraestructuras eléctricas, y 2 billones si se incluye la electrificación de los usos finales. China encabeza la lista (940 000 millones), por delante de Estados Unidos (615 000) y la Unión Europea (440 000). África suma 110 000 millones de dólares.\n\nLa AIE precisa que alrededor de tres cuartas partes de la inversión prevista en 2026 se basa en decisiones tomadas mucho antes del inicio del conflicto en Oriente Medio: como en perturbaciones anteriores, muchos efectos solo serán visibles más adelante.',
        takeaways: ['La electricidad (generación, redes, electrificación) concentra la mayor parte de la inversión energética.', 'África solo recibe 110 000 millones de dólares de 3,4 billones: una gran brecha respecto a sus necesidades.', 'La seguridad de suministro se convierte en un criterio de elección de proyectos, además de los costes.'],
        risks: 'Los importes de 2026 son estimaciones publicadas en mayo de 2026. La AIE advierte de que los efectos del conflicto en Oriente Medio sobre las decisiones de inversión aparecerán de forma gradual.'
      },
      de: {
        title: 'Energie: 3,4 Billionen US-Dollar Investitionen für 2026 erwartet',
        summary: 'Laut Internationaler Energieagentur dürften die weltweiten Energieinvestitionen 2026 3,4 Billionen US-Dollar erreichen (+5 %), knapp 60 % davon mit Strombezug.',
        body: 'In ihrem am 28. Mai 2026 veröffentlichten Bericht World Energy Investment 2026 schätzt die Internationale Energieagentur (IEA), dass die weltweiten Energieinvestitionen 2026 3,4 Billionen US-Dollar erreichen werden, 5 % mehr als 2025. Im Jahr 2015 waren es 2,7 Billionen.\n\nStrombezogene Ausgaben machen bereits knapp 60 % der Gesamtsumme aus: 1,6 Billionen US-Dollar für Stromversorgung und -infrastruktur, 2 Billionen einschließlich der Elektrifizierung der Endnutzung. China liegt vorn (940 Mrd.), vor den USA (615) und der Europäischen Union (440). Auf Afrika entfallen 110 Mrd. US-Dollar.\n\nDie IEA weist darauf hin, dass rund drei Viertel der für 2026 erwarteten Investitionen auf Entscheidungen beruhen, die lange vor Beginn des Nahostkonflikts getroffen wurden: Wie bei früheren Schocks werden viele Auswirkungen erst später sichtbar.',
        takeaways: ['Strom (Erzeugung, Netze, Elektrifizierung) vereint den Großteil der Energieinvestitionen auf sich.', 'Afrika erhält nur 110 Mrd. von 3,4 Billionen US-Dollar: eine große Lücke gegenüber dem Bedarf.', 'Versorgungssicherheit wird neben den Kosten zum Kriterium bei der Projektauswahl.'],
        risks: 'Die Beträge für 2026 sind im Mai 2026 veröffentlichte Schätzungen. Die IEA warnt, dass sich die Folgen des Nahostkonflikts für Investitionsentscheidungen erst nach und nach zeigen werden.'
      }
    }
  },

  // ------------------------------------------------------------------ RAPPORT Afrique
  {
    slug: 'rapport-afrique-2026-croissance-financement', kind: 'report', region: 'africa', sector: 'macro', inv_type: 'infrastructure',
    photo: 'chantier', featured: 1, published_at: '2026-10-05 09:10:00',
    sources: [
      ['African Development Bank — African Economic Outlook 2026', 'https://www.afdb.org/en/news-and-events/press-releases/africas-growth-holds-firm-amid-global-turbulence-says-2026-african-economic-outlook-93626', '2026-05-26'],
      ['World Bank — Africa Economic Update, April 2026', 'https://www.worldbank.org/en/news/press-release/2026/04/08/sub-saharan-africa-s-growth-holds-but-downside-risks-mount', '2026-04-08']
    ],
    report_url: 'https://www.worldbank.org/en/region/afr/publication/africa-economic-update',
    figures: [
      { l: L('Croissance de l’Afrique (BAD)', 'Africa’s growth (AfDB)', 'Crecimiento de África (BAfD)', 'Wachstum Afrikas (AfDB)'), n: 4.2, d: 1, u: '%', p: L('prévision 2026 (4,4 % en 2025 et en 2027)', '2026 forecast (4.4% in 2025 and in 2027)', 'previsión 2026 (4,4 % en 2025 y en 2027)', 'Prognose 2026 (4,4 % in 2025 und 2027)') },
      { l: L('Croissance de l’Afrique subsaharienne (Banque mondiale)', 'Sub-Saharan Africa growth (World Bank)', 'Crecimiento de África subsahariana (Banco Mundial)', 'Wachstum Subsahara-Afrikas (Weltbank)'), n: 4.1, d: 1, u: '%', p: L('prévision 2026, comme en 2025', '2026 forecast, same as 2025', 'previsión 2026, igual que en 2025', 'Prognose 2026, wie 2025') },
      { l: L('Besoin de financement annuel pour les ODD (BAD)', 'Annual financing gap for the SDGs (AfDB)', 'Brecha anual de financiación para los ODS (BAfD)', 'Jährliche Finanzierungslücke für die SDGs (AfDB)'), v: L('plus de 1 300 Md USD', 'over USD 1.3 trillion', 'más de 1,3 billones USD', 'über 1,3 Billionen USD'), p: L('par an', 'per year', 'al año', 'pro Jahr') },
      { l: L('Ressources mobilisables avec des réformes (BAD)', 'Resources that reforms could unlock (AfDB)', 'Recursos movilizables con reformas (BAfD)', 'Durch Reformen mobilisierbare Mittel (AfDB)'), v: L('jusqu’à 1 430 Md USD', 'up to USD 1.43 trillion', 'hasta 1,43 billones USD', 'bis zu 1,43 Billionen USD'), p: L('par an', 'per year', 'al año', 'pro Jahr') },
      { l: L('Service de la dette publique extérieure / recettes (Banque mondiale)', 'External public debt service to revenue (World Bank)', 'Servicio de la deuda pública externa / ingresos (Banco Mundial)', 'Auslandsschuldendienst im Verhältnis zu den Einnahmen (Weltbank)'), n: 18, d: 0, u: '%', p: L('2025 (9 % en 2017)', '2025 (9% in 2017)', '2025 (9 % en 2017)', '2025 (9 % im Jahr 2017)') },
      { l: L('Investissement privé entraîné par 1 USD d’investissement public (BAD)', 'Private investment associated with each USD 1 of public investment (AfDB)', 'Inversión privada asociada a cada USD de inversión pública (BAfD)', 'Private Investitionen je 1 USD öffentlicher Investition (AfDB)'), v: L('environ 1,40 USD', 'about USD 1.40', 'unos 1,40 USD', 'rund 1,40 USD'), p: L('partenariats public-privé', 'public-private partnerships', 'asociaciones público-privadas', 'öffentlich-private Partnerschaften') }
    ],
    chart: {
      title: L('Prévisions de croissance 2026 par région d’Afrique (BAD)', '2026 growth forecasts by African region (AfDB)', 'Previsiones de crecimiento 2026 por región de África (BAfD)', 'Wachstumsprognosen 2026 nach afrikanischer Region (AfDB)'),
      unit: '%', d: 1,
      items: [
        [L('Afrique de l’Est', 'East Africa', 'África Oriental', 'Ostafrika'), 5.9],
        [L('Afrique de l’Ouest', 'West Africa', 'África Occidental', 'Westafrika'), 4.7],
        [L('Afrique du Nord', 'North Africa', 'África del Norte', 'Nordafrika'), 4.0],
        [L('Afrique centrale', 'Central Africa', 'África Central', 'Zentralafrika'), 3.8],
        [L('Afrique australe', 'Southern Africa', 'África Austral', 'Südliches Afrika'), 2.1]
      ]
    },
    t: {
      fr: {
        title: 'Afrique 2026 : une croissance qui résiste, un financement à mobiliser',
        summary: 'Rapport de synthèse à partir des publications de la Banque africaine de développement et de la Banque mondiale : croissance attendue autour de 4 % en 2026, mais un besoin de financement supérieur à 1 300 milliards de dollars par an.',
        body: '## Tendance générale\nLa Banque africaine de développement (BAD) prévoit une croissance de 4,2 % pour l’Afrique en 2026, après 4,4 % en 2025 et avant un retour à 4,4 % en 2027. Pour la seule Afrique subsaharienne, la Banque mondiale attend 4,1 % en 2026, comme en 2025, après avoir abaissé sa prévision de 0,3 point par rapport à octobre 2025.\n\n## Des régions très contrastées\nL’Afrique de l’Est reste la plus dynamique (5,9 % en 2026, contre 6,6 % en 2025), devant l’Afrique de l’Ouest (4,7 %), soutenue par la production agricole et les investissements d’infrastructure. L’Afrique du Nord atteindrait 4,0 %, l’Afrique centrale 3,8 % et l’Afrique australe 2,1 %, pénalisée par la faiblesse des mines et de l’agriculture et par le coût de l’énergie.\n\n## Le financement, enjeu central\nLa BAD chiffre à plus de 1 300 milliards de dollars par an le besoin de financement pour atteindre les Objectifs de développement durable. Elle estime qu’avec des réformes, le continent pourrait mobiliser jusqu’à 1 430 milliards par an : 469 milliards de recettes supplémentaires et environ 299 milliards d’économies grâce à un investissement public plus efficace. Les investisseurs institutionnels (fonds de pension, assureurs, fonds souverains) gèrent environ 4 000 milliards de dollars d’actifs, dont moins de 2,7 % sont alloués aux infrastructures et aux secteurs productifs en Afrique.\n\n## Leviers mis en avant par les institutions\nLa BAD relève le rôle de la production agricole et des investissements d’infrastructure dans la croissance, et appelle à approfondir les marchés de capitaux et les partenariats public-privé. La Banque mondiale insiste sur les politiques industrielles, les infrastructures, les compétences, l’accès au financement et l’intégration régionale via la Zone de libre-échange continentale africaine.',
        takeaways: ['La croissance africaine reste parmi les plus élevées du monde, mais elle ralentit légèrement en 2026.', 'Le poids de la dette a doublé : le service de la dette publique extérieure absorbe 18 % des recettes en 2025, contre 9 % en 2017.', 'Selon la BAD, chaque dollar d’investissement public est associé à environ 1,40 dollar d’investissement privé dans les partenariats public-privé.'],
        risks: 'Les deux institutions n’utilisent ni le même périmètre (Afrique entière pour la BAD, Afrique subsaharienne pour la Banque mondiale) ni les mêmes méthodes : leurs chiffres ne sont pas directement comparables, notamment pour l’inflation (10,4 % en 2026 selon la BAD ; 4,8 % selon la Banque mondiale). Les risques cités : tensions géopolitiques, prix de l’énergie et des engrais, volatilité financière, dépréciation des monnaies, recul de l’aide au développement.'
      },
      en: {
        title: 'Africa 2026: growth holds firm, financing still to be mobilised',
        summary: 'Summary report based on publications by the African Development Bank and the World Bank: growth expected at around 4% in 2026, but a financing gap exceeding USD 1.3 trillion a year.',
        body: '## Overall trend\nThe African Development Bank (AfDB) projects growth of 4.2% for Africa in 2026, after 4.4% in 2025 and before a return to 4.4% in 2027. For Sub-Saharan Africa alone, the World Bank expects 4.1% in 2026, the same as in 2025, after lowering its forecast by 0.3 percentage points compared with October 2025.\n\n## Sharp regional contrasts\nEast Africa remains the fastest-growing region (5.9% in 2026, against 6.6% in 2025), ahead of West Africa (4.7%), supported by agricultural production and infrastructure investment. North Africa is expected to reach 4.0%, Central Africa 3.8% and Southern Africa 2.1%, held back by weaker mining and agricultural output and by energy costs.\n\n## Financing, the central issue\nThe AfDB puts the annual financing gap to meet the Sustainable Development Goals at more than USD 1.3 trillion. It estimates that, with reforms, the continent could unlock up to USD 1.43 trillion a year: USD 469 billion in additional revenues and roughly USD 299 billion in savings from more efficient public investment. Institutional investors (pension funds, insurers, sovereign wealth funds) manage around USD 4 trillion in assets, of which less than 2.7% is allocated to infrastructure and productive sectors in Africa.\n\n## Levers highlighted by the institutions\nThe AfDB notes the role of agricultural production and infrastructure investment in growth, and calls for deeper capital markets and expanded public-private partnerships. The World Bank emphasises industrial policy, infrastructure, skills, access to finance and regional integration through the African Continental Free Trade Area.',
        takeaways: ['African growth remains among the highest in the world, but slows slightly in 2026.', 'The debt burden has doubled: external public debt service absorbs 18% of revenue in 2025, against 9% in 2017.', 'According to the AfDB, each dollar of public investment is associated with about USD 1.40 of private investment in public-private partnerships.'],
        risks: 'The two institutions use neither the same scope (all of Africa for the AfDB, Sub-Saharan Africa for the World Bank) nor the same methods: their figures are not directly comparable, notably for inflation (10.4% in 2026 according to the AfDB; 4.8% according to the World Bank). Risks cited: geopolitical tensions, energy and fertiliser prices, financial volatility, currency depreciation, declining development assistance.'
      },
      es: {
        title: 'África 2026: un crecimiento que resiste, una financiación por movilizar',
        summary: 'Informe de síntesis a partir de las publicaciones del Banco Africano de Desarrollo y del Banco Mundial: crecimiento previsto en torno al 4 % en 2026, pero una brecha de financiación superior a 1,3 billones de dólares al año.',
        body: '## Tendencia general\nEl Banco Africano de Desarrollo (BAfD) prevé un crecimiento del 4,2 % para África en 2026, tras el 4,4 % de 2025 y antes de volver al 4,4 % en 2027. Solo para África subsahariana, el Banco Mundial espera un 4,1 % en 2026, igual que en 2025, tras rebajar su previsión en 0,3 puntos respecto a octubre de 2025.\n\n## Regiones muy dispares\nÁfrica Oriental sigue siendo la más dinámica (5,9 % en 2026, frente al 6,6 % en 2025), por delante de África Occidental (4,7 %), apoyada en la producción agrícola y la inversión en infraestructuras. África del Norte alcanzaría el 4,0 %, África Central el 3,8 % y África Austral el 2,1 %, lastrada por la debilidad de la minería y la agricultura y por el coste de la energía.\n\n## La financiación, cuestión central\nEl BAfD cifra en más de 1,3 billones de dólares anuales la brecha de financiación para alcanzar los Objetivos de Desarrollo Sostenible. Estima que, con reformas, el continente podría movilizar hasta 1,43 billones al año: 469 000 millones en ingresos adicionales y unos 299 000 millones en ahorros gracias a una inversión pública más eficiente. Los inversores institucionales (fondos de pensiones, aseguradoras, fondos soberanos) gestionan unos 4 billones de dólares en activos, de los que menos del 2,7 % se destina a infraestructuras y sectores productivos en África.\n\n## Palancas destacadas por las instituciones\nEl BAfD señala el papel de la producción agrícola y de la inversión en infraestructuras en el crecimiento, y pide profundizar los mercados de capitales y las asociaciones público-privadas. El Banco Mundial insiste en la política industrial, las infraestructuras, las competencias, el acceso a la financiación y la integración regional a través de la Zona de Libre Comercio Continental Africana.',
        takeaways: ['El crecimiento africano sigue entre los más altos del mundo, pero se modera ligeramente en 2026.', 'El peso de la deuda se ha duplicado: el servicio de la deuda pública externa absorbe el 18 % de los ingresos en 2025, frente al 9 % en 2017.', 'Según el BAfD, cada dólar de inversión pública se asocia a unos 1,40 dólares de inversión privada en las asociaciones público-privadas.'],
        risks: 'Las dos instituciones no utilizan ni el mismo perímetro (toda África para el BAfD, África subsahariana para el Banco Mundial) ni los mismos métodos: sus cifras no son directamente comparables, en particular la inflación (10,4 % en 2026 según el BAfD; 4,8 % según el Banco Mundial). Riesgos citados: tensiones geopolíticas, precios de la energía y los fertilizantes, volatilidad financiera, depreciación de las monedas, descenso de la ayuda al desarrollo.'
      },
      de: {
        title: 'Afrika 2026: Wachstum hält stand, Finanzierung muss mobilisiert werden',
        summary: 'Zusammenfassender Bericht auf Basis von Veröffentlichungen der Afrikanischen Entwicklungsbank und der Weltbank: Wachstum von rund 4 % für 2026 erwartet, aber eine Finanzierungslücke von über 1,3 Billionen US-Dollar pro Jahr.',
        body: '## Gesamttrend\nDie Afrikanische Entwicklungsbank (AfDB) erwartet für Afrika 2026 ein Wachstum von 4,2 %, nach 4,4 % im Jahr 2025 und vor einer Rückkehr zu 4,4 % im Jahr 2027. Allein für Subsahara-Afrika rechnet die Weltbank 2026 mit 4,1 %, wie 2025, nachdem sie ihre Prognose gegenüber Oktober 2025 um 0,3 Prozentpunkte gesenkt hat.\n\n## Große regionale Unterschiede\nOstafrika bleibt die dynamischste Region (5,9 % im Jahr 2026 nach 6,6 % im Jahr 2025), vor Westafrika (4,7 %), gestützt durch Agrarproduktion und Infrastrukturinvestitionen. Nordafrika dürfte 4,0 % erreichen, Zentralafrika 3,8 % und das südliche Afrika 2,1 %, belastet durch schwächeren Bergbau, schwächere Landwirtschaft und Energiekosten.\n\n## Finanzierung als Kernfrage\nDie AfDB beziffert die jährliche Finanzierungslücke zur Erreichung der Ziele für nachhaltige Entwicklung auf über 1,3 Billionen US-Dollar. Mit Reformen könnte der Kontinent ihrer Einschätzung nach bis zu 1,43 Billionen pro Jahr mobilisieren: 469 Mrd. an zusätzlichen Einnahmen und rund 299 Mrd. an Einsparungen durch effizientere öffentliche Investitionen. Institutionelle Anleger (Pensionsfonds, Versicherer, Staatsfonds) verwalten rund 4 Billionen US-Dollar, von denen weniger als 2,7 % in Infrastruktur und produktive Sektoren in Afrika fließen.\n\n## Von den Institutionen hervorgehobene Hebel\nDie AfDB verweist auf die Rolle der Agrarproduktion und der Infrastrukturinvestitionen für das Wachstum und fordert tiefere Kapitalmärkte sowie mehr öffentlich-private Partnerschaften. Die Weltbank betont Industriepolitik, Infrastruktur, Qualifikationen, Zugang zu Finanzierung und regionale Integration über die Afrikanische Kontinentale Freihandelszone.',
        takeaways: ['Afrikas Wachstum zählt weiter zu den höchsten der Welt, schwächt sich 2026 aber leicht ab.', 'Die Schuldenlast hat sich verdoppelt: Der Auslandsschuldendienst beansprucht 2025 18 % der Einnahmen, nach 9 % im Jahr 2017.', 'Laut AfDB ist jeder Dollar öffentlicher Investition in öffentlich-privaten Partnerschaften mit rund 1,40 US-Dollar privater Investition verbunden.'],
        risks: 'Die beiden Institutionen verwenden weder denselben Zuschnitt (ganz Afrika bei der AfDB, Subsahara-Afrika bei der Weltbank) noch dieselben Methoden: Ihre Zahlen sind nicht direkt vergleichbar, insbesondere bei der Inflation (10,4 % für 2026 laut AfDB; 4,8 % laut Weltbank). Genannte Risiken: geopolitische Spannungen, Energie- und Düngemittelpreise, Finanzmarktvolatilität, Währungsabwertungen, rückläufige Entwicklungshilfe.'
      }
    }
  },

  // ------------------------------------------------------------------ RAPPORT Commerce
  {
    slug: 'rapport-commerce-mondial-2026-omc', kind: 'report', region: 'world', sector: 'trade', inv_type: 'markets',
    photo: 'port', featured: 0, published_at: '2026-10-05 08:05:00',
    sources: [
      ['WTO — Global Trade Outlook and Statistics, March 2026', 'https://www.wto.org/english/news_e/news26_e/stat_19mar26_329_e.htm', '2026-03-19'],
      ['WTO — Goods Trade Barometer', 'https://www.wto.org/english/news_e/news26_e/wtoi_09sep26_481_e.htm', '2026-09-09']
    ],
    report_url: 'https://www.wto.org/english/res_e/booksp_e/gtos0326_e.pdf',
    figures: [
      { l: L('Croissance du volume du commerce des marchandises', 'Merchandise trade volume growth', 'Crecimiento del volumen del comercio de mercancías', 'Wachstum des Warenhandelsvolumens'), n: 4.6, d: 1, u: '%', p: L('2025', '2025', '2025', '2025') },
      { l: L('Prévision centrale', 'Baseline forecast', 'Previsión central', 'Basisprognose'), n: 1.9, d: 1, u: '%', p: L('2026 (2,6 % en 2027)', '2026 (2.6% in 2027)', '2026 (2,6 % en 2027)', '2026 (2,6 % im Jahr 2027)') },
      { l: L('Scénario de prix de l’énergie élevés', 'High-energy-price scenario', 'Escenario de precios elevados de la energía', 'Szenario hoher Energiepreise'), n: 1.4, d: 1, u: '%', p: L('2026', '2026', '2026', '2026') },
      { l: L('Croissance du commerce des services', 'Services trade growth', 'Crecimiento del comercio de servicios', 'Wachstum des Dienstleistungshandels'), n: 4.8, d: 1, u: '%', p: L('prévision 2026 (5,3 % en 2025)', '2026 forecast (5.3% in 2025)', 'previsión 2026 (5,3 % en 2025)', 'Prognose 2026 (5,3 % im Jahr 2025)') },
      { l: L('Commerce de biens liés à l’IA', 'Trade in AI-related goods', 'Comercio de bienes relacionados con la IA', 'Handel mit KI-bezogenen Gütern'), v: L('4 180 Md USD (+21,9 %)', 'USD 4.18 trillion (+21.9%)', '4,18 billones USD (+21,9 %)', '4,18 Billionen USD (+21,9 %)'), p: L('2025 / 2024', '2025 vs 2024', '2025 / 2024', '2025 ggü. 2024') },
      { l: L('Part des biens liés à l’IA dans la croissance du commerce', 'Share of AI-related goods in trade growth', 'Cuota de los bienes ligados a la IA en el crecimiento del comercio', 'Anteil KI-bezogener Güter am Handelswachstum'), n: 42, d: 0, u: '%', p: L('2025', '2025', '2025', '2025') }
    ],
    chart: {
      title: L('Croissance prévue des importations de marchandises en 2026 par région (scénario central de l’OMC)', 'Forecast merchandise import growth in 2026 by region (WTO baseline)', 'Crecimiento previsto de las importaciones de mercancías en 2026 por región (escenario central de la OMC)', 'Prognostiziertes Wachstum der Warenimporte 2026 nach Region (WTO-Basisszenario)'),
      unit: '%', d: 1,
      items: [
        [L('Asie', 'Asia', 'Asia', 'Asien'), 3.3],
        [L('Afrique', 'Africa', 'África', 'Afrika'), 3.2],
        [L('Amérique du Sud', 'South America', 'América del Sur', 'Südamerika'), 2.5],
        [L('Europe', 'Europe', 'Europa', 'Europa'), 1.3],
        [L('Moyen-Orient', 'Middle East', 'Oriente Medio', 'Naher Osten'), 1.0],
        [L('Amérique du Nord', 'North America', 'América del Norte', 'Nordamerika'), 0.3],
        [L('CEI', 'CIS', 'CEI', 'GUS'), -2.0]
      ]
    },
    t: {
      fr: {
        title: 'Commerce mondial 2026 : ralentissement attendu, l’intelligence artificielle en soutien',
        summary: 'Rapport de synthèse à partir des publications de l’OMC : après +4,6 % en 2025, le commerce des marchandises ne progresserait que de 1,9 % en 2026. Les biens liés à l’IA ont représenté 42 % de la croissance des échanges en 2025.',
        body: '## Tendance générale\nSelon l’Organisation mondiale du commerce (OMC), le volume du commerce mondial des marchandises a augmenté de 4,6 % en 2025. Dans son scénario central publié le 19 mars 2026, il ne progresserait que de 1,9 % en 2026, avant 2,6 % en 2027. Le commerce des services ralentirait moins : 4,8 % en 2026 après 5,3 % en 2025.\n\n## Le moteur : les biens liés à l’intelligence artificielle\nLa valeur des échanges de biens liés à l’IA est passée de 3 430 à 4 180 milliards de dollars entre 2024 et 2025 (+21,9 %). Ces biens représentent environ un sixième du commerce mondial et ont expliqué 42 % de sa croissance en 2025.\n\n## Régions\nEn 2026, les importations de marchandises progresseraient le plus en Asie (3,3 %) et en Afrique (3,2 %), devant l’Amérique du Sud (2,5 %), l’Europe (1,3 %) et l’Amérique du Nord (0,3 %). Côté exportations, l’Asie et l’Amérique du Sud sont attendues à 3,5 %, l’Afrique à 1,2 %.\n\n## Le point à l’automne\nLe baromètre du commerce des marchandises publié le 9 septembre 2026 s’établit à 102,0, au-dessus de sa valeur de référence de 100 : les échanges résistent, tirés par l’électronique, tandis que le transport par conteneurs (99,6) est en retrait.\n\n## Logistique et matières premières\nL’OMC souligne la perturbation des corridors commerciaux : environ un tiers des exportations mondiales d’engrais transite par le détroit d’Ormuz, ce qui pèse sur l’agriculture des pays importateurs.',
        takeaways: ['La demande d’importations reste plus dynamique en Asie et en Afrique qu’en Europe ou en Amérique du Nord.', 'L’électronique et les biens liés à l’IA sont le premier moteur des échanges.', 'Les coûts de transport, d’assurance et d’engrais sont des points de vigilance pour les projets logistiques et agricoles.'],
        risks: 'Si les prix élevés de l’énergie persistent, l’OMC estime que la croissance du commerce des marchandises pourrait être réduite de 0,5 point, à 1,4 % en 2026. À l’inverse, elle pourrait gagner 0,5 point si le commerce de biens liés à l’IA reste aussi vigoureux qu’en 2025. Les prévisions datent de mars 2026.'
      },
      en: {
        title: 'World trade 2026: a slowdown expected, with artificial intelligence lending support',
        summary: 'Summary report based on WTO publications: after +4.6% in 2025, merchandise trade is expected to grow by only 1.9% in 2026. AI-related goods accounted for 42% of trade growth in 2025.',
        body: '## Overall trend\nAccording to the World Trade Organization (WTO), the volume of world merchandise trade grew by 4.6% in 2025. In its baseline scenario published on 19 March 2026, it would grow by only 1.9% in 2026, before 2.6% in 2027. Services trade would slow less: 4.8% in 2026 after 5.3% in 2025.\n\n## The engine: AI-related goods\nThe value of trade in AI-related goods rose from USD 3.43 trillion to USD 4.18 trillion between 2024 and 2025 (+21.9%). These goods make up about one-sixth of world trade and explained 42% of its growth in 2025.\n\n## Regions\nIn 2026, merchandise imports are expected to grow fastest in Asia (3.3%) and Africa (3.2%), ahead of South America (2.5%), Europe (1.3%) and North America (0.3%). On the export side, Asia and South America are expected at 3.5%, Africa at 1.2%.\n\n## The picture in the autumn\nThe Goods Trade Barometer published on 9 September 2026 stands at 102.0, above its baseline of 100: trade is holding up, driven by electronics, while container shipping (99.6) is lagging.\n\n## Logistics and commodities\nThe WTO highlights the disruption of trade corridors: about one-third of global fertiliser exports pass through the Strait of Hormuz, which weighs on agriculture in importing countries.',
        takeaways: ['Import demand remains more dynamic in Asia and Africa than in Europe or North America.', 'Electronics and AI-related goods are the main engine of trade.', 'Transport, insurance and fertiliser costs are points to watch for logistics and agricultural projects.'],
        risks: 'If high energy prices persist, the WTO estimates that merchandise trade growth could be reduced by 0.5 percentage points, to 1.4% in 2026. Conversely, it could gain 0.5 points if trade in AI-related goods stays as strong as in 2025. The forecasts date from March 2026.'
      },
      es: {
        title: 'Comercio mundial 2026: desaceleración prevista, con la inteligencia artificial como apoyo',
        summary: 'Informe de síntesis a partir de las publicaciones de la OMC: tras el +4,6 % de 2025, el comercio de mercancías solo crecería un 1,9 % en 2026. Los bienes relacionados con la IA supusieron el 42 % del crecimiento del comercio en 2025.',
        body: '## Tendencia general\nSegún la Organización Mundial del Comercio (OMC), el volumen del comercio mundial de mercancías creció un 4,6 % en 2025. En su escenario central publicado el 19 de marzo de 2026, solo crecería un 1,9 % en 2026, antes del 2,6 % en 2027. El comercio de servicios se frenaría menos: 4,8 % en 2026 tras el 5,3 % de 2025.\n\n## El motor: los bienes relacionados con la inteligencia artificial\nEl valor del comercio de bienes relacionados con la IA pasó de 3,43 a 4,18 billones de dólares entre 2024 y 2025 (+21,9 %). Estos bienes representan alrededor de una sexta parte del comercio mundial y explicaron el 42 % de su crecimiento en 2025.\n\n## Regiones\nEn 2026, las importaciones de mercancías crecerían más en Asia (3,3 %) y África (3,2 %), por delante de América del Sur (2,5 %), Europa (1,3 %) y América del Norte (0,3 %). En las exportaciones, se espera un 3,5 % para Asia y América del Sur y un 1,2 % para África.\n\n## La situación en otoño\nEl barómetro sobre el comercio de mercancías publicado el 9 de septiembre de 2026 se sitúa en 102,0, por encima de su valor de referencia de 100: el comercio resiste, impulsado por la electrónica, mientras que el transporte en contenedores (99,6) queda rezagado.\n\n## Logística y materias primas\nLa OMC destaca la perturbación de los corredores comerciales: alrededor de un tercio de las exportaciones mundiales de fertilizantes pasa por el estrecho de Ormuz, lo que afecta a la agricultura de los países importadores.',
        takeaways: ['La demanda de importaciones sigue siendo más dinámica en Asia y África que en Europa o América del Norte.', 'La electrónica y los bienes relacionados con la IA son el principal motor del comercio.', 'Los costes de transporte, seguros y fertilizantes son puntos de atención para los proyectos logísticos y agrícolas.'],
        risks: 'Si persisten los precios elevados de la energía, la OMC estima que el crecimiento del comercio de mercancías podría reducirse 0,5 puntos, hasta el 1,4 % en 2026. A la inversa, podría ganar 0,5 puntos si el comercio de bienes relacionados con la IA se mantiene tan fuerte como en 2025. Las previsiones datan de marzo de 2026.'
      },
      de: {
        title: 'Welthandel 2026: Abschwächung erwartet, künstliche Intelligenz als Stütze',
        summary: 'Zusammenfassender Bericht auf Basis von WTO-Veröffentlichungen: Nach +4,6 % im Jahr 2025 dürfte der Warenhandel 2026 nur um 1,9 % wachsen. KI-bezogene Güter machten 2025 42 % des Handelswachstums aus.',
        body: '## Gesamttrend\nLaut Welthandelsorganisation (WTO) ist das Volumen des weltweiten Warenhandels 2025 um 4,6 % gewachsen. Im Basisszenario vom 19. März 2026 würde es 2026 nur um 1,9 % zulegen, 2027 dann um 2,6 %. Der Dienstleistungshandel würde sich weniger abschwächen: 4,8 % im Jahr 2026 nach 5,3 % im Jahr 2025.\n\n## Der Motor: KI-bezogene Güter\nDer Wert des Handels mit KI-bezogenen Gütern stieg zwischen 2024 und 2025 von 3,43 auf 4,18 Billionen US-Dollar (+21,9 %). Diese Güter machen etwa ein Sechstel des Welthandels aus und erklärten 2025 42 % seines Wachstums.\n\n## Regionen\n2026 dürften die Warenimporte am stärksten in Asien (3,3 %) und Afrika (3,2 %) wachsen, vor Südamerika (2,5 %), Europa (1,3 %) und Nordamerika (0,3 %). Bei den Exporten werden für Asien und Südamerika 3,5 % erwartet, für Afrika 1,2 %.\n\n## Der Stand im Herbst\nDas am 9. September 2026 veröffentlichte Warenhandelsbarometer liegt bei 102,0 und damit über dem Basiswert von 100: Der Handel hält sich, getragen von der Elektronik, während die Containerschifffahrt (99,6) zurückbleibt.\n\n## Logistik und Rohstoffe\nDie WTO verweist auf gestörte Handelskorridore: Rund ein Drittel der weltweiten Düngemittelexporte passiert die Straße von Hormus, was die Landwirtschaft der Importländer belastet.',
        takeaways: ['Die Importnachfrage bleibt in Asien und Afrika dynamischer als in Europa oder Nordamerika.', 'Elektronik und KI-bezogene Güter sind der wichtigste Motor des Handels.', 'Transport-, Versicherungs- und Düngemittelkosten sind Punkte, die bei Logistik- und Agrarprojekten zu beachten sind.'],
        risks: 'Bei anhaltend hohen Energiepreisen könnte das Wachstum des Warenhandels laut WTO um 0,5 Prozentpunkte auf 1,4 % im Jahr 2026 sinken. Umgekehrt könnte es 0,5 Punkte gewinnen, wenn der Handel mit KI-bezogenen Gütern so stark bleibt wie 2025. Die Prognosen stammen vom März 2026.'
      }
    }
  }
];

const LOCALE = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES', de: 'de-DE' };
const pick = (v, lang) => (v && typeof v === 'object' ? v[lang] : v);

function fmt(n, d, lang, plus) {
  return new Intl.NumberFormat(LOCALE[lang], { minimumFractionDigits: d, maximumFractionDigits: d, signDisplay: plus ? 'exceptZero' : 'auto', useGrouping: true }).format(n);
}

function figureValue(f, lang) {
  if (f.v) return pick(f.v, lang);
  const unit = pick(f.u, lang);
  const sep = unit === '%' && lang === 'en' ? '' : ' ';
  return `${fmt(f.n, f.d, lang, f.plus)}${unit ? sep + unit : ''}`;
}

/** Transforme un article en ligne prête à insérer (champs i18n construits pour les 4 langues). */
function build(a) {
  const i18n = {};
  for (const lang of ['fr', 'en', 'es', 'de']) {
    const t = a.t[lang];
    i18n[lang] = {
      title: t.title, summary: t.summary, body: t.body,
      takeaways: t.takeaways.join('\n'),
      risks: t.risks,
      figures: a.figures.map((f) => `${pick(f.l, lang)} | ${figureValue(f, lang)} | ${pick(f.p, lang)}`).join('\n'),
      chart_title: a.chart ? pick(a.chart.title, lang) : '',
      chart_unit: a.chart ? pick(a.chart.unit, lang) : '',
      chart: a.chart ? a.chart.items.map(([l, v]) => `${pick(l, lang)} | ${v}`).join('\n') : ''
    };
  }
  return {
    slug: a.slug, kind: a.kind, region: a.region, sector: a.sector, inv_type: a.inv_type, photo_key: a.photo,
    featured: a.featured ? 1 : 0, published_at: a.published_at, report_url: a.report_url || null,
    sources: a.sources.map((s) => s.join(' | ')).join('\n'),
    i18n: JSON.stringify(i18n)
  };
}

module.exports = { ARTICLES, build };
