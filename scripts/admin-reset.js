'use strict';
/**
 * (Ré)initialise l'accès administrateur avec un mot de passe provisoire à usage unique.
 *   npm run admin:reset                          → nouveau mot de passe pour le compte admin existant
 *   npm run admin:reset -- --email vous@societe.com → change aussi l'adresse de connexion
 * Le mot de passe n'est jamais affiché dans la console : il est écrit dans data/initial-admin.txt.
 * Il doit être remplacé dès la première connexion (changement imposé par le site).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { one, run, tx, DATA_DIR } = require('../src/db');

const argEmail = (() => { const i = process.argv.indexOf('--email'); return i > -1 ? String(process.argv[i + 1] || '').trim().toLowerCase() : null; })();
if (argEmail !== null && !/^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(argEmail)) {
  console.error('Adresse e-mail invalide.');
  process.exit(1);
}

// Mot de passe provisoire lisible : 4 groupes de 5 caractères sans ambiguïté (≈ 100 bits d'entropie)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const groups = Array.from({ length: 4 }, () => Array.from({ length: 5 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join(''));
const password = groups.join('-') + '-' + crypto.randomInt(10, 100);

const admin = one(`SELECT * FROM users WHERE role = 'admin' ORDER BY id LIMIT 1`);
const email = argEmail || (admin ? admin.email : 'admin@example.test');
const clash = one('SELECT id FROM users WHERE email = ?', email);
if (clash && (!admin || clash.id !== admin.id)) {
  console.error(`L'adresse ${email} est déjà utilisée par un autre compte.`);
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
const adminId = tx(() => {
  let id;
  if (admin) {
    run(`UPDATE users SET email = ?, password_hash = ?, must_change_password = 1, status = 'active',
         email_verified_at = COALESCE(email_verified_at, datetime('now')) WHERE id = ?`, email, hash, admin.id);
    id = admin.id;
  } else {
    id = run(`INSERT INTO users (email, password_hash, full_name, country, phone, role, email_verified_at, kyc_status, must_change_password)
              VALUES (?, ?, 'Administrateur', 'FR', '+33000000000', 'admin', datetime('now'), 'approved', 1)`, email, hash).lastInsertRowid;
  }
  // Révoque les sessions ouvertes et lève un éventuel blocage de connexion
  run(`DELETE FROM sessions WHERE json_extract(sess, '$.userId') = ?`, id);
  run('DELETE FROM login_attempts WHERE email = ? COLLATE NOCASE AND success = 0', email);
  run(`INSERT INTO audit_log (actor_id, actor_email, action, target_type, target_id, details, ip)
       VALUES (NULL, 'console', 'admin.credentials_reset', 'user', ?, ?, 'local')`,
    String(id), JSON.stringify({ email, email_changed: !!(admin && admin.email !== email) }));
  return id;
});

const baseUrl = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
const file = path.join(DATA_DIR, 'initial-admin.txt');
fs.writeFileSync(file, [
  'ACCÈS ADMINISTRATEUR — CONFIDENTIEL',
  `Généré le : ${new Date().toISOString()}`,
  '',
  `URL de connexion : ${baseUrl}/admin/login`,
  `Identifiant (e-mail) : ${email}`,
  `Mot de passe provisoire : ${password}`,
  '',
  'Ce mot de passe est à usage unique : le site impose de le remplacer dès la première connexion.',
  'Après connexion : activez la double authentification (Mon espace > Profil et sécurité),',
  'puis SUPPRIMEZ ce fichier.',
  ''
].join('\n'), { mode: 0o600 });

console.log(`Accès administrateur réinitialisé pour ${email} (compte #${adminId}).`);
console.log(`Identifiants provisoires enregistrés dans : ${file}`);
