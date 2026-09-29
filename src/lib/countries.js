'use strict';
/** Liste des pays (ISO 3166-1 alpha-2), noms localisés via Intl.DisplayNames. */
const CODES = ('AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HK HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG MK NO OM PK PW PS PA PG PY PE PH PL PT QA RE RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA KR SS ES LK SD SR SE CH SY TW TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VA VE VN YE ZM ZW').split(' ');

const cache = {};
function countries(lang) {
  if (cache[lang]) return cache[lang];
  const dn = new Intl.DisplayNames([lang], { type: 'region' });
  cache[lang] = CODES.map((code) => ({ code, name: dn.of(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, lang));
  return cache[lang];
}

function countryName(code, lang) {
  try { return new Intl.DisplayNames([lang], { type: 'region' }).of(code); } catch { return code; }
}

module.exports = { countries, countryName, CODES };
