'use strict';
/**
 * Données initiales, créées uniquement si absentes :
 *  - un compte administrateur (identifiants dans .env ou générés dans data/initial-admin.txt)
 *  - les pages institutionnelles (modifiables dans l'administration)
 *  - quatre fiches de DÉMONSTRATION clairement marquées comme fictives (à archiver avant la mise en production)
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { one, run, DATA_DIR } = require('./db');
const { randomToken } = require('./lib/security');

/**
 * Compte administrateur initial :
 *  - ADMIN_EMAIL + ADMIN_PASSWORD définis → compte créé avec ce mot de passe provisoire
 *    (changement imposé à la première connexion en production, ou si ADMIN_FORCE_PASSWORD_CHANGE=true) ;
 *  - sinon, en local : mot de passe généré et écrit dans data/initial-admin.txt ;
 *  - sinon, en serverless (Vercel, disque en lecture seule) : aucun compte créé, avertissement dans les journaux.
 */
async function seedAdmin() {
  if (await one("SELECT id FROM users WHERE role = 'admin'")) return;
  const email = (process.env.ADMIN_EMAIL || 'admin@example.test').trim().toLowerCase();
  let password = process.env.ADMIN_PASSWORD;
  let generated = false;
  if (!password) {
    if (process.env.VERCEL) {
      console.warn('[seed] Aucun administrateur : définissez ADMIN_EMAIL et ADMIN_PASSWORD (mot de passe provisoire) dans les variables d’environnement, puis redéployez.');
      return;
    }
    password = randomToken(9) + 'A1'; generated = true;
  }
  const force = generated || process.env.ADMIN_FORCE_PASSWORD_CHANGE === 'true' ||
    (process.env.NODE_ENV === 'production' && process.env.ADMIN_FORCE_PASSWORD_CHANGE !== 'false');
  await run(`INSERT INTO users (email, password_hash, full_name, country, phone, role, email_verified_at, kyc_status, must_change_password)
       VALUES (?, ?, 'Administrateur', 'FR', '+33000000000', 'admin', datetime('now'), 'approved', ?) ON CONFLICT (email) DO NOTHING`,
    email, bcrypt.hashSync(password, 12), force ? 1 : 0);
  if (generated) {
    const file = path.join(DATA_DIR, 'initial-admin.txt');
    fs.writeFileSync(file, `Compte administrateur initial (à changer dès la première connexion)\nURL : /admin/login\nE-mail : ${email}\nMot de passe : ${password}\n`);
    console.log(`[seed] Compte administrateur créé — identifiants enregistrés dans ${path.relative(process.cwd(), file)}`);
  } else {
    console.log(`[seed] Compte administrateur créé pour ${email}`);
  }
}

