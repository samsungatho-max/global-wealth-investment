'use strict';
/**
 * Base de données PostgreSQL.
 *  - Production (Vercel) : DATABASE_URL / POSTGRES_URL (Neon ou tout PostgreSQL) via `pg`.
 *  - Local et tests : PGlite (PostgreSQL embarqué, fichiers dans DATA_DIR/pgdata) — même dialecte SQL.
 *
 * API asynchrone : one(sql, ...params), all(...), run(...), tx(async () => {...}).
 * Les paramètres s'écrivent « ? » (convertis en $1, $2…). Dans tx(), toutes les requêtes passent
 * automatiquement par la transaction en cours (AsyncLocalStorage).
 * Tous les montants sont stockés en centimes d'euro (BIGINT) ; les dates en texte UTC « AAAA-MM-JJ HH:MM:SS ».
 */
const path = require('path');
const fs = require('fs');
const { AsyncLocalStorage } = require('async_hooks');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const SCHEMA_VERSION = '7';

const als = new AsyncLocalStorage();
let driver = null; // { kind, query(text, params), exec(sql), transaction(fn), close() }

function toPositional(sql) {
  let out = '', n = 0, inStr = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'") inStr = !inStr;
    if (c === '?' && !inStr) { out += '$' + (++n); continue; }
    out += c;
  }
  return out;
}

function normalizeParams(params) {
  return params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p));
}

async function createDriver() {
  if (DATABASE_URL) {
    const pg = require('pg');
    pg.types.setTypeParser(20, (v) => Number(v));   // BIGINT → number
    pg.types.setTypeParser(1700, (v) => Number(v)); // NUMERIC → number
    const pool = new pg.Pool({
      connectionString: DATABASE_URL,
      ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? false : { rejectUnauthorized: false },
      max: Number(process.env.DB_POOL_MAX || 5),
      idleTimeoutMillis: 10000
    });
    return {
      kind: 'postgres',
      query: (text, params) => pool.query(text, params),
      exec: (sql) => pool.query(sql),
      async transaction(fn) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await fn({ query: (t, p) => client.query(t, p), exec: (sql) => client.query(sql) });
          await client.query('COMMIT');
          return result;
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          throw err;
        } finally { client.release(); }
      },
      close: () => pool.end()
    };
  }
  const { PGlite } = require('@electric-sql/pglite');
  const dir = path.join(DATA_DIR, 'pgdata');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new PGlite(dir, { parsers: { 20: (v) => Number(v), 1700: (v) => Number(v) } });
  await db.waitReady;
  return {
    kind: 'pglite',
    query: (text, params) => db.query(text, params),
    exec: (sql) => db.exec(sql),
    transaction: (fn) => db.transaction((t) => fn({ query: (tt, p) => t.query(tt, p), exec: (sql) => t.exec(sql) })),
    close: () => db.close()
  };
}

let driverPromise = null;
function getDriver() {
  if (!driverPromise) driverPromise = createDriver().then((d) => (driver = d));
  return driverPromise;
}

async function query(sql, params = []) {
  const d = driver || await getDriver();
  const ctx = als.getStore();
  const runner = ctx ? ctx.client : d;
  const res = await runner.query(toPositional(sql), normalizeParams(params));
  return { rows: res.rows || [], rowCount: res.rowCount != null ? res.rowCount : res.affectedRows || 0 };
}

const one = async (sql, ...params) => (await query(sql, params)).rows[0];
const all = async (sql, ...params) => (await query(sql, params)).rows;

/** INSERT : retourne { lastInsertRowid } (RETURNING * ajouté automatiquement) ; sinon { changes }. */
async function run(sql, ...params) {
  let text = sql;
  const isInsert = /^\s*insert/i.test(text);
  if (isInsert && !/\breturning\b/i.test(text)) text += ' RETURNING *';
  const res = await query(text, params);
  return { lastInsertRowid: isInsert && res.rows[0] ? res.rows[0].id : undefined, changes: res.rowCount, rows: res.rows };
}

/** Exécute fn dans une transaction (rollback automatique en cas d'erreur). Imbrication tolérée. */
async function tx(fn) {
  const d = driver || await getDriver();
  if (als.getStore()) return fn();
  return d.transaction((client) => als.run({ client }, fn));
}

async function exec(sql) {
  const d = driver || await getDriver();
  return d.exec(sql);
}

