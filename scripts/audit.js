'use strict';
/**
 * Audit fonctionnel complet sur une instance d'essai (base vide, site public en anglais, faux serveur d'e-mail) :
 * parcours visiteur, parcours client (inscription → tableau de bord → dépôt → investissement → retrait → déconnexion),
 * parcours administrateur, liens, images, téléchargements, droits d'accès, langue, devise et e-mails.
 * Usage : node scripts/audit.js   — affiche la liste des anomalies ; code de sortie 1 s'il en reste.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'globacor-audit-'));
process.env.DATA_DIR = tmp;
process.env.MARKETS_OFFLINE = 'true'; // aucune requête vers les sources de données de marché pendant les tests
process.env.ADMIN_EMAIL = 'admin@example.test';
process.env.ADMIN_PASSWORD = 'AdminTest12345';
process.env.PORT = '0';
process.env.MAIL_FROM = 'GLOBACOR Partners INC <contact@globacor-test.com>';
delete process.env.KEEP_LANGUAGES; delete process.env.SEED_DEMO;

const { SMTPServer } = require('smtp-server');
const inbox = [];
const smtp = new SMTPServer({
  authOptional: true, disabledCommands: ['STARTTLS'], logger: false,
  onData(stream, session, cb) { const c = []; stream.on('data', (x) => c.push(x)); stream.on('end', () => { inbox.push({ to: session.envelope.rcptTo.map((r) => r.address.toLowerCase()), raw: Buffer.concat(c).toString('utf8') }); cb(null, 'OK'); }); }
});
const utf8 = (raw) => Buffer.from(raw.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16))), 'latin1').toString('utf8');
const subject = (raw) => { const m = raw.match(/^Subject: ([\s\S]*?)\r?\n(?=\S)/m); return m ? m[1].replace(/\r?\n\s+/g, '').replace(/=\?UTF-8\?Q\?(.*?)\?=/gi, (x, q) => utf8(q.replace(/_/g, ' '))).replace(/=\?UTF-8\?B\?(.*?)\?=/gi, (x, b) => Buffer.from(b, 'base64').toString('utf8')) : ''; };

const FRENCH = /[àâçéèêëîïôùûœ]|\b(les|des|une|pour|avec|votre|vos|nous|dans|projet|société|sont|aux|du|au|et|ou|sur|par|qui|que|mois)\b/i;
const ALLOWED = /Türkiye|TÜBİTAK|ESPOIR-JEUNES|Côte d.Ivoire|Ministerio de Desarrollo|₦|m²|cafés|façades|Réunion|Curaçao|São Tomé|Saint-Barthélemy|Åland/;
const KEYS = /\b(account|deposit|withdraw|kyc|tx|req|opp|project|common|auth|nav|footer|risk|sim|news|security|contact|home|hero|ux|mail|notif|sector|partners|docs|perf)\.[a-z][a-z0-9_]{2,}\b/;
const JUNK = /\bundefined\b|\bNaN\b|\[object Object\]|lorem ipsum/;
const lines = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<option[\s\S]*?<\/option>/g, ' ').replace(/<[^>]+>/g, '\n')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&#34;|&quot;/g, '"').split('\n').map((s) => s.trim()).filter(Boolean);
const pdf = () => new Blob([Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF')], { type: 'application/pdf' });

const findings = [];
const note = (area, msg) => { const k = `${area} — ${msg}`; if (!findings.includes(k)) findings.push(k); };
let base;

class Client {
  constructor(name) { this.name = name; this.cookie = ''; this.csrf = ''; }
  async req(method, url, body, { multipart } = {}) {
    const headers = { cookie: this.cookie, 'accept-language': 'fr-FR,fr;q=0.9' };
    let payload;
    if (body && multipart) { payload = new FormData(); for (const [k, v] of Object.entries(body)) { if (v instanceof Blob) payload.append(k, v, v.type === 'application/pdf' ? 'document.pdf' : 'page.html'); else payload.append(k, v); } }
    else if (body) { headers['content-type'] = 'application/x-www-form-urlencoded'; payload = new URLSearchParams(body).toString(); }
    const t0 = Date.now();
    const res = await fetch(base + url, { method, headers, body: payload, redirect: 'manual' });
    for (const c of res.headers.getSetCookie()) if (c.startsWith('sx.sid=')) this.cookie = c.split(';')[0];
    const type = res.headers.get('content-type') || '';
    const text = /text|json|xml|javascript/.test(type) ? await res.text() : (await res.arrayBuffer(), '');
    const m = text.match(/name="_csrf" value="([^"]+)"/); if (m) this.csrf = m[1];
    return { status: res.status, location: res.headers.get('location'), text, type, ms: Date.now() - t0, headers: res.headers };
  }
  get(url) { return this.req('GET', url); }
  post(url, body = {}, opts) { return this.req('POST', url, { _csrf: this.csrf, ...body }, opts); }
}

/** Contrôle le contenu d'une page (langue, clés non traduites, valeurs techniques, devise). */
function inspect(area, url, page, { english = true } = {}) {
  if (page.status >= 500) note(area, `${url} : erreur serveur ${page.status}`);
  if (!/text\/html/.test(page.type) || page.status >= 300) return;
  const ls = lines(page.text);
  if (english) {
    if (!/<html lang="en">/.test(page.text)) note(area, `${url} : la page n'est pas déclarée en anglais`);
    const fr = ls.filter((l) => FRENCH.test(l) && !ALLOWED.test(l));
    if (fr.length) note(area, `${url} : texte français « ${fr[0].slice(0, 90)} »`);
    const eur = ls.filter((l) => /\d\s?€|€\s?\d|\d\s?FCFA/.test(l));
    // Simulateur de scénarios : devise choisie par le visiteur, exemple affiché en euros
    if (eur.length && !url.startsWith('/fund-management')) note(area, `${url} : montant ou devise hors USD « ${eur[0].slice(0, 80)} »`);
  }
  const k = !english ? [] : ls.filter((l) => KEYS.test(l) && !/@|https?:|www\.|\.(com|org|pdf|webp)/.test(l));
  if (k.length) note(area, `${url} : libellé non traduit « ${k[0].slice(0, 80)} »`);
  const j = ls.filter((l) => JUNK.test(l));
  if (j.length) note(area, `${url} : valeur technique affichée « ${j[0].slice(0, 80)} »`);
  if (!/<title>[^<]{5,}<\/title>/.test(page.text)) note(area, `${url} : titre de page manquant`);
  if (/<img(?![^>]*\balt=)[^>]*>/.test(page.text)) note(area, `${url} : image sans texte alternatif`);
}

