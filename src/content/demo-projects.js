'use strict';
/**
 * Fiches « Projet exemple » : SIMULATIONS destinées à illustrer la plateforme dans chaque catégorie.
 * Elles ne correspondent à aucun projet réel, aucune société et aucun résultat financier ;
 * elles sont marquées is_demo = 1 et affichées avec le bandeau « Projet exemple — simulation ».
 * Montants en dollars américains (USD). Aucun rendement n'est indiqué.
 */

const SUFFIX = { fr: '(projet exemple)', en: '(example project)', es: '(proyecto de ejemplo)', de: '(Beispielprojekt)' };

const NOTE = {
  fr: 'Projet exemple — simulation : cette fiche est fictive et sert uniquement à illustrer la plateforme. Elle ne correspond à aucun projet réel et ne constitue pas une offre.',
  en: 'Example project — simulation: this sheet is fictitious and only illustrates the platform. It does not correspond to any real project and is not an offer.',
  es: 'Proyecto de ejemplo — simulación: esta ficha es ficticia y solo sirve para ilustrar la plataforma. No corresponde a ningún proyecto real y no constituye una oferta.',
  de: 'Beispielprojekt — Simulation: Dieses Projektblatt ist fiktiv und dient nur der Veranschaulichung der Plattform. Es entspricht keinem realen Projekt und stellt kein Angebot dar.'
};

const CONDITIONS = {
  fr: 'Projet exemple : aucune souscription n’est possible sur cette fiche. Pour un projet réel, la participation est réservée aux investisseurs dont l’identité a été vérifiée, après lecture des documents du projet. Le capital reste engagé pendant la durée prévue et peut être perdu en partie ou en totalité.',
  en: 'Example project: no subscription is possible on this sheet. For a real project, participation is reserved for investors whose identity has been verified, after reading the project documents. Capital remains committed for the planned duration and may be lost in part or in full.',
  es: 'Proyecto de ejemplo: no es posible ninguna suscripción en esta ficha. En un proyecto real, la participación está reservada a los inversores con identidad verificada, tras leer los documentos del proyecto. El capital permanece comprometido durante la duración prevista y puede perderse total o parcialmente.',
  de: 'Beispielprojekt: Auf diesem Projektblatt ist keine Zeichnung möglich. Bei einem realen Projekt ist die Beteiligung Anlegern mit bestätigter Identität vorbehalten, nach Lektüre der Projektunterlagen. Das Kapital bleibt für die geplante Laufzeit gebunden und kann ganz oder teilweise verloren gehen.'
};

const dec = (n) => String(n).replace('.', ',');
const FEES = {
  fr: (e, m) => `Exemple indicatif : frais d’entrée de ${dec(e)} % et frais de gestion de ${dec(m)} % par an. Les frais réels figurent dans les documents de chaque projet.`,
  en: (e, m) => `Indicative example: entry fee of ${e}% and management fee of ${m}% per year. Actual fees are set out in each project’s documents.`,
  es: (e, m) => `Ejemplo orientativo: comisión de entrada del ${dec(e)} % y comisión de gestión del ${dec(m)} % anual. Las comisiones reales figuran en los documentos de cada proyecto.`,
  de: (e, m) => `Unverbindliches Beispiel: Ausgabeaufschlag von ${dec(e)} % und Verwaltungsgebühr von ${dec(m)} % pro Jahr. Die tatsächlichen Gebühren stehen in den Unterlagen des jeweiligen Projekts.`
};

