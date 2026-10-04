'use strict';
/**
 * Envoi d'e-mails avec journal complet (table email_log).
 *
 * Étapes distinctes, jamais confondues :
 *   queued          → message préparé
 *   not_sent        → AUCUN envoi (pas de SMTP configuré) — copie écrite dans data/outbox/
 *   relay_accepted  → accepté par le serveur SMTP / service d'envoi (réponse 250)
 *   delivered       → remis au serveur destinataire (Gmail, Outlook…) — connu uniquement via webhook du service d'envoi
 *   deferred        → remise retardée (signalée par le service)
 *   failed          → refusé ou erreur d'envoi (erreur SMTP enregistrée)
 *   bounced / complained → rebond ou signalement spam (via webhook)
 *
 * Configuration (variables d'environnement) : SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS,
 * MAIL_FROM, MAIL_REPLY_TO, DKIM_DOMAIN, DKIM_SELECTOR, DKIM_PRIVATE_KEY, SMTP_TLS_INSECURE.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { one, run, DATA_DIR } = require('../db');

const OUTBOX = path.join(DATA_DIR, 'outbox');
const MAX_ATTEMPTS = 3;
const FREE_MAIL_DOMAINS = ['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'hotmail.fr', 'live.com', 'live.fr', 'msn.com',
  'yahoo.com', 'yahoo.fr', 'ymail.com', 'icloud.com', 'me.com', 'aol.com', 'gmx.com', 'gmx.fr', 'orange.fr', 'free.fr', 'laposte.net', 'proton.me', 'protonmail.com'];

function parseFrom(from) {
  const m = String(from || '').match(/<([^>]+)>/);
  const address = (m ? m[1] : String(from || '')).trim().toLowerCase();
  return { address, domain: address.includes('@') ? address.split('@')[1] : '' };
}

function config() {
  const env = process.env;
  const from = env.MAIL_FROM || 'SYNERGIX COMPANY PARTNERS <no-reply@example.com>';
  const { address, domain } = parseFrom(from);
  const port = Number(env.SMTP_PORT || 587);
  const secure = env.SMTP_SECURE === 'true';
  const cfg = {
    enabled: !!env.SMTP_HOST,
    host: env.SMTP_HOST || null,
    port,
    secure,
    user: env.SMTP_USER ? env.SMTP_USER.replace(/^(.{2}).*(@.*)?$/, (m, a, b) => `${a}•••${b || ''}`) : null,
    from,
    fromAddress: address,
    fromDomain: domain,
    replyTo: env.MAIL_REPLY_TO || null,
    dkim: !!(env.DKIM_DOMAIN && env.DKIM_SELECTOR && env.DKIM_PRIVATE_KEY),
    dkimSelector: env.DKIM_SELECTOR || null,
    webhook: !!env.EMAIL_WEBHOOK_TOKEN,
    warnings: []
  };
  if (!cfg.enabled) cfg.warnings.push({ level: 'error', text: 'Aucun serveur SMTP configuré (SMTP_HOST vide) : AUCUN e-mail ne part. Les messages sont seulement copiés dans data/outbox/ et marqués « non envoyé ».' });
  if (!domain || /(^|\.)example\.(com|org|net)$/.test(domain)) cfg.warnings.push({ level: 'error', text: `Adresse d'expéditeur (MAIL_FROM) non définie ou fictive : « ${address || '—'} ». Utilisez une adresse de votre propre domaine, ex. no-reply@votre-domaine.com.` });
  if (FREE_MAIL_DOMAINS.includes(domain)) cfg.warnings.push({ level: 'error', text: `L'expéditeur utilise un domaine de messagerie gratuite (${domain}). Gmail, Outlook et Yahoo rejettent ou classent en spam ces messages envoyés depuis un autre serveur (échec DMARC). Utilisez une adresse de votre propre domaine.` });
  if (cfg.enabled && secure && port === 587) cfg.warnings.push({ level: 'warning', text: 'SMTP_SECURE=true avec le port 587 : en général, le port 587 utilise STARTTLS (SMTP_SECURE=false) et le port 465 le TLS direct (SMTP_SECURE=true).' });
  if (cfg.enabled && !secure && port === 465) cfg.warnings.push({ level: 'warning', text: 'Port 465 avec SMTP_SECURE=false : le port 465 exige SMTP_SECURE=true.' });
  if (cfg.enabled && !cfg.webhook) cfg.warnings.push({ level: 'info', text: 'Webhook de suivi non configuré (EMAIL_WEBHOOK_TOKEN) : la remise effective chez le destinataire (Gmail, Outlook…) et les rebonds ne peuvent pas être confirmés, seule l\'acceptation par le serveur SMTP est connue.' });
  return cfg;
}

let cached = { key: null, transporter: null };
function transporter() {
  const env = process.env;
  if (!env.SMTP_HOST) return null;
  const key = [env.SMTP_HOST, env.SMTP_PORT, env.SMTP_SECURE, env.SMTP_USER, env.SMTP_PASS, env.DKIM_SELECTOR].join('|');
  if (cached.key === key) return cached.transporter;
  const opts = {
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: env.SMTP_SECURE === 'true',
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: env.SMTP_TLS_INSECURE !== 'true' }
  };
  if (env.DKIM_DOMAIN && env.DKIM_SELECTOR && env.DKIM_PRIVATE_KEY) {
    opts.dkim = { domainName: env.DKIM_DOMAIN, keySelector: env.DKIM_SELECTOR, privateKey: env.DKIM_PRIVATE_KEY.replace(/\\n/g, '\n') };
  }
  cached = { key, transporter: nodemailer.createTransport(opts) };
  return cached.transporter;
}

const mask = (email) => String(email).replace(/^(.)[^@]*(@.*)$/, '$1•••$2');

async function appendEvent(id, event) {
  const row = await one('SELECT events FROM email_log WHERE id = ?', id);
  const events = row ? JSON.parse(row.events || '[]') : [];
  events.push({ at: new Date().toISOString(), ...event });
  await run(`UPDATE email_log SET events = ?, updated_at = datetime('now') WHERE id = ?`, JSON.stringify(events.slice(-50)), id);
}

function isTransient(err) {
  if (err.responseCode && err.responseCode >= 400 && err.responseCode < 500) return true;
  return ['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN'].includes(err.code);
}

function describeError(err) {
  return [err.code, err.responseCode, err.response || err.message].filter(Boolean).join(' — ').slice(0, 1000);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Envoie un e-mail et retourne la ligne du journal { id, status, error, smtp_response }.
 * Ne lève pas d'exception : l'appelant décide quoi afficher selon le statut réel.
 */
