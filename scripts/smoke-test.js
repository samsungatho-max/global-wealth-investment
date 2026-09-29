'use strict';
/**
 * Test de bout en bout : lance l'application sur une base temporaire et parcourt
 * les parcours investisseur et administrateur réels (HTTP, sessions, CSRF, base de données).
 * Usage : npm run check
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gwi-test-'));
process.env.DATA_DIR = tmp;
process.env.ADMIN_EMAIL = 'admin@example.test';
process.env.ADMIN_PASSWORD = 'AdminTest12345';
process.env.PORT = '0';
process.env.MAIL_FROM = 'Global Wealth Investment <no-reply@globalwealth-test.fr>';
process.env.EMAIL_WEBHOOK_TOKEN = 'jeton-webhook-test-0123456789';

// ---------- Serveur SMTP local : simule le service d'envoi ----------
// Accepte Gmail / Outlook / Yahoo ; refuse « rejete@… » (550) ; « temporaire@… » échoue une fois (451) puis réussit.
const { SMTPServer } = require('smtp-server');
const inbox = [];
const tempFailed = new Set();
const smtp = new SMTPServer({
  authOptional: true,
  disabledCommands: ['STARTTLS'],
  logger: false,
  onRcptTo(address, session, cb) {
    const a = address.address.toLowerCase();
    if (a.startsWith('rejete@')) return cb(Object.assign(new Error('5.1.1 <' + a + '>: Recipient address rejected: User unknown'), { responseCode: 550 }));
    if (a.startsWith('temporaire@') && !tempFailed.has(a)) { tempFailed.add(a); return cb(Object.assign(new Error('4.7.1 Try again later'), { responseCode: 451 })); }
    cb();
  },
  onData(stream, session, cb) {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => {
      inbox.push({ to: session.envelope.rcptTo.map((r) => r.address.toLowerCase()), from: session.envelope.mailFrom.address, raw: Buffer.concat(chunks).toString('utf8') });
      cb(null, 'Message queued as TEST' + inbox.length);
    });
  }
});

/** Décode un message brut (quoted-printable / base64) pour y retrouver le code. */
function decodeRaw(raw) {
  const qp = raw.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
  const b64 = (raw.match(/\r?\n\r?\n([A-Za-z0-9+/=\r\n]{40,})/g) || []).map((b) => Buffer.from(b.replace(/\s/g, ''), 'base64').toString('utf8'));
  return [qp, ...b64].join('\n');
}
function lastCodeFor(email) {
  const msg = [...inbox].reverse().find((m) => m.to.includes(email));
  if (!msg) return null;
  const m = decodeRaw(msg.raw).match(/letter-spacing:8px;color:#0a1628;">(\d{6})</);
  return m ? m[1] : null;
}

let app, one, run, totp;

let base;
const results = [];
function step(name) { results.push(name); console.log('  ✓', name); }

class Client {
  constructor() { this.cookie = ''; this.csrf = ''; }
  async req(method, url, body, { multipart } = {}) {
    const headers = { cookie: this.cookie };
    let payload;
    if (body && multipart) {
      payload = new FormData();
      for (const [k, v] of Object.entries(body)) { if (v instanceof Blob) payload.append(k, v, v.type === 'application/pdf' ? 'document.pdf' : 'page.html'); else payload.append(k, v); }
    } else if (body) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
      payload = new URLSearchParams(body).toString();
    }
    const res = await fetch(base + url, { method, headers, body: payload, redirect: 'manual' });
    const set = res.headers.getSetCookie();
    for (const c of set) if (c.startsWith('gwi.sid=')) this.cookie = c.split(';')[0];
    const text = await res.text();
    const m = text.match(/name="_csrf" value="([^"]+)"/);
    if (m) this.csrf = m[1];
    return { status: res.status, location: res.headers.get('location'), text };
  }
  get(url) { return this.req('GET', url); }
  post(url, body = {}, opts) { return this.req('POST', url, { _csrf: this.csrf, ...body }, opts); }
}

