'use strict';
/**
 * Version anglaise des contenus saisis en français dans l'administration (page « À propos », trois projets, mention du pied de page)
 * et des noms de sources des actualités. Utilisée une seule fois, lors du passage du site public en anglais :
 * une traduction n'est appliquée que si le texte français d'origine est toujours celui qui a été traduit.
 */

const REGULATORY = {
  fr: /nous connectons nos fonds et ressources financières/i,
  en: 'At GLOBACOR PARTNERS INC, we connect our funds and financial resources with the most promising economic opportunities worldwide.'
};

const ABOUT = {
  marker: 'Nous confions nos capitaux',
  body: `## Our mission
At GLOBACOR Partners INC, we connect our funds and financial resources with the most promising economic opportunities worldwide.

We entrust our capital to project sponsors rigorously selected for the strength of their business model, their demonstrated profitability and their grounding in the real economy.

## Our values
- **International deployment**: A global investment capacity to support sound projects, wherever they are based.
- **Strict selection and audit**: Every project undergoes an in-depth analysis of its business model, market and governance before any capital is allocated.
- **Structured financing**: The allocation of funds is tailored to the company’s actual needs and pace of development.
- **Aligned interests**: We favour lasting partnerships focused on value creation and shared performance.

## Company information
- **Company name**: GLOBACOR Partners Inc
- **Registration no.**: 24005225
- **Head office**: 30 Hazelton Ave., Toronto, ON M5R 2E5, Canada`
};

/** Projets : clé = slug ; `marker` = début du titre français attendu. */
const PROJECTS = {
  'exemple-centre-commercial': {
    marker: 'NORTHSTAR BUSINESS',
    en: {
      title: 'NORTHSTAR BUSINESS & SHOPPING CENTRE CANADA',
      summary: 'Development of a modern mixed-use complex combining a shopping centre and a professional building.',
      description: `## Project concept
The project consists of developing a modern real estate complex comprising:

## Shopping centre
- Supermarket, shops, fashion stores and electronics
- Restaurants, cafés and food outlets
- Pharmacy, beauty and wellness
- Banks and financial services
- Event space and family play area

## Professional building
- Offices and professional practices
- Coworking spaces, meeting rooms and training rooms
- Conference centre
- Medical practices and financial services
- Space for international companies

## Infrastructure
- Approximately 500 parking spaces, including accessible parking
- Electric vehicle charging points
- Delivery areas and loading dock
- 24/7 security, video surveillance and access control
- Green spaces and digital signage`,
      conditions: `The project may seek:

- **Institutional investors**: from $10 million
- **Family offices / private investors**: from CAD 5 million
- **Financial partners**: amount negotiable depending on the structure

Any actual investment offer must be structured in accordance with applicable Canadian securities rules and the relevant regulations.`,
      fees: `In 2026, the permit fee published by the City of Toronto is notably $20.77/m² for finished retail space and $24.46/m² for finished offices.

For a simplified assumption of 8,000 m² of retail space and 5,000 m² of professional space, the indicative calculation would be:

- 8,000 × $20.77 = $166,160
- 5,000 × $24.46 = $122,300

That is approximately **$288,460** for these components, before other applicable fees and subject to the exact classification of the project.`
    }
  },
  'exemple-centre-donnees': {
    marker: 'NORTHSTAR RESIDENCES',
    en: {
      title: 'NORTHSTAR RESIDENCES CANADA',
      summary: 'Premium multi-family residential development.',
      description: `## Project overview
- **Project name**: NORTHSTAR RESIDENCES CANADA
- **Location**: Toronto
- **Sector**: Residential real estate
- **Nature**: Construction of a modern multi-family residence
- **Estimated duration**: 30 months
- **Developer**: Real estate development company
- **Objective**: Build, market and operate a residential development intended for sale and/or rental.`,
      conditions: `The NORTHSTAR RESIDENCES CANADA project is seeking financial partners and investors wishing to take part in the development of a modern residential complex of approximately 100 units in Toronto.

Depending on the investor’s profile and the final agreements, participation may be structured as financing, an equity investment, a joint venture or a combination of several instruments.`,
      fees: `Project costs are broken down into several categories. They are set out transparently so that each partner can assess the overall cost of its participation.

## 1. Studies and due diligence
Feasibility study, land appraisal, geotechnical study, environmental study, market study, legal checks, accounting and financial review. Projected budget: CAD 250,000 to 500,000.

## 2. Land acquisition
Purchase price, legal fees, title search, survey, appraisal, inspection and applicable transfer taxes. Indicative budget: included in the CAD 8,000,000 acquisition budget, excluding adjustments and applicable taxes.

## 3. Architecture and engineering
Architect, civil, structural, mechanical and electrical engineers, specialist consultants, plans and technical studies. Projected budget: CAD 2,000,000.

## 4. Permits and municipal fees
Building permit, planning applications, Site Plan Control, rezoning if required, inspection fees and fees for applications and approvals. The exact amount will depend on the project and the approvals required. Budget provision: CAD 3,000,000.

## 5. Development charges
Development charges are separate from permit fees and can represent a significant share of a real estate development budget. Current provision: CAD 4,000,000. The final amount must be calculated on the basis of the land and the number and type of units.

## 6. Construction
The projected construction budget is currently CAD 30,000,000. It covers site preparation, foundations, structure, roofing, façades, plumbing, electricity, heating and ventilation, lifts, finishes, common areas and the necessary fit-out.

## 7. Financing
Interest, arrangement fees, appraisal fees, lender’s legal fees, administration fees and security-related costs. Projected provision: CAD 2,500,000. The actual cost will depend on the type of financing and the terms negotiated.

## 8. Legal and professional fees
Real estate lawyer, corporate lawyer, accountant, tax adviser, financial consultant, notary or equivalent professional where required, and contract review. Projected budget: CAD 1,000,000.

## 9. Insurance
The project must carry appropriate insurance: construction, civil liability, site, professional indemnity where necessary, and insurance of the property after delivery. The cost will depend on the cover and the value of the project.

## 10. Marketing and sales
Project identity, website, brochures, architectural renderings, advertising, real estate agents and marketing of the units. Projected budget: CAD 750,000.

## 11. Project management
Construction management, coordination of contractors, administration, financial monitoring, cost control and schedule management. Fees will be set by the contract concluded with the project manager.

## 12. Contingency
A reserve is provided for rising material prices, technical changes, delays, unforeseen works and regulatory changes. Current reserve: CAD 3,000,000.

## Summary of main costs
- Land: CAD 8,000,000
- Architecture and engineering: CAD 2,000,000
- Construction: CAD 30,000,000
- Infrastructure: CAD 2,500,000
- Parking: CAD 2,000,000
- Permits and approvals: CAD 3,000,000
- Development charges: CAD 4,000,000
- Legal and professional: CAD 1,000,000
- Marketing: CAD 750,000
- Financing: CAD 2,500,000
- Contingency: CAD 3,000,000
- **Projected total: CAD 58,750,000**

## Financial transparency
All final costs must be confirmed by the competent authorities, the appointed professionals, suppliers and financial partners before any commitment.

No additional fee should be requested from an investor or partner unless it is clearly identified, justified and provided for in the contractual documentation applicable to the project.`
    }
  },
  'exemple-amenagement-urbain': {
    marker: 'LAGOS HORIZON',
    en: {
      title: 'LAGOS HORIZON DEVELOPMENT',
      summary: 'Residential, commercial and professional real estate complex. Indicative location: Lagos State, Nigeria. Planned site: approximately 3 hectares. Indicative built area: 22,000 m². Construction period: 30 to 36 months. Projected budget: ₦18.5 billion. Financing sought: ₦15 billion.',
      description: `## Project concept
LAGOS HORIZON DEVELOPMENT would be a modern real estate complex designed to create a new hub for living, retail and business.

The project would comprise:

## Residence
- 120 apartments: studios, one-, two- and three-bedroom apartments and premium apartments
- Swimming pool, gym and children’s area
- Gardens and community spaces
- 24/7 security and secure parking

## Shopping centre
Approximately 6,000 m² dedicated to retail:

- Supermarket, mini-market and specialist stores
- Restaurants, cafés and food courts
- Pharmacies, fashion boutiques and electronics
- Banks, beauty salons and professional services

## Business centre
Approximately 4,000 m²:

- Offices and coworking
- Meeting rooms and conference centre
- Professional practices
- Space for SMEs and offices for international companies

## Technical features
The complex would be designed with:

- Contemporary architecture, glazed façades and materials suited to the tropical climate
- Air conditioning and ventilation
- Backup power supply, generator and complementary solar system
- Water tanks, water treatment and drainage
- Fire protection system and smoke detectors
- Video surveillance, access control and lifts
- Parking, exterior lighting, green spaces and waste management`,
      conditions: `The project may seek:

- **Lead investor**: ₦5–15 billion
- **Strategic partner**: ₦1–5 billion
- **Joint venture**: amount negotiable

Before any investment, the investor must be able to review: land title, company documents, plans, permits, market study, budget, financial projections, construction quotes, environmental study, contracts, guarantees and legal structure.`,
      fees: `## Projected budget by category
- Land: ₦2.5 billion
- Studies: ₦350 million
- Architecture and engineering: ₦700 million
- Construction: ₦9.3 billion
- Infrastructure: ₦1.55 billion
- Permits and planning: ₦350 million
- Legal and professional: ₦300 million
- Financing: ₦700 million
- Marketing: ₦250 million
- Contingency: ₦2.05 billion
- Taxes and other charges: to be determined according to the structure
- **Project total: approximately ₦18.5 billion**`
    }
  }
};