const PAGES = {
  about: {
    fr: { title: 'À propos de notre société', body: `## Notre mission\nGlobal Wealth Investment accompagne particuliers, entrepreneurs, investisseurs privés et entreprises dans la construction d'un patrimoine diversifié, fondé sur des actifs de l'économie réelle.\n\n## Nos valeurs\n- **Transparence** : risques, frais et performances réelles présentés clairement.\n- **Prudence** : sélection rigoureuse et diversification des projets.\n- **Long terme** : création de valeur durable plutôt que promesses de court terme.\n\n## Informations sur la société\nLes informations légales complètes (raison sociale, immatriculation, siège, autorisations réglementaires) figurent dans les [mentions légales](/page/legal).` },
    en: { title: 'About our company', body: `## Our mission\nGlobal Wealth Investment supports individuals, entrepreneurs, private investors and companies in building diversified wealth based on real-economy assets.\n\n## Our values\n- **Transparency**: risks, fees and actual performance presented clearly.\n- **Prudence**: rigorous selection and diversification of projects.\n- **Long term**: lasting value creation rather than short-term promises.\n\n## Company information\nFull legal information (company name, registration, head office, regulatory authorisations) is available in the [legal notice](/page/legal).` },
    es: { title: 'Sobre nuestra sociedad', body: `## Nuestra misión\nGlobal Wealth Investment acompaña a particulares, emprendedores, inversores privados y empresas en la construcción de un patrimonio diversificado, basado en activos de la economía real.\n\n## Nuestros valores\n- **Transparencia**: riesgos, comisiones y rentabilidades reales presentados con claridad.\n- **Prudencia**: selección rigurosa y diversificación de los proyectos.\n- **Largo plazo**: creación de valor duradero en lugar de promesas a corto plazo.\n\n## Información sobre la sociedad\nLa información legal completa figura en el [aviso legal](/page/legal).` },
    de: { title: 'Über unser Unternehmen', body: `## Unsere Mission\nGlobal Wealth Investment begleitet Privatpersonen, Unternehmer, Privatanleger und Unternehmen beim Aufbau eines diversifizierten Vermögens auf Basis von Sachwerten der Realwirtschaft.\n\n## Unsere Werte\n- **Transparenz**: Risiken, Gebühren und tatsächliche Wertentwicklung klar dargestellt.\n- **Vorsicht**: sorgfältige Auswahl und Diversifikation der Projekte.\n- **Langfristigkeit**: nachhaltige Wertschöpfung statt kurzfristiger Versprechen.\n\n## Unternehmensangaben\nVollständige rechtliche Angaben finden Sie im [Impressum](/page/legal).` }
  },
  strategies: {
    fr: { title: 'Nos stratégies d\'investissement', body: `## Diversification\nRépartition des capitaux entre plusieurs secteurs, pays et horizons afin de limiter l'impact d'un événement isolé.\n\n## Sélection des projets\nChaque projet fait l'objet d'une analyse documentaire, financière et juridique avant sa publication.\n\n## Suivi et valorisation\nLes investissements sont valorisés périodiquement ; chaque valorisation est datée et consultable dans l'espace investisseur.\n\n## Horizon long terme\nNos stratégies visent la création de valeur durable. Elles ne garantissent aucun rendement et comportent un risque de perte en capital.` },
    en: { title: 'Our investment strategies', body: `## Diversification\nAllocation of capital across several sectors, countries and horizons to limit the impact of any single event.\n\n## Project selection\nEach project undergoes documentary, financial and legal analysis before publication.\n\n## Monitoring and valuation\nInvestments are valued periodically; each valuation is dated and viewable in the investor area.\n\n## Long-term horizon\nOur strategies aim at lasting value creation. They guarantee no return and carry a risk of capital loss.` },
    es: { title: 'Nuestras estrategias de inversión', body: `## Diversificación\nReparto del capital entre varios sectores, países y horizontes para limitar el impacto de un acontecimiento aislado.\n\n## Selección de proyectos\nCada proyecto es objeto de un análisis documental, financiero y jurídico antes de su publicación.\n\n## Seguimiento y valoración\nLas inversiones se valoran periódicamente; cada valoración está fechada y puede consultarse en el espacio del inversor.\n\n## Horizonte a largo plazo\nNuestras estrategias buscan crear valor duradero. No garantizan ninguna rentabilidad y conllevan un riesgo de pérdida de capital.` },
    de: { title: 'Unsere Anlagestrategien', body: `## Diversifikation\nVerteilung des Kapitals auf mehrere Sektoren, Länder und Zeithorizonte, um die Auswirkungen einzelner Ereignisse zu begrenzen.\n\n## Projektauswahl\nJedes Projekt wird vor der Veröffentlichung dokumentarisch, finanziell und rechtlich geprüft.\n\n## Verfolgung und Bewertung\nDie Investitionen werden regelmäßig bewertet; jede Bewertung ist datiert und im Anlegerbereich einsehbar.\n\n## Langfristiger Horizont\nUnsere Strategien zielen auf nachhaltige Wertschöpfung. Sie garantieren keine Rendite und sind mit dem Risiko eines Kapitalverlusts verbunden.` }
  },
  sectors: {
    fr: { title: 'Nos secteurs d\'activité', body: `## Immobilier et infrastructures\nProjets résidentiels, bâtiments commerciaux, logements locatifs et infrastructures.\n\n## Agriculture et agro-industrie\nProduction agricole, transformation alimentaire, élevage, stockage et distribution.\n\n## Énergies renouvelables\nCentrales solaires, parcs éoliens et infrastructures énergétiques durables.\n\n## Commerce et logistique internationale\nFinancement du commerce, transport, import-export et chaînes d'approvisionnement.\n\nConsultez les [opportunités ouvertes](/opportunities).` },
    en: { title: 'Our business sectors', body: `## Real estate & infrastructure\nResidential projects, commercial buildings, rental housing and infrastructure.\n\n## Agriculture & agribusiness\nFarming, food processing, livestock, storage and distribution.\n\n## Renewable energy\nSolar plants, wind farms and sustainable energy infrastructure.\n\n## International trade & logistics\nTrade finance, transport, import-export and supply chains.\n\nSee the [open opportunities](/opportunities).` },
    es: { title: 'Nuestros sectores de actividad', body: `## Inmobiliario e infraestructuras\nProyectos residenciales, edificios comerciales, viviendas de alquiler e infraestructuras.\n\n## Agricultura y agroindustria\nProducción agrícola, transformación alimentaria, ganadería, almacenamiento y distribución.\n\n## Energías renovables\nCentrales solares, parques eólicos e infraestructuras energéticas sostenibles.\n\n## Comercio y logística internacional\nFinanciación del comercio, transporte, importación-exportación y cadenas de suministro.\n\nConsulte las [oportunidades abiertas](/opportunities).` },
    de: { title: 'Unsere Geschäftsbereiche', body: `## Immobilien und Infrastruktur\nWohnprojekte, Gewerbegebäude, Mietwohnungen und Infrastruktur.\n\n## Landwirtschaft und Agrarindustrie\nAgrarproduktion, Lebensmittelverarbeitung, Viehzucht, Lagerung und Vertrieb.\n\n## Erneuerbare Energien\nSolarkraftwerke, Windparks und nachhaltige Energieinfrastruktur.\n\n## Internationaler Handel und Logistik\nHandelsfinanzierung, Transport, Import-Export und Lieferketten.\n\nSiehe [offene Anlagechancen](/opportunities).` }
  },
  risks: {
    fr: { title: 'Politique de gestion des risques', body: `## Risques principaux\n- **Perte en capital** : vous pouvez perdre tout ou partie du capital investi.\n- **Illiquidité** : les sommes investies peuvent être bloquées jusqu'à l'échéance du projet.\n- **Risque de projet** : retards, dépassements de coûts ou défaillance du porteur de projet.\n- **Risque pays et de change** : évolutions politiques, réglementaires ou monétaires.\n\n## Notre échelle de risque\nChaque projet est classé de 1 (risque le plus faible) à 5 (risque le plus élevé), avec une explication détaillée sur sa fiche.\n\n## Bonnes pratiques\nDiversifiez vos placements et n'investissez que des sommes dont vous n'aurez pas besoin pendant la durée prévue.` },
    en: { title: 'Risk management policy', body: `## Main risks\n- **Capital loss**: you may lose all or part of the capital invested.\n- **Illiquidity**: amounts invested may be locked until the project matures.\n- **Project risk**: delays, cost overruns or default of the project sponsor.\n- **Country and currency risk**: political, regulatory or monetary developments.\n\n## Our risk scale\nEach project is rated from 1 (lowest risk) to 5 (highest risk), with a detailed explanation on its sheet.\n\n## Good practice\nDiversify your investments and only invest money you will not need during the expected period.` },
    es: { title: 'Política de gestión de riesgos', body: `## Principales riesgos\n- **Pérdida de capital**: puede perder todo o parte del capital invertido.\n- **Iliquidez**: las sumas invertidas pueden quedar bloqueadas hasta el vencimiento del proyecto.\n- **Riesgo de proyecto**: retrasos, sobrecostes o incumplimiento del promotor.\n- **Riesgo país y de cambio**: evoluciones políticas, reglamentarias o monetarias.\n\n## Nuestra escala de riesgo\nCada proyecto se clasifica de 1 (riesgo más bajo) a 5 (riesgo más alto), con una explicación detallada en su ficha.\n\n## Buenas prácticas\nDiversifique sus inversiones e invierta únicamente sumas que no necesitará durante el periodo previsto.` },
    de: { title: 'Richtlinie zum Risikomanagement', body: `## Hauptrisiken\n- **Kapitalverlust**: Sie können das eingesetzte Kapital ganz oder teilweise verlieren.\n- **Illiquidität**: Angelegte Beträge können bis zur Fälligkeit des Projekts gebunden sein.\n- **Projektrisiko**: Verzögerungen, Kostenüberschreitungen oder Ausfall des Projektträgers.\n- **Länder- und Währungsrisiko**: politische, regulatorische oder monetäre Entwicklungen.\n\n## Unsere Risikoskala\nJedes Projekt wird von 1 (niedrigstes Risiko) bis 5 (höchstes Risiko) eingestuft, mit ausführlicher Erläuterung im Projektblatt.\n\n## Empfehlungen\nStreuen Sie Ihre Anlagen und investieren Sie nur Beträge, die Sie während der vorgesehenen Laufzeit nicht benötigen.` }
  },
  faq: {
    fr: { title: 'Questions fréquentes', body: `## Les rendements sont-ils garantis ?\nNon. Aucun rendement n'est garanti et le capital investi peut être perdu en tout ou partie.\n\n## Pourquoi dois-je vérifier mon identité ?\nLa vérification d'identité (KYC) est une obligation légale de lutte contre le blanchiment. Aucune opération financière n'est possible avant validation.\n\n## Quand mon dépôt est-il crédité ?\nUniquement après vérification effective de la réception des fonds par notre équipe.\n\n## Comment retirer mes fonds ?\nDepuis votre espace, rubrique Retrait, vers un compte bancaire à votre nom.\n\n## Comment sont calculées les valeurs de mon portefeuille ?\nÀ partir des valorisations datées publiées par la société de gestion ; chaque valorisation est consultable dans votre historique.` },
    en: { title: 'Frequently asked questions', body: `## Are returns guaranteed?\nNo. No return is guaranteed and the capital invested may be lost in whole or in part.\n\n## Why do I need to verify my identity?\nIdentity verification (KYC) is a legal anti-money laundering requirement. No financial operation is possible before approval.\n\n## When is my deposit credited?\nOnly after our team has actually verified receipt of the funds.\n\n## How do I withdraw my funds?\nFrom your area, Withdrawal section, to a bank account in your name.\n\n## How are my portfolio values calculated?\nFrom dated valuations published by the management company; each valuation is visible in your history.` },
    es: { title: 'Preguntas frecuentes', body: `## ¿Están garantizadas las rentabilidades?\nNo. Ninguna rentabilidad está garantizada y el capital invertido puede perderse total o parcialmente.\n\n## ¿Por qué debo verificar mi identidad?\nLa verificación de identidad (KYC) es una obligación legal contra el blanqueo de capitales. No es posible ninguna operación financiera antes de su validación.\n\n## ¿Cuándo se abona mi depósito?\nÚnicamente tras la verificación efectiva de la recepción de los fondos por nuestro equipo.\n\n## ¿Cómo retiro mis fondos?\nDesde su espacio, sección Retirada, hacia una cuenta bancaria a su nombre.\n\n## ¿Cómo se calculan los valores de mi cartera?\nA partir de las valoraciones fechadas publicadas por la sociedad gestora; cada valoración puede consultarse en su historial.` },
    de: { title: 'Häufige Fragen', body: `## Sind die Renditen garantiert?\nNein. Es wird keine Rendite garantiert, und das eingesetzte Kapital kann ganz oder teilweise verloren gehen.\n\n## Warum muss ich meine Identität bestätigen?\nDie Identitätsprüfung (KYC) ist eine gesetzliche Pflicht zur Geldwäschebekämpfung. Vor der Freigabe ist keine Finanztransaktion möglich.\n\n## Wann wird meine Einzahlung gutgeschrieben?\nErst nachdem unser Team den Zahlungseingang tatsächlich geprüft hat.\n\n## Wie kann ich mein Geld auszahlen lassen?\nIn Ihrem Bereich unter Auszahlung, auf ein Bankkonto, das auf Ihren Namen lautet.\n\n## Wie werden die Werte meines Portfolios berechnet?\nAnhand der datierten Bewertungen der Verwaltungsgesellschaft; jede Bewertung ist in Ihrem Verlauf einsehbar.` }
  },
  legal: {
    fr: { title: 'Mentions légales', body: `Les informations de l'éditeur (raison sociale, forme juridique, immatriculation, siège, directeur de la publication, hébergeur et statut réglementaire) sont affichées ci-dessous à partir des paramètres de la société renseignés dans l'administration.\n\n**Modèle à faire valider par un conseil juridique avant publication.**` },
    en: { title: 'Legal notice', body: `Publisher information (company name, legal form, registration, head office, publication director, host and regulatory status) is displayed below from the company settings entered in the administration.\n\n**Template to be validated by legal counsel before publication.**` },
    es: { title: 'Aviso legal', body: `La información del editor (razón social, forma jurídica, registro, domicilio social, director de la publicación, proveedor de alojamiento y estatuto reglamentario) se muestra a continuación a partir de los parámetros de la sociedad introducidos en la administración.\n\n**Modelo que debe validar un asesor jurídico antes de su publicación.**` },
    de: { title: 'Impressum', body: `Die Angaben zum Herausgeber (Firma, Rechtsform, Registernummer, Sitz, verantwortliche Person, Hosting-Anbieter und aufsichtsrechtlicher Status) werden unten aus den in der Verwaltung hinterlegten Unternehmensdaten angezeigt.\n\n**Vorlage, die vor der Veröffentlichung von einem Rechtsberater geprüft werden muss.**` }
  },
  terms: {
    fr: { title: 'Conditions générales', body: `## 1. Objet\nLes présentes conditions régissent l'utilisation de la plateforme et de l'espace investisseur.\n\n## 2. Ouverture de compte\nL'utilisateur fournit des informations exactes. La vérification d'identité est requise avant toute opération financière.\n\n## 3. Risques\nTout investissement comporte un risque de perte en capital. Aucun rendement n'est garanti.\n\n## 4. Dépôts et retraits\nLes dépôts ne sont crédités qu'après vérification effective. Les retraits sont versés sur un compte au nom de l'investisseur, selon les frais et délais affichés.\n\n## 5. Droit applicable\n[À compléter]\n\n**Modèle à faire valider par un conseil juridique avant publication.**` },
    en: { title: 'Terms and conditions', body: `## 1. Purpose\nThese terms govern the use of the platform and the investor area.\n\n## 2. Account opening\nThe user provides accurate information. Identity verification is required before any financial operation.\n\n## 3. Risks\nAll investments carry a risk of capital loss. No return is guaranteed.\n\n## 4. Deposits and withdrawals\nDeposits are only credited after actual verification. Withdrawals are paid to an account in the investor's name, subject to the fees and time frames shown.\n\n## 5. Governing law\n[To be completed]\n\n**Template to be validated by legal counsel before publication.**` },
    es: { title: 'Condiciones generales', body: `## 1. Objeto\nLas presentes condiciones regulan el uso de la plataforma y del espacio del inversor.\n\n## 2. Apertura de cuenta\nEl usuario facilita información exacta. Se requiere la verificación de identidad antes de cualquier operación financiera.\n\n## 3. Riesgos\nToda inversión conlleva un riesgo de pérdida de capital. Ninguna rentabilidad está garantizada.\n\n## 4. Depósitos y retiradas\nLos depósitos solo se abonan tras una verificación efectiva. Las retiradas se abonan en una cuenta a nombre del inversor, según las comisiones y plazos indicados.\n\n## 5. Derecho aplicable\n[A completar]\n\n**Modelo que debe validar un asesor jurídico antes de su publicación.**` },
    de: { title: 'Allgemeine Geschäftsbedingungen', body: `## 1. Gegenstand\nDiese Bedingungen regeln die Nutzung der Plattform und des Anlegerbereichs.\n\n## 2. Kontoeröffnung\nDer Nutzer macht zutreffende Angaben. Vor jeder Finanztransaktion ist eine Identitätsprüfung erforderlich.\n\n## 3. Risiken\nJede Anlage ist mit dem Risiko eines Kapitalverlusts verbunden. Es wird keine Rendite garantiert.\n\n## 4. Ein- und Auszahlungen\nEinzahlungen werden erst nach tatsächlicher Prüfung gutgeschrieben. Auszahlungen erfolgen auf ein Konto im Namen des Anlegers gemäß den angegebenen Gebühren und Fristen.\n\n## 5. Anwendbares Recht\n[Zu ergänzen]\n\n**Vorlage, die vor der Veröffentlichung von einem Rechtsberater geprüft werden muss.**` }
  },
  privacy: {
    fr: { title: 'Politique de confidentialité', body: `## Données collectées\nIdentité, coordonnées, pays de résidence, documents de vérification d'identité, données de transactions et journaux de connexion.\n\n## Finalités\nGestion du compte, respect des obligations légales (KYC, lutte contre le blanchiment), sécurité et prévention de la fraude, information des investisseurs.\n\n## Conservation et sécurité\nLes documents d'identité sont stockés de manière privée et ne sont accessibles qu'aux administrateurs habilités. Les mots de passe sont chiffrés de manière irréversible.\n\n## Vos droits\nAccès, rectification, effacement (sous réserve des obligations légales de conservation), limitation et portabilité : écrivez-nous via la page [Contact](/contact).\n\n**Modèle à faire valider par un conseil juridique avant publication.**` },
    en: { title: 'Privacy policy', body: `## Data collected\nIdentity, contact details, country of residence, identity verification documents, transaction data and sign-in logs.\n\n## Purposes\nAccount management, compliance with legal obligations (KYC, anti-money laundering), security and fraud prevention, investor information.\n\n## Retention and security\nIdentity documents are stored privately and are accessible only to authorised administrators. Passwords are irreversibly hashed.\n\n## Your rights\nAccess, rectification, erasure (subject to legal retention obligations), restriction and portability: write to us via the [Contact](/contact) page.\n\n**Template to be validated by legal counsel before publication.**` },
    es: { title: 'Política de privacidad', body: `## Datos recogidos\nIdentidad, datos de contacto, país de residencia, documentos de verificación de identidad, datos de transacciones y registros de conexión.\n\n## Finalidades\nGestión de la cuenta, cumplimiento de las obligaciones legales (KYC, prevención del blanqueo), seguridad y prevención del fraude, información a los inversores.\n\n## Conservación y seguridad\nLos documentos de identidad se almacenan de forma privada y solo son accesibles a los administradores autorizados. Las contraseñas se cifran de forma irreversible.\n\n## Sus derechos\nAcceso, rectificación, supresión (salvo obligaciones legales de conservación), limitación y portabilidad: escríbanos desde la página de [Contacto](/contact).\n\n**Modelo que debe validar un asesor jurídico antes de su publicación.**` },
    de: { title: 'Datenschutzerklärung', body: `## Erhobene Daten\nIdentität, Kontaktdaten, Wohnsitzland, Unterlagen zur Identitätsprüfung, Transaktionsdaten und Anmeldeprotokolle.\n\n## Zwecke\nKontoverwaltung, Erfüllung gesetzlicher Pflichten (KYC, Geldwäschebekämpfung), Sicherheit und Betrugsprävention, Information der Anleger.\n\n## Aufbewahrung und Sicherheit\nAusweisdokumente werden vertraulich gespeichert und sind nur für befugte Administratoren zugänglich. Passwörter werden irreversibel verschlüsselt.\n\n## Ihre Rechte\nAuskunft, Berichtigung, Löschung (vorbehaltlich gesetzlicher Aufbewahrungspflichten), Einschränkung und Datenübertragbarkeit: Schreiben Sie uns über die Seite [Kontakt](/contact).\n\n**Vorlage, die vor der Veröffentlichung von einem Rechtsberater geprüft werden muss.**` }
  }
};