/** Parcourt toutes les pages accessibles depuis les points d'entrée, vérifie liens, images et fichiers statiques. */
async function crawl(client, area, starts, { english = true, allow = () => true } = {}) {
  const seen = new Set(), queue = [...starts], assets = new Set();
  let slow = null;
  while (queue.length) {
    const u = queue.shift();
    if (seen.has(u) || seen.size > 400) continue; seen.add(u);
    const page = await client.get(u);
    if (page.status === 404) note(area, `lien cassé : ${u}`);
    if (!slow || page.ms > slow.ms) slow = { u, ms: page.ms };
    inspect(area, u, page, { english });
    if (!/text\/html/.test(page.type)) continue;
    for (const m of page.text.matchAll(/(?:href|src|action)="(\/[^"#]*)/g)) {
      const link = m[1].replace(/&amp;/g, '&');
      if (/^\/(static|media)\//.test(link)) assets.add(link.split(' ')[0]);
      else if (m[0].startsWith('href') && !/^\/(logout|admin\/setup)/.test(link) && !/[?&](currency|lang)=/.test(link) && allow(link) && !seen.has(link)) queue.push(link);
    }
    for (const m of page.text.matchAll(/srcset="([^"]+)"/g)) m[1].split(',').forEach((s) => assets.add(s.trim().split(' ')[0]));
  }
  for (const a of assets) { const r = await client.get(a); if (r.status !== 200) note(area, `fichier introuvable : ${a} (${r.status})`); }
  return { pages: seen.size, assets: assets.size, slow };
}

(async () => {
  await new Promise((r) => smtp.listen(0, '127.0.0.1', r));
  process.env.SMTP_HOST = '127.0.0.1'; process.env.SMTP_PORT = String(smtp.server.address().port); process.env.SMTP_SECURE = 'false';
  const app = require('../src/server');
  const { one, all, run, close } = require('../src/db');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  const report = {};
  const mailTo = (addr, from = 0) => inbox.slice(from).filter((m) => m.to.includes(addr));

  // ================= 1. Visiteur =================
  const pub = new Client('visiteur');
  report.public = await crawl(pub, 'Site public', ['/', '/company', '/markets', '/solutions', '/fund-management', '/submit-project', '/cookies', '/opportunities', '/simulator', '/news', '/contact', '/page/about', '/page/faq', '/page/legal', '/page/terms', '/page/privacy', '/page/strategies', '/page/sectors', '/page/risks', '/login', '/register', '/forgot-password'],
    { allow: (l) => !/^\/(account|admin)/.test(l) });
  const home = await pub.get('/');
  for (const h of ['content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy']) if (!home.headers.get(h)) note('Sécurité', `en-tête ${h} absent`);
  if (!/HttpOnly/i.test((await fetch(base + '/')).headers.getSetCookie().join(';'))) note('Sécurité', 'cookie de session sans HttpOnly');
  if ((await pub.get('/account')).status !== 302) note('Droits', 'espace client accessible sans connexion');
  if ((await pub.get('/admin')).status !== 302) note('Droits', 'administration accessible sans connexion');
  const nf = await pub.get('/page-qui-n-existe-pas');
  if (nf.status !== 404 || !/Page not found/i.test(nf.text)) note('Site public', 'page 404 absente ou non traduite');
  for (const q of ['/opportunities?sector=energy', '/opportunities?country=Kenya', '/opportunities?amount=a4', '/opportunities?risk=3', '/news?sector=energy', '/news?region=africa', '/news?q=growth']) {
    const r = await pub.get(q); if (r.status !== 200) note('Recherche et filtres', `${q} → ${r.status}`); inspect('Recherche et filtres', q, r);
  }

  // Formulaire de contact
  // Contact simple
  await pub.get('/contact');
  let r = await pub.post('/contact', { motive: 'information', full_name: 'A' });
  if (r.status !== 400) note('Contact', 'message incomplet accepté'); inspect('Contact', '/contact (erreur)', r);
  let fromC = inbox.length;
  r = await pub.post('/contact', { motive: 'information', full_name: 'Emma Clarke', email: 'emma.clarke@example.org', description: 'Could you tell me more about your services?', certify: 'on' });
  if (r.location !== '/contact/confirmation') note('Contact', `message valide refusé (${r.status})`);
  else { if (!mailTo('emma.clarke@example.org', fromC).length) note('E-mails', 'pas d’accusé de réception pour le formulaire de contact'); if (!mailTo('admin@example.test', fromC).length) note('E-mails', 'message de contact non transmis à l’équipe'); }
  r = await pub.post('/contact', { motive: 'information', full_name: 'Multi Part', email: 'm@example.org', description: 'Sent as multipart form data.', certify: 'on' }, { multipart: true });
  if (r.status >= 500) note('Contact', 'erreur serveur sur un formulaire envoyé en multipart');
  // Demande d'information sur une solution
  await pub.get('/solutions'); fromC = inbox.length;
  r = await pub.post('/solutions/request', { solution: 'allocation', full_name: 'Liam Wright', email: 'liam.wright@example.org', description: 'Please send me details on capital allocation.', certify: 'on' });
  if (r.location !== '/contact/confirmation') note('Solutions', `demande d’information refusée (${r.status})`);
  else if (!mailTo('admin@example.test', fromC).length) note('E-mails', 'demande d’information sur une solution non transmise');
  // Marchés : chaque catégorie répond, avec des données datées ou un message d'indisponibilité
  for (const c of ['indices', 'equities', 'bonds', 'currencies', 'commodities', 'metals', 'energy', 'indicators']) {
    const mp = await pub.get('/markets/' + c); inspect('Marchés', '/markets/' + c, mp);
    if (mp.status !== 200 || !/Associated risks/.test(mp.text)) note('Marchés', `/markets/${c} : page incomplète`);
    if (!/Data not available at the moment|Date of the value/.test(mp.text)) note('Marchés', `/markets/${c} : ni données datées ni message d'indisponibilité`);
  }
  // Soumettre un projet
  await pub.get('/submit-project');
  r = await pub.post('/submit-project', { motive: 'funding', full_name: 'A' });
  if (r.status !== 400) note('Contact', 'formulaire incomplet accepté'); inspect('Contact', '/contact (erreur)', r);
  let from = inbox.length;
  r = await pub.post('/submit-project', { motive: 'funding', full_name: 'Sarah Miller', organisation: 'Miller Foods Ltd', position: 'Managing Director', country: 'GB', project_country: 'KE', revenue: 'USD 1.2 million', forecasts: 'Break-even expected in year three.', city: 'London', email: 'sarah.miller@example.org', phone: '+44 20 7946 0958',
    sector: 'agriculture', project_name: 'Miller Processing Plant', nature: 'Food processing unit', amount: '2,500,000', own_funds: '400000', duration: '30', stage: 'plan', business_plan: 'yes', documents: 'yes',
    description: 'Construction of a food processing plant serving regional retailers, with 60 jobs planned over three years.', website: 'www.millerfoods.example.org', certify: 'on', attachments: pdf() }, { multipart: true });
  if (r.location !== '/contact/confirmation') note('Contact', `demande valide refusée (${r.status}) : ${(lines(r.text).find((l) => /check|invalid|Please/i.test(l)) || '').slice(0, 100)}`);
  else {
    const conf = await pub.get('/contact/confirmation'); inspect('Contact', '/contact/confirmation', conf);
    const saved = await one(`SELECT * FROM requests WHERE email = 'sarah.miller@example.org'`);
    if (!saved) note('Base de données', 'demande de contact non enregistrée');
    else {
      if (Number(saved.amount_cents) !== 250000000) note('Contact', `montant « 2,500,000 » enregistré ${saved.amount_cents / 100} $ (format anglais des milliers mal compris)`);
      if (!conf.text.includes(saved.ref)) note('Contact', 'numéro de dossier absent de la confirmation');
      if (!mailTo('sarah.miller@example.org', from).length) note('E-mails', 'pas de confirmation au demandeur');
      const adm = mailTo('admin@example.test', from)[0];
      if (!adm) note('E-mails', 'pas de notification à l’administration');
      else if (!/filename="?document\.pdf/i.test(adm.raw)) note('E-mails', 'pièce jointe non transmise');
    }
  }

  // ================= 2. Client =================
  const cli = new Client('client');
  await cli.get('/register');
  r = await cli.post('/register', { full_name: 'John Smith', email: 'john.smith@example.org', country: 'US', phone: '+1 416 555 0100', password: 'short', password_confirm: 'short', accept: 'on' });
  if (r.status !== 400) note('Inscription', 'mot de passe trop court accepté'); inspect('Inscription', '/register (erreur)', r);
  from = inbox.length;
  r = await cli.post('/register', { full_name: 'John Smith', email: 'john.smith@example.org', country: 'US', phone: '+1 416 555 0100', password: 'ClientTest2026', password_confirm: 'ClientTest2026', accept: 'on' });
  if (r.status !== 302) note('Inscription', `inscription valide refusée (${r.status})`);
  const vpage = await cli.get('/verify-email'); inspect('Inscription', '/verify-email', vpage);
  const codeMail = mailTo('john.smith@example.org', from)[0];
  const code = codeMail && (utf8(codeMail.raw).match(/letter-spacing:8px;color:#0a1628;">(\d{6})</) || [])[1];
  if (!code) note('E-mails', 'code de confirmation non reçu à l’inscription');
  r = await cli.post('/verify-email', { code: '000000' === code ? '111111' : '000000' }); inspect('Inscription', '/verify-email (mauvais code)', r);
  r = await cli.post('/verify-email', { code: code || '' });
  if (r.status !== 302) note('Inscription', 'code de confirmation correct refusé');
  const john = await one(`SELECT * FROM users WHERE email = 'john.smith@example.org'`);
  if (!john || !john.email_verified_at) note('Inscription', 'compte non confirmé après saisie du code');
  if (john && john.lang !== 'en') note('Inscription', `langue du compte « ${john.lang} » au lieu de l'anglais`);

  // Connexion / déconnexion
  await cli.post('/logout');
  if ((await cli.get('/account')).status !== 302) note('Connexion', 'session encore active après déconnexion');
  await cli.get('/login');
  r = await cli.post('/login', { email: 'john.smith@example.org', password: 'wrong-password' }); inspect('Connexion', '/login (erreur)', r);
  if (r.status === 302) note('Connexion', 'mauvais mot de passe accepté');
  r = await cli.post('/login', { email: 'john.smith@example.org', password: 'ClientTest2026' });
  if (r.status !== 302) note('Connexion', 'connexion valide refusée');

  // Tableau de bord et pages de l'espace client, compte encore vide
  report.accountEmpty = await crawl(cli, 'Espace client (nouveau compte)', ['/account'], { allow: (l) => /^\/account/.test(l) });

  // Profil
  await cli.get('/account/security');
  r = await cli.post('/account/security/profile', { phone: '+1 416 555 0199', lang: 'en', full_name: 'John Smith', country: 'US' });
  if ((await one('SELECT phone FROM users WHERE id = ?', john.id)).phone !== '+1 416 555 0199') note('Profil', 'modification du téléphone non enregistrée');
  inspect('Profil', '/account/security', await cli.get('/account/security'));

  // Vérification d'identité
  await cli.get('/account/kyc');
  r = await cli.post('/account/kyc', { doc_type: 'passport', id_file: pdf(), address_file: pdf() }, { multipart: true });
  if (r.status !== 302) note('KYC', `envoi des justificatifs refusé (${r.status})`);
  inspect('KYC', '/account/kyc', await cli.get('/account/kyc'));

  // ================= 3. Administrateur =================
  const adm = new Client('admin');
  await adm.get('/admin/login');
  r = await adm.post('/admin/login', { email: 'john.smith@example.org', password: 'ClientTest2026' });
  if (r.status === 302 && r.location === '/admin') note('Droits', 'un client peut se connecter à l’administration');
  r = await adm.post('/admin/login', { email: 'admin@example.test', password: 'AdminTest12345' });
  if (r.location !== '/admin') note('Administration', 'connexion administrateur refusée');
  if ((await cli.get('/admin')).status !== 403) note('Droits', 'un client connecté accède à /admin');
  if ((await cli.get('/admin/requests')).status !== 403) note('Droits', 'un client connecté accède aux dossiers');

  await adm.get('/admin/settings');
  await adm.post('/admin/settings/general', { site_name: 'GLOBACOR Partners INC', lang_en: 'on', cur_EUR: 'on', cur_GBP: 'on', cur_XOF: 'on', funds_enabled: 'on', funds_ack: 'on', notify_emails: 'direction@globacor-test.com' });
  const kyc = await one('SELECT * FROM kyc_submissions WHERE user_id = ?', john.id);
  if (!kyc) note('Base de données', 'dossier KYC non enregistré');
  else {
    if ((await adm.get(`/admin/kyc/${kyc.id}/file/id`)).status !== 200) note('Téléchargements', 'pièce d’identité illisible côté administration');
    if ((await pub.get(`/admin/kyc/${kyc.id}/file/id`)).status === 200) note('Droits', 'pièce d’identité lisible sans connexion');
    from = inbox.length;
    await adm.get('/admin/kyc'); await adm.post(`/admin/kyc/${kyc.id}/review`, { decision: 'approve' });
    if ((await one('SELECT kyc_status FROM users WHERE id = ?', john.id)).kyc_status !== 'approved') note('KYC', 'validation par l’administration sans effet');
    if (!mailTo('john.smith@example.org', from).length) note('E-mails', 'client non prévenu de la validation de son identité');
  }

  // Dépôt : demande du client, puis enregistrement et confirmation par l'administration
  const depPage = await cli.get('/account/deposit'); inspect('Dépôt', '/account/deposit', depPage);
  if (/IBAN|SWIFT|BIC\b/i.test(lines(depPage.text).join(' '))) note('Dépôt', 'coordonnées bancaires affichées');
  from = inbox.length;
  r = await cli.post('/account/deposit', { amount: '25,000', message: 'I would like to fund my account.' });
  const depReq = await one(`SELECT * FROM requests WHERE motive = 'deposit'`);
  if (!depReq) note('Dépôt', `demande d’instructions non enregistrée (${r.status})`);
  else if (Number(depReq.amount_cents) !== 2500000) note('Dépôt', `montant « 25,000 » enregistré ${depReq.amount_cents / 100} $ (format anglais des milliers mal compris)`);
  if (!mailTo('direction@globacor-test.com', from).length) note('E-mails', 'demande de dépôt non envoyée à l’adresse de réception');
  inspect('Dépôt', '/account/deposit (envoyée)', await cli.get('/account/deposit'));
  await adm.get(`/admin/users/${john.id}`);
  await adm.post(`/admin/users/${john.id}/deposits`, { amount: '25000' });
  const dep = await one(`SELECT * FROM transactions WHERE type = 'deposit' AND user_id = ?`, john.id);
  if (!dep) note('Dépôt', 'enregistrement du dépôt par l’administration impossible');
  else {
    from = inbox.length;
    await adm.get('/admin/transactions'); await adm.post(`/admin/transactions/${dep.id}/action`, { action: 'confirm', external_ref: 'STATEMENT-2026-10-001', verified: 'on' });
    if ((await one('SELECT status FROM transactions WHERE id = ?', dep.id)).status !== 'confirmed') note('Dépôt', 'confirmation du dépôt sans effet');
    if (!mailTo('john.smith@example.org', from).length) note('E-mails', 'client non prévenu de la confirmation de son dépôt');
  }

  // Projet, investissement, valorisation, document
  await adm.get('/admin/projects/new');
  r = await adm.post('/admin/projects', { sector: 'energy', country: 'Kenya', risk_level: '3', target: '2000000', min_ticket: '5000', duration_months: '36', publish: '1',
    title_en: 'Rift Valley Solar Park', summary_en: 'Ground-mounted solar plant selling electricity to the grid.', location_en: 'Nakuru County', objective_en: 'Build and operate a 20 MW solar plant.',
    description_en: 'The project covers the construction and operation of a solar plant.', funding_type_en: 'Equity and senior debt', stage_en: 'Permits obtained', potential_en: 'Long-term power purchase agreement.',
    conditions_en: 'Open to verified investors.', fees_en: 'Entry fee: 2%.' }, { multipart: true });
  const proj = await one(`SELECT * FROM projects WHERE slug = 'rift-valley-solar-park'`);
  if (!proj) note('Administration', `création d’un projet en anglais impossible (${r.status})`);
  else {
    const sheet = await pub.get('/opportunities/rift-valley-solar-park'); inspect('Fiche projet', '/opportunities/rift-valley-solar-park', sheet);
    for (const s of ['Rift Valley Solar Park', 'Nakuru County', 'Build and operate a 20 MW solar plant', 'Equity and senior debt', 'Permits obtained', 'Long-term power purchase agreement', '$2,000,000']) if (!sheet.text.includes(s)) note('Fiche projet', `information absente : « ${s} »`);
    await adm.get(`/admin/users/${john.id}`);
    await adm.post(`/admin/users/${john.id}/investments`, { project_id: String(proj.id), amount: '10000', start_date: '2026-10-01', end_date: '2029-10-01' });
    const inv = await one('SELECT * FROM investments WHERE user_id = ?', john.id);
    if (!inv) note('Investissement', 'enregistrement de l’investissement impossible');
    else await adm.post(`/admin/investments/${inv.id}/valuations`, { value: '10400', date: '2026-10-07', note: 'Quarterly report' });
    from = inbox.length;
    await adm.get(`/admin/users/${john.id}`);
    await adm.post(`/admin/users/${john.id}/documents`, { title: 'Subscription agreement', category: 'contract', file: pdf() }, { multipart: true });
    await pub.get('/opportunities/rift-valley-solar-park');
    r = await pub.post('/opportunities/rift-valley-solar-park/interest', { name: 'Peter Jones', email: 'peter.jones@example.org', amount: '50000', message: 'Please send me the documentation.' });
    if (!(await one(`SELECT id FROM interests WHERE email = 'peter.jones@example.org'`))) note('Fiche projet', '« Submit a request » : demande non enregistrée');
    const im = mailTo('direction@globacor-test.com', from).find((m) => utf8(m.raw).includes('Peter Jones'));
    if (!im) note('E-mails', 'demande déposée depuis une fiche projet non envoyée à l’adresse de réception');
    else if (!utf8(im.raw).includes('Please send me the documentation.') || !utf8(im.raw).includes('Rift Valley Solar Park')) note('E-mails', 'e-mail de demande sur projet incomplet');
  }

  // Échanges sur un dossier : message de l'équipe visible par le client, réponse du client transmise à l'équipe
  if (depReq) {
    await adm.get(`/admin/requests/${depReq.id}`);
    await adm.post(`/admin/requests/${depReq.id}`, { status: 'review', admin_note: 'Internal note, never shown.', message: 'Thank you. Could you confirm the origin of the funds?' });
    const list = await cli.get('/account/requests'); inspect('Espace client', '/account/requests', list);
    if (!list.text.includes(depReq.ref)) note('Espace client', 'la demande du client n’apparaît pas dans « My requests »');
    const thread = await cli.get(`/account/requests/${depReq.ref}`); inspect('Espace client', '/account/requests/:ref', thread);
    if (!/Could you confirm the origin of the funds/.test(thread.text)) note('Espace client', 'message de l’équipe absent de l’historique des échanges');
    if (/Internal note, never shown/.test(thread.text)) note('Droits', 'note interne visible par le client');
    if (!/Under review/.test(thread.text)) note('Espace client', 'statut du dossier non affiché');
    from = inbox.length;
    await cli.post(`/account/requests/${depReq.ref}/messages`, { body: 'The funds come from the sale of a property.' });
    if (!(await adm.get(`/admin/requests/${depReq.id}`)).text.includes('The funds come from the sale of a property.')) note('Administration', 'réponse du client absente du dossier');
    if (!mailTo('direction@globacor-test.com', from).length) note('E-mails', 'réponse du client non transmise à l’adresse de réception');
    const stranger = new Client('autre');
    if ((await stranger.get(`/account/requests/${depReq.ref}`)).status === 200) note('Droits', 'dossier d’un client lisible sans connexion');
  }

  // Espace client avec données : portefeuille, transactions, documents, notifications
  const dash = await cli.get('/account'); inspect('Tableau de bord', '/account', dash);
  for (const s of ['$10,400.00', '$15,000.00']) if (!dash.text.includes(s)) note('Tableau de bord', `montant attendu absent : ${s}`);
  report.account = await crawl(cli, 'Espace client', ['/account'], { allow: (l) => /^\/account/.test(l) });
  const doc = await one('SELECT * FROM user_documents WHERE user_id = ?', john.id);
  if (!doc) note('Documents', 'document déposé par l’administration non enregistré');
  else {
    if ((await cli.get(`/account/documents/${doc.id}`)).status !== 200) note('Téléchargements', 'le client ne peut pas télécharger son document');
    const other = new Client('autre');
    if ((await other.get(`/account/documents/${doc.id}`)).status === 200) note('Droits', 'document d’un client lisible sans connexion');
  }

  // Retrait (compte bancaire hors zone IBAN : États-Unis)
  await cli.get('/account/withdraw');
  r = await cli.post('/account/withdraw', { amount: '1,000', holder: 'John Smith', iban: '021000021 123456789012', bic: 'CHASUS33', bank: 'JPMorgan Chase' });
  if (r.status !== 302) note('Retrait', `compte bancaire américain refusé : « ${(lines(r.text).find((l) => /invalid|must|required|account/i.test(l) && l.length < 160) || r.status)} »`);
  inspect('Retrait', '/account/withdraw', r.status === 302 ? await cli.get('/account/transactions') : r);
  r = await cli.post('/account/withdraw', { amount: '900000', holder: 'John Smith', iban: 'GB29NWBK60161331926819', bank: 'NatWest' });
  if (r.status === 302) note('Retrait', 'retrait supérieur au solde accepté');
  const wdr = await one(`SELECT * FROM transactions WHERE type = 'withdrawal' AND user_id = ?`, john.id);
  if (wdr) { await adm.get('/admin/transactions'); await adm.post(`/admin/transactions/${wdr.id}/action`, { action: 'confirm', external_ref: 'WIRE-OUT-1', verified: 'on' }); }

  // Notifications
  const notif = await cli.get('/account/notifications'); inspect('Notifications', '/account/notifications', notif);
  const nrows = await all('SELECT message FROM notifications WHERE user_id = ?', john.id);
  if (!nrows.length) note('Notifications', 'aucune notification créée pour le client');
  for (const n of nrows) if (FRENCH.test(n.message) && !ALLOWED.test(n.message)) note('Notifications', `notification en français : « ${n.message.slice(0, 80)} »`);

  // Mot de passe oublié
  const fp = new Client('oubli');
  await fp.get('/forgot-password'); from = inbox.length;
  r = await fp.post('/forgot-password', { email: 'john.smith@example.org' }); inspect('Mot de passe oublié', '/forgot-password (envoyé)', r.status === 302 ? await fp.get(r.location) : r);
  if (!mailTo('john.smith@example.org', from).length) note('E-mails', 'pas d’e-mail de réinitialisation du mot de passe');

  // ================= 4. Administration : toutes les pages =================
  report.admin = await crawl(adm, 'Administration', ['/admin'], { english: false, allow: (l) => /^\/admin/.test(l) && !/\/(delete|file|files|documents\/\d+)/.test(l) });
  for (const q of ['/admin/requests?q=miller', '/admin/requests?status=new', '/admin/requests?motive=deposit', '/admin/users?q=smith', '/admin/transactions?type=deposit', '/admin/emails', '/admin/audit']) {
    const p = await adm.get(q); if (p.status !== 200) note('Administration', `${q} → ${p.status}`);
  }
  if (!(await adm.get('/admin/requests?q=miller')).text.includes('Sarah Miller')) note('Administration', 'recherche de dossier par nom sans résultat');
  const adminDash = await adm.get('/admin');
  if (!/<html lang="fr">/.test(adminDash.text)) note('Administration', 'l’administration n’est plus en français');

  // ================= 5. E-mails envoyés aux clients =================
  const clientMails = inbox.filter((m) => m.to.some((a) => /example\.org$/.test(a)));
  for (const m of clientMails) {
    const body = utf8(m.raw).replace(/<[^>]+>/g, '\n'); const subj = subject(m.raw);
    const fr = [subj, ...body.split('\n').map((s) => s.trim())].filter((l) => l && !/^[A-Za-z-]+: |boundary|charset|^--/.test(l) && FRENCH.test(l) && !ALLOWED.test(l));
    if (fr.length) note('E-mails', `texte français dans un e-mail client (« ${subj.slice(0, 50)} ») : « ${fr[0].slice(0, 80)} »`);
    if (/\d\s?€/.test(body)) note('E-mails', `montant en euros dans un e-mail client (« ${subj.slice(0, 50)} »)`);
  }
  report.mails = { total: inbox.length, clients: clientMails.length, sujets: [...new Set(clientMails.map((m) => subject(m.raw)))] };
  const failed = await all(`SELECT kind, status FROM email_log WHERE status NOT IN ('relay_accepted', 'delivered')`);
  if (failed.length) note('E-mails', `${failed.length} e-mail(s) non accepté(s) : ${[...new Set(failed.map((f) => f.kind + '/' + f.status))].join(', ')}`);

  // ================= 6. Cohérence de la base =================
  const ledger = require('../src/lib/ledger');
  const cash = await ledger.cashBalance(john.id);
  const expected = 2500000 - 1000000 - (wdr ? Number(wdr.amount_cents) : 0);
  if (cash !== expected) note('Base de données', `solde du client ${cash / 100} $ au lieu de ${expected / 100} $`);
  if (!(await one(`SELECT id FROM audit_log WHERE action = 'project.create'`))) note('Base de données', 'journal d’audit vide');
  try { await run('DELETE FROM audit_log'); if (!(await one('SELECT id FROM audit_log LIMIT 1'))) note('Sécurité', 'le journal d’audit peut être effacé'); } catch { /* attendu : suppression refusée */ }

  console.log('\n=== Périmètre contrôlé ===');
  for (const [k, v] of Object.entries(report)) console.log(k, JSON.stringify(v).slice(0, 700));
  console.log(`\n=== ${findings.length} anomalie(s) ===`);
  findings.forEach((f, i) => console.log(`${i + 1}. ${f}`));
  server.close(); smtp.close(); await close();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fichiers verrouillés */ }
  process.exit(findings.length ? 1 : 0);
})().catch((e) => { console.error('✗ AUDIT INTERROMPU :', e); process.exit(2); });
