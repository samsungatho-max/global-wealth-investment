'use strict';
/**
 * Génère le lien d'installation du premier administrateur.
 *   npm run admin:setup-link [-- --url https://votre-site.vercel.app]
 * - écrit le condensat SHA-256 du jeton dans config/admin-setup.json (à publier avec le code) ;
 * - écrit le lien complet (avec le jeton) dans data/admin-setup.txt (reste sur cet ordinateur, non publié).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const i = process.argv.indexOf('--url');
const base = (i > -1 ? process.argv[i + 1] : 'https://global-wealth-investment.vercel.app').replace(/\/$/, '');
const token = crypto.randomBytes(32).toString('hex');
const hash = crypto.createHash('sha256').update(token).digest('hex');

const root = path.join(__dirname, '..');
fs.mkdirSync(path.join(root, 'config'), { recursive: true });
fs.writeFileSync(path.join(root, 'config', 'admin-setup.json'), JSON.stringify({
  _comment: "Condensat SHA-256 du jeton d'installation du premier administrateur. Le jeton lui-même n'est pas publié.",
  token_sha256: hash
}, null, 2) + '\n');
fs.mkdirSync(path.join(root, 'data'), { recursive: true });
const link = `${base}/admin/setup?token=${token}`;
fs.writeFileSync(path.join(root, 'data', 'admin-setup.txt'), [
  'INSTALLATION DU COMPTE ADMINISTRATEUR — CONFIDENTIEL',
  '',
  'Ouvrez ce lien dans votre navigateur (une seule utilisation possible) :',
  link,
  '',
  "Si l'adresse de votre site est différente, gardez la fin du lien à partir de /admin/setup?token=…",
  "Ce lien ne fonctionne plus dès que le compte administrateur est créé. Supprimez ensuite ce fichier.",
  ''
].join('\n'), { mode: 0o600 });
console.log('Condensat publié dans config/admin-setup.json ; lien privé écrit dans data/admin-setup.txt');