// ---------------------------------------------------------------------------
// Schéma
// ---------------------------------------------------------------------------
const SCHEMA = `
CREATE OR REPLACE FUNCTION datetime(base text, modifier text DEFAULT NULL) RETURNS text AS $$
  SELECT to_char(((CASE WHEN base = 'now' THEN now() ELSE base::timestamptz END)
    + COALESCE(modifier::interval, interval '0')) AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION json_extract(doc text, path text) RETURNS text AS $$
  SELECT (doc::jsonb) ->> substr(path, 3)
$$ LANGUAGE sql IMMUTABLE;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  country TEXT NOT NULL,
  phone TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'fr',
  role TEXT NOT NULL DEFAULT 'investor' CHECK (role IN ('investor','admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  email_verified_at TEXT,
  email_verify_token_hash TEXT,
  email_verify_expires TEXT,
  totp_secret TEXT,
  totp_enabled INTEGER NOT NULL DEFAULT 0,
  kyc_status TEXT NOT NULL DEFAULT 'none' CHECK (kyc_status IN ('none','pending','approved','rejected')),
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT datetime('now'),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  original_name TEXT,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public','private')),
  data BYTEA NOT NULL,
  created_at TEXT NOT NULL DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS password_resets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS kyc_submissions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  id_file TEXT NOT NULL,
  id_file_name TEXT,
  address_file TEXT NOT NULL,
  address_file_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewer_id BIGINT REFERENCES users(id),
  review_note TEXT,
  created_at TEXT NOT NULL DEFAULT datetime('now'),
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS projects (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  sector TEXT NOT NULL CHECK (sector IN ('real_estate','commercial','agriculture','industry','energy','trade','infrastructure','tourism','technology','mining','development')),
  country TEXT NOT NULL,
  i18n TEXT NOT NULL DEFAULT '{}',
  target_cents BIGINT NOT NULL DEFAULT 0,
  min_ticket_cents BIGINT NOT NULL DEFAULT 0,
  duration_months INTEGER NOT NULL DEFAULT 12,
  risk_level INTEGER NOT NULL DEFAULT 3 CHECK (risk_level BETWEEN 1 AND 5),
  image_path TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','suspended','closed','archived')),
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT datetime('now'),
  updated_at TEXT NOT NULL DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS project_documents (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  original_name TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'investors' CHECK (visibility IN ('public','investors')),
  created_at TEXT NOT NULL DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS interests (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  amount_cents BIGINT NOT NULL DEFAULT 0,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','converted','declined')),
  created_at TEXT NOT NULL DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS investments (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  project_id BIGINT NOT NULL REFERENCES projects(id),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','matured','closed')),
  created_by BIGINT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS valuations (
  id BIGSERIAL PRIMARY KEY,
  investment_id BIGINT NOT NULL REFERENCES investments(id),
  value_cents BIGINT NOT NULL,
  valuation_date TEXT NOT NULL,
  note TEXT,
  created_by BIGINT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('deposit','withdrawal','investment','payout','fee')),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  fee_cents BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','confirmed','rejected','cancelled')),
  reference TEXT NOT NULL UNIQUE,
  method TEXT,
  beneficiary TEXT,
  investment_id BIGINT REFERENCES investments(id),
  user_note TEXT,
  admin_note TEXT,
  external_ref TEXT,
  created_at TEXT NOT NULL DEFAULT datetime('now'),
  processed_at TEXT,
  processed_by BIGINT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS user_documents (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('contract','statement','other')),
  file_path TEXT NOT NULL,
  original_name TEXT NOT NULL,
  uploaded_by BIGINT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  link TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','answered','closed')),
  reply TEXT,
  replied_by BIGINT REFERENCES users(id),
  replied_at TEXT,
  created_at TEXT NOT NULL DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS requests (
  id BIGSERIAL PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  motive TEXT NOT NULL CHECK (motive IN ('project','funding','opportunity','investor','other')),
  full_name TEXT NOT NULL,
  organisation TEXT,
  country TEXT NOT NULL,
  city TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  sector TEXT,
  nature TEXT,
  amount_cents BIGINT,
  own_funds_cents BIGINT,
  duration_months INTEGER,
  description TEXT NOT NULL,
  stage TEXT,
  has_business_plan INTEGER,
  has_documents INTEGER,
  website TEXT,
  lang TEXT NOT NULL DEFAULT 'fr',
  certified_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','review','info_requested','forwarded','closed')),
  admin_note TEXT,
  handled_by BIGINT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT datetime('now'),
  updated_at TEXT NOT NULL DEFAULT datetime('now')
);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status, created_at);

CREATE TABLE IF NOT EXISTS news (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'news' CHECK (kind IN ('news','report')),
  i18n TEXT NOT NULL DEFAULT '{}',
  image_path TEXT,
  file_path TEXT,
  file_name TEXT,
  published INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS pages (
  slug TEXT PRIMARY KEY,
  i18n TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id BIGINT,
  actor_email TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT datetime('now')
);

-- Journal d'audit en ajout seul : aucune modification ni suppression possible via l'application.
CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'audit_log is append-only'; END
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS audit_log_no_change ON audit_log;
CREATE TRIGGER audit_log_no_change BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
DROP TRIGGER IF EXISTS audit_log_no_truncate ON audit_log;
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();

CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGSERIAL PRIMARY KEY,
  email TEXT,
  ip TEXT,
  success INTEGER NOT NULL,
  reason TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expires BIGINT NOT NULL
);

-- Journal de chaque e-mail : étapes distinctes, jamais « réussi » par défaut.
CREATE TABLE IF NOT EXISTS email_log (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  to_email TEXT NOT NULL,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  message_id TEXT,
  transport TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','not_sent','relay_accepted','deferred','delivered','failed','bounced','complained')),
  smtp_response TEXT,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  events TEXT NOT NULL DEFAULT '[]',
  relay_accepted_at TEXT,
  delivered_at TEXT,
  failed_at TEXT,
  created_at TEXT NOT NULL DEFAULT datetime('now'),
  updated_at TEXT NOT NULL DEFAULT datetime('now')
);

-- Codes de confirmation de compte : seul un condensat HMAC est stocké.
CREATE TABLE IF NOT EXISTS email_verifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  invalidated_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  email_log_id BIGINT REFERENCES email_log(id),
  created_at TEXT NOT NULL DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL,
  reset_at BIGINT NOT NULL
);

-- Actualités et rapports : catégories, sources, planification
ALTER TABLE projects ADD COLUMN IF NOT EXISTS photo_key TEXT;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_sector_check;
ALTER TABLE projects ADD CONSTRAINT projects_sector_check CHECK (sector IN ('real_estate','commercial','agriculture','industry','energy','trade','infrastructure','tourism','technology','mining','development'));
ALTER TABLE news ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT 'world';
ALTER TABLE news ADD COLUMN IF NOT EXISTS sector TEXT NOT NULL DEFAULT 'macro';
ALTER TABLE news ADD COLUMN IF NOT EXISTS inv_type TEXT NOT NULL DEFAULT 'markets';
ALTER TABLE news ADD COLUMN IF NOT EXISTS sources TEXT NOT NULL DEFAULT '';
ALTER TABLE news ADD COLUMN IF NOT EXISTS report_url TEXT;
ALTER TABLE news ADD COLUMN IF NOT EXISTS photo_key TEXT;
ALTER TABLE news ADD COLUMN IF NOT EXISTS featured INTEGER NOT NULL DEFAULT 0;
ALTER TABLE news ADD COLUMN IF NOT EXISTS publish_at TEXT;
ALTER TABLE news ADD COLUMN IF NOT EXISTS reviewed_by BIGINT;
ALTER TABLE news ADD COLUMN IF NOT EXISTS updated_at TEXT;

-- Veille : sources officielles suivies et publications détectées (jamais publiées automatiquement)
CREATE TABLE IF NOT EXISTS news_sources (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  feed_url TEXT NOT NULL UNIQUE,
  site_url TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  last_checked_at TEXT,
  last_status TEXT,
  created_at TEXT NOT NULL DEFAULT datetime('now')
);
CREATE TABLE IF NOT EXISTS news_suggestions (
  id BIGSERIAL PRIMARY KEY,
  source_id BIGINT REFERENCES news_sources(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  summary TEXT,
  published_at TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','used','dismissed')),
  created_at TEXT NOT NULL DEFAULT datetime('now')
);
CREATE INDEX IF NOT EXISTS idx_news_sugg_status ON news_suggestions(status, created_at);
CREATE INDEX IF NOT EXISTS idx_news_pub ON news(published, published_at);

CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_inv_user ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_inv_project ON investments(project_id);
CREATE INDEX IF NOT EXISTS idx_val_inv ON valuations(investment_id, valuation_date);
CREATE INDEX IF NOT EXISTS idx_login_email ON login_attempts(email, created_at);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_email_log_msg ON email_log(message_id);
CREATE INDEX IF NOT EXISTS idx_email_log_created ON email_log(created_at);
CREATE INDEX IF NOT EXISTS idx_email_verif_user ON email_verifications(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);
`;

let schemaPromise = null;
/** Crée ou met à jour le schéma (une seule fois par version, protégé par un verrou consultatif). */
function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await getDriver();
      await exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`).catch(() => {});
      const v = await one(`SELECT value FROM meta WHERE key = 'schema_version'`);
      if (v && v.value === SCHEMA_VERSION) return;
      await tx(async () => {
        await query('SELECT pg_advisory_xact_lock(424242)');
        const again = await one(`SELECT value FROM meta WHERE key = 'schema_version'`);
        if (again && again.value === SCHEMA_VERSION) return;
        await als.getStore().client.exec(SCHEMA);
        await query(`INSERT INTO meta (key, value) VALUES ('schema_version', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value`, [SCHEMA_VERSION]);
      });
    })().catch((err) => { schemaPromise = null; throw err; });
  }
  return schemaPromise;
}

async function close() {
  if (driver) await driver.close();
  driver = null; driverPromise = null; schemaPromise = null;
}

module.exports = { query, one, all, run, tx, exec, ensureSchema, close, DATA_DIR, getDriver, driverKind: () => (driver ? driver.kind : null) };
