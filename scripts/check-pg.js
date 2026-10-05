'use strict';
/**
 * Exécute le test de bout en bout à travers le pilote réseau `pg` (celui utilisé en production avec Neon),
 * face à un serveur PostgreSQL local (PGlite exposé sur le protocole PostgreSQL).
 * Usage : npm run check:pg
 */
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

(async () => {
  const { PGlite } = require('@electric-sql/pglite');
  const { PGLiteSocketServer } = require('@electric-sql/pglite-socket');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'globacor-pg-'));
  const db = await PGlite.create(path.join(dir, 'pgdata'));
  const server = new PGLiteSocketServer({ db, port: 0, host: '127.0.0.1' });
  await server.start();
  const port = server.server ? server.server.address().port : server.port;
  console.log(`Serveur PostgreSQL de test sur 127.0.0.1:${port}`);

  const child = spawn(process.execPath, [path.join(__dirname, 'smoke-test.js')], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${port}/postgres`, DB_POOL_MAX: '1' }
  });
  child.on('exit', async (code) => {
    await server.stop().catch(() => {});
    await db.close().catch(() => {});
    process.exit(code);
  });
})().catch((err) => { console.error(err); process.exit(1); });
