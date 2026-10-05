'use strict';
/**
 * Photos d'illustration (Unsplash, licence Unsplash — usage commercial autorisé).
 * Elles ne représentent PAS les projets proposés : elles sont signalées comme « photo d'illustration »
 * sur le site et créditées sur la page /credits.
 * Fichiers : public/img/photos/<clé>-800.webp (4:3) et <clé>-1600.webp (16:9).
 */
const PHOTOS = {
  hero: { id: '1580465446156-0a5b3eee11ae', author: 'JC Gellidon', alt: { fr: 'Quartier d’affaires au crépuscule', en: 'Business district at dusk', es: 'Distrito financiero al atardecer', de: 'Geschäftsviertel in der Abenddämmerung' } },
  skyline: { id: '1761493826870-b3a05338e4aa', author: 'Miguel A Amutio', alt: { fr: 'Ligne d’horizon urbaine au lever du soleil', en: 'City skyline at sunrise', es: 'Horizonte urbano al amanecer', de: 'Stadtsilhouette bei Sonnenaufgang' } },
  immeuble: { id: '1515263487990-61b07816b324', author: 'Luke van Zyl', alt: { fr: 'Immeuble résidentiel moderne', en: 'Modern residential building', es: 'Edificio residencial moderno', de: 'Modernes Wohngebäude' } },
  'immeuble-2': { id: '1619218070141-bcfeb8b93074', author: 'Mark Tryapichnikov', alt: { fr: 'Façade d’immeuble contemporain', en: 'Contemporary building facade', es: 'Fachada de edificio contemporáneo', de: 'Zeitgenössische Gebäudefassade' } },
  villa: { id: '1613977257365-aaae5a9817ff', author: 'John Fornander', alt: { fr: 'Villa moderne avec piscine', en: 'Modern villa with swimming pool', es: 'Villa moderna con piscina', de: 'Moderne Villa mit Pool' } },
  'villa-2': { id: '1544984243-ec57ea16fe25', author: 'Roberto Nickson', alt: { fr: 'Villa de standing au coucher du soleil', en: 'Luxury villa at sunset', es: 'Villa de lujo al atardecer', de: 'Luxusvilla bei Sonnenuntergang' } },
  reunion: { id: '1573164574572-cb89e39749b4', author: 'Christina @ wocintechchat.com', alt: { fr: 'Réunion de travail en salle de conseil', en: 'Business meeting in a boardroom', es: 'Reunión de trabajo en una sala de juntas', de: 'Geschäftsbesprechung im Konferenzraum' } },
  'poignee-main': { id: '1686771416282-3888ddaf249b', author: 'Mina Rad', alt: { fr: 'Poignée de main lors d’un rendez-vous professionnel', en: 'Handshake at a business appointment', es: 'Apretón de manos en una reunión profesional', de: 'Händedruck bei einem Geschäftstermin' } },
  agriculture: { id: '1615811361523-6bd03d7748e7', author: 'Chris Ensminger', alt: { fr: 'Tracteur dans un champ cultivé', en: 'Tractor in a cultivated field', es: 'Tractor en un campo cultivado', de: 'Traktor auf einem bestellten Feld' } },
  champs: { id: '1557096336-8e576993d3ff', author: 'Ivan Bandura', alt: { fr: 'Vue aérienne de cultures', en: 'Aerial view of crops', es: 'Vista aérea de cultivos', de: 'Luftaufnahme von Feldern' } },
  usine: { id: '1717386255773-1e3037c81788', author: 'Homa Appliances', alt: { fr: 'Ligne de production industrielle', en: 'Industrial production line', es: 'Línea de producción industrial', de: 'Industrielle Fertigungslinie' } },
  solaire: { id: '1629726797843-618688139f5a', author: 'Raphael Cruz', alt: { fr: 'Centrale solaire au sol', en: 'Ground-mounted solar farm', es: 'Parque solar en suelo', de: 'Freiflächen-Solarpark' } },
  eolien: { id: '1466611653911-95081537e5b7', author: 'Karsten Würth', alt: { fr: 'Éoliennes au coucher du soleil', en: 'Wind turbines at sunset', es: 'Aerogeneradores al atardecer', de: 'Windräder bei Sonnenuntergang' } },
  port: { id: '1678182451047-196f22a4143e', author: 'Ali Mkumbwa', alt: { fr: 'Terminal portuaire à conteneurs', en: 'Container port terminal', es: 'Terminal portuaria de contenedores', de: 'Containerterminal im Hafen' } },
  cargo: { id: '1578575437130-527eed3abbec', author: 'Andy Li', alt: { fr: 'Porte-conteneurs à quai', en: 'Container ship at the quay', es: 'Buque portacontenedores en el muelle', de: 'Containerschiff am Kai' } },
  graphiques: { id: '1651341050677-24dba59ce0fd', author: 'Anne Nygård', alt: { fr: 'Tableau de bord financier sur écran', en: 'Financial dashboard on screen', es: 'Panel financiero en pantalla', de: 'Finanz-Dashboard auf dem Bildschirm' } },
  grues: { id: '1485083269755-a7b559a4fe5e', author: 'EJ Yao', alt: { fr: 'Grues de chantier au-dessus de la ville', en: 'Construction cranes over the city', es: 'Grúas de obra sobre la ciudad', de: 'Baukräne über der Stadt' } },
  chantier: { id: '1536895058696-a69b1c7ba34f', author: 'Nathan Waters', alt: { fr: 'Structure d’immeuble en construction', en: 'Building structure under construction', es: 'Estructura de edificio en construcción', de: 'Gebäuderohbau' } },
  residence: { id: '1624204386084-dd8c05e32226', author: 'Tobias Wilden', alt: { fr: 'Immeuble résidentiel aux balcons vitrés', en: 'Residential building with glazed balconies', es: 'Edificio residencial con balcones acristalados', de: 'Wohngebäude mit verglasten Balkonen' } },
  'centre-commercial': { id: '1696208732970-5744331c9fdf', author: 'Declan Sun', alt: { fr: 'Atrium d’un centre commercial', en: 'Shopping centre atrium', es: 'Atrio de un centro comercial', de: 'Atrium eines Einkaufszentrums' } },
  bureaux: { id: '1462396240927-52058a6a84ec', author: 'Patrick Tomasso', alt: { fr: 'Immeubles de bureaux à façade vitrée', en: 'Glass-fronted office buildings', es: 'Edificios de oficinas con fachada de cristal', de: 'Bürogebäude mit Glasfassade' } },
  entrepot: { id: '1627309366653-2dedc084cdf1', author: 'Jacques Dillies', alt: { fr: 'Entrepôt logistique', en: 'Logistics warehouse', es: 'Almacén logístico', de: 'Logistiklager' } },
  pont: { id: '1515674744565-0d7112cd179a', author: 'CHUTTERSNAP', alt: { fr: 'Pont routier vu du ciel', en: 'Road bridge seen from above', es: 'Puente de carretera visto desde el aire', de: 'Straßenbrücke aus der Luft' } },
  hotel: { id: '1540541338287-41700207dee6', author: 'Paolo Nicolello', alt: { fr: 'Complexe hôtelier en bord de mer', en: 'Seaside hotel resort', es: 'Complejo hotelero junto al mar', de: 'Hotelanlage am Meer' } },
  datacenter: { id: '1558494949-ef010cbdcc31', author: 'Taylor Vick', alt: { fr: 'Baies de serveurs dans un centre de données', en: 'Server racks in a data centre', es: 'Racks de servidores en un centro de datos', de: 'Serverschränke in einem Rechenzentrum' } },
  ville: { id: '1744907895363-d351aa6019ef', author: 'Tunde Buremo', alt: { fr: 'Vue aérienne d’une ville en développement', en: 'Aerial view of a growing city', es: 'Vista aérea de una ciudad en desarrollo', de: 'Luftaufnahme einer wachsenden Stadt' } },
  'centre-affaires': { id: '1543892607-04657ef3a279', author: 'Matt Reames', alt: { fr: 'Immeuble de bureaux contemporain', en: 'Contemporary office building', es: 'Edificio de oficinas contemporáneo', de: 'Zeitgenössisches Bürogebäude' } },
  tours: { id: '1511963039483-c8c419fa95db', author: 'Tim Gouw', alt: { fr: 'Tours résidentielles en centre-ville', en: 'Residential towers in a city centre', es: 'Torres residenciales en el centro urbano', de: 'Wohntürme in der Innenstadt' } },
  complexe: { id: '1759193531945-f4d3ab0ca3e4', author: 'Emily Wassmansdorf', alt: { fr: 'Ensemble résidentiel au bord de l’eau', en: 'Waterfront residential development', es: 'Conjunto residencial junto al agua', de: 'Wohnanlage am Wasser' } },
  'residence-2': { id: '1432297984334-707d34c4163a', author: 'Hans Eiskonen', alt: { fr: 'Résidence contemporaine', en: 'Contemporary residence', es: 'Residencia contemporánea', de: 'Zeitgenössische Wohnanlage' } },
  mine: { id: '1523660778745-247ed0bcce31', author: 'Dominik Vanyi', alt: { fr: 'Camion minier sur un site d’extraction', en: 'Haul truck on a mining site', es: 'Camión minero en una explotación', de: 'Muldenkipper auf einem Abbaugelände' } },
  conteneurs: { id: '1494412685616-a5d310fbb07d', author: 'CHUTTERSNAP', alt: { fr: 'Terminal à conteneurs vu du ciel', en: 'Container terminal seen from above', es: 'Terminal de contenedores vista desde el aire', de: 'Containerterminal aus der Luft' } },
  autoroute: { id: '1465447142348-e9952c393450', author: 'Denys Nevozhai', alt: { fr: 'Échangeur autoroutier vu du ciel', en: 'Motorway interchange seen from above', es: 'Enlace de autopistas visto desde el aire', de: 'Autobahnkreuz aus der Luft' } },
  serre: { id: '1524486361537-8ad15938e1a3', author: 'Erwan Hesry', alt: { fr: 'Cultures sous serre', en: 'Greenhouse crops', es: 'Cultivos en invernadero', de: 'Gewächshauskulturen' } },
  barrage: { id: '1560279966-2d681f3d4dfc', author: 'Dan Meyers', alt: { fr: 'Barrage hydroélectrique', en: 'Hydroelectric dam', es: 'Presa hidroeléctrica', de: 'Wasserkraftwerk mit Staudamm' } },
  camions: { id: '1565793298595-6a879b1d9492', author: 'Marcin Jozwiak', alt: { fr: 'Flotte de camions de transport', en: 'Fleet of transport trucks', es: 'Flota de camiones de transporte', de: 'Lkw-Flotte' } },
  'usine-2': { id: '1647427060118-4911c9821b82', author: 'Simon Kadula', alt: { fr: 'Atelier de production automatisé', en: 'Automated production workshop', es: 'Taller de producción automatizado', de: 'Automatisierte Fertigungshalle' } },
  moisson: { id: '1506519056028-d18449e82c6f', author: 'Johny Goerend', alt: { fr: 'Moissonneuses dans un champ', en: 'Harvesters in a field', es: 'Cosechadoras en un campo', de: 'Mähdrescher auf einem Feld' } },
  elevage: { id: '1566310203664-bb0828838943', author: 'Ronnie Overgoor', alt: { fr: 'Troupeau de bovins au pâturage', en: 'Cattle grazing in a pasture', es: 'Ganado bovino pastando', de: 'Rinder auf der Weide' } },
  peche: { id: '1545214766-04116e13521c', author: 'Chris King', alt: { fr: 'Bateaux de pêche à quai', en: 'Fishing boats at the quay', es: 'Barcos de pesca en el muelle', de: 'Fischerboote am Kai' } },
  sante: { id: '1719934398679-d764c1410770', author: 'Arturo Esparza', alt: { fr: 'Galerie vitrée d’un établissement de santé', en: 'Glazed gallery of a health facility', es: 'Galería acristalada de un centro de salud', de: 'Verglaste Galerie einer Gesundheitseinrichtung' } },
  education: { id: '1576495199011-eb94736d05d6', author: 'Wonderlane', alt: { fr: 'Bâtiment universitaire moderne', en: 'Modern university building', es: 'Edificio universitario moderno', de: 'Modernes Universitätsgebäude' } },
  savane: { id: '1535940360221-641a69c43bac', author: 'David Clode', alt: { fr: 'Savane arborée', en: 'Wooded savanna', es: 'Sabana arbolada', de: 'Baumsavanne' } },
  route: { id: '1646383850884-f0e389eb3659', author: 'Pavel Neznanov', alt: { fr: 'Route traversant une vallée boisée', en: 'Road through a wooded valley', es: 'Carretera que atraviesa un valle boscoso', de: 'Straße durch ein bewaldetes Tal' } },
  marche: { id: '1532079563951-0c8a7dacddb3', author: 'Lisheng Chang', alt: { fr: 'Marché vu du ciel', en: 'Market seen from above', es: 'Mercado visto desde el aire', de: 'Markt aus der Luft' } }
};

