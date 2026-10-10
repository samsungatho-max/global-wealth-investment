/* GLOBACOR Partners INC — simulateur de scénarios (page « Gestion de fonds »). Calculs effectués en centimes, sans rechargement. */
(function () {
  'use strict';
  var root = document.querySelector('[data-fsim]');
  if (!root) return;

  var $ = function (s) { return root.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(root.querySelectorAll(s)); };
  var locale = root.getAttribute('data-locale') || 'en-US';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var el = {
    amount: $('[data-amount]'), currency: $('[data-currency]'), pct: $('[data-pct]'), range: $('[data-range]'),
    outInitial: $('[data-out="initial"]'), outPct: $('[data-out="pct"]'), outGain: $('[data-out="gain"]'), outTotal: $('[data-out="total"]'),
    outDuration: $('[data-out="duration"]'), gainLabel: $('[data-gain-label]'), result: $('[data-result]'),
    line: $('[data-line]'), area: $('[data-area]'), base: $('[data-base]'), dot: $('[data-dot]'), halo: $('[data-halo]'),
    yStart: $('[data-y-start]'), yEnd: $('[data-y-end]'), xEnd: $('[data-x-end]'), xMid: $('[data-x-mid]')
  };
  var state = { cents: 100000, pct: 30, currency: 'EUR', duration: root.getAttribute('data-duration') || '24h' };
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
  function clampPct(v) { v = Math.round(parseFloat(String(v).replace(',', '.')) * 10) / 10; if (isNaN(v)) v = 0; return Math.min(Math.max(v, -100), 1000); }
  /** Variation appliquée au capital, arrondie au centime. */
  function gainOf(cents, pct) { return Math.round(cents * Math.round(pct * 10) / 1000); }

  function money(cents, signed) {
    var cur = state.currency, out;
    if (cur === 'XOF') out = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.abs(cents) / 100) + ' FCFA';
    else out = new Intl.NumberFormat(locale, { style: 'currency', currency: cur }).format(Math.abs(cents) / 100);
    if (cents < 0) return '−' + out;
    return signed && cents > 0 ? '+' + out : out;
  }
  function pctText(p) { return (p > 0 ? '+' : p < 0 ? '−' : '') + new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Math.abs(p)) + ' %'; }

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

  function drawChart(initial, total) {
    var lo = Math.min(initial, total), hi = Math.max(initial, total);
    var pad = (hi - lo) * 0.25 || initial * 0.1 || 1;
    var y = function (v) { return 200 - (v - (lo - pad)) / ((hi + pad) - (lo - pad)) * 170; };
    var y0 = y(initial).toFixed(1), y1 = y(total).toFixed(1);
    el.line.setAttribute('d', 'M40 ' + y0 + ' L560 ' + y1);
    el.area.setAttribute('d', 'M40 ' + y0 + ' L560 ' + y1 + ' L560 ' + y0 + ' Z');
    el.base.setAttribute('y1', y0); el.base.setAttribute('y2', y0);
    el.dot.setAttribute('cy', y1); el.halo.setAttribute('cy', y1);
    el.yStart.setAttribute('y', Math.min(Math.max(parseFloat(y0) + (total >= initial ? 18 : -10), 14), 214)); el.yStart.textContent = money(initial);
    el.yEnd.setAttribute('y', Math.min(Math.max(parseFloat(y1) + (total >= initial ? -12 : 20), 14), 214)); el.yEnd.textContent = money(total);
    if (!reduce) { el.line.classList.remove('draw'); void el.line.getBoundingClientRect(); el.line.classList.add('draw'); }
  }

  function render() {
    var gain = gainOf(state.cents, state.pct), total = state.cents + gain;
    var tone = gain > 0 ? 'up' : gain < 0 ? 'down' : 'flat';
    el.result.setAttribute('data-tone', tone);
    el.outInitial.textContent = money(state.cents);
    $$('[data-out="pct"]').forEach(function (n) { n.textContent = pctText(state.pct); });
    el.gainLabel.textContent = el.gainLabel.getAttribute(gain < 0 ? 'data-loss' : 'data-gain');
    tween(el.outGain, 'gain', gain, true);
    tween(el.outTotal, 'total', total, false);
    var dur = root.querySelector('[data-duration-btn][aria-pressed="true"]');
    if (dur) { el.outDuration.textContent = dur.textContent.trim(); el.xEnd.textContent = dur.textContent.trim(); el.xMid.textContent = dur.getAttribute('data-mid') || ''; }
    drawChart(state.cents, total);

    // Scénarios comparatifs : même capital, variations différentes
    var maxAbs = 1;
    var cards = $$('[data-scn]');
    cards.forEach(function (c) { maxAbs = Math.max(maxAbs, Math.abs(clampPct(c.querySelector('[data-scn-pct]').value))); });
    cards.forEach(function (c) {
      var p = clampPct(c.querySelector('[data-scn-pct]').value), g = gainOf(state.cents, p);
      c.setAttribute('data-tone', g > 0 ? 'up' : g < 0 ? 'down' : 'flat');
      c.classList.toggle('is-active', p === state.pct);
      c.querySelector('[data-scn-gain]').textContent = money(g, true);
      c.querySelector('[data-scn-total]').textContent = money(state.cents + g);
      c.querySelector('[data-scn-bar]').style.width = Math.max(Math.abs(p) / maxAbs * 100, 3) + '%';
    });
    $$('[data-preset]').forEach(function (b) { b.setAttribute('aria-pressed', parseFloat(b.getAttribute('data-preset')) === state.pct ? 'true' : 'false'); });
  }

  function setPct(v, from) {
    state.pct = clampPct(v);
    if (from !== el.pct) el.pct.value = state.pct;
    el.range.value = Math.min(Math.max(state.pct, -100), 100);
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
  $$('[data-preset]').forEach(function (b) { b.addEventListener('click', function () { setPct(b.getAttribute('data-preset')); }); });
  $$('[data-duration-btn]').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('[data-duration-btn]').forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
      state.duration = b.getAttribute('data-duration-btn');
      render();
    });
  });
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
  render();
})();
