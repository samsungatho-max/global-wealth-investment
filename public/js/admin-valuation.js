/* GLOBACOR Partners INC — administration : éditeur de valorisation.
   L'aperçu interroge le serveur, qui recalcule la courbe avec la valeur saisie sans rien enregistrer. */
(function () {
  'use strict';
  var form = document.querySelector('[data-val-editor]');
  if (!form) return;
  var chart = document.querySelector('[data-pf]');
  var $ = function (s) { return form.querySelector(s); };
  var el = { inv: $('[data-ve-inv]'), freq: $('[data-ve-freq]'), date: $('[data-ve-date]'), time: $('[data-ve-time]'), timeWrap: $('[data-ve-time-wrap]'), fine: $('[data-ve-fine]'),
    prev: $('[data-ve-prev]'), value: $('[data-ve-value]'), diff: $('[data-ve-diff]'), error: $('[data-ve-error]'), preview: $('[data-ve-preview]') };
  var fmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' });

  function parseAmount(raw) {
    var s = String(raw || '').replace(/[\s  $]/g, '');
    if (!s) return null;
    var c = s.lastIndexOf(','), d = s.lastIndexOf('.');
    if (c > -1 && d > -1) s = c > d ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (c > -1) s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
    return /^\d+(\.\d{1,2})?$/.test(s) ? Math.round(parseFloat(s) * 100) : null;
  }
  function current() { return el.inv.options[el.inv.selectedIndex]; }
  function clearPreview() { if (chart) chart.dispatchEvent(new CustomEvent('pf:preview', { detail: null })); }

  function sync() {
    var opt = current(), prev = parseInt(opt.getAttribute('data-current'), 10) || 0, cents = parseAmount(el.value.value);
    form.setAttribute('action', '/admin/investments/' + opt.value + '/valuations');
    el.date.min = opt.getAttribute('data-start') || '';
    el.prev.textContent = opt.getAttribute('data-label');
    if (cents === null) { el.diff.textContent = '—'; el.diff.className = ''; return; }
    var diff = cents - prev;
    el.diff.textContent = (diff > 0 ? '+' : diff < 0 ? '−' : '') + fmt.format(Math.abs(diff) / 100) + (prev > 0 ? ' (' + (diff > 0 ? '+' : diff < 0 ? '−' : '') + (Math.abs(diff) / prev * 100).toFixed(2).replace('.', ',') + ' %)' : '');
    el.diff.className = diff > 0 ? 'pos' : diff < 0 ? 'neg' : '';
  }

  /** Fréquence de la source : précision de l'heure de valeur (aucune heure pour une source journalière ou hebdomadaire). */
  function setFreq() {
    var f = el.freq.value, timed = f === 'hour' || f === 'minute' || f === 'second';
    el.timeWrap.hidden = !timed;
    el.time.required = timed;
    el.time.step = f === 'second' ? 1 : f === 'minute' ? 60 : 3600;
    el.fine.hidden = !(f === 'minute' || f === 'second');
    if (!timed) el.time.value = '';
    else if (!el.time.value) { var n = new Date(); el.time.value = ('0' + n.getUTCHours()).slice(-2) + ':' + (f === 'hour' ? '00' : ('0' + n.getUTCMinutes()).slice(-2)); }
  }

  function showError(msg) { el.error.textContent = msg || ''; el.error.hidden = !msg; }

  el.preview.addEventListener('click', function () {
    showError('');
    var q = 'investment_id=' + encodeURIComponent(current().value) + '&date=' + encodeURIComponent(el.date.value) + '&time=' + encodeURIComponent(el.time.value || '') + '&value=' + encodeURIComponent(el.value.value);
    fetch(form.getAttribute('data-preview-url') + '?' + q, { credentials: 'same-origin', headers: { accept: 'application/json' } })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) { clearPreview(); showError(res.j.error || 'Aperçu impossible.'); return; }
        if (chart) { chart.dispatchEvent(new CustomEvent('pf:preview', { detail: res.j.points })); chart.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
      })
      .catch(function () { showError('Aperçu impossible pour le moment.'); });
  });

  // Publication : confirmation explicite (un brouillon s'enregistre sans confirmation)
  form.addEventListener('submit', function (e) {
    var btn = e.submitter;
    if (btn && btn.hasAttribute('data-confirm-publish') && !window.confirm('Publier cette valorisation ? Elle apparaîtra aussitôt dans le tableau de bord du client et sera inscrite au journal d\'audit.')) e.preventDefault();
  });

  ['input', 'change'].forEach(function (ev) {
    el.value.addEventListener(ev, function () { sync(); clearPreview(); });
    el.inv.addEventListener(ev, function () { sync(); clearPreview(); });
    el.date.addEventListener(ev, clearPreview);
    el.time.addEventListener(ev, clearPreview);
  });
  el.freq.addEventListener('change', setFreq);
  setFreq(); sync();
})();