/** Photos proposées par secteur : la première sert de visuel du secteur, les suivantes varient les fiches projets. */
const SECTOR_PHOTOS = {
  real_estate: ['immeuble', 'complexe', 'residence', 'tours', 'villa', 'residence-2', 'immeuble-2', 'villa-2'],
  commercial: ['centre-commercial', 'centre-affaires', 'bureaux', 'marche'],
  tourism: ['hotel', 'savane', 'villa-2'],
  agriculture: ['agriculture', 'moisson', 'serre', 'champs'],
  livestock: ['elevage'],
  fishing: ['peche'],
  industry: ['usine', 'usine-2', 'chantier'],
  trade: ['camions', 'entrepot', 'conteneurs'],
  infrastructure: ['pont', 'autoroute', 'route', 'grues', 'chantier'],
  energy: ['solaire', 'eolien', 'barrage'],
  mining: ['mine'],
  technology: ['datacenter', 'graphiques'],
  health: ['sante'],
  education: ['education'],
  import_export: ['conteneurs', 'cargo'],
  business: ['reunion', 'poignee-main', 'skyline'],
  maritime: ['port', 'cargo'],
  development: ['ville', 'grues', 'skyline']
};
const SECTOR_PHOTO = Object.fromEntries(Object.entries(SECTOR_PHOTOS).map(([k, v]) => [k, v[0]]));

/** Photo d'une fiche projet : celle choisie dans l'administration, sinon une photo du secteur (variée d'un projet à l'autre). */
function projectPhotoKey(p) {
  if (p.photo_key && PHOTOS[p.photo_key]) return p.photo_key;
  const list = SECTOR_PHOTOS[p.sector] || ['hero'];
  return list[Math.abs(Number(p.id) || 0) % list.length];
}

function photo(key, lang) {
  const p = PHOTOS[key];
  if (!p) return null;
  return {
    key,
    small: `/static/img/photos/${key}-800.webp`,
    large: `/static/img/photos/${key}-1600.webp`,
    alt: p.alt[lang] || p.alt.fr,
    author: p.author
  };
}

function credits() {
  return Object.entries(PHOTOS).map(([key, p]) => ({ key, author: p.author, alt: p.alt, url: `https://images.unsplash.com/photo-${p.id}` }));
}

module.exports = { PHOTOS, SECTOR_PHOTO, SECTOR_PHOTOS, projectPhotoKey, photo, credits };
