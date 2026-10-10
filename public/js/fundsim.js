/* GLOBACOR Partners INC — simulateur de scénarios (page « Gestion de fonds »).
   Capitalisation composée jour par jour : capital × (1 + taux)^jours. Calcul instantané, sans rechargement. */
(function () {
  'use strict';
  var root = document.querySelector('[data-fsim]');
  if (!root) return;

  var $ = function (s) { return root.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(root.querySelectorAll(s)); };
  var locale = root.getAttribute('data-locale') || 'en-US';
  var MAX_DAYS = 60;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var el = {
    amount: $('[data-amount]'), currency: $('[data-currency]'), pct: $('[data-pct]'), range: $('[data-range]'),
    days: $('[data-days]'), daysRange: $('[data-days-range]'),
    outInitial: $('[data-out="initial"]'), outGain: $('[data-out="gain"]'), outTotal: $('[data-out="total"]'),
    outCum: $('[data-out="cum"]'), outRate: $('[data-out="rate"]'), outDays: $('[data-out="days"]'),
    gainLabel: $('[data-gain-label]'), result: $('[data-result]'),
    line: $('[data-line]'), area: $('[data-area]'), base: $('[data-base]'), dot: $('[data-dot]'), halo: $('[data-halo]'), startDot: $('[data-start-dot]'),
    yStart: $('[data-y-start]'), yEnd: $('[data-y-end]'), xEnd: $('[data-x-end]'), xMid: $('[data-x-mid]'),
    rows: $('[data-rows]'), more: $('[data-more]')
  };
  var txt = { day: root.getAttribute('data-day') || 'day', days: root.getAttribute('data-days-word') || 'days', dayCap: root.getAttribute('data-day-cap') || 'Day' };
  var state = { cents: 100000, pct: 30, currency: 'EUR', days: 1 };
  var shown = { gain: null, total: null };

  /** « 1 000,50 », « 1,000.50 », « 1000 » → centimes (entier). */
  function parseAmount(raw) {
    var s = String(raw || '').replace(/[^\d.,]/g, '');
    if (!s) return 0;
    var lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(','), dec = -1;
    if (lastDot !== -1 && lastComma !== -1) dec = Math.max(lastDot, lastComma);
    else if (lastComma !== -1) dec = (s.length - lastComma - 1 <= 2 && s.indexOf(',') === lastComma) ? lastComma : -1;
    else if (lastDot !== -1) dec = (s.length - lastDot - 1 <= 2 && s.indexOf('.') === lastDot) ? lastDot : -1;
    var intPart = (dec === -1 ? s : s.slice(0, dec)).replace(/[.,]/g, '');
    var fracPart = dec === -1 ? '' : s.slice(dec + 1).replace(/[.,]/g, '');
    var cents = parseInt(intPart || '0', 10) * 100 + parseInt((fracPart + '00').slice(0, 2), 10);
    return Math.min(Math.max(cents || 0, 0), 100000000000000);
  }
  function clampPct(v) { v = Math.round(parseFloat(String(v).replace(',', '.')) * 10) / 10; if (isNaN(v)) v = 0; return Math.min(Math.max(v, -100), 100); }
  function clampDays(v) { v = parseInt(v, 10); if (isNaN(v)) v = 1; return Math.min(Math.max(v, 1), MAX_DAYS); }
  /** Capital après n jours au taux journalier donné, arrondi au centime : capital × (1 + taux)^n. */
  function valueAt(cents, pct, n) { return Math.round(cents * Math.pow(1 + pct / 100, n)); }

  function money(cents, signed) {
    var cur = state.currency, abs = Math.abs(cents) / 100, out, opt;
    if (abs >= 1e15) {
      opt = cur === 'XOF' ? { notation: 'scientific', maximumFractionDigits: 2 } : { style: 'currency', currency: cur, notation: 'scientific', maximumFractionDigits: 2 };
      out = new Intl.NumberFormat(locale, opt).format(abs) + (cur === 'XOF' ? ' FCFA' : '');
    } else if (cur === 'XOF') out = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(abs) + ' FCFA';
    else out = new Intl.NumberFormat(locale, { style: 'currency', currency: cur }).format(abs);
    if (cents < 0) return '−' + out;
    return signed && cents > 0 ? '+' + out : out;
  }
  function pctText(p, digits) {
    var abs = Math.abs(p), opt = abs >= 1e12 ? { notation: 'scientific', maximumFractionDigits: 2 } : { maximumFractionDigits: digits === undefined ? 1 : digits };
    return (p > 0 ? '+' : p < 0 ? '−' : '') + new Intl.NumberFormat(locale, opt).format(abs) + ' %';
  }
  function daysText(n) { return new Intl.NumberFormat(locale).format(n) + ' ' + (n > 1 ? txt.days : txt.day); }

  /** Affichage progressif d'un montant (désactivé si l'utilisateur préfère moins d'animations). */
  function tween(node, key, to, signed) {
    var from = shown[key];
    shown[key] = to;
    if (reduce || from === null || from === to) { node.textContent = money(to, signed); return; }
    var start = null, id = (node._tw = (node._tw || 0) + 1);
    function step(ts) {
      if (node._tw !== id) return;
      if (start === null) start = ts;
      var k = Math.min((ts - start) / 380, 1), e = 1 - Math.pow(1 - k, 3);
      node.textContent = money(Math.round(from + (to - from) * e), signed);
      if (k < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
    // Valeur exacte garantie même si l'animation est suspendue (onglet en arrière-plan)
    setTimeout(function () { if (node._tw === id) { node._tw = id + 1; node.textContent = money(to, signed); } }, 450);
  }

  /** Courbe mathématique : un point par jour (échantillonnée au-delà de 120 jours). */
  function drawChart(values) {
    var n = values.length - 1, lo = Math.min.apply(null, values), hi = Math.max.apply(null, values);
    var pad = (hi - lo) * 0.12 || values[0] * 0.1 || 1;
    var y = function (v) { return 200 - (v - (lo - pad)) / ((hi + pad) - (lo - pad)) * 170; };
    var x = function (k) { return 40 + 520 * k / n; };
    var stepK = Math.max(1, Math.ceil(n / 120)), pts = [];
    for (var k = 0; k <= n; k += stepK) pts.push(x(k).toFixed(1) + ' ' + y(values[k]).toFixed(1));
    if ((n % stepK) !== 0) pts.push('560 ' + y(values[n]).toFixed(1));
    var y0 = y(values[0]).toFixed(1), y1 = y(values[n]).toFixed(1), d = 'M' + pts.join(' L');
    el.line.setAttribute('d', d);
    el.area.setAttribute('d', d + ' L560 ' + y0 + ' L40 ' + y0 + ' Z');
    el.base.setAttribute('y1', y0); el.base.setAttribute('y2', y0);
    el.startDot.setAttribute('cy', y0);
    el.dot.setAttribute('cy', y1); el.halo.setAttribute('cy', y1);
    var up = values[n] >= values[0];
    el.yStart.setAttribute('y', Math.min(Math.max(parseFloat(y0) + (up ? 18 : -10), 14), 214)); el.yStart.textContent = money(values[0]);
    el.yEnd.setAttribute('y', Math.min(Math.max(parseFloat(y1) + (up ? -12 : 20), 14), 214)); el.yEnd.textContent = money(values[n]);
    el.xEnd.textContent = txt.dayCap + ' ' + n;
    el.xMid.textContent = n >= 4 ? txt.dayCap + ' ' + Math.round(n / 2) : '';
    if (!reduce) { el.line.classList.remove('draw'); void el.line.getBoundingClientRect(); el.line.classList.add('draw'); }
  }

  /** Tableau jour par jour. */
  function drawRows(values) {
    var n = values.length - 1, html = '';
    for (var k = 1; k <= n; k++) {
      var g = values[k] - values[k - 1], cum = values[0] ? (values[k] / values[0] - 1) * 100 : 0;
      html += '<tr' + (k === n ? ' class="is-last"' : '') + '><th scope="row">' + txt.dayCap + ' ' + k + '</th><td>' + money(values[k - 1]) + '</td><td class="chg">' + money(g, true) + '</td><td class="end">' + money(values[k]) + '</td><td class="chg">' + pctText(cum, 2) + '</td></tr>';
    }
    el.rows.innerHTML = html;
  }

  function render() {
    var values = [];
    for (var k = 0; k <= state.days; k++) values.push(valueAt(state.cents, state.pct, k));
    var total = values[state.days], gain = total - state.cents;
    var cum = (Math.pow(1 + state.pct / 100, state.days) - 1) * 100;
    var tone = state.pct > 0 ? 'up' : state.pct < 0 ? 'down' : 'flat';
    el.result.setAttribute('data-tone', tone);
    root.setAttribute('data-tone', tone);
    el.outInitial.textContent = money(state.cents);
    el.outRate.textContent = pctText(state.pct);
    el.outDays.textContent = daysText(state.days);
    $$('[data-out="cum"]').forEach(function (nd) { nd.textContent = pctText(cum, 2); });
    el.gainLabel.textContent = el.gainLabel.getAttribute(gain < 0 ? 'data-loss' : 'data-gain');
    tween(el.outGain, 'gain', gain, true);
    tween(el.outTotal, 'total', total, false);
    drawChart(values);
    drawRows(values);

    // Scénarios comparatifs : même capital, même nombre de jours, taux journaliers différents
    var cards = $$('[data-scn]'), logs = cards.map(function (c) {
      var p = clampPct(c.querySelector('[data-scn-pct]').value);
      return Math.abs(p <= -100 ? 50 : state.days * Math.log(1 + p / 100));
    });
    var maxLog = Math.max.apply(null, logs.concat([1e-9]));
    cards.forEach(function (c, i) {
      var p = clampPct(c.querySelector('[data-scn-pct]').value), t = valueAt(state.cents, p, state.days), g = t - state.cents;
      c.setAttribute('data-tone', p > 0 ? 'up' : p < 0 ? 'down' : 'flat');
      c.classList.toggle('is-active', p === state.pct);
      c.querySelector('[data-scn-gain]').textContent = money(g, true);
      c.querySelector('[data-scn-total]').textContent = money(t);
      c.querySelector('[data-scn-bar]').style.width = Math.max(logs[i] / maxLog * 100, 3) + '%';
    });
    $$('[data-preset]').forEach(function (b) { b.setAttribute('aria-pressed', parseFloat(b.getAttribute('data-preset')) === state.pct ? 'true' : 'false'); });
    $$('[data-day-btn]').forEach(function (b) { b.setAttribute('aria-pressed', parseInt(b.getAttribute('data-day-btn'), 10) === state.days ? 'true' : 'false'); });
  }

  function setPct(v, from) {
    state.pct = clampPct(v);
    if (from !== el.pct) el.pct.value = state.pct;
    el.range.value = state.pct;
    render();
  }
  function setDays(v, from) {
    state.days = clampDays(v);
    if (from !== el.days) el.days.value = state.days;
    el.daysRange.value = Math.min(state.days, parseInt(el.daysRange.max, 10));
    render();
  }

  el.amount.addEventListener('input', function () { state.cents = parseAmount(el.amount.value); render(); });
  el.amount.addEventListener('blur', function () {
    el.amount.value = new Intl.NumberFormat(locale, { minimumFractionDigits: state.cents % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(state.cents / 100);
  });
  el.currency.addEventListener('change', function () { state.currency = el.currency.value; shown.gain = shown.total = null; render(); });
  el.pct.addEventListener('input', function () { setPct(el.pct.value, el.pct); });
  el.pct.addEventListener('blur', function () { el.pct.value = state.pct; });
  el.range.addEventListener('input', function () { setPct(el.range.value, el.range); });
  el.days.addEventListener('input', function () { if (el.days.value !== '') setDays(el.days.value, el.days); });
  el.days.addEventListener('blur', function () { el.days.value = state.days; });
  el.daysRange.addEventListener('input', function () { setDays(el.daysRange.value, el.daysRange); });
  $$('[data-preset]').forEach(function (b) { b.addEventListener('click', function () { setPct(b.getAttribute('data-preset')); }); });
  $$('[data-day-btn]').forEach(function (b) { b.addEventListener('click', function () { setDays(b.getAttribute('data-day-btn')); }); });
  $$('[data-scn]').forEach(function (c) {
    var input = c.querySelector('[data-scn-pct]');
    input.addEventListener('input', render);
    input.addEventListener('blur', function () { input.value = clampPct(input.value); render(); });
    c.querySelector('[data-scn-apply]').addEventListener('click', function () {
      setPct(input.value);
      if (root.scrollIntoView && window.innerWidth < 1000) el.result.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    });
  });

  state.cents = parseAmount(el.amount.value);
  state.currency = el.currency.value;
  state.pct = clampPct(el.pct.value);
  state.days = clampDays(el.days.value);
  render();
})();
