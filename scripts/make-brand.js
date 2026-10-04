'use strict';
/**
 * Génère l'identité visuelle SYNERGIX COMPANY PARTNERS dans public/img/brand/ :
 *  - logos vectoriels (SVG) : symbole seul, versions horizontales pour fond clair et fond sombre ;
 *  - icônes PNG (180, 192, 512) et image de partage 1200×630, dessinées sans dépendance externe.
 * Usage : node scripts/make-brand.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'public', 'img', 'brand');
fs.mkdirSync(OUT, { recursive: true });

const NAVY = '#0a1628';
const GOLD = '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6d3ad"/><stop offset=".55" stop-color="#c9a96e"/><stop offset="1" stop-color="#b08e52"/></linearGradient>';

/** Symbole (48×48). `light` = tracé blanc (fond sombre) ; sinon tracé bleu nuit (fond clair). */
const mark = (light, tx = 0, ty = 0, s = 1) => {
  const second = light ? '#ffffff' : NAVY;
  const hole = light ? NAVY : '#ffffff';
  return `<g transform="translate(${tx} ${ty}) scale(${s})">
    <circle cx="24" cy="24" r="21.2" fill="none" stroke="url(#g)" stroke-width="1.5"/>
    <path d="M31.5 17.5A7.5 7.5 0 1 0 24 25" fill="none" stroke="url(#g)" stroke-width="4" stroke-linecap="round"/>
    <path d="M24 25A7.5 7.5 0 1 1 16.5 32.5" fill="none" stroke="${second}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="31.5" cy="17.5" r="3.1" fill="${hole}" stroke="url(#g)" stroke-width="1.5"/>
    <circle cx="16.5" cy="32.5" r="3.1" fill="${hole}" stroke="${second}" stroke-width="1.5"/>
  </g>`;
};

const FONT = "font-family=\"Montserrat, 'Segoe UI', Arial, Helvetica, sans-serif\"";
const wordmark = (light, x, y) => `
  <text x="${x}" y="${y}" ${FONT} font-size="25" font-weight="700" letter-spacing="3.2" fill="${light ? '#ffffff' : NAVY}">SYNERGIX</text>
  <text x="${x + 1}" y="${y + 17}" ${FONT} font-size="8.6" font-weight="600" letter-spacing="3.6" fill="${light ? '#d7bd8a' : '#b08e52'}">COMPANY PARTNERS</text>`;

const svg = (w, h, body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="SYNERGIX COMPANY PARTNERS"><defs>${GOLD}</defs>${bg || ''}${body}</svg>\n`;

// Symbole seul : icône (fond bleu nuit arrondi), et versions transparentes
fs.writeFileSync(path.join(OUT, 'synergix-symbole.svg'), svg(48, 48, mark(true, 4.8, 4.8, 0.8), `<rect width="48" height="48" rx="10.5" fill="${NAVY}"/>`));
fs.writeFileSync(path.join(OUT, 'synergix-symbole-fond-sombre.svg'), svg(48, 48, mark(true)));
fs.writeFileSync(path.join(OUT, 'synergix-symbole-fond-clair.svg'), svg(48, 48, mark(false)));
// Logo horizontal
fs.writeFileSync(path.join(OUT, 'synergix-logo-fond-clair.svg'), svg(260, 60, mark(false, 6, 6, 1) + wordmark(false, 66, 30)));
fs.writeFileSync(path.join(OUT, 'synergix-logo-fond-sombre.svg'), svg(260, 60, mark(true, 6, 6, 1) + wordmark(true, 66, 30), `<rect width="260" height="60" fill="${NAVY}"/>`));
fs.writeFileSync(path.join(OUT, 'synergix-logo-transparent-blanc.svg'), svg(260, 60, mark(true, 6, 6, 1) + wordmark(true, 66, 30)));
// Favicon
fs.copyFileSync(path.join(OUT, 'synergix-symbole.svg'), path.join(__dirname, '..', 'public', 'img', 'favicon.svg'));

// ---------------------------------------------------------------------------
// Rendu PNG du symbole (sans dépendance) : distances signées + suréchantillonnage 4×4
// ---------------------------------------------------------------------------
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const G0 = hex('#e6d3ad'), G1 = hex('#c9a96e'), G2 = hex('#b08e52'), WHITE = [255, 255, 255], N0 = hex('#0f2140'), N1 = hex('#050d1c'), HOLE = hex('#0a1628');
const gold = (t) => (t < 0.55 ? mix(G0, G1, t / 0.55) : mix(G1, G2, (t - 0.55) / 0.45));

/** Couleur du symbole au point (x, y) en coordonnées 48×48, ou null si le point est hors du tracé. */
function markColor(x, y) {
  const g = gold(Math.min(1, Math.max(0, (x + y) / 96)));
  const d = (cx, cy) => Math.hypot(x - cx, y - cy);
  // Points de connexion (au-dessus de tout)
  for (const [cx, cy, c] of [[31.5, 17.5, g], [16.5, 32.5, WHITE]]) {
    const r = d(cx, cy);
    if (r <= 2.35) return HOLE;
    if (r <= 3.85) return c;
  }
  // Arcs (épaisseur 4) avec extrémités arrondies
  const arc = (cx, cy, excluded, ends, c) => {
    const r = d(cx, cy);
    if (Math.abs(r - 7.5) <= 2) {
      let a = Math.atan2(y - cy, x - cx) * 180 / Math.PI; // 0 = droite, 90 = bas
      if (!(a > excluded[0] && a < excluded[1])) return c;
    }
    for (const [ex, ey] of ends) if (d(ex, ey) <= 2) return c;
    return null;
  };
  const top = arc(24, 17.5, [0, 90], [[31.5, 17.5], [24, 25]], g);
  if (top) return top;
  const bottom = arc(24, 32.5, [-180, -90], [[24, 25], [16.5, 32.5]], WHITE);
  if (bottom) return bottom;
  // Anneau
  if (Math.abs(d(24, 24) - 21.2) <= 0.75) return g;
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
    let acc = [0, 0, 0];
    for (let i = 0; i < SS; i++) for (let j = 0; j < SS; j++) {
      const c = markColor((px + (i + 0.5) / SS - ox) * k, (py + (j + 0.5) / SS - oy) * k) || bg;
      acc = acc.map((v, n) => v + c[n]);
    }
    return acc.map((v) => v / (SS * SS));
  });
}

for (const s of [180, 192, 512]) fs.writeFileSync(path.join(OUT, `synergix-icone-${s}.png`), render(s, s, Math.round(s * 0.74)));
fs.writeFileSync(path.join(OUT, 'synergix-partage-1200x630.png'), render(1200, 630, 330));

fs.writeFileSync(path.join(__dirname, '..', 'public', 'site.webmanifest'), JSON.stringify({
  name: 'SYNERGIX COMPANY PARTNERS', short_name: 'SYNERGIX', start_url: '/', display: 'standalone',
  background_color: '#0a1628', theme_color: '#0a1628',
  icons: [
    { src: '/static/img/brand/synergix-icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
    { src: '/static/img/brand/synergix-icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
  ]
}, null, 2) + '\n');

console.log(fs.readdirSync(OUT).map((f) => `${f} (${Math.round(fs.statSync(path.join(OUT, f)).size / 1024)} Ko)`).join('\n'));
