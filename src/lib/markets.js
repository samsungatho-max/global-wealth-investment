'use strict';
/**
 * Données de marché issues de sources officielles et ouvertes, toujours affichées avec leur date et leur source :
 *  - Banque centrale européenne (ECB Data Portal) : indices boursiers en moyenne mensuelle, courbe des taux, rendements à 10 ans ;
 *  - taux de change de référence de la BCE (service Frankfurter) ;
 *  - Banque mondiale (Indicateurs du développement dans le monde, CC BY 4.0) : croissance, inflation, chômage.
 * Aucune valeur n'est inventée : si une source ne répond pas, la dernière valeur connue est conservée avec sa date
 * pendant une durée limitée, puis la série est indiquée comme indisponible.
 * Les catégories sans source ouverte fiable (actions, matières premières, métaux précieux, énergie) n'affichent pas de cours.
 */
const { one, run } = require('../db');

const ECB = 'https://data-api.ecb.europa.eu/service/data/';
const SRC = {
  ecb: { name: 'European Central Bank — ECB Data Portal', url: 'https://data.ecb.europa.eu' },
  ecbfx: { name: 'European Central Bank — euro foreign exchange reference rates', url: 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html' },
  wb: { name: 'World Bank — World Development Indicators (CC BY 4.0)', url: 'https://data.worldbank.org' }
};

/** Séries suivies. freq : D (quotidien), M (mensuel), A (annuel). digits : décimales affichées. */
const SERIES = {
  sp500: { cat: 'indices', src: 'ecb', key: 'FM/M.US.USD.DS.EI.S_PCOMP.HSTA', freq: 'M', unit: 'pts', digits: 0, name: { en: 'S&P 500 (monthly average)', fr: 'S&P 500 (moyenne mensuelle)' } },
  stoxx50: { cat: 'indices', src: 'ecb', key: 'FM/M.U2.EUR.DS.EI.DJES50I.HSTA', freq: 'M', unit: 'pts', digits: 0, name: { en: 'EURO STOXX 50 (monthly average)', fr: 'EURO STOXX 50 (moyenne mensuelle)' } },
  stoxx: { cat: 'indices', src: 'ecb', key: 'FM/M.U2.EUR.DS.EI.DJEURST.HSTA', freq: 'M', unit: 'pts', digits: 0, name: { en: 'EURO STOXX broad index (monthly average)', fr: 'EURO STOXX large (moyenne mensuelle)' } },
  nikkei: { cat: 'indices', src: 'ecb', key: 'FM/M.JP.JPY.DS.EI.JAPDOWA.HSTA', freq: 'M', unit: 'pts', digits: 0, name: { en: 'Nikkei 225 (monthly average)', fr: 'Nikkei 225 (moyenne mensuelle)' } },
  eu2y: { cat: 'bonds', src: 'ecb', key: 'YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_2Y', freq: 'D', unit: '%', digits: 2, name: { en: 'Euro area AAA government bonds — 2-year yield', fr: 'Zone euro, emprunts d’État AAA — rendement à 2 ans' } },
  eu5y: { cat: 'bonds', src: 'ecb', key: 'YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_5Y', freq: 'D', unit: '%', digits: 2, name: { en: 'Euro area AAA government bonds — 5-year yield', fr: 'Zone euro, emprunts d’État AAA — rendement à 5 ans' } },
  eu10y: { cat: 'bonds', src: 'ecb', key: 'YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y', freq: 'D', unit: '%', digits: 2, name: { en: 'Euro area AAA government bonds — 10-year yield', fr: 'Zone euro, emprunts d’État AAA — rendement à 10 ans' } },
  us10y: { cat: 'bonds', src: 'ecb', key: 'FM/M.US.USD.4F.BB.US10YT_RR.YLDA', freq: 'M', unit: '%', digits: 2, name: { en: 'United States — 10-year government bond yield (monthly average)', fr: 'États-Unis — rendement des emprunts d’État à 10 ans (moyenne mensuelle)' } },
  eurusd: { cat: 'currencies', src: 'ecbfx', fx: 'EUR', freq: 'D', unit: 'EUR', digits: 4, name: { en: 'US dollar / euro (USD → EUR)', fr: 'Dollar américain / euro (USD → EUR)' } },
  gbpusd: { cat: 'currencies', src: 'ecbfx', fx: 'GBP', freq: 'D', unit: 'GBP', digits: 4, name: { en: 'US dollar / pound sterling (USD → GBP)', fr: 'Dollar américain / livre sterling (USD → GBP)' } },
  jpyusd: { cat: 'currencies', src: 'ecbfx', fx: 'JPY', freq: 'D', unit: 'JPY', digits: 2, name: { en: 'US dollar / Japanese yen (USD → JPY)', fr: 'Dollar américain / yen japonais (USD → JPY)' } },
  chfusd: { cat: 'currencies', src: 'ecbfx', fx: 'CHF', freq: 'D', unit: 'CHF', digits: 4, name: { en: 'US dollar / Swiss franc (USD → CHF)', fr: 'Dollar américain / franc suisse (USD → CHF)' } },
  cadusd: { cat: 'currencies', src: 'ecbfx', fx: 'CAD', freq: 'D', unit: 'CAD', digits: 4, name: { en: 'US dollar / Canadian dollar (USD → CAD)', fr: 'Dollar américain / dollar canadien (USD → CAD)' } },
  cnyusd: { cat: 'currencies', src: 'ecbfx', fx: 'CNY', freq: 'D', unit: 'CNY', digits: 4, name: { en: 'US dollar / Chinese yuan (USD → CNY)', fr: 'Dollar américain / yuan chinois (USD → CNY)' } },
  gdp_wld: { cat: 'indicators', src: 'wb', wb: ['WLD', 'NY.GDP.MKTP.KD.ZG'], freq: 'A', unit: '%', digits: 1, name: { en: 'World — real GDP growth', fr: 'Monde — croissance du PIB réel' } },
  gdp_usa: { cat: 'indicators', src: 'wb', wb: ['USA', 'NY.GDP.MKTP.KD.ZG'], freq: 'A', unit: '%', digits: 1, name: { en: 'United States — real GDP growth', fr: 'États-Unis — croissance du PIB réel' } },
  gdp_emu: { cat: 'indicators', src: 'wb', wb: ['EMU', 'NY.GDP.MKTP.KD.ZG'], freq: 'A', unit: '%', digits: 1, name: { en: 'Euro area — real GDP growth', fr: 'Zone euro — croissance du PIB réel' } },
  gdp_chn: { cat: 'indicators', src: 'wb', wb: ['CHN', 'NY.GDP.MKTP.KD.ZG'], freq: 'A', unit: '%', digits: 1, name: { en: 'China — real GDP growth', fr: 'Chine — croissance du PIB réel' } },
  gdp_ssf: { cat: 'indicators', src: 'wb', wb: ['SSF', 'NY.GDP.MKTP.KD.ZG'], freq: 'A', unit: '%', digits: 1, name: { en: 'Sub-Saharan Africa — real GDP growth', fr: 'Afrique subsaharienne — croissance du PIB réel' } },
  cpi_wld: { cat: 'indicators', src: 'wb', wb: ['WLD', 'FP.CPI.TOTL.ZG'], freq: 'A', unit: '%', digits: 1, name: { en: 'World — consumer price inflation', fr: 'Monde — inflation des prix à la consommation' } },
  cpi_usa: { cat: 'indicators', src: 'wb', wb: ['USA', 'FP.CPI.TOTL.ZG'], freq: 'A', unit: '%', digits: 1, name: { en: 'United States — consumer price inflation', fr: 'États-Unis — inflation des prix à la consommation' } },
  une_wld: { cat: 'indicators', src: 'wb', wb: ['WLD', 'SL.UEM.TOTL.ZS'], freq: 'A', unit: '%', digits: 1, name: { en: 'World — unemployment rate', fr: 'Monde — taux de chômage' } }
};

const CATEGORIES = ['indices', 'equities', 'bonds', 'currencies', 'commodities', 'metals', 'energy', 'indicators'];
const CATEGORY_ICON = { indices: 'chart', equities: 'growth', bonds: 'file', currencies: 'swap', commodities: 'leaf', metals: 'mine', energy: 'sun', indicators: 'globe' };
/** Durée de validité du cache et âge maximal toléré d'une dernière observation, par fréquence (en heures / jours). */
const TTL_H = { D: 6, M: 24, A: 72 };
const MAX_AGE_D = { D: 10, M: 75, A: 800 };
const HOME = ['sp500', 'stoxx50', 'eurusd', 'eu10y', 'us10y'];

const get = (url, ms = 7000) => fetch(url, { signal: AbortSignal.timeout(ms), headers: { accept: 'application/json, text/csv;q=0.9' } });

async function fetchEcb(key, n) {
  const res = await get(`${ECB}${key}?lastNObservations=${n}&format=csvdata`);
  if (!res.ok) throw new Error('ECB ' + res.status);
  const lines = (await res.text()).trim().split(/\r?\n/);
  const head = lines.shift().split(',');
  const ti = head.indexOf('TIME_PERIOD'), vi = head.indexOf('OBS_VALUE');
  const pts = lines.map((l) => { const c = l.split(','); return [c[ti], Number(c[vi])]; }).filter((p) => p[0] && Number.isFinite(p[1]));
  if (!pts.length) throw new Error('ECB : aucune observation');
  return pts;
}

async function fetchFx() {
  const start = new Date(Date.now() - 200 * 86400000).toISOString().slice(0, 10);
  const symbols = [...new Set(Object.values(SERIES).filter((s) => s.fx).map((s) => s.fx))];
  const res = await get(`https://api.frankfurter.app/${start}..?from=USD&to=${symbols.join(',')}`);
  if (!res.ok) throw new Error('FX ' + res.status);
  const j = await res.json();
  const out = {};
  for (const [d, r] of Object.entries(j.rates || {}).sort()) for (const s of symbols) if (Number.isFinite(r[s])) (out[s] = out[s] || []).push([d, r[s]]);
  if (!Object.keys(out).length) throw new Error('FX : aucune observation');
  return out;
}

async function fetchWb([country, indicator]) {
  const res = await get(`https://api.worldbank.org/v2/country/${country}/indicator/${indicator}?format=json&mrv=12`);
  if (!res.ok) throw new Error('WB ' + res.status);
  const j = await res.json();
  const pts = ((j && j[1]) || []).filter((x) => x.value != null).map((x) => [String(x.date), Number(x.value)]).sort((a, b) => a[0].localeCompare(b[0]));
  if (!pts.length) throw new Error('WB : aucune observation');
  return pts;
}

const readCache = async (id) => { const r = await one('SELECT payload, fetched_at FROM market_cache WHERE id = ?', id); if (!r) return null; try { return { pts: JSON.parse(r.payload), fetchedAt: r.fetched_at }; } catch { return null; } };
const writeCache = (id, pts) => run(`INSERT INTO market_cache (id, payload, fetched_at) VALUES (?, ?, datetime('now')) ON CONFLICT (id) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`, id, JSON.stringify(pts));
const hoursSince = (ts) => (Date.now() - new Date(String(ts).replace(' ', 'T') + 'Z').getTime()) / 3600000;
const obsDate = (p, freq) => new Date(freq === 'A' ? `${p}-12-31T00:00:00Z` : freq === 'M' ? `${p}-28T00:00:00Z` : `${p}T00:00:00Z`);

/** Met à jour depuis les sources les séries dont le cache est périmé (ou toutes si force). */
async function refresh(ids, { force = false } = {}) {
  if (process.env.MARKETS_OFFLINE === 'true') return 0; // tests : aucune requête vers l'extérieur
  const todo = [];
  for (const id of ids) { const c = await readCache(id); if (force || !c || hoursSince(c.fetchedAt) > TTL_H[SERIES[id].freq]) todo.push(id); }
  if (!todo.length) return 0;
  let fx = null;
  if (todo.some((id) => SERIES[id].fx)) fx = await fetchFx().catch((e) => { console.warn('[marchés] taux de change :', e.message); return null; });
  const done = await Promise.all(todo.map(async (id) => {
    const s = SERIES[id];
    try {
      const pts = s.fx ? (fx && fx[s.fx]) : s.wb ? await fetchWb(s.wb) : await fetchEcb(s.key, s.freq === 'D' ? 260 : 60);
      if (!pts || !pts.length) return 0;
      await writeCache(id, pts);
      return 1;
    } catch (e) { console.warn(`[marchés] ${id} :`, e.message); return 0; }
  }));
  return done.reduce((a, b) => a + b, 0);
}

/** Série prête à afficher, ou { available: false } si aucune donnée suffisamment récente n'est disponible. */
async function load(id, lang) {
  const s = SERIES[id];
  const base = { id, cat: s.cat, name: s.name[lang] || s.name.en, unit: s.unit, digits: s.digits, freq: s.freq, source: SRC[s.src] };
  const c = await readCache(id);
  if (!c || !c.pts.length) return { ...base, available: false };
  const last = c.pts[c.pts.length - 1], prev = c.pts.length > 1 ? c.pts[c.pts.length - 2] : null;
  if ((Date.now() - obsDate(last[0], s.freq).getTime()) / 86400000 > MAX_AGE_D[s.freq]) return { ...base, available: false };
  const first = c.pts[0];
  return {
    ...base, available: true, points: c.pts, value: last[1], date: last[0], fetchedAt: c.fetchedAt,
    change: prev ? last[1] - prev[1] : null,
    changePct: prev && prev[1] && s.unit !== '%' ? (last[1] - prev[1]) / Math.abs(prev[1]) : null,
    periodPct: first && first[1] && s.unit !== '%' ? (last[1] - first[1]) / Math.abs(first[1]) : null,
    periodFrom: first[0]
  };
}

async function category(cat, lang) {
  const ids = Object.keys(SERIES).filter((id) => SERIES[id].cat === cat);
  const cached = (await Promise.all(ids.map((id) => readCache(id)))).some(Boolean);
  await Promise.race([refresh(ids), new Promise((r) => setTimeout(r, cached ? 2500 : 9000))]).catch(() => {});
  return Promise.all(ids.map((id) => load(id, lang)));
}

async function home(lang) {
  await Promise.race([refresh(HOME), new Promise((r) => setTimeout(r, 2500))]).catch(() => {});
  return (await Promise.all(HOME.map((id) => load(id, lang)))).filter((s) => s.available);
}

const refreshAll = () => refresh(Object.keys(SERIES), { force: true });

/** Tracé SVG (chemin) d'une série, pour un graphique de largeur w et de hauteur h. */
function sparkPath(points, w, h, pad = 4) {
  const vals = points.map((p) => p[1]);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const x = (i) => pad + (i * (w - 2 * pad)) / Math.max(1, points.length - 1);
  const y = (v) => h - pad - ((v - min) * (h - 2 * pad)) / span;
  return { d: points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p[1]).toFixed(1)}`).join(''), min, max, x, y };
}

module.exports = { SERIES, CATEGORIES, CATEGORY_ICON, SRC, category, home, load, refresh, refreshAll, sparkPath };
