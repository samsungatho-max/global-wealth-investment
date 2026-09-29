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

const app = require('../src/server');
const { one, run } = require('../src/db');
const totp = require('../src/lib/totp');

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
  let r = await inv.post('/register', { full_name: 'Marie Dupont', email: 'marie@example.test', country: 'FR', phone: '+33 6 12 34 56 78', password: 'short', password_confirm: 'short', accept: 'on' });
  assert.strictEqual(r.status, 400);
  r = await inv.post('/register', { full_name: 'Marie Dupont', email: 'marie@example.test', country: 'FR', phone: '+33 6 12 34 56 78', password: 'MotDePasse2026', password_confirm: 'MotDePasse2026', accept: 'on' });
  assert.strictEqual(r.location, '/verify-email/pending');
  assert.strictEqual((await inv.get('/account')).location, '/verify-email/pending');
  const outbox = path.join(tmp, 'outbox');
  const mailFile = fs.readdirSync(outbox).find((f) => f.includes('marie'));
  const link = fs.readFileSync(path.join(outbox, mailFile), 'utf8').match(/\/verify-email\/[a-f0-9]{64}/)[0];
  r = await inv.get(link);
  assert.strictEqual(r.location, '/account');
  assert.strictEqual((await inv.get('/account')).status, 200);
  step('Inscription, e-mail de vérification et activation du compte');

  // Dépôt refusé tant que KYC non validé / fonds désactivés
  r = await inv.get('/account/deposit');
  assert.match(r.text, /pas encore ouverte/);
  step('Dépôts bloqués tant que la réception de fonds n\'est pas activée');

  // ---------- KYC ----------
  await inv.get('/account/kyc');
  r = await inv.post('/account/kyc', { doc_type: 'passport', id_file: pdf(), address_file: pdf() }, { multipart: true });
  assert.strictEqual(r.status, 302);
  assert.strictEqual(one('SELECT kyc_status FROM users WHERE email = ?', 'marie@example.test').kyc_status, 'pending');
  const bad = await inv.post('/account/kyc', { doc_type: 'passport', id_file: new Blob(['x'], { type: 'text/html' }), address_file: pdf() }, { multipart: true });
  assert.ok([302, 400].includes(bad.status));
  step('Soumission KYC avec documents privés');

  // ---------- Administration ----------
  const adm = new Client();
  await adm.get('/admin/login');
  r = await adm.post('/admin/login', { email: 'marie@example.test', password: 'MotDePasse2026' });
  assert.strictEqual(r.status, 401, 'un investisseur ne peut pas se connecter à l\'admin');
  r = await adm.post('/admin/login', { email: 'admin@example.test', password: 'AdminTest12345' });
  assert.strictEqual(r.location, '/admin');
  assert.strictEqual((await adm.get('/admin')).status, 200);
  assert.strictEqual((await inv.get('/admin')).status, 403);
  step('Connexion administrateur distincte ; investisseur refusé sur /admin');

  const kyc = one(`SELECT id FROM kyc_submissions WHERE status = 'pending'`);
  await adm.get('/admin/kyc');
  assert.strictEqual((await adm.get(`/admin/kyc/${kyc.id}/file/id`)).status, 200);
  await adm.post(`/admin/kyc/${kyc.id}/review`, { decision: 'approve' });
  const marie = one('SELECT * FROM users WHERE email = ?', 'marie@example.test');
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
  for (let i = 0; i < 5; i++) await brute.post('/login', { email: 'marie@example.test', password: 'wrong-password-1' });
  r = await brute.post('/login', { email: 'marie@example.test', password: 'MotDePasse2026' });
  assert.strictEqual(r.status, 429);
  run(`DELETE FROM login_attempts WHERE email = 'marie@example.test'`);
  step('Blocage temporaire après 5 échecs de connexion');

  // ---------- Mot de passe oublié ----------
  const fp = new Client();
  await fp.get('/forgot-password');
  await fp.post('/forgot-password', { email: 'marie@example.test' });
  const resetMail = fs.readdirSync(outbox).filter((f) => f.includes('marie')).map((f) => fs.readFileSync(path.join(outbox, f), 'utf8')).find((txt) => /Subject: .*réinitialisation/.test(txt));
  const code = resetMail.match(/: (\d{6})/)[1];
  await fp.get('/reset-password');
  r = await fp.post('/reset-password', { email: 'marie@example.test', code: '000000', password: 'NouveauMotDePasse1', password_confirm: 'NouveauMotDePasse1' });
  assert.strictEqual(r.status, 400);
  r = await fp.post('/reset-password', { email: 'marie@example.test', code, password: 'NouveauMotDePasse1', password_confirm: 'NouveauMotDePasse1' });
  assert.strictEqual(r.location, '/login');
  assert.strictEqual((await inv.get('/account')).location, '/login', 'anciennes sessions invalidées');
  step('Réinitialisation par code e-mail ; anciennes sessions révoquées');

  // ---------- 2FA ----------
  const tf = new Client();
  await tf.get('/login');
  await tf.post('/login', { email: 'marie@example.test', password: 'NouveauMotDePasse1' });
  await tf.get('/account/security');
  await tf.post('/account/security/2fa/start');
  const setupPage = await tf.get('/account/security');
  const secret = setupPage.text.match(/class="mono"[^>]*>([A-Z2-7 ]+)</)[1].replace(/\s/g, '');
  const now = Math.floor(Date.now() / 30000);
  await tf.post('/account/security/2fa/confirm', { code: totp.hotp(secret, now) });
  assert.strictEqual(one('SELECT totp_enabled FROM users WHERE id = ?', marie.id).totp_enabled, 1);
  const tf2 = new Client();
  await tf2.get('/login');
  r = await tf2.post('/login', { email: 'marie@example.test', password: 'NouveauMotDePasse1' });
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
  console.log(`\n${results.length} scénarios validés.`);
  require('../src/db').db.close();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* Windows : fichiers WAL encore verrouillés */ }
}

main().catch((e) => { console.error('\n✗ ÉCHEC :', e); process.exit(1); }).then(() => process.exit(0));
