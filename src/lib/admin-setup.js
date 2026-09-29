'use strict';
/**
 * Installation du premier compte administrateur sans saisir de secret dans l'hébergeur.
 *
 * Un jeton aléatoire est généré sur l'ordinateur du propriétaire (npm run admin:setup-link) :
 *  - seul son condensat SHA-256 est publié (config/admin-setup.json ou ADMIN_SETUP_TOKEN_HASH) ;
 *  - le lien contenant le jeton reste sur l'ordinateur (data/admin-setup.txt).
 * La page /admin/setup n'existe que tant qu'aucun administrateur n'a été créé, et exige ce jeton.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CONFIG_FILE = path.join(__dirname, '..', '..', 'config', 'admin-setup.json');

function expectedHash() {
  if (process.env.ADMIN_SETUP_TOKEN_HASH) return process.env.ADMIN_SETUP_TOKEN_HASH.trim().toLowerCase();
  try { return String(JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')).token_sha256 || '').toLowerCase(); } catch { return ''; }
}

function tokenValid(token) {
  const expected = expectedHash();
  if (!/^[a-f0-9]{64}$/.test(expected) || !token) return false;
  const given = crypto.createHash('sha256').update(String(token)).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

module.exports = { tokenValid, expectedHash, CONFIG_FILE };