const pdf = () => new Blob([Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF')], { type: 'application/pdf' });

async function main() {
  await new Promise((r) => smtp.listen(0, '127.0.0.1', r));
  process.env.SMTP_HOST = '127.0.0.1';
  process.env.SMTP_PORT = String(smtp.server.address().port);
  process.env.SMTP_SECURE = 'false';
  app = require('../src/server');
  ({ one, run } = require('../src/db'));
  totp = require('../src/lib/totp');

  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  console.log('Base de test :', tmp);

  // ---------- Pages publiques ----------
  const pub = new Client();
  for (const u of ['/', '/opportunities', '/simulator', '/news', '/contact', '/page/legal', '/page/risks', '/?lang=en', '/?lang=es', '/?lang=de']) {
    assert.strictEqual((await pub.get(u)).status, 200, u);
  }
  assert.match((await pub.get('/?lang=de')).text, /Mein Anlegerkonto erstellen/);
  assert.match((await pub.get('/?lang=fr')).text, /Chaque investissement mérite une vision/);
  step('Pages publiques accessibles dans les 4 langues');

  const homeFr = (await pub.get('/?lang=fr')).text;
  const photoUrls = [...new Set(homeFr.match(/\/static\/img\/photos\/[a-z0-9-]+\.webp/g))];
  assert.ok(photoUrls.length >= 12, 'photos présentes sur l’accueil');
  for (const u of photoUrls) {
    const res = await fetch(base + u);
    assert.strictEqual(res.status, 200, u);
    assert.strictEqual(res.headers.get('content-type'), 'image/webp', u);
  }
  assert.match(homeFr, /Photo d’illustration/);
  const credits = await pub.get('/credits');
  assert.strictEqual(credits.status, 200);
  assert.ok((credits.text.match(/\/ Unsplash/g) || []).length >= 18, 'crédits de chaque photo');
  step('Photos WebP servies, signalées comme illustrations et créditées');

  const home = await pub.get('/opportunities');
  assert.match(home.text, /projet fictif/);
  assert.doesNotMatch(home.text, /garanti[e]? de \d/i);
  step('Fiches de démonstration clairement marquées comme fictives');

  // CSRF
  const noCsrf = await fetch(base + '/contact', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: pub.cookie }, body: 'subject=x&body=y', redirect: 'manual' });
  assert.strictEqual(noCsrf.status, 403);
  step('Requête sans jeton CSRF rejetée (403)');

  // ---------- Inscription + vérification e-mail ----------
  const inv = new Client();
  await inv.get('/register');
  let r = await inv.post('/register', { full_name: 'Marie Dupont', email: 'marie.dupont@gmail.com', country: 'FR', phone: '+33 6 12 34 56 78', password: 'short', password_confirm: 'short', accept: 'on' });
  assert.strictEqual(r.status, 400);
  r = await inv.post('/register', { full_name: 'Marie Dupont', email: 'marie.dupont@gmail.com', country: 'FR', phone: '+33 6 12 34 56 78', password: 'MotDePasse2026', password_confirm: 'MotDePasse2026', accept: 'on' });
  assert.strictEqual(r.location, '/verify-email');
  assert.strictEqual((await inv.get('/account')).location, '/verify-email');
  // Étapes 1-2 : code généré, e-mail accepté par le serveur SMTP (Gmail)
  const marieId = one('SELECT id FROM users WHERE email = ?', 'marie.dupont@gmail.com').id;
  let log = one(`SELECT * FROM email_log WHERE user_id = ? AND kind = 'verify_code' ORDER BY id DESC`, marieId);
  assert.strictEqual(log.status, 'relay_accepted', 'e-mail accepté par le serveur SMTP');
  assert.match(log.smtp_response, /250/);
  const code1 = lastCodeFor('marie.dupont@gmail.com');
  assert.match(code1, /^\d{6}$/, 'code reçu dans la boîte (serveur SMTP)');
  const mailMsg = inbox[inbox.length - 1];
  assert.strictEqual(mailMsg.from, 'no-reply@globalwealth-test.fr');
  assert.match(mailMsg.raw, /Content-Type: text\/plain/);
  assert.match(mailMsg.raw, /Content-Type: text\/html/);
  assert.match(mailMsg.raw, /Message-ID: <[a-f0-9]+@globalwealth-test\.fr>/i);
  assert.ok(!one('SELECT code_hash FROM email_verifications WHERE user_id = ?', marieId).code_hash.includes(code1), 'code jamais stocké en clair');
  let page = await inv.get('/verify-email');
  assert.match(page.text, /Un code de confirmation a été envoyé à m•••@gmail\.com/);
  assert.ok(!page.text.includes(code1), 'le code n’apparaît jamais dans la page');
  step('Inscription (Gmail) : code généré, stocké haché, e-mail texte + HTML accepté par le serveur SMTP');

  // Mauvais code, puis renvoi : délai minimal, nouveau code différent, ancien code invalidé
  r = await inv.post('/verify-email', { code: code1 === '000000' ? '111111' : '000000' });
  assert.strictEqual(r.status, 400);
  assert.match(r.text, /Il vous reste 4 essai/);
  await inv.post('/verify-email/resend');
  assert.match((await inv.get('/verify-email')).text, /patienter \d+ secondes/);
  assert.strictEqual(one('SELECT COUNT(*) AS n FROM email_verifications WHERE user_id = ?', marieId).n, 1, 'pas de renvoi avant 60 s');
  run(`UPDATE email_verifications SET created_at = datetime('now', '-2 minutes') WHERE user_id = ?`, marieId);
  await inv.get('/verify-email');
  await inv.post('/verify-email/resend');
  const code2 = lastCodeFor('marie.dupont@gmail.com');
  assert.notStrictEqual(code2, code1, 'le nouveau code est différent');
  page = await inv.get('/verify-email');
  assert.match(page.text, /Un nouveau code vous a été envoyé/);
  assert.ok(!page.text.includes(code2));
  r = await inv.post('/verify-email', { code: code1 });
  assert.strictEqual(r.status, 400, 'l’ancien code est invalidé');
  r = await inv.post('/verify-email', { code: code2 });
  assert.strictEqual(r.location, '/account');
  assert.strictEqual((await inv.get('/account')).status, 200);
  step('« Renvoyer le code » : délai de 60 s, nouveau code différent, ancien code invalidé, compte confirmé');

  // Expiration
  const exp = new Client();
  await exp.get('/register');
  await exp.post('/register', { full_name: 'Jean Martin', email: 'jean.martin@outlook.com', country: 'FR', phone: '+33 6 11 22 33 44', password: 'MotDePasse2026', password_confirm: 'MotDePasse2026', accept: 'on' });
  const jeanId = one('SELECT id FROM users WHERE email = ?', 'jean.martin@outlook.com').id;
  assert.strictEqual(one(`SELECT status FROM email_log WHERE user_id = ? AND kind = 'verify_code'`, jeanId).status, 'relay_accepted');
  const jeanCode = lastCodeFor('jean.martin@outlook.com');
  run(`UPDATE email_verifications SET expires_at = datetime('now', '-1 minute') WHERE user_id = ?`, jeanId);
  await exp.get('/verify-email');
  r = await exp.post('/verify-email', { code: jeanCode });
  assert.match(r.text, /a expiré/);
  run(`UPDATE email_verifications SET created_at = datetime('now', '-2 minutes') WHERE user_id = ?`, jeanId);
  await exp.post('/verify-email/resend');
  r = await exp.post('/verify-email', { code: lastCodeFor('jean.martin@outlook.com') });
  assert.strictEqual(r.location, '/account');
  step('Parcours Outlook : e-mail accepté, code expiré refusé, nouveau code accepté');

  // Refus définitif (550) : pas de faux « succès », erreur enregistrée et visible
  const rej = new Client();
  await rej.get('/register');
  await rej.post('/register', { full_name: 'Paul Rejet', email: 'rejete@hotmail.com', country: 'FR', phone: '+33 6 00 00 00 01', password: 'MotDePasse2026', password_confirm: 'MotDePasse2026', accept: 'on' });
  log = one(`SELECT * FROM email_log WHERE to_email = 'rejete@hotmail.com'`);
  assert.strictEqual(log.status, 'failed');
  assert.match(log.error, /550/);
  assert.strictEqual(log.attempts, 1, 'erreur définitive : pas de nouvelle tentative');
  assert.match((await rej.get('/verify-email')).text, /n’a pas pu être envoyé/);
  // Erreur temporaire (451) : nouvelle tentative automatique puis succès
  const tmpc = new Client();
  await tmpc.get('/register');
  await tmpc.post('/register', { full_name: 'Anne Temp', email: 'temporaire@yahoo.fr', country: 'FR', phone: '+33 6 00 00 00 02', password: 'MotDePasse2026', password_confirm: 'MotDePasse2026', accept: 'on' });
  log = one(`SELECT * FROM email_log WHERE to_email = 'temporaire@yahoo.fr'`);
  assert.strictEqual(log.status, 'relay_accepted');
  assert.strictEqual(log.attempts, 2);
  // Aucun SMTP configuré (cause du problème initial) : statut « non envoyé », jamais « envoyé »
  const savedHost = process.env.SMTP_HOST;
  delete process.env.SMTP_HOST;
  const nos = new Client();
  await nos.get('/register');
  await nos.post('/register', { full_name: 'Sans Smtp', email: 'sans.smtp@gmail.com', country: 'FR', phone: '+33 6 00 00 00 03', password: 'MotDePasse2026', password_confirm: 'MotDePasse2026', accept: 'on' });
  assert.strictEqual(one(`SELECT status FROM email_log WHERE to_email = 'sans.smtp@gmail.com'`).status, 'not_sent');
  assert.match((await nos.get('/verify-email')).text, /n’a pas pu être envoyé/);
  process.env.SMTP_HOST = savedHost;
  step('Erreurs d’envoi : refus 550 et absence de SMTP signalés ; erreur 451 retentée automatiquement');

  // Webhook du service d'envoi : remise effective chez le destinataire
  const delivered = one(`SELECT message_id FROM email_log WHERE to_email = 'jean.martin@outlook.com' ORDER BY id DESC`).message_id;
  let wh = await fetch(base + '/webhooks/email?token=mauvais', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event: 'delivered', 'message-id': `<${delivered}>` }) });
  assert.strictEqual(wh.status, 401);
  wh = await fetch(base + '/webhooks/email?token=' + process.env.EMAIL_WEBHOOK_TOKEN, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event: 'delivered', 'message-id': `<${delivered}>`, email: 'jean.martin@outlook.com' }) });
  assert.strictEqual((await wh.json()).matched, 1);
  assert.strictEqual(one('SELECT status FROM email_log WHERE message_id = ?', delivered).status, 'delivered');
  const bouncedId = one(`SELECT message_id FROM email_log WHERE to_email = 'temporaire@yahoo.fr'`).message_id;
  await fetch(base + '/webhooks/email?token=' + process.env.EMAIL_WEBHOOK_TOKEN, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify([{ event: 'hard_bounce', 'message-id': bouncedId, reason: 'mailbox full' }]) });
  assert.strictEqual(one('SELECT status FROM email_log WHERE message_id = ?', bouncedId).status, 'bounced');
  step('Webhook de remise : « remis » et « rebond » enregistrés, jeton obligatoire');

  // Dépôt refusé tant que KYC non validé / fonds désactivés
  r = await inv.get('/account/deposit');
  assert.match(r.text, /pas encore ouverte/);
  step('Dépôts bloqués tant que la réception de fonds n\'est pas activée');

  // ---------- KYC ----------
  await inv.get('/account/kyc');
  r = await inv.post('/account/kyc', { doc_type: 'passport', id_file: pdf(), address_file: pdf() }, { multipart: true });
  assert.strictEqual(r.status, 302);
  assert.strictEqual(one('SELECT kyc_status FROM users WHERE email = ?', 'marie.dupont@gmail.com').kyc_status, 'pending');
  const bad = await inv.post('/account/kyc', { doc_type: 'passport', id_file: new Blob(['x'], { type: 'text/html' }), address_file: pdf() }, { multipart: true });
  assert.ok([302, 400].includes(bad.status));
  step('Soumission KYC avec documents privés');

  // ---------- Administration ----------
  const adm = new Client();
  await adm.get('/admin/login');
  r = await adm.post('/admin/login', { email: 'marie.dupont@gmail.com', password: 'MotDePasse2026' });
  assert.strictEqual(r.status, 401, 'un investisseur ne peut pas se connecter à l\'admin');
  r = await adm.post('/admin/login', { email: 'admin@example.test', password: 'AdminTest12345' });
  assert.strictEqual(r.location, '/admin');
  assert.strictEqual((await adm.get('/admin')).status, 200);
  assert.strictEqual((await inv.get('/admin')).status, 403);
  step('Connexion administrateur distincte ; investisseur refusé sur /admin');

  // ---------- E-mails / Journal d'envoi ----------
  let ep = await adm.get('/admin/emails');
  assert.strictEqual(ep.status, 200);
  assert.match(ep.text, /Journal d'envoi/);
  assert.match(ep.text, /rejete@hotmail\.com/);
  assert.match(ep.text, /Recipient address rejected/);
  assert.match(ep.text, /Non envoyé/);
  assert.ok(!ep.text.includes(lastCodeFor('marie.dupont@gmail.com')), 'aucun code dans le journal');
  await adm.post('/admin/emails/verify-connection');
  assert.match((await adm.get('/admin/emails')).text, /Connexion et authentification SMTP réussies/);
  const before = inbox.length;
  r = await adm.post('/admin/emails/test', { to: 'controle.envoi@gmail.com' });
  assert.match(r.location, /^\/admin\/emails\/\d+$/);
  assert.strictEqual(inbox.length, before + 1);
  assert.strictEqual(one(`SELECT status FROM email_log WHERE kind = 'test' ORDER BY id DESC`).status, 'relay_accepted');
  assert.match((await adm.get(r.location)).text, /E-mail de test accepté par le serveur SMTP/);
  await adm.post('/admin/emails/test', { to: 'rejete@outlook.com' });
  assert.strictEqual(one(`SELECT status FROM email_log WHERE kind = 'test' ORDER BY id DESC`).status, 'failed');
  const rejId = one(`SELECT id FROM users WHERE email = 'rejete@hotmail.com'`).id;
  run(`UPDATE email_verifications SET created_at = datetime('now', '-2 minutes') WHERE user_id = ?`, rejId);
  await adm.get(`/admin/users/${rejId}`);
  await adm.post(`/admin/users/${rejId}/resend-code`);
  assert.match((await adm.get(`/admin/users/${rejId}`)).text, /e-mail NON envoyé \(failed\)/);
  step('Admin : journal d’envoi avec erreurs du serveur, test SMTP, e-mail de test, renvoi du code');

  const kyc = one(`SELECT id FROM kyc_submissions WHERE status = 'pending'`);
  await adm.get('/admin/kyc');
  assert.strictEqual((await adm.get(`/admin/kyc/${kyc.id}/file/id`)).status, 200);
  await adm.post(`/admin/kyc/${kyc.id}/review`, { decision: 'approve' });
  const marie = one('SELECT * FROM users WHERE email = ?', 'marie.dupont@gmail.com');
  assert.strictEqual(marie.kyc_status, 'approved');
  step('Validation KYC par l\'administrateur');

  await adm.get('/admin/settings');
  r = await adm.post('/admin/settings/general', { site_name: 'Global Wealth Investment', lang_fr: 'on', lang_en: 'on', lang_es: 'on', lang_de: 'on', cur_USD: 'on', cur_GBP: 'on', cur_XOF: 'on', funds_enabled: 'on' });
  assert.strictEqual(one(`SELECT value FROM settings WHERE key = 'funds_enabled'`), undefined, 'activation impossible sans confirmation réglementaire');
  await adm.post('/admin/settings/general', { site_name: 'Global Wealth Investment', lang_fr: 'on', lang_en: 'on', lang_es: 'on', lang_de: 'on', cur_USD: 'on', cur_GBP: 'on', cur_XOF: 'on', funds_enabled: 'on', funds_ack: 'on' });
  step('Réception de fonds activable uniquement avec confirmation réglementaire');

  // ---------- Dépôt ----------
  await inv.get('/account/deposit');
  r = await inv.post('/account/deposit', { amount: '5 000,00' });
  const depRef = r.location.split('/').pop();
  assert.match(depRef, /^DEP-\d{8}-[A-Z0-9]{6}$/);
  assert.strictEqual((await inv.get(r.location)).status, 200);
  const dep = one('SELECT * FROM transactions WHERE reference = ?', depRef);
  assert.strictEqual(dep.status, 'pending');
  assert.strictEqual(require('../src/lib/ledger').cashBalance(marie.id), 0, 'dépôt non crédité avant vérification');
  step('Demande de dépôt : référence unique, non créditée avant vérification');

  await adm.get('/admin/transactions');
  await adm.post(`/admin/transactions/${dep.id}/action`, { action: 'confirm', external_ref: '' });
  assert.strictEqual(one('SELECT status FROM transactions WHERE id = ?', dep.id).status, 'pending', 'confirmation impossible sans contrôle');
  await adm.post(`/admin/transactions/${dep.id}/action`, { action: 'confirm', external_ref: 'RELEVE-2026-09-001', verified: 'on' });
  assert.strictEqual(one('SELECT status FROM transactions WHERE id = ?', dep.id).status, 'confirmed');
  assert.strictEqual(require('../src/lib/ledger').cashBalance(marie.id), 500000);
  step('Confirmation du dépôt après contrôle effectif (référence bancaire obligatoire)');

  // ---------- Projet réel + investissement ----------
  await adm.get('/admin/projects/new');
  r = await adm.post('/admin/projects', { sector: 'energy', country: 'Maroc', risk_level: '3', target: '200000', min_ticket: '1000', duration_months: '24', title_fr: 'Parc solaire de test', summary_fr: 'Résumé', description_fr: 'Description', conditions_fr: 'Conditions', fees_fr: 'Frais' }, { multipart: true });
  const projectId = Number(r.location.match(/projects\/(\d+)/)[1]);
  await adm.get(r.location);
  await adm.post(`/admin/projects/${projectId}/status`, { status: 'open' });
  await adm.get(`/admin/users/${marie.id}`);
  const demo = one('SELECT id FROM projects WHERE is_demo = 1 LIMIT 1');
  await adm.post(`/admin/users/${marie.id}/investments`, { project_id: String(demo.id), amount: '1000', start_date: '2026-01-01', end_date: '2027-01-01' });
  assert.strictEqual(one('SELECT COUNT(*) AS n FROM investments').n, 0, 'aucun investissement possible dans une démo');
  await adm.post(`/admin/users/${marie.id}/investments`, { project_id: String(projectId), amount: '9000', start_date: '2026-01-01', end_date: '2028-01-01' });
  assert.strictEqual(one('SELECT COUNT(*) AS n FROM investments').n, 0, 'solde insuffisant refusé');
  await adm.post(`/admin/users/${marie.id}/investments`, { project_id: String(projectId), amount: '3000', start_date: '2026-01-01', end_date: '2028-01-01' });
  const invRow = one('SELECT * FROM investments WHERE user_id = ?', marie.id);
  assert.strictEqual(invRow.amount_cents, 300000);
  assert.strictEqual(require('../src/lib/ledger').cashBalance(marie.id), 200000);
  assert.match((await pub.get('/opportunities/parc-solaire-de-test')).text, /1,5\s?%/);
  step('Investissement enregistré, solde débité, montant mobilisé calculé depuis la base');

  await adm.post(`/admin/investments/${invRow.id}/valuations`, { value: '3150', date: '2026-06-30', note: 'Rapport semestriel' });
  const dash = (await inv.get('/account')).text;
  assert.match(dash, /3\s?150,00\s?€/);
  assert.match(dash, /\+5,00\s?%/);
  step('Valorisation datée visible dans le tableau de bord investisseur');

  // ---------- Retrait ----------
  await inv.get('/account/withdraw');
  r = await inv.post('/account/withdraw', { amount: '500', holder: 'Jean Martin', iban: 'FR7630006000011234567890189', bank: 'Banque' });
  assert.match(r.text, /titulaire du compte doit correspondre/i);
  r = await inv.post('/account/withdraw', { amount: '500', holder: 'Marie Dupont', iban: 'FR7630006000011234567890188', bank: 'Banque' });
  assert.match(r.text, /Numéro de compte invalide/);
  r = await inv.post('/account/withdraw', { amount: '5000', holder: 'Marie Dupont', iban: 'FR7630006000011234567890189', bank: 'Banque' });
  assert.match(r.text, /supérieur à votre solde/);
  r = await inv.post('/account/withdraw', { amount: '500', holder: 'MARIE DUPONT', iban: 'FR76 3000 6000 0112 3456 7890 189', bank: 'Banque' });
  assert.strictEqual(r.status, 302);
  const wdr = one(`SELECT * FROM transactions WHERE type = 'withdrawal'`);
  assert.strictEqual(require('../src/lib/ledger').availableBalance(marie.id), 150000);
  await adm.post(`/admin/transactions/${wdr.id}/action`, { action: 'confirm', external_ref: 'VIR-OUT-1', verified: 'on' });
  assert.strictEqual(require('../src/lib/ledger').cashBalance(marie.id), 150000);
  step('Retrait : contrôle titulaire / IBAN / solde, puis exécution confirmée');

  // Le client ne peut pas modifier son solde : aucune route ne l'expose
  r = await inv.post('/account/transactions/' + dep.id + '/cancel');
  assert.strictEqual(one('SELECT status FROM transactions WHERE id = ?', dep.id).status, 'confirmed');
  step('Le client ne peut pas modifier une transaction confirmée');

  // ---------- Journal d'audit inaltérable ----------
  assert.ok(one('SELECT COUNT(*) AS n FROM audit_log').n >= 8);
  assert.throws(() => run('UPDATE audit_log SET action = ? WHERE id = 1', 'x'), /append-only/);
  assert.throws(() => run('DELETE FROM audit_log'), /append-only/);
  step('Journal d\'audit : modification et suppression refusées par la base');

  // ---------- Verrouillage après échecs ----------
  const brute = new Client();
  await brute.get('/login');
  for (let i = 0; i < 5; i++) await brute.post('/login', { email: 'marie.dupont@gmail.com', password: 'wrong-password-1' });
  r = await brute.post('/login', { email: 'marie.dupont@gmail.com', password: 'MotDePasse2026' });
  assert.strictEqual(r.status, 429);
  run(`DELETE FROM login_attempts WHERE email = 'marie.dupont@gmail.com'`);
  step('Blocage temporaire après 5 échecs de connexion');

  // ---------- Mot de passe oublié ----------
  const fp = new Client();
  await fp.get('/forgot-password');
  await fp.post('/forgot-password', { email: 'marie.dupont@gmail.com' });
  assert.strictEqual(one(`SELECT status FROM email_log WHERE kind = 'password_reset' ORDER BY id DESC`).status, 'relay_accepted');
  const code = lastCodeFor('marie.dupont@gmail.com');
  await fp.get('/reset-password');
  r = await fp.post('/reset-password', { email: 'marie.dupont@gmail.com', code: '000000', password: 'NouveauMotDePasse1', password_confirm: 'NouveauMotDePasse1' });
  assert.strictEqual(r.status, 400);
  r = await fp.post('/reset-password', { email: 'marie.dupont@gmail.com', code, password: 'NouveauMotDePasse1', password_confirm: 'NouveauMotDePasse1' });
  assert.strictEqual(r.location, '/login');
  assert.strictEqual((await inv.get('/account')).location, '/login', 'anciennes sessions invalidées');
  step('Réinitialisation par code e-mail ; anciennes sessions révoquées');

  // ---------- 2FA ----------
  const tf = new Client();
  await tf.get('/login');
  await tf.post('/login', { email: 'marie.dupont@gmail.com', password: 'NouveauMotDePasse1' });
  await tf.get('/account/security');
  await tf.post('/account/security/2fa/start');
  const setupPage = await tf.get('/account/security');
  const secret = setupPage.text.match(/class="mono"[^>]*>([A-Z2-7 ]+)</)[1].replace(/\s/g, '');
  const now = Math.floor(Date.now() / 30000);
  await tf.post('/account/security/2fa/confirm', { code: totp.hotp(secret, now) });
  assert.strictEqual(one('SELECT totp_enabled FROM users WHERE id = ?', marie.id).totp_enabled, 1);
  const tf2 = new Client();
  await tf2.get('/login');
  r = await tf2.post('/login', { email: 'marie.dupont@gmail.com', password: 'NouveauMotDePasse1' });
  assert.strictEqual(r.location, '/login/2fa');
  await tf2.get('/login/2fa');
  r = await tf2.post('/login/2fa', { code: '123456' === totp.hotp(secret, now) ? '654321' : '123456' });
  assert.strictEqual(r.status, 401);
  r = await tf2.post('/login/2fa', { code: totp.hotp(secret, now) });
  assert.strictEqual(r.location, '/account');
  step('Authentification à deux facteurs (TOTP) activée et exigée à la connexion');

  // ---------- Mot de passe provisoire administrateur ----------
  run(`UPDATE users SET must_change_password = 1 WHERE email = 'admin@example.test'`);
  const first = new Client();
  await first.get('/admin/login');
  r = await first.post('/admin/login', { email: 'admin@example.test', password: 'AdminTest12345' });
  assert.strictEqual(r.location, '/admin');
  r = await first.get('/admin');
  assert.strictEqual(r.location, '/account/security#password', 'accès admin bloqué tant que le mot de passe provisoire n’est pas changé');
  assert.strictEqual((await first.get('/admin/users')).status, 302);
  assert.match((await first.get('/account/security')).text, /mot de passe provisoire/);
  r = await first.post('/account/security/password', { current: 'AdminTest12345', password: 'AdminTest12345', password_confirm: 'AdminTest12345' });
  assert.strictEqual(one(`SELECT must_change_password FROM users WHERE email = 'admin@example.test'`).must_change_password, 1, 'réutilisation refusée');
  await first.get('/account/security');
  r = await first.post('/account/security/password', { current: 'AdminTest12345', password: 'AdminDefinitif2026', password_confirm: 'AdminDefinitif2026' });
  assert.strictEqual(r.location, '/admin');
  assert.strictEqual((await first.get('/admin')).status, 200);
  step('Mot de passe provisoire : changement imposé avant tout accès à l’administration');

  // ---------- Notifications ----------
  assert.ok(one('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ?', marie.id).n >= 6);
  step('Notifications internes et e-mails générés à chaque opération');

  server.close();
  smtp.close();
  console.log(`\n${results.length} scénarios validés.`);
  require('../src/db').db.close();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* Windows : fichiers WAL encore verrouillés */ }
}

main().catch((e) => { console.error('\n✗ ÉCHEC :', e); process.exit(1); }).then(() => process.exit(0));