async function seedPages() {
  for (const [slug, i18n] of Object.entries(PAGES)) {
    if (!await one('SELECT slug FROM pages WHERE slug = ?', slug)) {
      await run('INSERT INTO pages (slug, i18n) VALUES (?, ?) ON CONFLICT (slug) DO NOTHING', slug, JSON.stringify(i18n));
    }
  }
}

const DEMO_NOTE = {
  fr: 'Exemple de démonstration : projet fictif destiné à illustrer la plateforme. Ne constitue pas une offre.',
  en: 'Demonstration example: fictitious project intended to illustrate the platform. Not an offer.',
  es: 'Ejemplo de demostración: proyecto ficticio destinado a ilustrar la plataforma. No constituye una oferta.',
  de: 'Demonstrationsbeispiel: fiktives Projekt zur Veranschaulichung der Plattform. Kein Angebot.'
};

const DEMO_PROJECTS = [
  {
    slug: 'demo-residence-locative', sector: 'real_estate', country: 'Portugal', target: 1500000, ticket: 1000, months: 36, risk: 3,
    t: {
      fr: ['Résidence locative (démonstration)', 'Construction d\'un immeuble de 24 logements destinés à la location longue durée.', 'Exemple de fiche : acquisition d\'un terrain et construction d\'un immeuble résidentiel de 24 logements, destinés à la location longue durée, puis revente à l\'échéance.', 'Souscription réservée aux investisseurs dont l\'identité est vérifiée. Capital bloqué pendant la durée du projet.', 'Frais d\'entrée : 2 % du montant investi. Frais de gestion : 1 % par an.'],
      en: ['Rental residence (demonstration)', 'Construction of a 24-unit building for long-term rental.', 'Example sheet: purchase of land and construction of a 24-unit residential building for long-term rental, followed by a sale at maturity.', 'Open only to investors whose identity has been verified. Capital locked for the duration of the project.', 'Entry fee: 2% of the amount invested. Management fee: 1% per year.'],
      es: ['Residencia de alquiler (demostración)', 'Construcción de un edificio de 24 viviendas destinadas al alquiler de larga duración.', 'Ficha de ejemplo: adquisición de un terreno y construcción de un edificio residencial de 24 viviendas para alquiler de larga duración y posterior venta al vencimiento.', 'Reservado a inversores con identidad verificada. Capital bloqueado durante la duración del proyecto.', 'Comisión de entrada: 2 % del importe invertido. Comisión de gestión: 1 % anual.'],
      de: ['Mietwohnanlage (Demonstration)', 'Bau eines Gebäudes mit 24 Wohnungen zur Langzeitvermietung.', 'Beispielblatt: Erwerb eines Grundstücks und Bau eines Wohngebäudes mit 24 Einheiten zur Langzeitvermietung, anschließend Verkauf bei Fälligkeit.', 'Nur für Anleger mit bestätigter Identität. Kapital für die Projektlaufzeit gebunden.', 'Ausgabeaufschlag: 2 % des Anlagebetrags. Verwaltungsgebühr: 1 % pro Jahr.']
    }
  },
  {
    slug: 'demo-unite-transformation-agricole', sector: 'agriculture', country: 'Côte d\'Ivoire', target: 600000, ticket: 500, months: 24, risk: 4,
    t: {
      fr: ['Unité de transformation agricole (démonstration)', 'Équipement d\'une unité de transformation et de stockage de produits agricoles.', 'Exemple de fiche : financement des équipements de séchage, de conditionnement et de stockage pour une coopérative agricole.', 'Souscription réservée aux investisseurs dont l\'identité est vérifiée. Risque climatique et de prix des matières premières.', 'Frais d\'entrée : 2,5 %. Aucun frais de sortie.'],
      en: ['Agricultural processing unit (demonstration)', 'Equipment for a processing and storage unit for agricultural products.', 'Example sheet: financing of drying, packaging and storage equipment for an agricultural cooperative.', 'Open only to investors whose identity has been verified. Weather and commodity price risk.', 'Entry fee: 2.5%. No exit fee.'],
      es: ['Unidad de transformación agrícola (demostración)', 'Equipamiento de una unidad de transformación y almacenamiento de productos agrícolas.', 'Ficha de ejemplo: financiación de equipos de secado, envasado y almacenamiento para una cooperativa agrícola.', 'Reservado a inversores con identidad verificada. Riesgo climático y de precio de las materias primas.', 'Comisión de entrada: 2,5 %. Sin comisión de salida.'],
      de: ['Agrarverarbeitungsanlage (Demonstration)', 'Ausstattung einer Anlage zur Verarbeitung und Lagerung von Agrarprodukten.', 'Beispielblatt: Finanzierung von Trocknungs-, Verpackungs- und Lagereinrichtungen für eine landwirtschaftliche Genossenschaft.', 'Nur für Anleger mit bestätigter Identität. Wetter- und Rohstoffpreisrisiko.', 'Ausgabeaufschlag: 2,5 %. Keine Rücknahmegebühr.']
    }
  },
  {
    slug: 'demo-centrale-solaire', sector: 'energy', country: 'Espagne', target: 2500000, ticket: 1000, months: 60, risk: 3,
    t: {
      fr: ['Centrale solaire (démonstration)', 'Construction et exploitation d\'une centrale photovoltaïque au sol.', 'Exemple de fiche : développement d\'une centrale photovoltaïque avec vente d\'électricité sur le réseau. Les revenus dépendent de la production et des prix de l\'électricité.', 'Souscription réservée aux investisseurs dont l\'identité est vérifiée. Durée longue, liquidité limitée.', 'Frais d\'entrée : 2 %. Frais de gestion : 0,8 % par an.'],
      en: ['Solar power plant (demonstration)', 'Construction and operation of a ground-mounted photovoltaic plant.', 'Example sheet: development of a photovoltaic plant selling electricity to the grid. Revenues depend on production and electricity prices.', 'Open only to investors whose identity has been verified. Long duration, limited liquidity.', 'Entry fee: 2%. Management fee: 0.8% per year.'],
      es: ['Central solar (demostración)', 'Construcción y explotación de una central fotovoltaica en suelo.', 'Ficha de ejemplo: desarrollo de una central fotovoltaica con venta de electricidad a la red. Los ingresos dependen de la producción y de los precios de la electricidad.', 'Reservado a inversores con identidad verificada. Duración larga, liquidez limitada.', 'Comisión de entrada: 2 %. Comisión de gestión: 0,8 % anual.'],
      de: ['Solarkraftwerk (Demonstration)', 'Bau und Betrieb einer Freiflächen-Photovoltaikanlage.', 'Beispielblatt: Entwicklung einer Photovoltaikanlage mit Stromeinspeisung ins Netz. Die Erträge hängen von der Produktion und den Strompreisen ab.', 'Nur für Anleger mit bestätigter Identität. Lange Laufzeit, begrenzte Liquidität.', 'Ausgabeaufschlag: 2 %. Verwaltungsgebühr: 0,8 % pro Jahr.']
    }
  },
  {
    slug: 'demo-plateforme-logistique', sector: 'trade', country: 'Sénégal', target: 900000, ticket: 500, months: 18, risk: 4,
    t: {
      fr: ['Plateforme logistique portuaire (démonstration)', 'Financement d\'un entrepôt et d\'une flotte de transport pour l\'import-export.', 'Exemple de fiche : financement d\'un entrepôt sous douane et de véhicules de transport pour une société d\'import-export.', 'Souscription réservée aux investisseurs dont l\'identité est vérifiée. Risque de change et risque pays.', 'Frais d\'entrée : 3 %. Aucun frais de gestion.'],
      en: ['Port logistics platform (demonstration)', 'Financing of a warehouse and a transport fleet for import-export.', 'Example sheet: financing of a bonded warehouse and transport vehicles for an import-export company.', 'Open only to investors whose identity has been verified. Currency and country risk.', 'Entry fee: 3%. No management fee.'],
      es: ['Plataforma logística portuaria (demostración)', 'Financiación de un almacén y de una flota de transporte para la importación-exportación.', 'Ficha de ejemplo: financiación de un depósito aduanero y de vehículos de transporte para una empresa de importación-exportación.', 'Reservado a inversores con identidad verificada. Riesgo de cambio y riesgo país.', 'Comisión de entrada: 3 %. Sin comisión de gestión.'],
      de: ['Hafenlogistikplattform (Demonstration)', 'Finanzierung eines Lagers und einer Transportflotte für Import-Export.', 'Beispielblatt: Finanzierung eines Zolllagers und von Transportfahrzeugen für ein Import-Export-Unternehmen.', 'Nur für Anleger mit bestätigter Identität. Währungs- und Länderrisiko.', 'Ausgabeaufschlag: 3 %. Keine Verwaltungsgebühr.']
    }
  }
];

async function seedDemoProjects() {
  if (await one('SELECT id FROM projects LIMIT 1')) return;
  if (process.env.SEED_DEMO === 'false') return;
  for (const p of DEMO_PROJECTS) {
    const i18n = {};
    for (const [lang, [title, summary, description, conditions, fees]] of Object.entries(p.t)) {
      i18n[lang] = { title, summary, description: `${description}\n\n**${DEMO_NOTE[lang]}**`, conditions, fees };
    }
    await run(`INSERT INTO projects (slug, sector, country, i18n, target_cents, min_ticket_cents, duration_months, risk_level, status, is_demo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', 1) ON CONFLICT (slug) DO NOTHING`,
      p.slug, p.sector, p.country, JSON.stringify(i18n), p.target * 100, p.ticket * 100, p.months, p.risk);
  }
  console.log('[seed] 4 fiches de démonstration créées (marquées comme fictives — à archiver avant la mise en production).');
}

async function seed() {
  await seedAdmin();
  await seedPages();
  await seedDemoProjects();
}

module.exports = { seed };
