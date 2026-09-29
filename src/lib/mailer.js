'use strict';
/**
 * Envoi d'e-mails. Si SMTP_HOST est configuré, envoi réel via nodemailer.
 * Sinon (développement) : les e-mails sont écrits dans data/outbox/ et affichés dans la console.
 */
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { DATA_DIR } = require('../db');

const OUTBOX = path.join(DATA_DIR, 'outbox');
let transporter = null;

if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });
}

async function sendMail({ to, subject, text }) {
  const from = process.env.MAIL_FROM || 'Global Wealth Investment <no-reply@example.com>';
  if (transporter) {
    try {
      await transporter.sendMail({ from, to, subject, text });
    } catch (err) {
      console.error('[mail] Échec d\'envoi à', to, ':', err.message);
    }
    return;
  }
  fs.mkdirSync(OUTBOX, { recursive: true });
  const file = path.join(OUTBOX, `${Date.now()}-${to.replace(/[^a-z0-9@.]/gi, '_')}.txt`);
  fs.writeFileSync(file, `From: ${from}\nTo: ${to}\nSubject: ${subject}\n\n${text}\n`);
  console.log(`[mail:dev] → ${to} | ${subject} (voir ${path.relative(process.cwd(), file)})`);
}

module.exports = { sendMail, OUTBOX };
