'use strict';
/**
 * Sauvegarde complète de la base (toutes les tables, fichiers téléversés inclus) au format JSON.
 * Usage : npm run backup  — avec DATABASE_URL pour sauvegarder la base de production (Neon).
 * En production, activez aussi la restauration à un instant donné proposée par Neon.
 */
const fs = require('fs');
const path = require('path');
const { all, ensureSchema, close, DATA_DIR } = require('../src/db');

const TABLES = ['meta', 'settings', 'users', 'files', 'pages', 'projects', 'project_documents', 'interests', 'investments', 'valuations',
  'transactions', 'user_documents', 'kyc_submissions', 'password_resets', 'notifications', 'messages', 'news', 'audit_log',
  'login_attempts', 'email_log', 'email_verifications'];

(async () => {
  await ensureSchema();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = process.env.BACKUP_DIR || path.join(DATA_DIR, '..', 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const dump = { created_at: new Date().toISOString(), tables: {} };
  for (const t of TABLES) {
    const rows = await all(`SELECT * FROM ${t}`);
    dump.tables[t] = rows.map((r) => {
      const o = { ...r };
      if (o.data && (o.data instanceof Uint8Array)) o.data = { base64: Buffer.from(o.data).toString('base64') };
      return o;
    });
  }
  const file = path.join(dir, `backup-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(dump), { mode: 0o600 });
  const counts = Object.entries(dump.tables).map(([k, v]) => `${k}:${v.length}`).join(' ');
  console.log('Sauvegarde créée :', file);
  console.log(counts);
  await close();
})().catch((err) => { console.error(err); process.exit(1); });
