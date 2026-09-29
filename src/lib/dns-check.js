'use strict';
/** Diagnostic de délivrabilité d'un domaine d'envoi : MX, SPF, DKIM, DMARC. */
const dns = require('dns').promises;

const COMMON_SELECTORS = ['brevo1', 'brevo2', 'mail', 'default', 'google', 'selector1', 'selector2', 's1', 's2', 'k1', 'k2', 'mg', 'mta', 'smtp', 'pm', 'dkim', 'resend'];

async function txt(name) {
  try { return (await dns.resolveTxt(name)).map((parts) => parts.join('')); } catch { return []; }
}

async function checkDomain(domain, selectors = []) {
  domain = String(domain || '').trim().toLowerCase().replace(/^@/, '');
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return { domain, error: 'Domaine invalide.' };
  const results = [];

  let mx = [];
  try { mx = await dns.resolveMx(domain); } catch { /* aucun */ }
  mx = mx.filter((m) => m.exchange && m.exchange !== '.'); // « MX nul » (RFC 7505) = n'accepte aucun e-mail
  results.push({
    name: 'MX', ok: mx.length > 0,
    value: mx.sort((a, b) => a.priority - b.priority).map((m) => `${m.priority} ${m.exchange}`).join(', ') || '—',
    advice: mx.length ? 'Le domaine peut recevoir des e-mails (réponses, rebonds).' : 'Aucun enregistrement MX : ajoutez-en un pour recevoir les réponses et rebonds ; certains filtres pénalisent les domaines sans MX.'
  });

  const spf = (await txt(domain)).filter((r) => /^v=spf1/i.test(r));
  results.push({
    name: 'SPF', ok: spf.length === 1,
    value: spf.join(' | ') || '—',
    advice: spf.length === 0 ? 'Aucun SPF : ajoutez un TXT « v=spf1 include:<domaine de votre service d’envoi> ~all » (ex. include:spf.brevo.com).'
      : spf.length > 1 ? 'Plusieurs SPF : il ne doit y en avoir qu’un seul, fusionnez-les.'
        : /\+all/.test(spf[0]) ? 'SPF trop permissif (+all) : utilisez ~all ou -all.' : 'SPF présent. Vérifiez qu’il inclut bien votre service d’envoi.'
  });

  const dmarc = (await txt(`_dmarc.${domain}`)).filter((r) => /^v=DMARC1/i.test(r));
  const policy = dmarc[0] && (dmarc[0].match(/;\s*p=(\w+)/i) || [])[1];
  results.push({
    name: 'DMARC', ok: dmarc.length === 1,
    value: dmarc.join(' | ') || '—',
    advice: !dmarc.length ? 'Aucun DMARC : obligatoire pour Gmail et Yahoo. Ajoutez un TXT sur _dmarc.' + domain + ' : « v=DMARC1; p=none; rua=mailto:dmarc@' + domain + ' », puis passez à p=quarantine une fois SPF et DKIM validés.'
      : `DMARC présent (politique p=${policy || '?'}).`
  });

  const list = [...new Set([...selectors.filter(Boolean), ...COMMON_SELECTORS])];
  const found = [];
  await Promise.all(list.map(async (s) => {
    const recs = (await txt(`${s}._domainkey.${domain}`)).filter((r) => /(^|;)\s*p=[A-Za-z0-9+/]{20,}/.test(r)); // clé publique non vide (p= vide = clé révoquée)
    if (recs.length) found.push(s);
  }));
  results.push({
    name: 'DKIM', ok: found.length > 0,
    value: found.length ? `Sélecteur(s) trouvé(s) : ${found.join(', ')}` : '—',
    advice: found.length ? 'Signature DKIM publiée.' : `Aucune clé DKIM trouvée (sélecteurs testés : ${list.join(', ')}). Publiez l’enregistrement DKIM fourni par votre service d’envoi, ou indiquez son sélecteur.`
  });

  return { domain, results, ok: results.every((r) => r.ok) };
}

module.exports = { checkDomain, COMMON_SELECTORS };