/** t[lang] = [titre, résumé, description] */
const PROJECTS = [
  {
    slug: 'exemple-immeuble-bureaux', sector: 'commercial', country: 'Canada', photo: 'bureaux', target: 18000000, ticket: 10000, months: 72, risk: 2, fees: [2, 1],
    t: {
      fr: ['Immeuble de bureaux à haute performance énergétique', 'Acquisition et rénovation d’un immeuble de bureaux destiné à la location à des entreprises.', 'Le projet consiste à acquérir un immeuble de bureaux, à le rénover pour réduire sa consommation d’énergie, puis à le louer à plusieurs entreprises. Les revenus dépendent du taux d’occupation et du niveau des loyers ; ils ne sont pas garantis.'],
      en: ['High energy-performance office building', 'Purchase and renovation of an office building to be let to companies.', 'The project consists of buying an office building, renovating it to cut its energy use, then letting it to several companies. Income depends on the occupancy rate and rent levels; it is not guaranteed.'],
      es: ['Edificio de oficinas de alta eficiencia energética', 'Adquisición y renovación de un edificio de oficinas destinado al alquiler a empresas.', 'El proyecto consiste en adquirir un edificio de oficinas, renovarlo para reducir su consumo de energía y alquilarlo a varias empresas. Los ingresos dependen de la tasa de ocupación y del nivel de los alquileres; no están garantizados.'],
      de: ['Bürogebäude mit hoher Energieeffizienz', 'Erwerb und Sanierung eines Bürogebäudes zur Vermietung an Unternehmen.', 'Das Projekt umfasst den Erwerb eines Bürogebäudes, seine energetische Sanierung und die Vermietung an mehrere Unternehmen. Die Erträge hängen von der Auslastung und der Miethöhe ab; sie sind nicht garantiert.']
    }
  },
  {
    slug: 'exemple-transformation-fruits', sector: 'agriculture', country: 'Kenya', photo: 'champs', target: 3200000, ticket: 1000, months: 36, risk: 4, fees: [2.5, 1],
    t: {
      fr: ['Unité de transformation de fruits tropicaux', 'Construction d’une unité de tri, de séchage et de conditionnement de fruits pour l’export.', 'Le projet finance une unité de transformation approvisionnée par des producteurs locaux : tri, séchage, conditionnement et stockage au froid. L’activité est exposée aux aléas climatiques, aux prix agricoles et aux normes d’exportation.'],
      en: ['Tropical fruit processing unit', 'Construction of a sorting, drying and packaging unit for fruit destined for export.', 'The project finances a processing unit supplied by local growers: sorting, drying, packaging and cold storage. The business is exposed to weather hazards, agricultural prices and export standards.'],
      es: ['Unidad de transformación de frutas tropicales', 'Construcción de una unidad de selección, secado y envasado de fruta para la exportación.', 'El proyecto financia una unidad de transformación abastecida por productores locales: selección, secado, envasado y almacenamiento en frío. La actividad está expuesta al clima, a los precios agrícolas y a las normas de exportación.'],
      de: ['Verarbeitungsanlage für tropische Früchte', 'Bau einer Anlage zum Sortieren, Trocknen und Verpacken von Früchten für den Export.', 'Das Projekt finanziert eine Verarbeitungsanlage, die von lokalen Erzeugern beliefert wird: Sortierung, Trocknung, Verpackung und Kühllagerung. Das Geschäft ist Wetterrisiken, Agrarpreisen und Exportnormen ausgesetzt.']
    }
  },
  {
    slug: 'exemple-materiaux-construction', sector: 'industry', country: 'Vietnam', photo: 'usine', target: 6500000, ticket: 2500, months: 48, risk: 3, fees: [2, 1.2],
    t: {
      fr: ['Unité de production de matériaux de construction', 'Création d’une ligne de production de matériaux pour le marché régional du bâtiment.', 'Le projet porte sur l’installation d’une ligne de production automatisée et de ses équipements de contrôle qualité. Les résultats dépendent de la demande du secteur du bâtiment, du coût des matières premières et de l’énergie.'],
      en: ['Building materials production unit', 'Creation of a production line for materials serving the regional construction market.', 'The project covers the installation of an automated production line and its quality-control equipment. Results depend on demand from the construction sector and on raw material and energy costs.'],
      es: ['Unidad de producción de materiales de construcción', 'Creación de una línea de producción de materiales para el mercado regional de la construcción.', 'El proyecto consiste en instalar una línea de producción automatizada y sus equipos de control de calidad. Los resultados dependen de la demanda del sector de la construcción y del coste de las materias primas y de la energía.'],
      de: ['Produktionsanlage für Baustoffe', 'Aufbau einer Fertigungslinie für Baustoffe für den regionalen Baumarkt.', 'Das Projekt umfasst die Installation einer automatisierten Fertigungslinie samt Qualitätskontrolle. Die Ergebnisse hängen von der Nachfrage der Bauwirtschaft sowie von Rohstoff- und Energiekosten ab.']
    }
  },
  {
    slug: 'exemple-parc-eolien', sector: 'energy', country: 'Brésil', photo: 'eolien', target: 32000000, ticket: 5000, months: 84, risk: 3, fees: [2, 0.8],
    t: {
      fr: ['Parc éolien terrestre', 'Construction et exploitation d’un parc éolien raccordé au réseau électrique.', 'Le projet finance l’installation d’éoliennes et leur raccordement au réseau. Les revenus proviennent de la vente d’électricité et varient selon le vent, les prix de l’électricité et la disponibilité des équipements.'],
      en: ['Onshore wind farm', 'Construction and operation of a wind farm connected to the electricity grid.', 'The project finances the installation of wind turbines and their grid connection. Income comes from electricity sales and varies with wind conditions, electricity prices and equipment availability.'],
      es: ['Parque eólico terrestre', 'Construcción y explotación de un parque eólico conectado a la red eléctrica.', 'El proyecto financia la instalación de aerogeneradores y su conexión a la red. Los ingresos proceden de la venta de electricidad y varían según el viento, los precios de la electricidad y la disponibilidad de los equipos.'],
      de: ['Onshore-Windpark', 'Bau und Betrieb eines ans Stromnetz angeschlossenen Windparks.', 'Das Projekt finanziert die Errichtung von Windkraftanlagen und ihren Netzanschluss. Die Erträge stammen aus dem Stromverkauf und schwanken je nach Wind, Strompreisen und Verfügbarkeit der Anlagen.']
    }
  },
  {
    slug: 'exemple-plateforme-logistique', sector: 'trade', country: 'Émirats arabes unis', photo: 'entrepot', target: 12000000, ticket: 5000, months: 48, risk: 3, fees: [2, 1],
    t: {
      fr: ['Plateforme logistique multimodale', 'Construction d’entrepôts reliés au port et à l’aéroport pour le commerce international.', 'Le projet prévoit la construction d’entrepôts modernes loués à des transporteurs et à des sociétés d’import-export. Les revenus dépendent du taux de remplissage et de l’activité du commerce international.'],
      en: ['Multimodal logistics platform', 'Construction of warehouses linked to the port and airport for international trade.', 'The project plans the construction of modern warehouses let to carriers and import-export companies. Income depends on occupancy and on international trade activity.'],
      es: ['Plataforma logística multimodal', 'Construcción de almacenes conectados con el puerto y el aeropuerto para el comercio internacional.', 'El proyecto prevé la construcción de almacenes modernos alquilados a transportistas y empresas de importación-exportación. Los ingresos dependen de la ocupación y de la actividad del comercio internacional.'],
      de: ['Multimodale Logistikplattform', 'Bau von Lagerhallen mit Anbindung an Hafen und Flughafen für den internationalen Handel.', 'Das Projekt sieht den Bau moderner Lagerhallen vor, die an Spediteure und Import-Export-Unternehmen vermietet werden. Die Erträge hängen von der Auslastung und vom internationalen Handel ab.']
    }
  },
  {
    slug: 'exemple-villas-residences', sector: 'real_estate', country: 'Maurice', photo: 'villa', target: 7000000, ticket: 5000, months: 36, risk: 3, fees: [2, 1],
    t: {
      fr: ['Résidence de villas de standing', 'Construction d’un ensemble de villas destinées à la vente et à la location saisonnière.', 'Le projet porte sur la construction d’un ensemble de villas avec services. Le résultat dépend du rythme des ventes, des prix du marché immobilier local et de la fréquentation touristique.'],
      en: ['Premium villa residence', 'Construction of a group of villas for sale and seasonal rental.', 'The project covers the construction of a serviced villa development. The outcome depends on the pace of sales, local property prices and tourist numbers.'],
      es: ['Residencial de villas de alto nivel', 'Construcción de un conjunto de villas destinadas a la venta y al alquiler vacacional.', 'El proyecto consiste en construir un conjunto de villas con servicios. El resultado depende del ritmo de ventas, de los precios del mercado inmobiliario local y de la afluencia turística.'],
      de: ['Hochwertige Villenanlage', 'Bau einer Villenanlage für Verkauf und Ferienvermietung.', 'Das Projekt umfasst den Bau einer Villenanlage mit Serviceleistungen. Das Ergebnis hängt vom Verkaufstempo, den lokalen Immobilienpreisen und der touristischen Nachfrage ab.']
    }
  },
  {
    slug: 'exemple-amenagement-urbain', sector: 'development', country: 'Nigeria', photo: 'ville', target: 9000000, ticket: 1000, months: 60, risk: 5, fees: [2.5, 1],
    t: {
      fr: ['Aménagement d’un quartier urbain mixte', 'Viabilisation de terrains, logements abordables, commerces de proximité et équipements collectifs.', 'Le projet vise à aménager un quartier associant logements abordables, commerces et services. Il comporte un risque élevé : délais administratifs, risque de change, risque pays et incertitude sur la demande.'],
      en: ['Mixed-use urban district development', 'Land servicing, affordable housing, local shops and community facilities.', 'The project aims to develop a district combining affordable housing, shops and services. It carries a high risk: administrative delays, currency risk, country risk and uncertain demand.'],
      es: ['Urbanización de un barrio de uso mixto', 'Urbanización de terrenos, vivienda asequible, comercio de proximidad y equipamientos colectivos.', 'El proyecto busca urbanizar un barrio que combine vivienda asequible, comercios y servicios. Conlleva un riesgo elevado: plazos administrativos, riesgo de cambio, riesgo país e incertidumbre sobre la demanda.'],
      de: ['Entwicklung eines gemischt genutzten Stadtviertels', 'Erschließung von Grundstücken, bezahlbarer Wohnraum, Nahversorgung und Gemeinschaftseinrichtungen.', 'Das Projekt soll ein Viertel mit bezahlbarem Wohnraum, Geschäften und Dienstleistungen entwickeln. Es ist mit hohem Risiko verbunden: Behördenverzögerungen, Währungsrisiko, Länderrisiko und unsichere Nachfrage.']
    }
  },
  {
    slug: 'exemple-centre-donnees', sector: 'technology', country: 'États-Unis', photo: 'datacenter', target: 28000000, ticket: 10000, months: 60, risk: 3, fees: [2, 1.2],
    t: {
      fr: ['Centre de données régional', 'Construction d’un centre de données destiné à l’hébergement de services numériques d’entreprises.', 'Le projet finance un bâtiment technique, ses équipements électriques et de refroidissement, puis la location d’espaces d’hébergement à des entreprises. Il dépend de la demande en services numériques, du coût de l’énergie et de l’évolution rapide des technologies.'],
      en: ['Regional data centre', 'Construction of a data centre hosting digital services for businesses.', 'The project finances a technical building, its power and cooling equipment, then the letting of hosting space to businesses. It depends on demand for digital services, energy costs and fast-changing technology.'],
      es: ['Centro de datos regional', 'Construcción de un centro de datos para alojar servicios digitales de empresas.', 'El proyecto financia un edificio técnico, sus equipos eléctricos y de refrigeración, y el alquiler de espacios de alojamiento a empresas. Depende de la demanda de servicios digitales, del coste de la energía y de la rápida evolución tecnológica.'],
      de: ['Regionales Rechenzentrum', 'Bau eines Rechenzentrums für das Hosting digitaler Unternehmensdienste.', 'Das Projekt finanziert ein technisches Gebäude, seine Strom- und Kühltechnik sowie die Vermietung von Hosting-Flächen an Unternehmen. Es hängt von der Nachfrage nach digitalen Diensten, den Energiekosten und dem raschen Technologiewandel ab.']
    }
  },
  {
    slug: 'exemple-pont-routier', sector: 'infrastructure', country: 'Indonésie', photo: 'pont', target: 45000000, ticket: 10000, months: 96, risk: 3, fees: [1.5, 0.8],
    t: {
      fr: ['Pont routier et voie de contournement', 'Construction d’un pont et d’une voie de contournement pour désengorger un axe régional.', 'Le projet porte sur un ouvrage routier réalisé dans le cadre d’un contrat de longue durée avec une autorité publique. Les principaux risques sont les retards de chantier, les surcoûts et le niveau réel du trafic.'],
      en: ['Road bridge and bypass', 'Construction of a bridge and bypass to relieve congestion on a regional route.', 'The project concerns a road structure built under a long-term contract with a public authority. The main risks are construction delays, cost overruns and actual traffic levels.'],
      es: ['Puente de carretera y vía de circunvalación', 'Construcción de un puente y una circunvalación para descongestionar un eje regional.', 'El proyecto consiste en una obra viaria realizada en el marco de un contrato de larga duración con una autoridad pública. Los principales riesgos son los retrasos de obra, los sobrecostes y el nivel real de tráfico.'],
      de: ['Straßenbrücke und Umgehungsstraße', 'Bau einer Brücke und einer Umgehungsstraße zur Entlastung einer regionalen Verkehrsachse.', 'Das Projekt betrifft ein Straßenbauwerk im Rahmen eines langfristigen Vertrags mit einer öffentlichen Stelle. Die Hauptrisiken sind Bauverzögerungen, Mehrkosten und das tatsächliche Verkehrsaufkommen.']
    }
  },
  {
    slug: 'exemple-residence-urbaine', sector: 'real_estate', country: 'Maroc', photo: 'residence', target: 8500000, ticket: 5000, months: 48, risk: 3, fees: [2, 1],
    t: {
      fr: ['Résidence urbaine de 120 logements', 'Construction d’une résidence de 120 logements avec commerces en rez-de-chaussée.', 'Le projet comprend l’acquisition du terrain, la construction de 120 logements et leur commercialisation. Le résultat dépend des coûts de construction, des délais et des prix de vente du marché local.'],
      en: ['120-unit urban residence', 'Construction of a 120-unit residence with ground-floor shops.', 'The project includes buying the land, building 120 homes and marketing them. The outcome depends on construction costs, timelines and local market sale prices.'],
      es: ['Residencial urbano de 120 viviendas', 'Construcción de un residencial de 120 viviendas con locales comerciales en planta baja.', 'El proyecto incluye la adquisición del terreno, la construcción de 120 viviendas y su comercialización. El resultado depende de los costes de construcción, los plazos y los precios de venta del mercado local.'],
      de: ['Städtische Wohnanlage mit 120 Wohnungen', 'Bau einer Wohnanlage mit 120 Wohnungen und Geschäften im Erdgeschoss.', 'Das Projekt umfasst den Grundstückserwerb, den Bau von 120 Wohnungen und deren Vermarktung. Das Ergebnis hängt von Baukosten, Zeitplan und den Verkaufspreisen am lokalen Markt ab.']
    }
  },
  {
    slug: 'exemple-centre-commercial', sector: 'commercial', country: 'Ghana', photo: 'centre-commercial', target: 24000000, ticket: 5000, months: 60, risk: 4, fees: [2, 1.2],
    t: {
      fr: ['Centre commercial régional', 'Construction d’un centre commercial réunissant enseignes, restauration et loisirs.', 'Le projet finance la construction d’un centre commercial et sa mise en location auprès d’enseignes. Les revenus dépendent du taux d’occupation, de la fréquentation et du pouvoir d’achat local ; un risque de change existe.'],
      en: ['Regional shopping centre', 'Construction of a shopping centre bringing together retailers, restaurants and leisure.', 'The project finances the construction of a shopping centre and its letting to retailers. Income depends on occupancy, footfall and local purchasing power; there is a currency risk.'],
      es: ['Centro comercial regional', 'Construcción de un centro comercial con tiendas, restauración y ocio.', 'El proyecto financia la construcción de un centro comercial y su alquiler a marcas. Los ingresos dependen de la ocupación, la afluencia y el poder adquisitivo local; existe riesgo de cambio.'],
      de: ['Regionales Einkaufszentrum', 'Bau eines Einkaufszentrums mit Geschäften, Gastronomie und Freizeitangeboten.', 'Das Projekt finanziert den Bau eines Einkaufszentrums und dessen Vermietung an Händler. Die Erträge hängen von Auslastung, Besucherzahlen und lokaler Kaufkraft ab; es besteht ein Währungsrisiko.']
    }
  },
  {
    slug: 'exemple-complexe-hotelier', sector: 'tourism', country: 'Mexique', photo: 'hotel', target: 15000000, ticket: 5000, months: 60, risk: 4, fees: [2, 1.2],
    t: {
      fr: ['Complexe hôtelier balnéaire', 'Construction d’un complexe hôtelier en bord de mer avec restauration et espaces de loisirs.', 'Le projet porte sur la construction puis l’exploitation d’un complexe hôtelier. L’activité est saisonnière et sensible à la conjoncture touristique, aux événements climatiques et aux taux de change.'],
      en: ['Seaside hotel resort', 'Construction of a seaside hotel resort with restaurants and leisure areas.', 'The project covers the construction and then operation of a hotel resort. The business is seasonal and sensitive to tourism trends, weather events and exchange rates.'],
      es: ['Complejo hotelero de playa', 'Construcción de un complejo hotelero junto al mar con restauración y zonas de ocio.', 'El proyecto consiste en construir y después explotar un complejo hotelero. La actividad es estacional y sensible a la coyuntura turística, a los fenómenos climáticos y a los tipos de cambio.'],
      de: ['Hotelanlage am Meer', 'Bau einer Hotelanlage am Meer mit Gastronomie und Freizeitbereichen.', 'Das Projekt umfasst den Bau und anschließenden Betrieb einer Hotelanlage. Das Geschäft ist saisonabhängig und reagiert empfindlich auf Tourismuskonjunktur, Wetterereignisse und Wechselkurse.']
    }
  }
];

function build(p) {
  const i18n = {};
  for (const [lang, [title, summary, description]] of Object.entries(p.t)) {
    i18n[lang] = { title: `${title} ${SUFFIX[lang]}`, summary, description: `${description}\n\n**${NOTE[lang]}**`, conditions: CONDITIONS[lang], fees: FEES[lang](p.fees[0], p.fees[1]) };
  }
  return { slug: p.slug, sector: p.sector, country: p.country, photo_key: p.photo, i18n: JSON.stringify(i18n), target_cents: p.target * 100, min_ticket_cents: p.ticket * 100, duration_months: p.months, risk_level: p.risk };
}

module.exports = { PROJECTS, build };
