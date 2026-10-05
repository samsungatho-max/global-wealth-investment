'use strict';
/**
 * Génère l'identité visuelle GLOBACOR Partners INC dans public/img/brand/ :
 *  - logos vectoriels (SVG) : symbole seul, versions horizontales pour fond clair et fond sombre ;
 *  - icônes PNG (180, 192, 512) et image de partage 1200×630, dessinées sans dépendance externe.
 * Symbole : un « G » or ouvert vers le haut, dont la barre forme l'équateur d'un globe (méridien blanc).
 * Usage : node scripts/make-brand.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'public', 'img', 'brand');
fs.mkdirSync(OUT, { recursive: true });

const NAVY = '#0a1628';
const GOLD = '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6d3ad"/><stop offset=".55" stop-color="#c9a96e"/><stop offset="1" stop-color="#b08e52"/></linearGradient>';

// Géométrie du symbole (repère 48×48)
const R = 16, W = 4.4, OPEN = -44;                       // rayon et épaisseur du G, angle d'ouverture (degrés)
const rad = (a) => a * Math.PI / 180;
const END = [24 + R * Math.cos(rad(OPEN)), 24 + R * Math.sin(rad(OPEN))];
const BAR_X = 24;                                        // extrémité intérieure de la barre du G
const MER = { rx: 6.6, ry: 14.4, w: 1.5 };                // méridien du globe

/** Symbole (48×48). `light` = méridien blanc (fond sombre) ; sinon bleu nuit (fond clair). */
const mark = (light, tx = 0, ty = 0, s = 1) => `<g transform="translate(${tx} ${ty}) scale(${s})" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <ellipse cx="24" cy="24" rx="${MER.rx}" ry="${MER.ry}" stroke="${light ? '#ffffff' : NAVY}" stroke-width="${MER.w}"/>
    <path d="M${END[0].toFixed(2)} ${END[1].toFixed(2)}A${R} ${R} 0 1 0 ${24 + R} 24H${BAR_X}" stroke="url(#g)" stroke-width="${W}"/>
  </g>`;

const FONT = "font-family=\"Montserrat, 'Segoe UI', Arial, Helvetica, sans-serif\"";
const wordmark = (light, x, y) => `
  <text x="${x}" y="${y}" ${FONT} font-size="25" font-weight="700" letter-spacing="3" fill="${light ? '#ffffff' : NAVY}">GLOBACOR</text>
  <text x="${x + 1}" y="${y + 17}" ${FONT} font-size="8.6" font-weight="600" letter-spacing="5.3" fill="${light ? '#d7bd8a' : '#b08e52'}">PARTNERS INC</text>`;

