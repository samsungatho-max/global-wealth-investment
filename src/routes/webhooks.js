'use strict';
/**
 * Webhook des services d'envoi : remise effective, rebonds, plaintes spam.
 * URL à déclarer chez le service : https://votre-domaine/webhooks/email?token=<EMAIL_WEBHOOK_TOKEN>
 * Formats reconnus : Brevo, SendGrid, Mailgun, Postmark, et un format générique
 * { "message_id": "...", "event": "delivered|bounced|deferred|complained", "reason": "..." }.
 */
const express = require('express');
const crypto = require('crypto');
const { recordDeliveryEvent } = require('../lib/mailer');

const router = express.Router();
router.use(express.json({ limit: '1mb', type: ['application/json', 'application/*+json'] }));

const MAP = {
  delivered: 'delivered', delivery: 'delivered',
  deferred: 'deferred', deferral: 'deferred', soft_bounce: 'deferred', softbounce: 'deferred',
  hard_bounce: 'bounced', hardbounce: 'bounced', bounce: 'bounced', bounced: 'bounced', blocked: 'bounced',
  invalid_email: 'bounced', dropped: 'bounced', error: 'bounced', rejected: 'bounced',
  spam: 'complained', complaint: 'complained', spamcomplaint: 'complained', complained: 'complained'
};

function normalize(e) {
  // Mailgun
  if (e['event-data']) {
    const d = e['event-data'];
    let status = MAP[String(d.event || '').toLowerCase()];
    if (d.event === 'failed') status = d.severity === 'temporary' ? 'deferred' : 'bounced';
    return { messageId: d.message && d.message.headers && d.message.headers['message-id'], status, raw: d.event,
      detail: d['delivery-status'] && (d['delivery-status'].description || d['delivery-status'].message) };
  }
  const raw = e.event || e.RecordType || e.type || '';
  return {
    messageId: e['message-id'] || e['Message-Id'] || e['smtp-id'] || e.message_id || e.messageId || e.MessageID,
    status: MAP[String(raw).toLowerCase().replace(/\s+/g, '')],
    raw,
    detail: e.reason || e.Description || e.Details || e.response || ''
  };
}

router.post('/email', (req, res) => {
  const expected = process.env.EMAIL_WEBHOOK_TOKEN;
  const given = String(req.query.token || req.get('x-webhook-token') || '');
  if (!expected) return res.status(404).json({ ok: false, error: 'webhook disabled' });
  const a = Buffer.from(expected), b = Buffer.from(given);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ ok: false });
  const events = Array.isArray(req.body) ? req.body : [req.body];
  let matched = 0;
  for (const e of events.slice(0, 500)) {
    if (!e || typeof e !== 'object') continue;
    const n = normalize(e);
    if (recordDeliveryEvent(n.messageId, n.status, n.detail, n.raw)) matched++;
  }
  res.json({ ok: true, received: events.length, matched });
});

module.exports = router;
