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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'globacor-test-'));
process.env.DATA_DIR = tmp;
process.env.KEEP_LANGUAGES = 'true'; // le passage du site public en anglais est contrôlé dans english-test.js
process.env.ADMIN_EMAIL = 'admin@example.test';
process.env.ADMIN_PASSWORD = 'AdminTest12345';
process.env.PORT = '0';
process.env.SEED_DEMO = 'true'; // fiches fictives : uniquement pour les tests, jamais créées par défaut
process.env.SEED_REFERENCED = 'false'; // les projets référencés sont contrôlés dans setup-test.js
process.env.MAIL_FROM = 'GLOBACOR Partners INC <no-reply@globacor-test.fr>';
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

/** Décode le quoted-printable en UTF-8 (pour vérifier les textes accentués des e-mails). */
const utf8 = (raw) => Buffer.from(raw.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16))), 'latin1').toString('utf8');

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

let app, one, all, run, totp;

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
    for (const c of set) if (c.startsWith('sx.sid=')) this.cookie = c.split(';')[0];
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
  ({ one, all, run } = require('../src/db'));
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

  // ---------- Identité : GLOBACOR Partners INC ----------
  for (const u of ['/', '/page/about', '/login', '/register', '/news', '/contact', '/credits', '/page/about?lang=en']) {
    const html = (await pub.get(u)).text;
    assert.match(html, /<title>[^<]*GLOBACOR Partners INC/, `titre de ${u}`);
    assert.ok(!/global wealth|synergix/i.test(html), `ancien nom absent de ${u}`);
    assert.strictEqual(html.split('<span class="brand-name">Globacor<small>Partners Inc</small></span>').length, 3, `logo en en-tête et pied de page de ${u}`);
    assert.match(html, /og:site_name" content="GLOBACOR Partners INC"/);
  }
  for (const f of ['/static/img/favicon.svg', '/static/site.webmanifest', '/static/img/brand/globacor-icone-180.png', '/static/img/brand/globacor-icone-512.png', '/static/img/brand/globacor-partage-1200x630.png', '/static/img/brand/globacor-logo-fond-clair.svg']) {
    assert.strictEqual((await pub.get(f)).status, 200, f);
  }
  assert.match((await pub.get('/static/site.webmanifest')).text, /"name": ?"GLOBACOR Partners INC"/);
  step('Nouveau nom et nouveau logo : titres, en-tête, pied de page, métadonnées, icônes');

  const homeFr = (await pub.get('/?lang=fr')).text;
  const photoUrls = [...new Set(homeFr.match(/\/static\/img\/photos\/[a-z0-9-]+\.webp/g))];
  assert.ok(photoUrls.length >= 12, 'photos présentes sur l’accueil');
  for (const u of photoUrls) {
    const res = await fetch(base + u);
    assert.strictEqual(res.status, 200, u);
    assert.strictEqual(res.headers.get('content-type'), 'image/webp', u);
  }
  assert.doesNotMatch(homeFr, /Photo d’illustration|Crédits photos|ph-label/, 'aucune étiquette sur les photos');
  step('Photos WebP servies, intégrées sans étiquette');

  const home = await pub.get('/opportunities');
  assert.match(home.text, /Projet exemple — simulation/);
  assert.doesNotMatch(home.text, /garanti[e]? de \d/i);
  step('Fiches de démonstration clairement marquées comme fictives');

  // ---------- Opportunités internationales : catégories, filtres, devise USD ----------
  const cards = (html) => (html.match(/<article class="card project-card">/g) || []).length;
  assert.strictEqual(cards(home.text), 16, '16 fiches exemple');
  assert.strictEqual((home.text.match(/chip-demo/g) || []).length, 16, 'chaque fiche exemple porte le bandeau « Projet exemple »');
  assert.match(home.text, /Opportunités internationales/);
  assert.match(home.text, /Découvrez des projets sélectionnés dans différents secteurs et marchés à travers le monde\./);
  assert.match(home.text, /45\s000\s000\s\$/, 'montants affichés en dollars par défaut');
  assert.doesNotMatch(home.text, /ds€/);
  for (const s of ['real_estate', 'commercial', 'agriculture', 'industry', 'energy', 'trade', 'infrastructure', 'tourism', 'technology', 'development']) {
    assert.ok(cards((await pub.get(`/opportunities?sector=${s}`)).text) >= 1, `catégorie ${s} illustrée`);
  }
  assert.strictEqual(cards((await pub.get('/opportunities?country=Canada')).text), 1);
  assert.strictEqual(cards((await pub.get('/opportunities?amount=a4')).text), 4, 'plus de 20 M$');
  assert.strictEqual(cards((await pub.get('/opportunities?risk=5')).text), 1);
  assert.strictEqual(cards((await pub.get('/opportunities?sector=commercial&risk=2&amount=a3')).text), 1);
  const none = await pub.get('/opportunities?sector=tourism&risk=1');
  assert.strictEqual(cards(none.text), 0);
  assert.match(none.text, /Aucun projet ne correspond à ces critères/);
  assert.strictEqual(cards((await pub.get('/opportunities?sector=x&amount=zz&risk=9&country=Nulle')).text), 16, 'filtres invalides ignorés');
  const sheet = await pub.get('/opportunities/exemple-complexe-hotelier');
  assert.match(sheet.text, /Projet exemple — simulation/);
  assert.match(sheet.text, /15\s000\s000,00\s\$/);
  assert.match(sheet.text, /hotel-1600\.webp/);
  assert.doesNotMatch(sheet.text, /id="interest"/, 'aucune souscription sur une fiche exemple');
  const homePage = await pub.get('/');
  assert.strictEqual(cards(homePage.text), 6);
  assert.match(homePage.text, /Opportunités internationales/);
  assert.match((await pub.get('/opportunities?lang=en&currency=USD')).text, /\$45,000,000</);
  step('Opportunités internationales : 10 catégories, filtres pays / secteur / montant / risque, dollars par défaut');

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
  const marieId = (await one('SELECT id FROM users WHERE email = ?', 'marie.dupont@gmail.com')).id;
  let log = await one(`SELECT * FROM email_log WHERE user_id = ? AND kind = 'verify_code' ORDER BY id DESC`, marieId);
  assert.strictEqual(log.status, 'relay_accepted', 'e-mail accepté par le serveur SMTP');
  assert.match(log.smtp_response, /250/);
  const code1 = lastCodeFor('marie.dupont@gmail.com');
  assert.match(code1, /^\d{6}$/, 'code reçu dans la boîte (serveur SMTP)');
  const mailMsg = inbox[inbox.length - 1];
  assert.strictEqual(mailMsg.from, 'no-reply@globacor-test.fr');
  assert.match(mailMsg.raw, /^From: "?GLOBACOR Partners INC"? </m);
  assert.match(mailMsg.raw, /quipe GLOBACOR Partners INC/, 'signature des e-mails');
  assert.ok(!/global wealth|synergix/i.test(mailMsg.raw), 'ancien nom absent des e-mails');
  assert.match(mailMsg.raw, /Content-Type: text\/plain/);
  assert.match(mailMsg.raw, /Content-Type: text\/html/);
  assert.match(mailMsg.raw, /Message-ID: <[a-f0-9]+@globacor-test\.fr>/i);
  assert.ok(!(await one('SELECT code_hash FROM email_verifications WHERE user_id = ?', marieId)).code_hash.includes(code1), 'code jamais stocké en clair');
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
  assert.strictEqual((await one('SELECT COUNT(*) AS n FROM email_verifications WHERE user_id = ?', marieId)).n, 1, 'pas de renvoi avant 60 s');
  await run(`UPDATE email_verifications SET created_at = datetime('now', '-2 minutes') WHERE user_id = ?`, marieId);
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
  const jeanId = (await one('SELECT id FROM users WHERE email = ?', 'jean.martin@outlook.com')).id;
  assert.strictEqual((await one(`SELECT status FROM email_log WHERE user_id = ? AND kind = 'verify_code'`, jeanId)).status, 'relay_accepted');
  const jeanCode = lastCodeFor('jean.martin@outlook.com');
  await run(`UPDATE email_verifications SET expires_at = datetime('now', '-1 minute') WHERE user_id = ?`, jeanId);
  await exp.get('/verify-email');
  r = await exp.post('/verify-email', { code: jeanCode });
  assert.match(r.text, /a expiré/);
  await run(`UPDATE email_verifications SET created_at = datetime('now', '-2 minutes') WHERE user_id = ?`, jeanId);
  await exp.post('/verify-email/resend');
  r = await exp.post('/verify-email', { code: lastCodeFor('jean.martin@outlook.com') });
  assert.strictEqual(r.location, '/account');
  step('Parcours Outlook : e-mail accepté, code expiré refusé, nouveau code accepté');

  // Refus définitif (550) : pas de faux « succès », erreur enregistrée et visible
  const rej = new Client();
  await rej.get('/register');
  await rej.post('/register', { full_name: 'Paul Rejet', email: 'rejete@hotmail.com', country: 'FR', phone: '+33 6 00 00 00 01', password: 'MotDePasse2026', password_confirm: 'MotDePasse2026', accept: 'on' });
  log = await one(`SELECT * FROM email_log WHERE to_email = 'rejete@hotmail.com'`);
  assert.strictEqual(log.status, 'failed');
  assert.match(log.error, /550/);
  assert.strictEqual(log.attempts, 1, 'erreur définitive : pas de nouvelle tentative');
  assert.match((await rej.get('/verify-email')).text, /n’a pas pu être envoyé/);
  // Erreur temporaire (451) : nouvelle tentative automatique puis succès
  const tmpc = new Client();
  await tmpc.get('/register');
  await tmpc.post('/register', { full_name: 'Anne Temp', email: 'temporaire@yahoo.fr', country: 'FR', phone: '+33 6 00 00 00 02', password: 'MotDePasse2026', password_confirm: 'MotDePasse2026', accept: 'on' });
  log = await one(`SELECT * FROM email_log WHERE to_email = 'temporaire@yahoo.fr'`);
  assert.strictEqual(log.status, 'relay_accepted');
  assert.strictEqual(log.attempts, 2);
  // Aucun SMTP configuré (cause du problème initial) : statut « non envoyé », jamais « envoyé »
  const savedHost = process.env.SMTP_HOST;
  delete process.env.SMTP_HOST;
  const nos = new Client();
  await nos.get('/register');
  await nos.post('/register', { full_name: 'Sans Smtp', email: 'sans.smtp@gmail.com', country: 'FR', phone: '+33 6 00 00 00 03', password: 'MotDePasse2026', password_confirm: 'MotDePasse2026', accept: 'on' });
  assert.strictEqual((await one(`SELECT status FROM email_log WHERE to_email = 'sans.smtp@gmail.com'`)).status, 'not_sent');
  assert.match((await nos.get('/verify-email')).text, /n’a pas pu être envoyé/);
  process.env.SMTP_HOST = savedHost;
  step('Erreurs d’envoi : refus 550 et absence de SMTP signalés ; erreur 451 retentée automatiquement');

  // Webhook du service d'envoi : remise effective chez le destinataire
  const delivered = (await one(`SELECT message_id FROM email_log WHERE to_email = 'jean.martin@outlook.com' ORDER BY id DESC`)).message_id;
  let wh = await fetch(base + '/webhooks/email?token=mauvais', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event: 'delivered', 'message-id': `<${delivered}>` }) });
  assert.strictEqual(wh.status, 401);
  wh = await fetch(base + '/webhooks/email?token=' + process.env.EMAIL_WEBHOOK_TOKEN, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event: 'delivered', 'message-id': `<${delivered}>`, email: 'jean.martin@outlook.com' }) });
  assert.strictEqual((await wh.json()).matched, 1);
  assert.strictEqual((await one('SELECT status FROM email_log WHERE message_id = ?', delivered)).status, 'delivered');
  const bouncedId = (await one(`SELECT message_id FROM email_log WHERE to_email = 'temporaire@yahoo.fr'`)).message_id;
  await fetch(base + '/webhooks/email?token=' + process.env.EMAIL_WEBHOOK_TOKEN, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify([{ event: 'hard_bounce', 'message-id': bouncedId, reason: 'mailbox full' }]) });
  assert.strictEqual((await one('SELECT status FROM email_log WHERE message_id = ?', bouncedId)).status, 'bounced');
  step('Webhook de remise : « remis » et « rebond » enregistrés, jeton obligatoire');

  // Dépôt refusé tant que KYC non validé / fonds désactivés
  r = await inv.get('/account/deposit');
  assert.match(r.text, /pas encore ouverte/);
  step('Dépôts bloqués tant que la réception de fonds n\'est pas activée');

  // ---------- KYC ----------
  await inv.get('/account/kyc');
  r = await inv.post('/account/kyc', { doc_type: 'passport', id_file: pdf(), address_file: pdf() }, { multipart: true });
  assert.strictEqual(r.status, 302);
  assert.strictEqual((await one('SELECT kyc_status FROM users WHERE email = ?', 'marie.dupont@gmail.com')).kyc_status, 'pending');
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

  // ---------- Page Contact : dépôt d'un dossier, numéro unique, e-mails, traitement par l'administration ----------
  const vis = new Client();
  let cp = await vis.get('/contact');
  assert.match(cp.text, /Présentez-nous votre projet/);
  assert.match(cp.text, /Chaque proposition fait l’objet d’une analyse préalable/);
  for (const s of ['Analyse des projets', 'Sélection des opportunités', 'Mise en relation', 'Je suis porteur d’un projet', 'Je recherche un financement', 'Je souhaite présenter une opportunité d’affaires', 'Je suis investisseur \\/ partenaire', 'Autre demande', 'Soumettre mon projet', 'Demander un accompagnement', 'Je certifie que les informations communiquées sont exactes']) {
    assert.match(cp.text, new RegExp(s), s);
  }
  const dossier = {
    motive: 'funding', full_name: 'Awa Koné', organisation: 'Koné Agro SARL', country: 'CI', city: 'Abidjan', email: 'awa.kone@outlook.com', phone: '+225 07 00 00 00 00',
    sector: 'agriculture', nature: 'Unité de transformation de mangues', amount: '750 000', own_funds: '120000', duration: '36',
    description: 'Construction d’une unité de séchage et de conditionnement de mangues destinée à l’export, avec 40 emplois prévus.',
    stage: 'plan', business_plan: 'yes', documents: 'no', website: 'kone-agro.example.org', certify: 'on'
  };
  r = await vis.post('/contact', { ...dossier, certify: '', amount: 'beaucoup', email: 'pas-un-email', phone: '' });
  assert.strictEqual(r.status, 400);
  assert.match(r.text, /Merci de vérifier les champs signalés/);
  assert.match(r.text, /value="Koné Agro SARL"/, 'saisie conservée après une erreur');
  assert.strictEqual(Number((await one('SELECT COUNT(*) AS n FROM requests')).n), 0);
  r = await vis.post('/contact', { ...dossier, fax_number: 'robot' });
  assert.strictEqual(Number((await one('SELECT COUNT(*) AS n FROM requests')).n), 0, 'envoi automatisé ignoré');
  await vis.get('/contact');
  const mailsBefore = inbox.length;
  r = await vis.post('/contact', dossier);
  assert.strictEqual(r.location, '/contact/confirmation');
  const saved = await one('SELECT * FROM requests');
  assert.match(saved.ref, /^GP-\d{4}-[A-Z2-9]{6}$/, 'numéro de dossier attribué');
  assert.strictEqual(saved.status, 'new');
  assert.strictEqual(Number(saved.amount_cents), 75000000);
  assert.strictEqual(Number(saved.own_funds_cents), 12000000);
  assert.strictEqual(saved.website, 'https://kone-agro.example.org/');
  assert.ok(saved.certified_at);
  const conf = await vis.get('/contact/confirmation');
  assert.ok(conf.text.includes(saved.ref), 'numéro affiché à l’écran');
  assert.match(conf.text, /La réception d’une demande ne constitue pas une acceptation de financement ni une promesse de rendement/);
  assert.match(conf.text, /Un e-mail de confirmation a été envoyé à awa\.kone@outlook\.com/);
  const newMails = inbox.slice(mailsBefore);
  const toClient = newMails.find((m) => m.to.includes('awa.kone@outlook.com'));
  assert.ok(toClient && decodeRaw(toClient.raw).includes(saved.ref), 'e-mail de confirmation avec le numéro de dossier');
  assert.ok(newMails.some((m) => m.to.includes('admin@example.test') && decodeRaw(m.raw).includes(saved.ref)), 'notification e-mail à l’administration');
  assert.ok(await one(`SELECT id FROM notifications WHERE message LIKE ? AND link = ?`, `%${saved.ref}%`, `/admin/requests/${saved.id}`), 'notification interne');
  // E-mail reçu par l'administration : toutes les informations saisies, sans omission
  const adminMail = utf8(newMails.find((m) => m.to.includes('admin@example.test')).raw);
  for (const s of ['Nouvelle demande reçue via le site', saved.ref, 'Awa Koné', 'Koné Agro SARL', 'Abidjan', 'awa.kone@outlook.com', '+225 07 00 00 00 00', 'Je recherche un financement',
    'Agriculture et agro-industrie', 'Unité de transformation de mangues', '750', '120', '36 mois', 'Dossier et business plan finalisés', 'unité de séchage et de conditionnement de mangues', 'https://kone-agro.example.org/', '(UTC)']) {
    assert.ok(adminMail.includes(s), `e-mail de notification : « ${s} »`);
  }
  assert.match(newMails.find((m) => m.to.includes('admin@example.test')).raw, /^Reply-To: awa\.kone@outlook\.com/mi, 'réponse directe au demandeur');
  // Adresse de réception configurée + documents joints transmis en pièces jointes
  await require('../src/lib/settings').set('notify_emails', 'direction@globacor-test.fr');
  await vis.get('/contact');
  const withFiles = inbox.length;
  r = await vis.post('/contact', { ...dossier, project_name: 'Mangue Export', email: 'awa.kone@outlook.com', attachments: pdf() }, { multipart: true });
  assert.strictEqual(r.location, '/contact/confirmation', 'envoi avec document joint : ' + r.status + ' ' + ((r.text.match(/alert-error[^>]*>([^<]*)/) || [])[1] || r.text.slice(0, 200)));
  const withDoc = await one(`SELECT * FROM requests WHERE project_name = 'Mangue Export'`);
  const att = JSON.parse(withDoc.attachments);
  assert.strictEqual(att.length, 1);
  assert.strictEqual(att[0].name, 'document.pdf');
  const toOwner = inbox.slice(withFiles).find((m) => m.to.includes('direction@globacor-test.fr'));
  assert.ok(toOwner, 'e-mail envoyé à l’adresse de réception configurée');
  assert.ok(!inbox.slice(withFiles).some((m) => m.to.includes('admin@example.test')), 'l’adresse configurée remplace les administrateurs');
  assert.match(toOwner.raw, /Content-Disposition: attachment; filename="?document\.pdf"?/i, 'document transmis en pièce jointe');
  assert.match(toOwner.raw, /Content-Type: application\/pdf/i);
  assert.ok(utf8(toOwner.raw).includes('Mangue Export') && utf8(toOwner.raw).includes('document.pdf'));
  const dl = await adm.get(`/admin/requests/${withDoc.id}/files/${att[0].id}`);
  assert.strictEqual(dl.status, 200, 'document téléchargeable par l’administration');
  assert.strictEqual((await vis.get(`/admin/requests/${withDoc.id}/files/${att[0].id}`)).status, 302, 'document inaccessible au public');
  // Type de fichier refusé : la demande n'est pas enregistrée et l'erreur est signalée
  await vis.get('/contact');
  r = await vis.post('/contact', { ...dossier, project_name: 'Refus', attachments: new Blob(['<html></html>'], { type: 'text/html' }) }, { multipart: true });
  assert.strictEqual(r.status, 400);
  assert.match(r.text, /Documents joints : 3 fichiers au maximum/);
  assert.ok(!(await one(`SELECT id FROM requests WHERE project_name = 'Refus'`)), 'aucune demande enregistrée avec un fichier refusé');
  // Panne d'envoi : la demande est conservée et l'échec est signalé à l'administration
  const smtpHost = process.env.SMTP_HOST;
  delete process.env.SMTP_HOST;
  require('../src/lib/mailer').reset && require('../src/lib/mailer').reset();
  await vis.get('/contact');
  r = await vis.post('/contact', { ...dossier, project_name: 'Sans SMTP' });
  process.env.SMTP_HOST = smtpHost;
  require('../src/lib/mailer').reset && require('../src/lib/mailer').reset();
  assert.strictEqual(r.location, '/contact/confirmation', 'aucun formulaire perdu, même sans envoi d’e-mail');
  const noMail = await one(`SELECT * FROM requests WHERE project_name = 'Sans SMTP'`);
  assert.ok(noMail, 'demande enregistrée malgré la panne d’envoi');
  assert.doesNotMatch((await vis.get('/contact/confirmation')).text, /Un e-mail de confirmation a été envoyé/, 'pas de fausse annonce d’e-mail');
  assert.match((await adm.get(`/admin/requests/${noMail.id}`)).text, /n&#39;a pas été envoyé|n'a pas été envoyé/, 'échec d’envoi signalé sur le dossier');
  await require('../src/lib/settings').set('notify_emails', '');
  await run(`DELETE FROM requests WHERE project_name IN ('Mangue Export', 'Sans SMTP')`);
  r = await vis.post('/contact', { motive: 'other', full_name: 'Jean Martin', country: 'FR', email: 'jean.martin@gmail.com', description: 'Bonjour, je souhaite un renseignement.', certify: 'on' });
  assert.strictEqual(r.location, '/contact/confirmation', 'une autre demande n’exige pas le dossier de financement');
  const refs = (await all('SELECT ref FROM requests')).map((x) => x.ref);
  assert.strictEqual(new Set(refs).size, 2, 'numéros uniques');
  assert.match((await adm.get('/admin')).text, /Nouvelles demandes/);
  let list = await adm.get('/admin/requests');
  assert.ok(list.text.includes(saved.ref) && list.text.includes('Jean Martin'));
  list = await adm.get('/admin/requests?q=' + encodeURIComponent('koné agro'));
  assert.ok(list.text.includes(saved.ref) && !list.text.includes('Jean Martin'), 'recherche');
  list = await adm.get('/admin/requests?motive=other');
  assert.ok(!list.text.includes(saved.ref) && list.text.includes('Jean Martin'), 'filtre par motif');
  assert.ok(!(await adm.get('/admin/requests?sector=energy')).text.includes(saved.ref), 'filtre par secteur');
  const detail = await adm.get(`/admin/requests/${saved.id}`);
  assert.match(detail.text, /750\s000,00\s\$/);
  assert.match(detail.text, /Unité de transformation de mangues/);
  const mailsUpd = inbox.length;
  r = await adm.post(`/admin/requests/${saved.id}`, { status: 'info_requested', admin_note: 'Dossier sérieux, demander le business plan.', message: 'Merci de nous transmettre votre business plan.' });
  assert.strictEqual(r.location, `/admin/requests/${saved.id}`);
  const upd = await one('SELECT * FROM requests WHERE id = ?', saved.id);
  assert.strictEqual(upd.status, 'info_requested');
  assert.strictEqual(upd.admin_note, 'Dossier sérieux, demander le business plan.');
  const upMail = inbox.slice(mailsUpd).find((m) => m.to.includes('awa.kone@outlook.com'));
  assert.ok(upMail && /business plan/.test(decodeRaw(upMail.raw)) && !/Dossier sérieux/.test(decodeRaw(upMail.raw)), 'message envoyé au demandeur, note interne non divulguée');
  assert.ok((await adm.get('/admin/requests?status=info_requested')).text.includes(saved.ref), 'filtre par statut');
  for (const s of ['review', 'forwarded', 'closed']) {
    await adm.get(`/admin/requests/${saved.id}`);
    await adm.post(`/admin/requests/${saved.id}`, { status: s });
    assert.strictEqual((await one('SELECT status FROM requests WHERE id = ?', saved.id)).status, s);
  }
  assert.strictEqual((await vis.get(`/admin/requests/${saved.id}`)).status, 302, 'dossiers réservés à l’administration');
  assert.ok(await one(`SELECT id FROM audit_log WHERE action = 'request.update'`), 'traitement journalisé');
  step('Contact : dossier enregistré, numéro unique, confirmation, e-mails, recherche, filtres et statuts côté administration');

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
  assert.strictEqual((await one(`SELECT status FROM email_log WHERE kind = 'test' ORDER BY id DESC`)).status, 'relay_accepted');
  assert.match((await adm.get(r.location)).text, /E-mail de test accepté par le serveur SMTP/);
  await adm.post('/admin/emails/test', { to: 'rejete@outlook.com' });
  assert.strictEqual((await one(`SELECT status FROM email_log WHERE kind = 'test' ORDER BY id DESC`)).status, 'failed');
  const rejId = (await one(`SELECT id FROM users WHERE email = 'rejete@hotmail.com'`)).id;
  await run(`UPDATE email_verifications SET created_at = datetime('now', '-2 minutes') WHERE user_id = ?`, rejId);
  await adm.get(`/admin/users/${rejId}`);
  await adm.post(`/admin/users/${rejId}/resend-code`);
  assert.match((await adm.get(`/admin/users/${rejId}`)).text, /e-mail NON envoyé \(failed\)/);
  step('Admin : journal d’envoi avec erreurs du serveur, test SMTP, e-mail de test, renvoi du code');

  // ---------- Actualités et rapports ----------
  const newsLib = require('../src/lib/news');
  const seeded = await all('SELECT * FROM news');
  assert.strictEqual(seeded.length, 9);
  for (const row of seeded) {
    const srcs = newsLib.parseSources(row.sources);
    assert.ok(srcs.length >= 1 && srcs.every((s) => /^https:\/\//.test(s.url) && /^\d{4}-\d{2}-\d{2}$/.test(s.date)), `source datée pour ${row.slug}`);
    for (const l of ['fr', 'en', 'es', 'de']) {
      const tr = JSON.parse(row.i18n)[l];
      assert.ok(tr.title && tr.summary && tr.body && tr.risks && tr.takeaways, `${row.slug} complet en ${l}`);
      assert.ok(newsLib.parseFigures(tr.figures).length >= 3, `chiffres clés ${row.slug} ${l}`);
      assert.ok(newsLib.parseFigures(tr.figures).every((f) => f.period), `période de référence ${row.slug} ${l}`);
    }
  }
  let np = await pub.get('/news?lang=fr');
  assert.strictEqual(np.status, 200);
  assert.match(np.text, /À la une/);
  assert.match(np.text, /À retenir pour les investisseurs/);
  assert.match(np.text, /l’indice FAO repart à la hausse/);
  np = await pub.get('/news?region=africa');
  assert.match(np.text, /Afrique 2026/);
  assert.doesNotMatch(np.text, /indice FAO repart/);
  np = await pub.get('/news?sector=energy&kind=report');
  assert.match(np.text, /Aucune publication ne correspond/);
  let art = await pub.get('/news/fao-indice-prix-alimentaires-septembre-2026');
  assert.strictEqual(art.status, 200);
  assert.match(art.text, /href="https:\/\/www\.fao\.org\/worldfoodsituation\/foodpricesindex\/en\/" target="_blank" rel="noopener noreferrer"/);
  assert.match(art.text, /136,0 points/);
  assert.match(art.text, /Période de référence/);
  assert.match(art.text, /class="chart"/);
  assert.match(art.text, /Perspectives, limites et risques/);
  assert.match(art.text, /Synthèse originale rédigée à partir des sources citées/);
  assert.match((await pub.get('/news/fao-indice-prix-alimentaires-septembre-2026?lang=en')).text, /136\.0 points/);
  assert.match((await pub.get('/?lang=fr')).text, /Actualités et rapports d’investissement internationaux/);
  step('Rubrique actualités : 9 publications sourcées et datées, 4 langues, filtres, chiffres clés, graphique');

  // Contrôle éditorial : pas de publication sans source ni vérification ; planification ; suppression
  const draft = { kind: 'news', region: 'europe', sector: 'real_estate', inv_type: 'markets', title_fr: 'Article de test éditorial', summary_fr: 'Résumé de test.', body_fr: 'Corps.', published: 'on', verified: 'on' };
  await adm.get('/admin/news/new');
  r = await adm.post('/admin/news', draft, { multipart: true });
  let testNews = await one(`SELECT * FROM news WHERE slug = 'article-de-test-editorial'`);
  assert.strictEqual(testNews.published, 0, 'refus de publier sans source');
  assert.match((await adm.get(r.location)).text, /non publié : au moins une source/);
  await adm.post(`/admin/news/${testNews.id}`, { ...draft, sources: 'Eurostat — test | https://ec.europa.eu/eurostat | 2026-10-01', verified: '' }, { multipart: true });
  assert.strictEqual((await one('SELECT published FROM news WHERE id = ?', testNews.id)).published, 0, 'refus sans case de vérification');
  await adm.get(`/admin/news/${testNews.id}/edit`);
  await adm.post(`/admin/news/${testNews.id}`, { ...draft, sources: 'Eurostat — test | https://ec.europa.eu/eurostat | 2026-10-01', publish_at: '2099-01-01T08:00' }, { multipart: true });
  testNews = await one('SELECT * FROM news WHERE id = ?', testNews.id);
  assert.strictEqual(testNews.published, 1);
  assert.strictEqual((await pub.get('/news/article-de-test-editorial')).status, 404, 'publication planifiée invisible avant la date');
  assert.match((await adm.get('/admin/news')).text, /Planifié/);
  await adm.post(`/admin/news/${testNews.id}`, { ...draft, sources: 'Eurostat — test | https://ec.europa.eu/eurostat | 2026-10-01', publish_at: '' }, { multipart: true });
  assert.strictEqual((await pub.get('/news/article-de-test-editorial')).status, 200);
  await adm.get('/admin/news');
  await adm.post(`/admin/news/${testNews.id}/delete`);
  assert.strictEqual((await pub.get('/news/article-de-test-editorial')).status, 404);
  const faoId = (await one(`SELECT id FROM news WHERE slug LIKE 'omc-barometre%'`)).id;
  await adm.post(`/admin/news/${faoId}/delete`);
  await require('../src/seed').seed();
  assert.strictEqual((await one('SELECT COUNT(*) AS n FROM news')).n, 8, 'une publication supprimée ne revient pas');
  step('Admin actualités : source et vérification obligatoires, planification, suppression définitive');

  // Veille : faux flux RSS local → suggestions, jamais de publication automatique
  const http = require('http');
  const rssNow = new Date().toUTCString();
  const rssXml = `<?xml version="1.0"?><rss version="2.0"><channel><title>Test</title>
    <item><title><![CDATA[Nouveau rapport officiel &amp; perspectives]]></title><link>https://example.org/rapport-1</link><description>&lt;p&gt;Résumé du rapport.&lt;/p&gt;</description><pubDate>${rssNow}</pubDate></item>
    <item><title>Communiqué 2</title><link>https://example.org/communique-2</link><pubDate>${rssNow}</pubDate></item>
    <item><title>Très ancien</title><link>https://example.org/ancien</link><pubDate>Mon, 01 Jan 2018 00:00:00 GMT</pubDate></item></channel></rss>`;
  const rss = http.createServer((q, s) => { s.setHeader('content-type', 'application/rss+xml'); s.end(rssXml); });
  await new Promise((ok) => rss.listen(0, '127.0.0.1', ok));
  await run('UPDATE news_sources SET active = 0');
  await run('INSERT INTO news_sources (name, feed_url) VALUES (?, ?)', 'Source de test', `http://127.0.0.1:${rss.address().port}/feed.xml`);
  const beforeNews = (await one('SELECT COUNT(*) AS n FROM news')).n;
  await adm.get('/admin/news-watch');
  await adm.post('/admin/news-watch/run');
  let sugg = await all(`SELECT * FROM news_suggestions WHERE status = 'new' ORDER BY id`);
  assert.strictEqual(sugg.length, 2, 'deux publications récentes détectées, l’ancienne ignorée');
  assert.strictEqual(sugg[0].title, 'Nouveau rapport officiel & perspectives');
  assert.strictEqual(sugg[0].summary, 'Résumé du rapport.');
  assert.strictEqual((await one('SELECT COUNT(*) AS n FROM news')).n, beforeNews, 'aucune publication automatique');
  await adm.get('/admin/news-watch');
  await adm.post('/admin/news-watch/run');
  assert.strictEqual((await one('SELECT COUNT(*) AS n FROM news_suggestions')).n, 2, 'pas de doublon');
  const wp = await adm.get('/admin/news-watch');
  assert.match(wp.text, /Nouveau rapport officiel &amp; perspectives/);
  assert.match((await adm.get(`/admin/news/new?suggestion=${sugg[0].id}`)).text, /Source de test \| https:\/\/example\.org\/rapport-1/);
  await adm.get('/admin/news-watch');
  await adm.post(`/admin/news-watch/suggestions/${sugg[1].id}/dismiss`);
  assert.strictEqual((await one('SELECT status FROM news_suggestions WHERE id = ?', sugg[1].id)).status, 'dismissed');
  const cron = await (await fetch(base + '/cron/news-watch')).json();
  assert.strictEqual(cron.skipped, true, 'tâche planifiée limitée à une exécution toutes les 6 h');
  rss.close();
  step('Veille automatique : flux lus, suggestions à vérifier, aucun doublon, rien publié sans validation');

  const kyc = await one(`SELECT id FROM kyc_submissions WHERE status = 'pending'`);
  await adm.get('/admin/kyc');
  assert.strictEqual((await adm.get(`/admin/kyc/${kyc.id}/file/id`)).status, 200);
  await adm.post(`/admin/kyc/${kyc.id}/review`, { decision: 'approve' });
  const marie = await one('SELECT * FROM users WHERE email = ?', 'marie.dupont@gmail.com');
  assert.strictEqual(marie.kyc_status, 'approved');
  step('Validation KYC par l\'administrateur');

  await adm.get('/admin/settings');
  r = await adm.post('/admin/settings/general', { site_name: 'GLOBACOR Partners INC', lang_fr: 'on', lang_en: 'on', lang_es: 'on', lang_de: 'on', cur_EUR: 'on', cur_GBP: 'on', cur_XOF: 'on', funds_enabled: 'on' });
  assert.strictEqual(await one(`SELECT value FROM settings WHERE key = 'funds_enabled'`), undefined, 'activation impossible sans confirmation réglementaire');
  await adm.post('/admin/settings/general', { site_name: 'GLOBACOR Partners INC', lang_fr: 'on', lang_en: 'on', lang_es: 'on', lang_de: 'on', cur_EUR: 'on', cur_GBP: 'on', cur_XOF: 'on', funds_enabled: 'on', funds_ack: 'on' });
  step('Réception de fonds activable uniquement avec confirmation réglementaire');

  // ---------- Dépôt ----------
  await inv.get('/account/deposit');
  r = await inv.post('/account/deposit', { amount: '5 000,00' });
  const depRef = r.location.split('/').pop();
  assert.match(depRef, /^DEP-\d{8}-[A-Z0-9]{6}$/);
  assert.strictEqual((await inv.get(r.location)).status, 200);
  const dep = await one('SELECT * FROM transactions WHERE reference = ?', depRef);
  assert.strictEqual(dep.status, 'pending');
  assert.strictEqual(await require('../src/lib/ledger').cashBalance(marie.id), 0, 'dépôt non crédité avant vérification');
  step('Demande de dépôt : référence unique, non créditée avant vérification');

  await adm.get('/admin/transactions');
  await adm.post(`/admin/transactions/${dep.id}/action`, { action: 'confirm', external_ref: '' });
  assert.strictEqual((await one('SELECT status FROM transactions WHERE id = ?', dep.id)).status, 'pending', 'confirmation impossible sans contrôle');
  await adm.post(`/admin/transactions/${dep.id}/action`, { action: 'confirm', external_ref: 'RELEVE-2026-09-001', verified: 'on' });
  assert.strictEqual((await one('SELECT status FROM transactions WHERE id = ?', dep.id)).status, 'confirmed');
  assert.strictEqual(await require('../src/lib/ledger').cashBalance(marie.id), 500000);
  step('Confirmation du dépôt après contrôle effectif (référence bancaire obligatoire)');

  // ---------- Projet réel + investissement ----------
  await adm.get('/admin/projects/new');
  r = await adm.post('/admin/projects', { sector: 'energy', country: 'Maroc', risk_level: '3', target: '200000', min_ticket: '1000', duration_months: '24', title_fr: 'Parc solaire de test', summary_fr: 'Résumé', description_fr: 'Description', conditions_fr: 'Conditions', fees_fr: 'Frais' }, { multipart: true });
  const projectId = Number(r.location.match(/projects\/(\d+)/)[1]);
  const draftPage = await adm.get(r.location);
  assert.match(draftPage.text, /Brouillon : ce projet n'est pas visible sur le site|Brouillon : ce projet n&#39;est pas visible sur le site/);
  assert.ok(!(await pub.get('/opportunities?sector=energy')).text.includes('Parc solaire de test'), 'un brouillon n’est pas visible sur le site');
  await adm.post(`/admin/projects/${projectId}/status`, { status: 'open' });
  assert.ok((await pub.get('/opportunities?sector=energy')).text.includes('Parc solaire de test'), 'visible une fois publié');
  await adm.get('/admin/projects/new');
  r = await adm.post('/admin/projects', { sector: 'tourism', country: 'Maroc', risk_level: '2', target: '300000', duration_months: '12', title_fr: 'Hôtel publié directement', publish: '1' });
  assert.ok((await pub.get('/opportunities?sector=tourism')).text.includes('Hôtel publié directement'), '« Enregistrer et publier » affiche le projet immédiatement');
  await adm.post(`/admin/projects/${r.location.match(/projects\/(\d+)/)[1]}/status`, { status: 'archived' });
  await adm.get(`/admin/users/${marie.id}`);
  const demo = await one('SELECT id FROM projects WHERE is_demo = 1 LIMIT 1');
  await adm.post(`/admin/users/${marie.id}/investments`, { project_id: String(demo.id), amount: '1000', start_date: '2026-01-01', end_date: '2027-01-01' });
  assert.strictEqual((await one('SELECT COUNT(*) AS n FROM investments')).n, 0, 'aucun investissement possible dans une démo');
  await adm.post(`/admin/users/${marie.id}/investments`, { project_id: String(projectId), amount: '9000', start_date: '2026-01-01', end_date: '2028-01-01' });
  assert.strictEqual((await one('SELECT COUNT(*) AS n FROM investments')).n, 0, 'solde insuffisant refusé');
  await adm.post(`/admin/users/${marie.id}/investments`, { project_id: String(projectId), amount: '3000', start_date: '2026-01-01', end_date: '2028-01-01' });
  const invRow = await one('SELECT * FROM investments WHERE user_id = ?', marie.id);
  assert.strictEqual(invRow.amount_cents, 300000);
  assert.strictEqual(await require('../src/lib/ledger').cashBalance(marie.id), 200000);
  assert.match((await pub.get('/opportunities/parc-solaire-de-test')).text, /1,5\s?%/);
  step('Investissement enregistré, solde débité, montant mobilisé calculé depuis la base');

  await adm.post(`/admin/investments/${invRow.id}/valuations`, { value: '3150', date: '2026-06-30', note: 'Rapport semestriel' });
  const dash = (await inv.get('/account')).text;
  assert.match(dash, /3\s?150,00\s?\$/);
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
  const wdr = await one(`SELECT * FROM transactions WHERE type = 'withdrawal'`);
  assert.strictEqual(await require('../src/lib/ledger').availableBalance(marie.id), 150000);
  await adm.post(`/admin/transactions/${wdr.id}/action`, { action: 'confirm', external_ref: 'VIR-OUT-1', verified: 'on' });
  assert.strictEqual(await require('../src/lib/ledger').cashBalance(marie.id), 150000);
  step('Retrait : contrôle titulaire / IBAN / solde, puis exécution confirmée');

  // Le client ne peut pas modifier son solde : aucune route ne l'expose
  r = await inv.post('/account/transactions/' + dep.id + '/cancel');
  assert.strictEqual((await one('SELECT status FROM transactions WHERE id = ?', dep.id)).status, 'confirmed');
  step('Le client ne peut pas modifier une transaction confirmée');

  // ---------- Verrouillage après échecs ----------
  const brute = new Client();
  await brute.get('/login');
  for (let i = 0; i < 5; i++) await brute.post('/login', { email: 'marie.dupont@gmail.com', password: 'wrong-password-1' });
  r = await brute.post('/login', { email: 'marie.dupont@gmail.com', password: 'MotDePasse2026' });
  assert.strictEqual(r.status, 429);
  await run(`DELETE FROM login_attempts WHERE email = 'marie.dupont@gmail.com'`);
  step('Blocage temporaire après 5 échecs de connexion');

  // ---------- Mot de passe oublié ----------
  const fp = new Client();
  await fp.get('/forgot-password');
  await fp.post('/forgot-password', { email: 'marie.dupont@gmail.com' });
  assert.strictEqual((await one(`SELECT status FROM email_log WHERE kind = 'password_reset' ORDER BY id DESC`)).status, 'relay_accepted');
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
  assert.strictEqual((await one('SELECT totp_enabled FROM users WHERE id = ?', marie.id)).totp_enabled, 1);
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
  await run(`UPDATE users SET must_change_password = 1 WHERE email = 'admin@example.test'`);
  const first = new Client();
  await first.get('/admin/login');
  r = await first.post('/admin/login', { email: 'admin@example.test', password: 'AdminTest12345' });
  assert.strictEqual(r.location, '/admin');
  r = await first.get('/admin');
  assert.strictEqual(r.location, '/account/security#password', 'accès admin bloqué tant que le mot de passe provisoire n’est pas changé');
  assert.strictEqual((await first.get('/admin/users')).status, 302);
  assert.match((await first.get('/account/security')).text, /mot de passe provisoire/);
  r = await first.post('/account/security/password', { current: 'AdminTest12345', password: 'AdminTest12345', password_confirm: 'AdminTest12345' });
  assert.strictEqual((await one(`SELECT must_change_password FROM users WHERE email = 'admin@example.test'`)).must_change_password, 1, 'réutilisation refusée');
  await first.get('/account/security');
  r = await first.post('/account/security/password', { current: 'AdminTest12345', password: 'AdminDefinitif2026', password_confirm: 'AdminDefinitif2026' });
  assert.strictEqual(r.location, '/admin');
  assert.strictEqual((await first.get('/admin')).status, 200);
  step('Mot de passe provisoire : changement imposé avant tout accès à l’administration');

  // ---------- Notifications ----------
  assert.ok((await one('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ?', marie.id)).n >= 6);
  step('Notifications internes et e-mails générés à chaque opération');

  server.close();
  // ---------- Journal d'audit inaltérable (en dernier : erreurs SQL volontaires) ----------
  assert.ok((await one('SELECT COUNT(*) AS n FROM audit_log')).n >= 8);
  await assert.rejects(() => run('UPDATE audit_log SET action = ? WHERE id = 1', 'x'), /append-only/);
  if (!process.env.DATABASE_URL) {
    // Le serveur de test PGlite (check:pg) ferme la connexion après une 2e erreur : contrôle fait en mode embarqué.
    await assert.rejects(() => run('DELETE FROM audit_log'), /append-only/);
  }
  step('Journal d\'audit : modification et suppression refusées par la base');

  smtp.close();
  console.log(`\n${results.length} scénarios validés.`);
  await require('../src/db').close();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* Windows : fichiers WAL encore verrouillés */ }
}

main().catch((e) => { console.error('\n✗ ÉCHEC :', e); process.exit(1); }).then(() => process.exit(0));
