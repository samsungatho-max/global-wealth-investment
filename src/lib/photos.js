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
  chantier: { id: '1536895058696-a69b1c7ba34f', author: 'Nathan Waters', alt: { fr: 'Structure d’immeuble en construction', en: 'Building structure under construction', es: 'Estructura de edificio en construcción', de: 'Gebäuderohbau' } }
};

const SECTOR_PHOTO = { real_estate: 'immeuble', agriculture: 'agriculture', energy: 'solaire', trade: 'port' };

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

module.exports = { PHOTOS, SECTOR_PHOTO, photo, credits };
