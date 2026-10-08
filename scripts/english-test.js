'use strict';
/** Test : site public entièrement en anglais (même pour un navigateur français), administration en français. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'globacor-english-'));
process.env.DATA_DIR = tmp;
process.env.ADMIN_EMAIL = 'admin@example.test';
process.env.ADMIN_PASSWORD = 'AdminTest12345';
process.env.PORT = '0';
delete process.env.KEEP_LANGUAGES;
delete process.env.SEED_DEMO;

const FRENCH = /[àâçéèêëîïôùûœ]|\b(les|des|une|pour|avec|votre|vos|nous|dans|projet|société|sont|aux|du|au|et|ou|sur|par|qui|que)\b/i;
// Noms propres et intitulés officiels conservés tels quels
const ALLOWED = /^(.*Türkiye.*|.*TÜBİTAK.*|.*ESPOIR-JEUNES.*|.*Côte d.Ivoire.*|Ministerio de Desarrollo Urbano y Vivienda|.*₦.*|.*m².*)$/;
const lines = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<option[\s\S]*?<\/option>/g, ' ').replace(/<[^>]+>/g, '\n')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&#34;|&quot;/g, '"').split('\n').map((s) => s.trim()).filter(Boolean);

(async () => {
  const app = require('../src/server');
  const { one, run, close } = require('../src/db');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '', csrf = '';
  const req = async (method, url, body) => {
    const res = await fetch(base + url, {
      method, redirect: 'manual',
      headers: { cookie, 'accept-language': 'fr-FR,fr;q=0.9', ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
      body: body ? new URLSearchParams({ _csrf: csrf, ...body }).toString() : undefined
    });
    for (const c of res.headers.getSetCookie()) if (c.startsWith('sx.sid=')) cookie = c.split(';')[0];
    const text = await res.text();
    const m = text.match(/name="_csrf" value="([^"]+)"/); if (m) csrf = m[1];
    return { status: res.status, location: res.headers.get('location'), text };
  };

  // Contenus saisis en français dans l'administration : la version anglaise doit être appliquée
  await req('GET', '/');
  assert.deepStrictEqual(JSON.parse((await one(`SELECT value FROM settings WHERE key = 'languages'`)).value), ['en']);

  const seen = new Set();
  const queue = ['/', '/opportunities', '/simulator', '/news', '/contact', '/page/about', '/page/faq', '/page/legal', '/page/terms', '/page/privacy', '/page/strategies', '/page/sectors', '/page/risks',
    '/login', '/register', '/forgot-password', '/page-inexistante', '/?lang=fr', '/opportunities?sector=energy&lang=fr', '/contact?motif=other'];
  let checked = 0;
  while (queue.length) {
    const u = queue.shift();
    if (seen.has(u)) continue; seen.add(u);
    const page = await req('GET', u);
    assert.ok([200, 404].includes(page.status), `${u} → ${page.status}`);
    assert.match(page.text, /<html lang="en">/, `${u} : langue de la page`);
    for (const m of page.text.matchAll(/href="(\/(?:opportunities|news)\/[a-z0-9-]+)"/g)) if (!seen.has(m[1])) queue.push(m[1]);
    const bad = lines(page.text).filter((l) => FRENCH.test(l) && !ALLOWED.test(l));
    assert.deepStrictEqual(bad.slice(0, 3), [], `texte français sur ${u}`);
    assert.doesNotMatch(page.text, /hreflang=/, `${u} : aucun sélecteur de langue`);
    assert.doesNotMatch(page.text, /&amp;currency=|&currency=/, `${u} : le paramètre de devise doit être en tête de l'adresse`);
    checked++;
  }
  assert.ok(checked >= 45, `pages contrôlées : ${checked}`);
  const home = await req('GET', '/');
  assert.match(home.text, /International opportunities/);
  assert.match(home.text, /\$\d/, 'montants en dollars');

  // Formulaires : messages d'erreur et de confirmation en anglais
  await req('GET', '/contact');
  let r = await req('POST', '/contact', { motive: 'funding', full_name: 'A' });
  assert.strictEqual(r.status, 400);
  assert.match(r.text, /Please check the fields highlighted in red/);
  assert.deepStrictEqual(lines(r.text).filter((l) => FRENCH.test(l) && !ALLOWED.test(l)).slice(0, 3), []);
  r = await req('POST', '/contact', { motive: 'other', full_name: 'John Smith', country: 'CA', email: 'john.smith@example.org', description: 'I would like more information.', certify: 'on' });
  assert.strictEqual(r.location, '/contact/confirmation');
  const conf = await req('GET', '/contact/confirmation');
  assert.match(conf.text, /Your request has been recorded/);
  assert.deepStrictEqual(lines(conf.text).filter((l) => FRENCH.test(l) && !ALLOWED.test(l)).slice(0, 3), []);
  assert.strictEqual((await one(`SELECT lang FROM requests ORDER BY id DESC LIMIT 1`)).lang, 'en');
  await req('GET', '/login');
  r = await req('POST', '/login', { email: 'nobody@example.org', password: 'wrong-password' });
  assert.deepStrictEqual(lines(r.text).filter((l) => FRENCH.test(l) && !ALLOWED.test(l)).slice(0, 3), [], 'message de connexion en anglais');

  // Administration : toujours en français
  const login = await req('GET', '/admin/login');
  assert.match(login.text, /<html lang="fr">/);
  r = await req('POST', '/admin/login', { email: 'admin@example.test', password: 'AdminTest12345' });
  assert.strictEqual(r.location, '/admin');
  const dash = await req('GET', '/admin');
  if (dash.status === 200) {
    assert.match(dash.text, /<html lang="fr">/);
    assert.match(dash.text, /Tableau de bord/);
    assert.match((await req('GET', '/admin/projects')).text, /Demandes et dossiers/);
  }
  console.log(`  ✓ Site public entièrement en anglais (${checked} pages, formulaires et messages) ; administration en français`);
  await run('SELECT 1');
  server.close();
  await close();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fichiers verrouillés */ }
  process.exit(0);
})().catch((e) => { console.error('✗ ÉCHEC :', e); process.exit(1); });