async function sendMail({ to, subject, text, html, kind = 'other', userId = null }) {
  const cfg = config();
  const domain = cfg.fromDomain || 'localhost';
  const messageId = `${crypto.randomBytes(12).toString('hex')}@${domain}`;
  const t = transporter();
  const logId = (await run(`INSERT INTO email_log (kind, to_email, user_id, subject, message_id, transport) VALUES (?, ?, ?, ?, ?, ?)`,
    kind, to, userId, subject, messageId, t ? 'smtp' : 'none')).lastInsertRowid;

  if (!t) {
    try {
      fs.mkdirSync(OUTBOX, { recursive: true });
      fs.writeFileSync(path.join(OUTBOX, `${Date.now()}-${logId}.txt`), `From: ${cfg.from}\nTo: ${to}\nSubject: ${subject}\n\n${text}\n`);
    } catch { /* système de fichiers en lecture seule (serverless) */ }
    const error = 'Aucun serveur SMTP configuré : e-mail NON envoyé.';
    await run(`UPDATE email_log SET status = 'not_sent', error = ?, failed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`, error, logId);
    await appendEvent(logId, { type: 'not_sent', detail: error });
    console.warn(`[mail] #${logId} ${kind} → ${mask(to)} : NON ENVOYÉ (aucun SMTP configuré)`);
    return await one('SELECT * FROM email_log WHERE id = ?', logId);
  }

  const message = {
    from: cfg.from, to, subject, text, html,
    replyTo: cfg.replyTo || undefined,
    messageId: `<${messageId}>`,
    headers: { 'X-Entity-Ref-ID': String(logId), 'Auto-Submitted': 'auto-generated' }
  };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await run('UPDATE email_log SET attempts = ? WHERE id = ?', attempt, logId);
    try {
      const info = await t.sendMail(message);
      const accepted = (info.accepted || []).map(String).map((s) => s.toLowerCase());
      if (accepted.includes(String(to).toLowerCase())) {
        await run(`UPDATE email_log SET status = 'relay_accepted', smtp_response = ?, error = NULL, relay_accepted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
          String(info.response || '').slice(0, 500), logId);
        await appendEvent(logId, { type: 'relay_accepted', attempt, detail: info.response });
        console.log(`[mail] #${logId} ${kind} → ${mask(to)} : accepté par le serveur SMTP (${info.response})`);
      } else {
        const error = `Destinataire refusé par le serveur SMTP : ${JSON.stringify(info.rejected || [])} ${info.response || ''}`.slice(0, 1000);
        await run(`UPDATE email_log SET status = 'failed', smtp_response = ?, error = ?, failed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
          String(info.response || '').slice(0, 500), error, logId);
        await appendEvent(logId, { type: 'failed', attempt, detail: error });
        console.error(`[mail] #${logId} ${kind} → ${mask(to)} : REFUSÉ — ${error}`);
      }
      return await one('SELECT * FROM email_log WHERE id = ?', logId);
    } catch (err) {
      const error = describeError(err);
      await appendEvent(logId, { type: 'error', attempt, detail: error });
      if (attempt < MAX_ATTEMPTS && isTransient(err)) {
        console.warn(`[mail] #${logId} ${kind} → ${mask(to)} : erreur temporaire (tentative ${attempt}/${MAX_ATTEMPTS}) — ${error}`);
        await sleep(800 * attempt);
        continue;
      }
      await run(`UPDATE email_log SET status = 'failed', error = ?, failed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`, error, logId);
      console.error(`[mail] #${logId} ${kind} → ${mask(to)} : ÉCHEC après ${attempt} tentative(s) — ${error}`);
      return await one('SELECT * FROM email_log WHERE id = ?', logId);
    }
  }
  return await one('SELECT * FROM email_log WHERE id = ?', logId);
}

/** Teste la connexion et l'authentification SMTP (sans envoyer de message). */
async function verifyConnection() {
  const t = transporter();
  if (!t) return { ok: false, error: 'Aucun serveur SMTP configuré (SMTP_HOST vide).' };
  try {
    await t.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
}

const STATUS_RANK = { queued: 0, not_sent: 1, failed: 1, relay_accepted: 2, deferred: 3, delivered: 4, bounced: 5, complained: 6 };

/** Enregistre un événement de remise reçu d'un service d'envoi (webhook). */
async function recordDeliveryEvent(messageId, status, detail, raw) {
  const id = String(messageId || '').replace(/^<|>$/g, '').trim();
  if (!id) return false;
  const row = await one('SELECT * FROM email_log WHERE message_id = ?', id);
  if (!row) return false;
  await appendEvent(row.id, { type: `webhook:${raw || status}`, detail });
  if (!status) return true;
  // On ne revient jamais en arrière (ex. « deferred » reçu après « delivered »), sauf rebond/plainte.
  if ((STATUS_RANK[status] || 0) < (STATUS_RANK[row.status] || 0) && !['bounced', 'complained'].includes(status)) return true;
  if (status === 'delivered') {
    await run(`UPDATE email_log SET status = 'delivered', delivered_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`, row.id);
  } else if (status === 'bounced' || status === 'complained') {
    await run(`UPDATE email_log SET status = ?, error = ?, failed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`, status, String(detail || '').slice(0, 1000), row.id);
  } else {
    await run(`UPDATE email_log SET status = ?, updated_at = datetime('now') WHERE id = ?`, status, row.id);
  }
  console.log(`[mail] #${row.id} événement de remise : ${status}${detail ? ' — ' + detail : ''}`);
  return true;
}

module.exports = { sendMail, verifyConnection, config, recordDeliveryEvent, mask, OUTBOX, FREE_MAIL_DOMAINS };
