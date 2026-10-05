'use strict';
/**
 * Projets internationaux référencés : projets RÉELS, publics, financés par la Banque mondiale.
 * Données factuelles (intitulé officiel, pays, engagement, dates, organisme d'exécution, objectif) relevées le 5 octobre 2026
 * dans l'API officielle « Projects & Operations » (search.worldbank.org/api/v3/projects, licence CC BY 4.0) ;
 * chaque fiche renvoie à la page officielle du projet. Les textes sont des présentations originales rédigées à partir
 * de l'objectif de développement publié — aucun chiffre n'est ajouté. La plateforme n'est ni promoteur ni mandataire de ces projets.
 *
 * t[langue] = [objectif (résumé), description, résultats attendus, ville / région]
 */
const VERIFIED_AT = '2026-10-05';
const SOURCE_NAME = 'World Bank — Projects & Operations (open data, CC BY 4.0)';
const url = (id) => `https://projects.worldbank.org/en/projects-operations/project-detail/${id}`;

const PROJECTS = [
  {
    id: 'P180361', sector: 'real_estate', country: 'Équateur', photo: 'residence-2', amount: 100000000, fin: 'BIRD', instr: 'IPF', approved: '2023-10-05', closing: '2029-03-13',
    agency: 'Ministerio de Desarrollo Urbano y Vivienda', name: 'Ecuador Inclusive and Resilient Housing and Urban Development Project', title_fr: 'Logement et développement urbain inclusifs et résilients en Équateur',
    t: {
      fr: ['Améliorer l’accès des ménages à faibles revenus à un logement abordable et résilient, ainsi que les infrastructures et services urbains de quartiers ciblés.', 'Le projet finance des solutions de logement abordable et la mise à niveau de quartiers en Équateur. Il renforce aussi la capacité de l’État à déployer ses politiques de logement et d’amélioration de l’habitat.', 'Davantage de logements abordables et résilients, et de meilleurs services urbains dans les quartiers retenus.', 'Quartiers sélectionnés, échelle nationale'],
      en: ['Improve access to affordable, resilient housing for low-income households, together with urban infrastructure and services in targeted settlements.', 'The project finances affordable housing solutions and settlement upgrading in Ecuador. It also strengthens the government’s capacity to roll out its housing and upgrading policies.', 'More affordable, resilient homes and better urban services in the selected settlements.', 'Selected settlements, nationwide'],
      es: ['Mejorar el acceso de los hogares de bajos ingresos a una vivienda asequible y resiliente, así como la infraestructura y los servicios urbanos de asentamientos seleccionados.', 'El proyecto financia soluciones de vivienda asequible y la mejora de barrios en Ecuador. También refuerza la capacidad del Estado para aplicar sus políticas de vivienda y mejora del hábitat.', 'Más viviendas asequibles y resilientes y mejores servicios urbanos en los asentamientos seleccionados.', 'Asentamientos seleccionados, ámbito nacional'],
      de: ['Zugang einkommensschwacher Haushalte zu bezahlbarem, widerstandsfähigem Wohnraum verbessern sowie städtische Infrastruktur und Dienstleistungen in ausgewählten Siedlungen ausbauen.', 'Das Projekt finanziert bezahlbare Wohnlösungen und die Aufwertung von Siedlungen in Ecuador. Zudem stärkt es die Fähigkeit des Staates, seine Wohnungspolitik umzusetzen.', 'Mehr bezahlbarer, widerstandsfähiger Wohnraum und bessere städtische Dienstleistungen in den ausgewählten Siedlungen.', 'Ausgewählte Siedlungen, landesweit']
    }
  },
  {
    id: 'P178683', sector: 'commercial', country: 'Sierra Leone', photo: 'marche', amount: 74000000, fin: 'IDA', instr: 'IPF', approved: '2024-05-29', closing: '2029-12-31',
    agency: 'Sierra Leone Road Authority ; Ministry of Works, Housing and Infrastructure', name: 'Sierra Leone Connectivity and Agricultural Market Infrastructure Project', title_fr: 'Connectivité et infrastructures de marchés agricoles en Sierra Leone',
    t: {
      fr: ['Réaliser des ponts ruraux et des infrastructures de marchés agricoles résistants au climat pour relier les communautés rurales aux marchés.', 'Le projet intervient sur des sites sélectionnés de Sierra Leone. Il associe des ouvrages de franchissement en zone rurale et des équipements marchands destinés aux produits agricoles.', 'Un meilleur accès des communautés rurales aux marchés agricoles.', 'Sites ruraux sélectionnés'],
      en: ['Provide climate-resilient rural bridges and agricultural market infrastructure to connect rural communities to markets.', 'The project operates at selected locations in Sierra Leone. It combines rural bridge works with market facilities for agricultural produce.', 'Better access to agricultural markets for rural communities.', 'Selected rural locations'],
      es: ['Construir puentes rurales e infraestructuras de mercados agrícolas resistentes al clima para conectar a las comunidades rurales con los mercados.', 'El proyecto actúa en lugares seleccionados de Sierra Leona. Combina puentes en zonas rurales con instalaciones de mercado para productos agrícolas.', 'Mejor acceso de las comunidades rurales a los mercados agrícolas.', 'Lugares rurales seleccionados'],
      de: ['Klimaresiliente ländliche Brücken und Infrastruktur für Agrarmärkte bereitstellen, um ländliche Gemeinden an Märkte anzubinden.', 'Das Projekt wird an ausgewählten Standorten in Sierra Leone umgesetzt. Es verbindet ländliche Brückenbauten mit Markteinrichtungen für Agrarprodukte.', 'Besserer Zugang ländlicher Gemeinden zu Agrarmärkten.', 'Ausgewählte ländliche Standorte']
    }
  },
  {
    id: 'P180337', sector: 'tourism', country: 'Zambie', photo: 'savane', amount: 100000000, fin: 'IDA', instr: 'IPF', approved: '2023-06-09', closing: '2030-12-31',
    agency: 'Ministry of Tourism', name: 'Green, Resilient and Transformational Tourism Development Project (GREAT-TDP)', title_fr: 'Développement d’un tourisme vert, résilient et transformateur en Zambie (GREAT-TDP)',
    t: {
      fr: ['Renforcer le cadre d’activité, l’accès à des infrastructures résilientes et les débouchés économiques dans les destinations touristiques émergentes de Zambie.', 'Le projet soutient l’économie fondée sur la nature, en premier lieu le tourisme. Il associe amélioration du cadre d’activité, infrastructures et appui aux activités économiques locales.', 'Des destinations émergentes mieux équipées et davantage d’activités économiques liées au tourisme.', 'Destinations touristiques émergentes'],
      en: ['Strengthen the enabling environment, access to resilient infrastructure and economic opportunities in Zambia’s emerging tourism destinations.', 'The project supports the nature-based economy, tourism first and foremost. It combines a better enabling environment, infrastructure and support for local economic activity.', 'Better-equipped emerging destinations and more tourism-related economic activity.', 'Emerging tourism destinations'],
      es: ['Reforzar el entorno de actividad, el acceso a infraestructuras resilientes y las oportunidades económicas en los destinos turísticos emergentes de Zambia.', 'El proyecto apoya la economía basada en la naturaleza, en primer lugar el turismo. Combina la mejora del entorno, infraestructuras y apoyo a la actividad económica local.', 'Destinos emergentes mejor equipados y más actividad económica vinculada al turismo.', 'Destinos turísticos emergentes'],
      de: ['Rahmenbedingungen, Zugang zu widerstandsfähiger Infrastruktur und wirtschaftliche Chancen in den aufstrebenden Tourismuszielen Sambias stärken.', 'Das Projekt fördert die naturbasierte Wirtschaft, vor allem den Tourismus. Es verbindet bessere Rahmenbedingungen, Infrastruktur und die Förderung lokaler Wirtschaftstätigkeit.', 'Besser ausgestattete aufstrebende Reiseziele und mehr tourismusbezogene Wirtschaftstätigkeit.', 'Aufstrebende Tourismusziele']
    }
  },
  {
    id: 'P179238', sector: 'agriculture', country: 'Tchad', photo: 'agriculture', amount: 150000000, fin: 'IDA', instr: 'IPF', approved: '2024-04-25', closing: '2030-07-31',
    agency: 'Ministry for Agricultural Production and Transformation', name: 'Chad Agribusiness and Rural Transformation Project', title_fr: 'Agro-industrie et transformation rurale au Tchad',
    t: {
      fr: ['Améliorer la compétitivité, l’inclusion et la résilience de chaînes de valeur agricoles sélectionnées au Tchad.', 'Le projet concentre ses investissements sur des filières retenues dans ses zones d’intervention, de la production à la transformation et à la mise en marché.', 'Des filières agricoles plus compétitives, plus inclusives et plus résistantes aux chocs.', 'Zones d’intervention du projet'],
      en: ['Improve the competitiveness, inclusiveness and resilience of selected agricultural value chains in Chad.', 'The project focuses its investments on selected value chains in its intervention areas, from production to processing and marketing.', 'More competitive, inclusive and shock-resilient agricultural value chains.', 'Project intervention areas'],
      es: ['Mejorar la competitividad, la inclusión y la resiliencia de cadenas de valor agrícolas seleccionadas en Chad.', 'El proyecto concentra sus inversiones en cadenas seleccionadas dentro de sus zonas de intervención, desde la producción hasta la transformación y la comercialización.', 'Cadenas agrícolas más competitivas, inclusivas y resistentes a las crisis.', 'Zonas de intervención del proyecto'],
      de: ['Wettbewerbsfähigkeit, Inklusivität und Widerstandsfähigkeit ausgewählter landwirtschaftlicher Wertschöpfungsketten im Tschad verbessern.', 'Das Projekt bündelt seine Investitionen auf ausgewählte Wertschöpfungsketten in seinen Einsatzgebieten – von der Erzeugung über die Verarbeitung bis zur Vermarktung.', 'Wettbewerbsfähigere, inklusivere und krisenfestere landwirtschaftliche Wertschöpfungsketten.', 'Einsatzgebiete des Projekts']
    }
  },
  {
    id: 'P179276', sector: 'livestock', country: 'Niger', photo: 'elevage', amount: 350000000, fin: 'IDA', instr: 'IPF', approved: '2024-06-28', closing: '2029-09-28',
    agency: 'Ministry of Agriculture', name: 'Livestock and Agriculture Modernization Project (LAMP)', title_fr: 'Modernisation de l’élevage et de l’agriculture au Niger (LAMP)',
    t: {
      fr: ['Accroître la productivité, la commercialisation et la résilience climatique du secteur agroalimentaire dans les zones du projet.', 'Le projet appuie la modernisation de l’élevage et de l’agriculture au Niger. Il agit à la fois sur la production, la mise en marché et l’adaptation au climat.', 'Une productivité plus élevée et des produits mieux commercialisés dans les zones du projet.', 'Zones du projet'],
      en: ['Increase productivity, commercialisation and climate resilience of the agri-food sector in the project areas.', 'The project supports the modernisation of livestock and agriculture in Niger. It addresses production, marketing and climate adaptation together.', 'Higher productivity and better-marketed products in the project areas.', 'Project areas'],
      es: ['Aumentar la productividad, la comercialización y la resiliencia climática del sector agroalimentario en las zonas del proyecto.', 'El proyecto apoya la modernización de la ganadería y la agricultura en Níger. Actúa a la vez sobre la producción, la comercialización y la adaptación al clima.', 'Mayor productividad y productos mejor comercializados en las zonas del proyecto.', 'Zonas del proyecto'],
      de: ['Produktivität, Vermarktung und Klimaresilienz des Agrar- und Ernährungssektors in den Projektgebieten steigern.', 'Das Projekt unterstützt die Modernisierung von Viehzucht und Landwirtschaft in Niger. Es setzt zugleich bei Erzeugung, Vermarktung und Klimaanpassung an.', 'Höhere Produktivität und besser vermarktete Erzeugnisse in den Projektgebieten.', 'Projektgebiete']
    }
  },
  {
    id: 'P174137', sector: 'fishing', country: 'Philippines', photo: 'peche', amount: 176020000, fin: 'BIRD', instr: 'IPF', approved: '2023-05-30', closing: '2029-12-31',
    agency: 'Department of Agriculture — Bureau of Fisheries and Aquatic Resources', name: 'Philippine Fisheries and Coastal Resiliency Project', title_fr: 'Pêche et résilience côtière aux Philippines',
    t: {
      fr: ['Améliorer la gestion des ressources halieutiques ciblées et accroître la valeur de la production de pêche pour les communautés côtières.', 'Le projet intervient dans des zones de gestion des pêches sélectionnées. Il associe planification de la ressource, gouvernance des zones de pêche et valorisation de la production.', 'Des ressources mieux gérées et une production mieux valorisée pour les communautés côtières.', 'Zones de gestion des pêches sélectionnées'],
      en: ['Improve the management of targeted fisheries resources and enhance the value of fisheries production for coastal communities.', 'The project operates in selected Fisheries Management Areas. It combines resource planning, governance of fishing areas and adding value to production.', 'Better-managed resources and higher-value production for coastal communities.', 'Selected Fisheries Management Areas'],
      es: ['Mejorar la gestión de los recursos pesqueros seleccionados y aumentar el valor de la producción pesquera para las comunidades costeras.', 'El proyecto actúa en zonas de gestión pesquera seleccionadas. Combina la planificación del recurso, la gobernanza de las zonas de pesca y la valorización de la producción.', 'Recursos mejor gestionados y una producción de mayor valor para las comunidades costeras.', 'Zonas de gestión pesquera seleccionadas'],
      de: ['Bewirtschaftung ausgewählter Fischereiressourcen verbessern und den Wert der Fischereiproduktion für Küstengemeinden steigern.', 'Das Projekt wird in ausgewählten Fischereibewirtschaftungsgebieten umgesetzt. Es verbindet Ressourcenplanung, Steuerung der Fanggebiete und höhere Wertschöpfung.', 'Besser bewirtschaftete Ressourcen und höherwertige Produktion für Küstengemeinden.', 'Ausgewählte Fischereibewirtschaftungsgebiete']
    }
  },
  {
    id: 'P179255', sector: 'industry', country: 'Turquie', photo: 'usine-2', amount: 450000000, fin: 'BIRD', instr: 'IPF', approved: '2023-06-02', closing: '2029-06-30',
    agency: 'KOSGEB ; TÜBİTAK ; Ministry of Industry and Technology', name: 'Türkiye Green Industry Project', title_fr: 'Industrie verte en Turquie',
    t: {
      fr: ['Soutenir une transformation verte efficace des entreprises industrielles en Turquie.', 'Le projet aide notamment les PME industrielles à améliorer leur performance énergétique et à réduire leurs émissions de carbone, y compris par des investissements solaires. Il comprend aussi un volet d’assistance technique.', 'Des entreprises industrielles plus sobres en énergie et en ressources.', 'Échelle nationale'],
      en: ['Support an efficient green transformation of industrial firms in Türkiye.', 'In particular, the project helps industrial SMEs improve their energy performance and cut their carbon emissions, including through solar investments. It also includes technical assistance.', 'Industrial firms that use less energy and fewer resources.', 'Nationwide'],
      es: ['Apoyar una transformación verde eficiente de las empresas industriales en Turquía.', 'El proyecto ayuda en particular a las pymes industriales a mejorar su rendimiento energético y reducir sus emisiones de carbono, también mediante inversiones solares. Incluye además asistencia técnica.', 'Empresas industriales que consumen menos energía y recursos.', 'Ámbito nacional'],
      de: ['Einen effizienten grünen Wandel der Industrieunternehmen in der Türkei unterstützen.', 'Das Projekt hilft insbesondere industriellen KMU, ihre Energieeffizienz zu verbessern und ihre CO₂-Emissionen zu senken, auch durch Solarinvestitionen. Es umfasst zudem technische Unterstützung.', 'Industrieunternehmen mit geringerem Energie- und Ressourcenverbrauch.', 'Landesweit']
    }
  },
  {
    id: 'P180228', sector: 'trade', country: 'Rwanda', photo: 'camions', amount: 126000000, fin: 'IDA', instr: 'IPF', approved: '2024-03-29', closing: '2030-09-30',
    agency: 'Ministry of Trade and Industry (MINICOM) ; Rwanda Transport Development Agency (RTDA) ; Ministry of Infrastructure (MININFRA)', name: 'Kigali Logistics Platform Connectivity Development Project', title_fr: 'Connectivité de la plateforme logistique de Kigali',
    t: {
      fr: ['Améliorer la connectivité et accroître les flux de biens et de services entre la plateforme logistique de Kigali et le corridor routier international Ngoma–Nyanza.', 'Le projet relie la plateforme logistique de Kigali au corridor routier international. Il porte aussi sur la sécurité et la résilience des déplacements de marchandises et de personnes.', 'Des échanges plus fluides et des trajets plus sûrs sur le corridor.', 'Kigali — corridor Ngoma–Nyanza'],
      en: ['Improve connectivity and increase the flow of goods and services between the Kigali Logistics Platform and the Ngoma–Nyanza international road corridor.', 'The project links the Kigali Logistics Platform to the international road corridor. It also addresses the safety and resilience of the movement of goods and people.', 'Smoother trade flows and safer journeys along the corridor.', 'Kigali — Ngoma–Nyanza corridor'],
      es: ['Mejorar la conectividad y aumentar el flujo de bienes y servicios entre la plataforma logística de Kigali y el corredor vial internacional Ngoma–Nyanza.', 'El proyecto conecta la plataforma logística de Kigali con el corredor vial internacional. También aborda la seguridad y la resiliencia del transporte de mercancías y personas.', 'Intercambios más fluidos y trayectos más seguros en el corredor.', 'Kigali — corredor Ngoma–Nyanza'],
      de: ['Anbindung verbessern und den Waren- und Dienstleistungsverkehr zwischen der Logistikplattform Kigali und dem internationalen Straßenkorridor Ngoma–Nyanza steigern.', 'Das Projekt bindet die Logistikplattform Kigali an den internationalen Straßenkorridor an. Es betrifft auch Sicherheit und Widerstandsfähigkeit des Güter- und Personenverkehrs.', 'Flüssigerer Handel und sicherere Fahrten auf dem Korridor.', 'Kigali — Korridor Ngoma–Nyanza']
    }
  },
  {
    id: 'P181166', sector: 'infrastructure', country: 'Honduras', photo: 'route', amount: 187000000, fin: 'IDA', instr: 'IPF', approved: '2024-12-17', closing: '2031-12-31',
    agency: '', name: 'Honduras Sustainable Connectivity Project', title_fr: 'Connectivité durable au Honduras',
    t: {
      fr: ['Améliorer un accès routier sûr et résistant au climat dans le nord-ouest du Honduras.', 'Le projet finance notamment la construction d’une nouvelle route à deux voies de 46 km reliant la CA-4 (près de Macuelizo) à la CA-13 (près de Corinto), à proximité de la frontière guatémaltèque. Il soutient aussi des moyens de subsistance durables dans des zones sélectionnées.', 'Un meilleur accès des populations rurales aux services, aux emplois et aux marchés.', 'Nord-ouest du pays (Macuelizo — Corinto)'],
      en: ['Improve safe, climate-resilient road access in north-western Honduras.', 'In particular, the project finances the construction of a new 46 km two-lane road linking the CA-4 (near Macuelizo) to the CA-13 (near Corinto), close to the Guatemalan border. It also supports sustainable livelihoods in selected areas.', 'Better access to services, jobs and markets for rural populations.', 'North-west of the country (Macuelizo — Corinto)'],
      es: ['Mejorar un acceso vial seguro y resistente al clima en el noroeste de Honduras.', 'El proyecto financia en particular la construcción de una nueva carretera de dos carriles y 46 km que une la CA-4 (cerca de Macuelizo) con la CA-13 (cerca de Corinto), próxima a la frontera con Guatemala. También apoya medios de vida sostenibles en zonas seleccionadas.', 'Mejor acceso de la población rural a servicios, empleos y mercados.', 'Noroeste del país (Macuelizo — Corinto)'],
      de: ['Sicheren, klimaresilienten Straßenzugang im Nordwesten von Honduras verbessern.', 'Das Projekt finanziert insbesondere den Bau einer neuen, 46 km langen zweispurigen Straße zwischen der CA-4 (bei Macuelizo) und der CA-13 (bei Corinto) nahe der Grenze zu Guatemala. Es fördert zudem nachhaltige Lebensgrundlagen in ausgewählten Gebieten.', 'Besserer Zugang der Landbevölkerung zu Dienstleistungen, Arbeitsplätzen und Märkten.', 'Nordwesten des Landes (Macuelizo — Corinto)']
    }
  },
  {
    id: 'P181221', sector: 'energy', country: 'Botswana', photo: 'solaire', amount: 88000000, fin: 'BIRD', instr: 'IPF', approved: '2024-07-11', closing: '2029-12-31',
    agency: 'Ministry of Minerals and Energy ; Botswana Power Corporation', name: 'Renewable Energy Support and Access Accelerator Project', title_fr: 'Appui aux énergies renouvelables et accès à l’électricité au Botswana',
    t: {
      fr: ['Permettre l’intégration des énergies renouvelables au réseau et améliorer l’accès à l’électricité dans les zones rurales du Botswana.', 'Le projet prévoit des renforcements du réseau, dont des systèmes de stockage par batteries d’une capacité estimée à environ 50 MW / 200 MWh. Il améliore aussi le service électrique dans des zones rurales sélectionnées.', 'Un réseau capable d’accueillir davantage d’énergie renouvelable et un meilleur service en zone rurale.', 'Réseau national et zones rurales sélectionnées'],
      en: ['Enable the grid integration of renewable energy and improve access to electricity in rural areas of Botswana.', 'The project provides for grid upgrades, including battery energy storage systems with an estimated capacity of about 50 MW / 200 MWh. It also improves electricity service in selected rural areas.', 'A grid able to take more renewable energy and better service in rural areas.', 'National grid and selected rural areas'],
      es: ['Permitir la integración de las energías renovables en la red y mejorar el acceso a la electricidad en las zonas rurales de Botsuana.', 'El proyecto prevé refuerzos de la red, incluidos sistemas de almacenamiento con baterías de una capacidad estimada de unos 50 MW / 200 MWh. También mejora el servicio eléctrico en zonas rurales seleccionadas.', 'Una red capaz de integrar más energía renovable y un mejor servicio en zonas rurales.', 'Red nacional y zonas rurales seleccionadas'],
      de: ['Netzintegration erneuerbarer Energien ermöglichen und den Zugang zu Strom in ländlichen Gebieten Botswanas verbessern.', 'Das Projekt sieht Netzverstärkungen vor, darunter Batteriespeicher mit einer geschätzten Kapazität von rund 50 MW / 200 MWh. Außerdem verbessert es die Stromversorgung in ausgewählten ländlichen Gebieten.', 'Ein Netz, das mehr erneuerbare Energie aufnehmen kann, und bessere Versorgung auf dem Land.', 'Landesnetz und ausgewählte ländliche Gebiete']
    }
  },
  {
    id: 'P168613', sector: 'mining', country: 'Guinée', photo: 'mine', amount: 65000000, fin: 'IDA', instr: 'IPF', approved: '2021-05-26', closing: '2027-09-30',
    agency: 'Ministry of Environment and Sustainable Development ; Ministry of Mining and Geology', name: 'Guinea Natural Resources, Mining and Environmental Management Project', title_fr: 'Gestion des ressources naturelles, des mines et de l’environnement en Guinée',
    t: {
      fr: ['Renforcer les capacités institutionnelles de gestion intégrée des ressources minérales et naturelles en Guinée.', 'Le projet appuie les administrations chargées des mines et de l’environnement. Il vise à accroître les bénéfices que le pays tire de ces deux secteurs.', 'Une gestion mieux encadrée des ressources minières et naturelles.', 'Échelle nationale'],
      en: ['Strengthen institutional capacities for the integrated management of mineral and natural resources in Guinea.', 'The project supports the administrations in charge of mining and the environment. It aims to increase the benefits the country derives from both sectors.', 'Better-governed management of mining and natural resources.', 'Nationwide'],
      es: ['Reforzar las capacidades institucionales de gestión integrada de los recursos minerales y naturales en Guinea.', 'El proyecto apoya a las administraciones responsables de la minería y del medio ambiente. Busca aumentar los beneficios que el país obtiene de ambos sectores.', 'Una gestión mejor regulada de los recursos mineros y naturales.', 'Ámbito nacional'],
      de: ['Institutionelle Kapazitäten für die integrierte Bewirtschaftung mineralischer und natürlicher Ressourcen in Guinea stärken.', 'Das Projekt unterstützt die für Bergbau und Umwelt zuständigen Behörden. Es soll den Nutzen erhöhen, den das Land aus beiden Sektoren zieht.', 'Besser geregelte Bewirtschaftung von Bergbau- und Naturressourcen.', 'Landesweit']
    }
  },
  {
    id: 'P179138', sector: 'technology', country: 'Togo', photo: 'datacenter', amount: 100000000, fin: 'IDA', instr: 'IPF', approved: '2024-12-18', closing: '2030-01-31',
    agency: 'Ministry of Digital Economy and Digital Transformation', name: 'Togo Digital Acceleration Project', title_fr: 'Accélération numérique du Togo',
    t: {
      fr: ['Étendre l’accès à une connectivité haut débit abordable et résiliente, développer les compétences numériques et renforcer l’entrepreneuriat numérique.', 'Le projet comprend le déploiement de réseaux de collecte et l’extension de la connectivité du dernier kilomètre. Il prévoit aussi un pôle technologique et un appui au cadre légal et réglementaire.', 'Davantage de personnes connectées et un écosystème numérique plus actif.', 'Échelle nationale'],
      en: ['Expand access to affordable, resilient broadband connectivity, enhance digital skills and strengthen digital entrepreneurship.', 'The project includes backhaul network deployment and the extension of last-mile connectivity. It also provides for a tech hub and support for the legal and regulatory framework.', 'More people connected and a more active digital ecosystem.', 'Nationwide'],
      es: ['Ampliar el acceso a una conectividad de banda ancha asequible y resiliente, desarrollar las competencias digitales y reforzar el emprendimiento digital.', 'El proyecto incluye el despliegue de redes troncales y la ampliación de la conectividad de última milla. También prevé un polo tecnológico y apoyo al marco legal y regulatorio.', 'Más personas conectadas y un ecosistema digital más activo.', 'Ámbito nacional'],
      de: ['Zugang zu bezahlbarer, widerstandsfähiger Breitbandanbindung ausweiten, digitale Kompetenzen fördern und digitales Unternehmertum stärken.', 'Das Projekt umfasst den Ausbau von Backhaul-Netzen und der Anbindung auf der letzten Meile. Vorgesehen sind auch ein Technologiezentrum und die Unterstützung des Rechts- und Regulierungsrahmens.', 'Mehr angeschlossene Menschen und ein aktiveres digitales Ökosystem.', 'Landesweit']
    }
  },
  {
    id: 'P180811', sector: 'health', country: 'Indonésie', photo: 'sante', amount: 1484000000, fin: 'BIRD', instr: 'IPF', approved: '2023-12-08', closing: '2029-06-30',
    agency: '', name: 'Indonesia Health Systems Strengthening Project', title_fr: 'Renforcement des systèmes de santé en Indonésie',
    t: {
      fr: ['Renforcer la capacité de service des établissements de santé et améliorer l’accès à des soins intégrés et de qualité en Indonésie.', 'Le projet finance l’acquisition, l’installation, l’exploitation et la maintenance d’équipements pour les centres de soins primaires et les hôpitaux de référence du pays.', 'Des établissements publics mieux équipés et davantage utilisés.', 'Échelle nationale'],
      en: ['Strengthen health facilities’ service readiness and improve access to integrated, quality health services in Indonesia.', 'The project finances the procurement, installation, operation and maintenance of equipment for primary care facilities and referral hospitals across the country.', 'Better-equipped, more widely used public health facilities.', 'Nationwide'],
      es: ['Reforzar la capacidad de servicio de los establecimientos de salud y mejorar el acceso a una atención integrada y de calidad en Indonesia.', 'El proyecto financia la adquisición, instalación, operación y mantenimiento de equipos para los centros de atención primaria y los hospitales de referencia del país.', 'Establecimientos públicos mejor equipados y más utilizados.', 'Ámbito nacional'],
      de: ['Leistungsbereitschaft der Gesundheitseinrichtungen stärken und den Zugang zu integrierter, hochwertiger Versorgung in Indonesien verbessern.', 'Das Projekt finanziert Beschaffung, Installation, Betrieb und Wartung von Ausrüstung für Einrichtungen der Primärversorgung und Referenzkrankenhäuser im ganzen Land.', 'Besser ausgestattete und stärker genutzte öffentliche Gesundheitseinrichtungen.', 'Landesweit']
    }
  },
  {
    id: 'P178750', sector: 'education', country: 'Sénégal', photo: 'education', amount: 150000000, fin: 'IDA', instr: 'IPF', approved: '2023-06-29', closing: '2028-07-31',
    agency: 'Ministry of Higher Education', name: 'Senegal Higher Education Project — ESPOIR-JEUNES', title_fr: 'Enseignement supérieur au Sénégal — ESPOIR-JEUNES',
    t: {
      fr: ['Élargir un accès équitable à des formations supérieures professionnelles courtes, adaptées au marché du travail, et renforcer la gouvernance et la recherche.', 'Le projet diversifie l’offre d’enseignement technique et professionnel supérieur au Sénégal afin d’améliorer l’employabilité des jeunes.', 'Davantage de jeunes formés à des compétences recherchées par les employeurs.', 'Échelle nationale'],
      en: ['Increase equitable access to market-relevant short-term vocational tertiary education and strengthen governance and research in higher education.', 'The project diversifies tertiary technical and vocational education in Senegal to improve the employability of young people.', 'More young people trained in skills employers are looking for.', 'Nationwide'],
      es: ['Ampliar el acceso equitativo a formaciones superiores profesionales de corta duración, adaptadas al mercado laboral, y reforzar la gobernanza y la investigación.', 'El proyecto diversifica la oferta de educación técnica y profesional superior en Senegal para mejorar la empleabilidad de los jóvenes.', 'Más jóvenes formados en competencias demandadas por los empleadores.', 'Ámbito nacional'],
      de: ['Gerechten Zugang zu arbeitsmarktnahen, kurzen berufsbezogenen Hochschulangeboten ausweiten sowie Steuerung und Forschung im Hochschulwesen stärken.', 'Das Projekt erweitert das Angebot technischer und beruflicher Hochschulbildung im Senegal, um die Beschäftigungsfähigkeit junger Menschen zu verbessern.', 'Mehr junge Menschen mit von Arbeitgebern gefragten Kompetenzen.', 'Landesweit']
    }
  },
  {
    id: 'P174825', sector: 'import_export', country: 'Inde', photo: 'conteneurs', amount: 150000000, fin: 'BIRD', instr: 'PforR', approved: '2024-04-24', closing: '2028-06-30',
    agency: 'West Bengal Department of Industries, Commerce and Enterprises', name: 'West Bengal Boosting Logistics Efficiency and Trade Facilitation Program', title_fr: 'Efficacité logistique et facilitation du commerce au Bengale-Occidental',
    t: {
      fr: ['Accroître l’efficacité logistique et faciliter le commerce au Bengale-Occidental.', 'Le programme renforce les capacités institutionnelles de promotion du commerce et de la logistique et vise à réduire les coûts des échanges. Il soutient aussi des mesures d’efficacité énergétique dans l’entreposage et la chaîne du froid.', 'Des coûts commerciaux réduits et une logistique plus efficace dans l’État.', 'État du Bengale-Occidental'],
      en: ['Increase logistics efficiency and trade facilitation in West Bengal.', 'The program strengthens institutional capacity for promoting trade and logistics and aims to reduce trade costs. It also supports energy-efficiency measures in warehousing and cold storage.', 'Lower trade costs and more efficient logistics in the state.', 'State of West Bengal'],
      es: ['Aumentar la eficiencia logística y facilitar el comercio en Bengala Occidental.', 'El programa refuerza la capacidad institucional de promoción del comercio y la logística y busca reducir los costes comerciales. También apoya medidas de eficiencia energética en el almacenamiento y la cadena de frío.', 'Costes comerciales más bajos y una logística más eficiente en el estado.', 'Estado de Bengala Occidental'],
      de: ['Logistikeffizienz steigern und den Handel in Westbengalen erleichtern.', 'Das Programm stärkt die institutionellen Kapazitäten zur Förderung von Handel und Logistik und soll die Handelskosten senken. Es unterstützt auch Energieeffizienzmaßnahmen in Lagerhaltung und Kühlkette.', 'Niedrigere Handelskosten und effizientere Logistik im Bundesstaat.', 'Bundesstaat Westbengalen']
    }
  },
  {
    id: 'P179381', sector: 'business', country: 'Kenya', photo: 'reunion', amount: 150000000, fin: 'IDA', instr: 'IPF', approved: '2023-12-11', closing: '2028-12-31',
    agency: 'Ministry of Industrialization, Trade and Enterprise Development', name: 'Kenya Jobs and Economic Transformation (KJET) Project', title_fr: 'Emploi et transformation économique au Kenya (KJET)',
    t: {
      fr: ['Renforcer la compétitivité des micro, petites et moyennes entreprises kényanes par des investissements ciblés dans des filières à forte croissance et par des réformes du climat des affaires.', 'Le projet associe réformes de la réglementation et de la promotion des investissements, dont un guichet numérique unique, et appui direct aux entreprises.', 'Davantage d’investissements privés et des emplois plus nombreux et de meilleure qualité.', 'Échelle nationale'],
      en: ['Enhance the competitiveness of Kenya’s micro, small and medium enterprises through targeted investments in high-growth clusters and business climate reforms.', 'The project combines regulatory and investment-promotion reforms, including a one-stop digital platform, with direct support to firms.', 'More private investment and more and better jobs.', 'Nationwide'],
      es: ['Reforzar la competitividad de las micro, pequeñas y medianas empresas de Kenia mediante inversiones selectivas en sectores de alto crecimiento y reformas del clima de negocios.', 'El proyecto combina reformas de la regulación y de la promoción de inversiones, incluida una ventanilla digital única, con apoyo directo a las empresas.', 'Más inversión privada y más y mejores empleos.', 'Ámbito nacional'],
      de: ['Wettbewerbsfähigkeit der kenianischen Kleinst-, Klein- und Mittelunternehmen durch gezielte Investitionen in wachstumsstarke Cluster und Reformen des Geschäftsklimas stärken.', 'Das Projekt verbindet Reformen bei Regulierung und Investitionsförderung, darunter eine zentrale digitale Anlaufstelle, mit direkter Unternehmensförderung.', 'Mehr private Investitionen sowie mehr und bessere Arbeitsplätze.', 'Landesweit']
    }
  },
  {
    id: 'P176812', sector: 'maritime', country: 'Bangladesh', photo: 'port', amount: 650000000, fin: 'IDA', instr: 'IPF', approved: '2024-06-28', closing: '2031-06-30',
    agency: 'Ministry of Shipping', name: 'Bay Terminal Marine Infrastructure Development Project', title_fr: 'Infrastructures maritimes du Bay Terminal au Bangladesh',
    t: {
      fr: ['Permettre aux grands navires d’accéder au futur Bay Terminal du port de Chittagong.', 'Le projet finance les infrastructures maritimes nécessaires à l’accès des navires de grande taille au terminal prévu.', 'Un port capable d’accueillir des navires de plus grande capacité.', 'Port de Chittagong'],
      en: ['Enable large vessels to access the proposed Bay Terminal of Chittagong Port.', 'The project finances the marine infrastructure needed for large vessels to reach the planned terminal.', 'A port able to receive higher-capacity vessels.', 'Chittagong Port'],
      es: ['Permitir que los grandes buques accedan a la futura Bay Terminal del puerto de Chittagong.', 'El proyecto financia las infraestructuras marítimas necesarias para que los buques de gran tamaño accedan a la terminal prevista.', 'Un puerto capaz de recibir buques de mayor capacidad.', 'Puerto de Chittagong'],
      de: ['Großen Schiffen den Zugang zum geplanten Bay Terminal des Hafens Chittagong ermöglichen.', 'Das Projekt finanziert die maritime Infrastruktur, die große Schiffe für die Zufahrt zum geplanten Terminal benötigen.', 'Ein Hafen, der Schiffe mit größerer Kapazität aufnehmen kann.', 'Hafen Chittagong']
    }
  },
  {
    id: 'P181160', sector: 'development', country: 'Angola', photo: 'grues', amount: 300000000, fin: 'BIRD', instr: 'PforR', approved: '2024-06-20', closing: '2029-12-31',
    agency: '', name: 'Angola Secondary Cities Support Program', title_fr: 'Appui aux villes secondaires d’Angola',
    t: {
      fr: ['Renforcer les capacités de gestion de la croissance urbaine et de réalisation des infrastructures, et élargir l’accès à des solutions de logement abordable dans des villes sélectionnées.', 'Le programme appuie des villes secondaires d’Angola dans le financement et l’amélioration de leurs infrastructures urbaines, du logement et des services.', 'Des villes secondaires mieux équipées et un accès élargi au logement abordable.', 'Villes secondaires sélectionnées'],
      en: ['Strengthen capacity for urban growth management and infrastructure delivery, and increase access to affordable housing solutions in selected cities.', 'The program supports secondary cities in Angola in financing and improving their urban infrastructure, housing and services.', 'Better-equipped secondary cities and wider access to affordable housing.', 'Selected secondary cities'],
      es: ['Reforzar las capacidades de gestión del crecimiento urbano y de ejecución de infraestructuras, y ampliar el acceso a soluciones de vivienda asequible en ciudades seleccionadas.', 'El programa apoya a ciudades secundarias de Angola en la financiación y mejora de sus infraestructuras urbanas, la vivienda y los servicios.', 'Ciudades secundarias mejor equipadas y mayor acceso a vivienda asequible.', 'Ciudades secundarias seleccionadas'],
      de: ['Kapazitäten für die Steuerung des Stadtwachstums und die Bereitstellung von Infrastruktur stärken und den Zugang zu bezahlbarem Wohnraum in ausgewählten Städten erweitern.', 'Das Programm unterstützt Sekundärstädte in Angola bei der Finanzierung und Verbesserung ihrer städtischen Infrastruktur, des Wohnungswesens und der Dienstleistungen.', 'Besser ausgestattete Sekundärstädte und breiterer Zugang zu bezahlbarem Wohnraum.', 'Ausgewählte Sekundärstädte']
    }
  }
];

