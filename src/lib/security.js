'use strict';
/** CSRF, contrôle d'accès, stockage des sessions et téléversements sécurisés. */
const crypto = require('crypto');
const path = require('path');
const session = require('express-session');
const multer = require('multer');
const { one, run } = require('../db');

// ---------- Jetons ----------
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
function safeEqual(a, b) {
  const ba = Buffer.from(String(a || '')), bb = Buffer.from(String(b || ''));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// ---------- CSRF (jeton synchronisé en session) ----------
function csrfToken(req, res, next) {
  if (!req.session.csrf) req.session.csrf = randomToken(24);
  res.locals.csrf = req.session.csrf;
  next();
}

function verifyCsrf(req, res, next) {
  const token = (req.body && req.body._csrf) || req.get('x-csrf-token');
  if (!safeEqual(token, req.session.csrf)) {
    const err = new Error('Invalid CSRF token'); err.status = 403; err.code = 'CSRF';
    return next(err);
  }
  next();
}

/** Vérifie le CSRF sur toutes les requêtes non sûres, sauf multipart (vérifié après multer). */
function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.is('multipart/form-data')) return next();
  return verifyCsrf(req, res, next);
}

// ---------- Utilisateur courant & gardes ----------
async function loadUser(req, res, next) {
  try {
    req.user = null;
    if (req.session.userId) {
      const u = await one('SELECT * FROM users WHERE id = ?', req.session.userId);
      if (u && u.status === 'active') req.user = u;
      else delete req.session.userId;
    }
    res.locals.user = req.user;
    next();
  } catch (e) { next(e); }
}

/** Mot de passe provisoire : tant qu'il n'est pas changé, seul l'écran de sécurité est accessible. */
const PASSWORD_CHANGE_ALLOWED = ['/account/security', '/account/security/password', '/logout'];
function enforcePasswordChange(req, res, next) {
  if (!req.user || !req.user.must_change_password) return next();
  if (PASSWORD_CHANGE_ALLOWED.includes(req.path) || req.path.startsWith('/static') || req.path.startsWith('/media')) return next();
  return res.redirect('/account/security#password');
}

function requireAuth(req, res, next) {
  if (!req.user) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
  if (!req.user.email_verified_at) return res.redirect('/verify-email');
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/admin/login');
  }
  if (req.user.role !== 'admin') {
    const err = new Error('Forbidden'); err.status = 403; return next(err);
  }
  next();
}

// ---------- Stockage des sessions dans PostgreSQL ----------
class PgStore extends session.Store {
  get(sid, cb) {
    one('SELECT sess, expires FROM sessions WHERE sid = ?', sid)
      .then((row) => cb(null, !row || row.expires < Date.now() ? null : JSON.parse(row.sess)))
      .catch(cb);
  }
  set(sid, sess, cb) {
    const expires = sess.cookie && sess.cookie.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + 86400000;
    run('INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?) ON CONFLICT (sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires',
      sid, JSON.stringify(sess), expires)
      .then(() => {
        // Nettoyage occasionnel des sessions expirées (pas de tâche de fond en mode serverless)
        if (Math.random() < 0.02) run('DELETE FROM sessions WHERE expires < ?', Date.now()).catch(() => {});
        cb && cb(null);
      })
      .catch((e) => cb && cb(e));
  }
  destroy(sid, cb) {
    run('DELETE FROM sessions WHERE sid = ?', sid).then(() => cb && cb(null)).catch((e) => cb && cb(e));
  }
  touch(sid, sess, cb) { this.set(sid, sess, cb); }
}

// ---------- Téléversements (stockés dans la base : privés, persistants, compatibles serverless) ----------
const MAX_UPLOAD_MB = Number(process.env.UPLOAD_MAX_MB || 4); // Vercel limite le corps des requêtes à 4,5 Mo
const ALLOWED = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp'
};
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp'];

async function storeFile(file, visibility) {
  const id = randomToken(16) + path.extname(file.originalname).toLowerCase();
  await run('INSERT INTO files (id, original_name, mime, size, visibility, data) VALUES (?, ?, ?, ?, ?, ?)',
    id, file.originalname.slice(0, 200), file.mimetype, file.size, visibility, file.buffer);
  return id;
}

/**
 * Retourne un intergiciel de téléversement. Après analyse du formulaire, chaque fichier est enregistré
 * en base ; `file.filename` contient alors l'identifiant du fichier stocké.
 */
function makeUploader(fieldRules) {
  const m = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 5 },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const kind = fieldRules[file.fieldname];
      const ok = ALLOWED[ext] === file.mimetype && (kind !== 'image' || IMAGE_EXT.includes(ext));
      if (!ok) { const e = new Error('File type not allowed'); e.status = 400; e.code = 'FILE_TYPE'; return cb(e); }
      cb(null, true);
    }
  });
  const persist = async (req, res, next) => {
    try {
      const list = req.file ? [req.file] : Object.values(req.files || {}).flat();
      for (const f of list) {
        f.filename = await storeFile(f, fieldRules[f.fieldname] === 'image' ? 'public' : 'private');
        delete f.buffer;
      }
      next();
    } catch (e) { next(e); }
  };
  return {
    single: (name) => [m.single(name), persist],
    fields: (defs) => [m.fields(defs), persist]
  };
}

/** Envoie un fichier stocké (contrôle d'accès à faire AVANT l'appel). */
async function sendStoredFile(res, id, downloadName, { inline = false, cache = false } = {}) {
  const f = id ? await one('SELECT * FROM files WHERE id = ?', String(id)) : null;
  if (!f) { res.status(404).type('text').send('Not found'); return; }
  const name = String(downloadName || f.original_name || f.id).replace(/["\r\n]/g, '');
  res.set('Content-Type', f.mime);
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${name.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.set('Cache-Control', cache ? 'public, max-age=604800, immutable' : 'private, no-store');
  res.send(Buffer.from(f.data));
}

async function removeFile(id) {
  if (id) await run('DELETE FROM files WHERE id = ?', String(id));
}

module.exports = {
  randomToken, sha256, safeEqual,
  csrfToken, verifyCsrf, csrfGuard,
  loadUser, enforcePasswordChange, requireAuth, requireAdmin,
  PgStore, makeUploader, sendStoredFile, removeFile, MAX_UPLOAD_MB
};
