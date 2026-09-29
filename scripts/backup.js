'use strict';
/**
 * Sauvegarde cohérente de la base (VACUUM INTO) + copie des fichiers téléversés.
 * Usage : npm run backup   (à planifier quotidiennement : cron, Planificateur de tâches…)
 */
const fs = require('fs');
const path = require('path');
const { db, DATA_DIR } = require('../src/db');

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dest = path.join(process.env.BACKUP_DIR || path.join(DATA_DIR, '..', 'backups'), stamp);
fs.mkdirSync(dest, { recursive: true });

db.exec(`VACUUM INTO '${path.join(dest, 'platform.db').replace(/'/g, "''")}'`);
const uploads = path.join(DATA_DIR, 'uploads');
if (fs.existsSync(uploads)) fs.cpSync(uploads, path.join(dest, 'uploads'), { recursive: true });

console.log('Sauvegarde créée :', dest);
