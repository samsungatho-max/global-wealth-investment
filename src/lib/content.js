'use strict';
/** Contenu multilingue (JSON par langue avec repli) et rendu Markdown minimal et sûr. */

const LANGS = ['fr', 'en', 'es', 'de'];

/** Retourne les champs traduits pour `lang`, avec repli champ par champ sur fr puis en. */
function parseI18n(json, lang) {
  let obj = {};
  try { obj = typeof json === 'string' ? JSON.parse(json || '{}') : (json || {}); } catch { obj = {}; }
  const chain = [lang, 'fr', 'en', 'es', 'de'];
  const keys = new Set();
  for (const l of LANGS) Object.keys(obj[l] || {}).forEach((k) => keys.add(k));
  const out = {};
  for (const k of keys) {
    for (const l of chain) {
      if (obj[l] && obj[l][k]) { out[k] = obj[l][k]; break; }
    }
  }
  return out;
}

function rawI18n(json) {
  try { return JSON.parse(json || '{}'); } catch { return {}; }
}

/** Construit l'objet i18n à partir des champs de formulaire `field_lang`. */
function i18nFromBody(body, fields) {
  const out = {};
  for (const l of LANGS) {
    out[l] = {};
    for (const f of fields) {
      const v = (body[`${f}_${l}`] || '').toString().trim();
      if (v) out[l][f] = v.slice(0, 20000);
    }
  }
  return out;
}

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function inline(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)/g, (m, text, url) => `<a href="${url}">${text}</a>`);
}

/** Markdown minimal : ## titres, listes "- ", **gras**, [liens](url), paragraphes. HTML échappé. */
function markdown(src) {
  const lines = escapeHtml(src || '').split(/\r?\n/);
  let html = '', para = [], list = false;
  const flush = () => { if (para.length) { html += `<p>${inline(para.join(' '))}</p>`; para = []; } };
  const closeList = () => { if (list) { html += '</ul>'; list = false; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); closeList(); continue; }
    let m;
    if ((m = line.match(/^(#{2,3})\s+(.*)$/))) {
      flush(); closeList();
      const lvl = m[1].length;
      html += `<h${lvl}>${inline(m[2])}</h${lvl}>`;
    } else if ((m = line.match(/^[-*]\s+(.*)$/))) {
      flush();
      if (!list) { html += '<ul>'; list = true; }
      html += `<li>${inline(m[1])}</li>`;
    } else {
      closeList();
      para.push(line);
    }
  }
  flush(); closeList();
  return html;
}

function slugify(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'item';
}

module.exports = { LANGS, parseI18n, rawI18n, i18nFromBody, markdown, escapeHtml, slugify };