/** Noms de sources des actualités : français → anglais. */
const NEWS_SOURCES = [
  ['FAO — Indice FAO des prix des produits alimentaires', 'FAO — FAO Food Price Index'],
  ['Banque asiatique de développement — Asian Development Outlook, septembre 2026', 'Asian Development Bank — Asian Development Outlook, September 2026'],
  ['Banque centrale européenne — Décisions de politique monétaire', 'European Central Bank — Monetary policy decisions'],
  ['OMC — Baromètre du commerce des marchandises', 'WTO — Goods Trade Barometer'],
  ['CNUCED — Rapport sur l’investissement dans le monde 2026', 'UNCTAD — World Investment Report 2026'],
  ['FMI — Mise à jour des Perspectives de l’économie mondiale, juillet 2026', 'IMF — World Economic Outlook Update, July 2026'],
  ['Agence internationale de l’énergie — World Energy Investment 2026', 'International Energy Agency — World Energy Investment 2026'],
  ['Banque africaine de développement — Perspectives économiques en Afrique 2026', 'African Development Bank — African Economic Outlook 2026'],
  ['Banque mondiale — Africa Economic Update, avril 2026', 'World Bank — Africa Economic Update, April 2026'],
  ['OMC — Perspectives et statistiques du commerce mondial, mars 2026', 'WTO — Global Trade Outlook and Statistics, March 2026']
];

const WB_SOURCE = ['Banque mondiale — Projets et opérations (données ouvertes, CC BY 4.0)', 'World Bank — Projects & Operations (open data, CC BY 4.0)'];

module.exports = { REGULATORY, ABOUT, PROJECTS, NEWS_SOURCES, WB_SOURCE };