const svg = (w, h, body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="GLOBACOR Partners INC"><defs>${GOLD}</defs>${bg || ''}${body}</svg>\n`;

// Symbole seul : icône (fond bleu nuit arrondi), et versions transparentes
fs.writeFileSync(path.join(OUT, 'globacor-symbole.svg'), svg(48, 48, mark(true, 3.6, 3.6, 0.85), `<rect width="48" height="48" rx="10.5" fill="${NAVY}"/>`));
fs.writeFileSync(path.join(OUT, 'globacor-symbole-fond-sombre.svg'), svg(48, 48, mark(true)));
fs.writeFileSync(path.join(OUT, 'globacor-symbole-fond-clair.svg'), svg(48, 48, mark(false)));
// Logo horizontal
fs.writeFileSync(path.join(OUT, 'globacor-logo-fond-clair.svg'), svg(262, 60, mark(false, 6, 6, 1) + wordmark(false, 62, 30)));
fs.writeFileSync(path.join(OUT, 'globacor-logo-fond-sombre.svg'), svg(262, 60, mark(true, 6, 6, 1) + wordmark(true, 62, 30), `<rect width="262" height="60" fill="${NAVY}"/>`));
fs.writeFileSync(path.join(OUT, 'globacor-logo-transparent-blanc.svg'), svg(262, 60, mark(true, 6, 6, 1) + wordmark(true, 62, 30)));
// Favicon
fs.copyFileSync(path.join(OUT, 'globacor-symbole.svg'), path.join(__dirname, '..', 'public', 'img', 'favicon.svg'));

// ---------------------------------------------------------------------------
// Rendu PNG du symbole (sans dépendance) : distance aux tracés + suréchantillonnage 4×4
// ---------------------------------------------------------------------------
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const G0 = hex('#e6d3ad'), G1 = hex('#c9a96e'), G2 = hex('#b08e52'), WHITE = [255, 255, 255], N0 = hex('#0f2140'), N1 = hex('#050d1c');
const gold = (t) => (t < 0.55 ? mix(G0, G1, t / 0.55) : mix(G1, G2, (t - 0.55) / 0.45));

const gPath = [];
for (let a = 360 + OPEN; a >= 0; a -= 2) gPath.push([24 + R * Math.cos(rad(a)), 24 + R * Math.sin(rad(a))]);
gPath.push([BAR_X, 24]);
const merPath = [];
for (let a = 0; a <= 360; a += 4) merPath.push([24 + MER.rx * Math.cos(rad(a)), 24 + MER.ry * Math.sin(rad(a))]);

function dist(pts, x, y) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    const d = Math.hypot(x - ax - t * dx, y - ay - t * dy);
    if (d < best) best = d;
  }
  return best;
}

/** Couleur du symbole au point (x, y) en coordonnées 48×48, ou null si le point est hors du tracé. */
function markColor(x, y) {
  if (x < 4 || x > 44 || y < 4 || y > 44) return null;
  if (dist(gPath, x, y) <= W / 2) return gold(Math.min(1, Math.max(0, (x + y) / 96)));
  if (dist(merPath, x, y) <= MER.w / 2) return WHITE;
  return null;
}

function crcTable() { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; }
const CRC = crcTable();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, pixel) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = Math.round(r); raw[o + 1] = Math.round(g); raw[o + 2] = Math.round(b);
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** Image w×h : fond bleu nuit en dégradé, symbole de `size` pixels centré. */
function render(w, h, size) {
  const ox = (w - size) / 2, oy = (h - size) / 2, k = 48 / size, SS = 4;
  return png(w, h, (px, py) => {
    const bg = mix(N0, N1, Math.min(1, (px / w + py / h) / 2 * 1.15));
    const x0 = (px - ox) * k, y0 = (py - oy) * k;
    if (x0 < 3 || x0 > 45 || y0 < 3 || y0 > 45) return bg;
    let acc = [0, 0, 0];
    for (let i = 0; i < SS; i++) for (let j = 0; j < SS; j++) {
      const c = markColor((px + (i + 0.5) / SS - ox) * k, (py + (j + 0.5) / SS - oy) * k) || bg;
      acc = acc.map((v, n) => v + c[n]);
    }
    return acc.map((v) => v / (SS * SS));
  });
}

for (const s of [180, 192, 512]) fs.writeFileSync(path.join(OUT, `globacor-icone-${s}.png`), render(s, s, Math.round(s * 0.86)));
fs.writeFileSync(path.join(OUT, 'globacor-partage-1200x630.png'), render(1200, 630, 380));

fs.writeFileSync(path.join(__dirname, '..', 'public', 'site.webmanifest'), JSON.stringify({
  name: 'GLOBACOR Partners INC', short_name: 'GLOBACOR', start_url: '/', display: 'standalone',
  background_color: '#0a1628', theme_color: '#0a1628',
  icons: [
    { src: '/static/img/brand/globacor-icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
    { src: '/static/img/brand/globacor-icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
  ]
}, null, 2) + '\n');

console.log(fs.readdirSync(OUT).map((f) => `${f} (${Math.round(fs.statSync(path.join(OUT, f)).size / 1024)} Ko)`).join('\n'));