const LOCALE = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES', de: 'de-DE' };
const date = (iso, lang) => new Intl.DateTimeFormat(LOCALE[lang], { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
const FIN = {
  IDA: { fr: 'Financement de l’Association internationale de développement (IDA, Groupe de la Banque mondiale)', en: 'Financing from the International Development Association (IDA, World Bank Group)', es: 'Financiación de la Asociación Internacional de Fomento (AIF, Grupo Banco Mundial)', de: 'Finanzierung der Internationalen Entwicklungsorganisation (IDA, Weltbankgruppe)' },
  BIRD: { fr: 'Prêt de la Banque internationale pour la reconstruction et le développement (BIRD, Groupe de la Banque mondiale)', en: 'Loan from the International Bank for Reconstruction and Development (IBRD, World Bank Group)', es: 'Préstamo del Banco Internacional de Reconstrucción y Fomento (BIRF, Grupo Banco Mundial)', de: 'Darlehen der Internationalen Bank für Wiederaufbau und Entwicklung (IBRD, Weltbankgruppe)' }
};
const INSTR = {
  IPF: { fr: 'financement de projet d’investissement', en: 'Investment Project Financing', es: 'financiamiento para proyectos de inversión', de: 'Investitionsprojektfinanzierung' },
  PforR: { fr: 'programme pour les résultats', en: 'Program-for-Results Financing', es: 'programa por resultados', de: 'ergebnisorientierte Programmfinanzierung' }
};
const STAGE = {
  fr: (a, c) => `En cours d’exécution — approuvé le ${a}, clôture prévue le ${c}.`,
  en: (a, c) => `Under implementation — approved on ${a}, expected closing on ${c}.`,
  es: (a, c) => `En ejecución — aprobado el ${a}, cierre previsto el ${c}.`,
  de: (a, c) => `In Umsetzung — genehmigt am ${a}, geplanter Abschluss am ${c}.`
};
const months = (a, b) => { const x = new Date(a), y = new Date(b); return Math.max(1, (y.getUTCFullYear() - x.getUTCFullYear()) * 12 + y.getUTCMonth() - x.getUTCMonth()); };

function build(p) {
  const i18n = {};
  for (const [lang, [objective, description, potential, location]] of Object.entries(p.t)) {
    i18n[lang] = {
      title: lang === 'fr' ? p.title_fr : p.name,
      summary: objective, objective, description, potential, location,
      funding_type: `${FIN[p.fin][lang]} — ${INSTR[p.instr][lang]}.`,
      stage: STAGE[lang](date(p.approved, lang), date(p.closing, lang))
    };
  }
  return {
    slug: `wb-${p.id.toLowerCase()}`, sector: p.sector, country: p.country, photo_key: p.photo, i18n: JSON.stringify(i18n),
    target_cents: p.amount * 100, duration_months: months(p.approved, p.closing),
    promoter: p.agency || null, source_name: SOURCE_NAME, source_url: url(p.id), source_ref: p.id, verified_at: VERIFIED_AT,
    internal_note: `Intitulé officiel : ${p.name}. Engagement ${p.fin} relevé dans l'API officielle des projets de la Banque mondiale le ${VERIFIED_AT} (statut : Active). Approbation : ${p.approved} ; clôture prévue : ${p.closing}.`
  };
}

module.exports = { PROJECTS, build, VERIFIED_AT, SOURCE_NAME };
