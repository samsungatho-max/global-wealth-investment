'use strict';
/** Test : installation du premier administrateur par lien à usage unique, clé de session générée automatiquement. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'globacor-setup-'));
const token = crypto.randomBytes(32).toString('hex');
process.env.DATA_DIR = tmp;
process.env.ADMIN_SEED = 'false';
process.env.SEED_DEMO = 'false';
process.env.ADMIN_SETUP_TOKEN_HASH = crypto.createHash('sha256').update(token).digest('hex');
delete process.env.SESSION_SECRET;

(async () => {
  const app = require('../src/server');
  const { one, close } = require('../src/db');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '', csrf = '';
  const req = async (method, url, body) => {
    const res = await fetch(base + url, {
      method, redirect: 'manual',
      headers: { cookie, ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
      body: body ? new URLSearchParams({ _csrf: csrf, ...body }).toString() : undefined
    });
    for (const c of res.headers.getSetCookie()) if (c.startsWith('sx.sid=')) cookie = c.split(';')[0];
    const text = await res.text();
    const m = text.match(/name="_csrf" value="([^"]+)"/); if (m) csrf = m[1];
    return { status: res.status, location: res.headers.get('location'), text };
  };

  // Site public sans fiche fictive : aucune mention de maquette ou de contenu provisoire, dans les 4 langues.
  const banned = /fictif|fictitious|ficticio|fiktiv|crédits? photo|photo credit|illustrati|ilustrativ|Symbolfoto|projet exemple|example project|proyecto de ejemplo|Beispielprojekt|par exemple|démonstration|demonstration|demostración|placeholder|lorem ipsum|provisoire|temporaire|à venir|coming soon|générée|à compléter|\[[^\]<>]{3,40}\]|Modèle à faire valider/i;
  const visible = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<option[\s\S]*?<\/option>/g, ' ').replace(/<[^>]+>/g, ' ');
  for (const lang of ['fr', 'en', 'es', 'de']) {
    for (const u of ['/', '/opportunities', '/simulator', '/news', '/contact', '/page/about', '/page/faq', '/page/legal', '/page/terms', '/page/privacy', '/page/strategies', '/page/sectors', '/page/risks', '/login', '/register', '/forgot-password']) {
      const page = await req('GET', `${u}?lang=${lang}`);
      assert.strictEqual(page.status, 200, u);
      assert.doesNotMatch(page.text, /ph-label|chip-demo|mosaic-note/, u);
      const hit = visible(page.text).match(banned);
      assert.ok(!hit, `${u} (${lang}) : « ${hit && hit[0]} » — ${hit ? visible(page.text).slice(Math.max(0, hit.index - 80), hit.index + 80).replace(/\s+/g, ' ') : ''}`);
    }
  }
  const opp = await req('GET', '/opportunities?lang=fr');
  assert.match(opp.text, /Des projets présentés après une étude rigoureuse/);
  assert.strictEqual((opp.text.match(/class="card project-card"/g) || []).length, 0);
  console.log('  ✓ Site public sans mention de maquette, de crédit photo ni de contenu provisoire (16 pages × 4 langues)');

  let r = await req('GET', '/admin/setup?token=mauvais');
  assert.match(r.text, /lien d'installation est invalide/);
  r = await req('POST', '/admin/setup', { token: 'mauvais', full_name: 'X', email: 'x@y.fr', password: 'MotDePasse2026', password_confirm: 'MotDePasse2026' });
  assert.strictEqual(r.status, 403);
  assert.strictEqual(await one(`SELECT id FROM users WHERE role = 'admin'`), undefined);
  await req('GET', `/admin/setup?token=${token}`);
  r = await req('POST', '/admin/setup', { token, full_name: 'La Direction', email: 'Direction@Societe.fr', password: 'court', password_confirm: 'court' });
  assert.strictEqual(r.status, 400);
  r = await req('POST', '/admin/setup', { token, full_name: 'La Direction', email: 'Direction@Societe.fr', password: 'MotDePasse2026', password_confirm: 'MotDePasse2026' });
  assert.strictEqual(r.location, '/admin');
  r = await req('GET', '/admin');
  assert.strictEqual(r.status, 200);
  assert.match(r.text, /Compte administrateur créé/);
  const admin = await one(`SELECT * FROM users WHERE role = 'admin'`);
  assert.strictEqual(admin.email, 'direction@societe.fr');
  assert.ok(admin.email_verified_at);
  assert.strictEqual((await req('GET', `/admin/setup?token=${token}`)).status, 404, 'page désactivée après création');
  r = await req('POST', '/admin/setup', { token, full_name: 'Intrus', email: 'intrus@x.fr', password: 'MotDePasse2026', password_confirm: 'MotDePasse2026' });
  assert.strictEqual(r.status, 404);
  assert.strictEqual((await one(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin'`)).n, 1);
  const secret = await one(`SELECT value FROM meta WHERE key = 'session_secret'`);
  assert.ok(secret && secret.value.length >= 64, 'clé de session générée et conservée en base');
  console.log('  ✓ Installation admin par lien à usage unique ; clé de session générée automatiquement');
  server.close();
  await close();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fichiers verrouillés */ }
  process.exit(0);
})().catch((e) => { console.error('✗ ÉCHEC :', e); process.exit(1); });
