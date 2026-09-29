'use strict';
/** CSRF, contrôle d'accès, stockage des sessions et téléversements sécurisés. */
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const multer = require('multer');
const { one, run, DATA_DIR } = require('../db');

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
function loadUser(req, res, next) {
  req.user = null;
  if (req.session.userId) {
    const u = one('SELECT * FROM users WHERE id = ?', req.session.userId);
    if (u && u.status === 'active') req.user = u;
    else delete req.session.userId;
  }
  res.locals.user = req.user;
  next();
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
  if (!req.user.email_verified_at) return res.redirect('/verify-email/pending');
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

// ---------- Stockage des sessions dans SQLite ----------
class SQLiteStore extends session.Store {
  constructor() {
    super();
    setInterval(() => run('DELETE FROM sessions WHERE expires < ?', Date.now()), 15 * 60 * 1000).unref();
  }
  get(sid, cb) {
    try {
      const row = one('SELECT sess, expires FROM sessions WHERE sid = ?', sid);
      if (!row || row.expires < Date.now()) return cb(null, null);
      cb(null, JSON.parse(row.sess));
    } catch (e) { cb(e); }
  }
  set(sid, sess, cb) {
    try {
      const expires = sess.cookie && sess.cookie.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + 86400000;
      run('INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires',
        sid, JSON.stringify(sess), expires);
      cb && cb(null);
    } catch (e) { cb && cb(e); }
  }
  destroy(sid, cb) {
    try { run('DELETE FROM sessions WHERE sid = ?', sid); cb && cb(null); } catch (e) { cb && cb(e); }
  }
  touch(sid, sess, cb) { this.set(sid, sess, cb); }
}

// ---------- Téléversements ----------
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const PUBLIC_DIR = path.join(UPLOAD_DIR, 'public');   // images publiques (projets, actualités)
const PRIVATE_DIR = path.join(UPLOAD_DIR, 'private'); // KYC, contrats, relevés — jamais servis directement
fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.mkdirSync(PRIVATE_DIR, { recursive: true });

const ALLOWED = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp'
};
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp'];

function makeUploader(fieldRules) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, fieldRules[file.fieldname] === 'image' ? PUBLIC_DIR : PRIVATE_DIR),
    filename: (req, file, cb) => cb(null, randomToken(16) + path.extname(file.originalname).toLowerCase())
  });
  return multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024, files: 5 },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const kind = fieldRules[file.fieldname];
      const ok = ALLOWED[ext] === file.mimetype && (kind !== 'image' || IMAGE_EXT.includes(ext));
      if (!ok) { const e = new Error('File type not allowed'); e.status = 400; e.code = 'FILE_TYPE'; return cb(e); }
      cb(null, true);
    }
  });
}

/** Chemin absolu d'un fichier privé, protégé contre la traversée de répertoire. */
function privatePath(name) {
  const p = path.join(PRIVATE_DIR, path.basename(name));
  return p;
}

module.exports = {
  randomToken, sha256, safeEqual,
  csrfToken, verifyCsrf, csrfGuard,
  loadUser, enforcePasswordChange, requireAuth, requireAdmin,
  SQLiteStore, makeUploader, privatePath, PUBLIC_DIR, PRIVATE_DIR
};
