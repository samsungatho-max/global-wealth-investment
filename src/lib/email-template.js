'use strict';
/**
 * Gabarit d'e-mail transactionnel : version texte + HTML.
 * HTML à base de tableaux et de styles en ligne (compatible Outlook, Gmail, Yahoo, Apple Mail),
 * sans image distante, sans suivi, sans JavaScript.
 */
const settings = require('./settings');
const { t } = require('../i18n');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * @param {object} o
 * @param {string} o.lang
 * @param {string} o.name        Nom du destinataire
 * @param {string[]} o.paragraphs Paragraphes (texte brut)
 * @param {string} [o.code]      Code à mettre en évidence
 * @param {{label:string,url:string}} [o.cta]
 * @param {string[]} [o.after]   Paragraphes après le code / bouton
 */
function render({ lang = 'fr', name, paragraphs = [], code, cta, after = [] }) {
  const site = settings.get('site_name');
  const company = settings.get('company');
  const greeting = t(lang, 'mail.greeting', { name: name || '' }).replace(/\s+,/, ',');
  const footer = [t(lang, 'mail.security_note'), t(lang, 'mail.automatic')];

  const text = [
    greeting, '',
    ...paragraphs.flatMap((p) => [p, '']),
    ...(code ? [`    ${code}`, ''] : []),
    ...(cta ? [`${cta.label} : ${cta.url}`, ''] : []),
    ...after.flatMap((p) => [p, '']),
    t(lang, 'mail.signature', { site }), '',
    '—', ...footer, company.legal_name && !/^\[/.test(company.legal_name) ? company.legal_name : site
  ].join('\n');

  const p = (s) => `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;">${esc(s)}</p>`;
  const html = `<!doctype html>
<html lang="${esc(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${esc(site)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:10px;">
    <tr><td style="background:#0a1628;padding:22px 28px;border-radius:10px 10px 0 0;">
      <span style="font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:bold;letter-spacing:1px;color:#ffffff;text-transform:uppercase;">Global Wealth</span>
      <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:3px;color:#d7bd8a;text-transform:uppercase;">&nbsp;Investment</span>
    </td></tr>
    <tr><td style="padding:30px 28px 10px;">
      ${p(greeting)}
      ${paragraphs.map(p).join('\n      ')}
      ${code ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 22px;"><tr><td style="background:#f7f3ea;border:1px solid #c9a96e;border-radius:8px;padding:14px 26px;font-family:'Courier New',Courier,monospace;font-size:30px;font-weight:bold;letter-spacing:8px;color:#0a1628;">${esc(code)}</td></tr></table>` : ''}
      ${cta ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 22px;"><tr><td style="background:#c9a96e;border-radius:6px;"><a href="${esc(cta.url)}" style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#0a1628;text-decoration:none;">${esc(cta.label)}</a></td></tr></table>` : ''}
      ${after.map(p).join('\n      ')}
      ${p(t(lang, 'mail.signature', { site }))}
    </td></tr>
    <tr><td style="padding:18px 28px 24px;border-top:1px solid #e5e7eb;">
      ${footer.map((f) => `<p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#6b7280;">${esc(f)}</p>`).join('')}
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
  return { text, html };
}

module.exports = { render };
