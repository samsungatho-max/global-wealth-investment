'use strict';
/**
 * Actualités et rapports.
 *  - Chaque publication cite ses sources (nom | URL | date) ; elle ne peut pas être publiée sans source.
 *  - Chiffres clés et graphiques sont saisis ligne par ligne (« libellé | valeur | période »).
 *  - Veille : les flux RSS de sources officielles alimentent une file de SUGGESTIONS. Rien n'est publié
 *    automatiquement : un administrateur vérifie la source, rédige une synthèse originale, puis publie.
 */
const { one, all, run } = require('../db');
const { parseI18n } = require('./content');

const REGIONS = ['world', 'africa', 'europe', 'asia', 'americas', 'middle_east'];
const SECTORS = ['macro', 'investment', 'real_estate', 'agriculture', 'energy', 'trade', 'industry'];
const INV_TYPES = ['markets', 'fdi', 'infrastructure', 'commodities', 'monetary'];
const SECTOR_PHOTOS = { macro: 'graphiques', investment: 'skyline', real_estate: 'immeuble', agriculture: 'champs', energy: 'eolien', trade: 'cargo', industry: 'usine' };

/** Visible publiquement : publié ET (pas de date planifiée OU date atteinte). */
const VISIBLE = `published = 1 AND (publish_at IS NULL OR publish_at <= datetime('now'))`;
const ORDER = `COALESCE(publish_at, published_at, created_at) DESC, id DESC`;

const lines = (text) => String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

/** « libellé | valeur | période » → [{ label, value, period }] */
function parseFigures(text) {
  return lines(text).map((l) => { const [label, value, period] = l.split('|').map((s) => s.trim()); return { label, value: value || '', period: period || '' }; })
    .filter((f) => f.label && f.value);
}

/** « libellé | nombre » → [{ label, value:Number }] (les lignes non numériques sont ignorées) */
function parseChart(text) {
  return lines(text).map((l) => { const [label, raw] = l.split('|').map((s) => s.trim()); const value = Number(String(raw || '').replace(/\s/g, '').replace(',', '.')); return { label, value }; })
    .filter((c) => c.label && Number.isFinite(c.value));
}

/** « nom | URL | date » → [{ name, url, date }] ; seules les URL http(s) sont conservées. */
function parseSources(text) {
  return lines(text).map((l) => { const [name, url, date] = l.split('|').map((s) => s.trim()); return { name, url, date: date || '' }; })
    .filter((s) => s.name && /^https?:\/\/[^\s"'<>]+$/i.test(s.url || ''));
}

function decorate(n, lang) {
  const tr = parseI18n(n.i18n, lang);
  return {
    ...n,
    tr,
    date: n.publish_at || n.published_at || n.created_at,
    sourceList: parseSources(n.sources),
    figures: parseFigures(tr.figures),
    chart: parseChart(tr.chart),
    takeaways: lines(tr.takeaways),
    photo: n.photo_key || SECTOR_PHOTOS[n.sector] || 'graphiques'
  };
}

// ---------------------------------------------------------------------------
// Veille RSS / Atom
// ---------------------------------------------------------------------------
const DEFAULT_SOURCES = [
  ['OMC — Organisation mondiale du commerce', 'https://www.wto.org/library/rss/latest_news_f.xml', 'https://www.wto.org'],
  ['BCE — Banque centrale européenne (communiqués)', 'https://www.ecb.europa.eu/rss/press.html', 'https://www.ecb.europa.eu'],
  ['ONU Info — Développement économique', 'https://news.un.org/feed/subscribe/fr/news/topic/economic-development/feed/rss.xml', 'https://news.un.org/fr'],
  ['BAD — Banque africaine de développement', 'https://www.afdb.org/en/rss.xml', 'https://www.afdb.org'],
  ['FAO — Organisation pour l’alimentation et l’agriculture', 'https://www.fao.org/feeds/fao-newsroom-rss', 'https://www.fao.org/newsroom'],
  ['BRI — Banque des règlements internationaux', 'https://www.bis.org/doclist/all_pressrels.rss', 'https://www.bis.org']
];

async function seedSources() {
  if (await one('SELECT id FROM news_sources LIMIT 1')) return;
  for (const [name, feed, site] of DEFAULT_SOURCES) {
    await run('INSERT INTO news_sources (name, feed_url, site_url) VALUES (?, ?, ?) ON CONFLICT (feed_url) DO NOTHING', name, feed, site);
  }
}

const decode = (s) => String(s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(Number(d))).replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&amp;/g, '&').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i')); return m ? m[1] : ''; };

/** Analyse minimale RSS 2.0 / RDF / Atom → [{ title, url, summary, date }] */
function parseFeed(xml) {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) || [];
  return blocks.map((b) => {
    let url = decode(tag(b, 'link'));
    if (!url) { const m = b.match(/<link[^>]*href="([^"]+)"/i); url = m ? m[1] : ''; }
    const rawDate = decode(tag(b, 'pubDate') || tag(b, 'dc:date') || tag(b, 'updated') || tag(b, 'published'));
    const d = rawDate ? new Date(rawDate) : null;
    return {
      title: decode(tag(b, 'title')).slice(0, 300),
      url: url.trim(),
      summary: decode(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content')).slice(0, 600),
      date: d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 19).replace('T', ' ') : null
    };
  }).filter((i) => i.title && /^https?:\/\//i.test(i.url));
}

/** Interroge les sources actives ; ajoute les nouvelles publications à la file des suggestions. */
async function runWatch({ maxAgeDays = 45 } = {}) {
  const sources = await all('SELECT * FROM news_sources WHERE active = 1 ORDER BY id');
  const report = [];
  const minDate = new Date(Date.now() - maxAgeDays * 86400000).toISOString().slice(0, 19).replace('T', ' ');
  for (const s of sources) {
    let added = 0, status = 'ok';
    try {
      const res = await fetch(s.feed_url, { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GWI-NewsWatch/1.0)', Accept: 'application/rss+xml, application/atom+xml, text/xml, */*' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const items = parseFeed(await res.text()).slice(0, 25);
      if (!items.length) status = 'aucune entrée lisible';
      for (const it of items) {
        if (it.date && it.date < minDate) continue;
        const r = await run(`INSERT INTO news_suggestions (source_id, source_name, title, url, summary, published_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (url) DO NOTHING`,
          s.id, s.name, it.title, it.url, it.summary, it.date);
        if (r.changes) added++;
      }
      if (items.length) status = `ok — ${items.length} entrées lues, ${added} nouvelle(s)`;
    } catch (err) {
      status = 'erreur : ' + String(err.message || err).slice(0, 200);
    }
    await run(`UPDATE news_sources SET last_checked_at = datetime('now'), last_status = ? WHERE id = ?`, status, s.id);
    report.push({ source: s.name, status, added });
  }
  await run(`INSERT INTO meta (key, value) VALUES ('news_watch_last', datetime('now')) ON CONFLICT (key) DO UPDATE SET value = excluded.value`);
  // Les suggestions écartées ou anciennes ne s'accumulent pas indéfiniment
  await run(`DELETE FROM news_suggestions WHERE status <> 'used' AND created_at < datetime('now', '-120 days')`);
  return report;
}

/** Veille planifiée : au plus une exécution toutes les `minHours` heures (appel public sans secret). */
async function runWatchThrottled(minHours = 6) {
  const last = await one(`SELECT value FROM meta WHERE key = 'news_watch_last'`);
  const fresh = last && (await one(`SELECT ? > datetime('now', ?) AS recent`, last.value, `-${minHours} hours`)).recent;
  if (fresh) return { skipped: true, last: last.value };
  return { skipped: false, report: await runWatch() };
}

module.exports = { REGIONS, SECTORS, INV_TYPES, SECTOR_PHOTOS, VISIBLE, ORDER, parseFigures, parseChart, parseSources, decorate, lines, seedSources, parseFeed, runWatch, runWatchThrottled, DEFAULT_SOURCES };
