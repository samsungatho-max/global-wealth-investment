/* GLOBACOR Partners INC — tableau de bord client : graphique d'évolution du portefeuille.
   Les points proviennent du serveur (transactions confirmées et valorisations enregistrées) ; rien n'est généré ici. */
(function () {
  'use strict';
  var root = document.querySelector('[data-pf]');
  if (!root) return;
  var $ = function (s) { return root.querySelector(s); };
  var W = 900, H = 340, PAD_T = 18, PAD_B = 26;
  var locale = root.getAttribute('data-locale') || 'en-GB';
  var currency = root.getAttribute('data-currency') || 'USD';
  var rate = parseFloat(root.getAttribute('data-rate')) || 1;
  var points = [], now = parseInt(root.getAttribute('data-now'), 10) || Date.now(), range = 0, view = [];
  try { points = JSON.parse(root.getAttribute('data-points') || '[]'); } catch (e) { points = []; }

  var el = {
    chart: $('[data-chart]'), line: $('[data-line]'), net: $('[data-net]'), area: $('[data-area]'), grid: $('[data-grid]'), cross: $('[data-cross]'), dot: $('[data-dot]'),
    axisY: $('[data-axis-y]'), axisX: $('[data-axis-x]'), empty: $('[data-empty-msg]'),
    value: $('[data-chart-value]'), change: $('[data-chart-change]'), date: $('[data-chart-date]'), updated: $('[data-updated]')
  };

  function money(cents, signed) {
    var a = Math.abs(cents) / 100 * rate, out;
    if (currency === 'XOF') out = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(a)) + ' FCFA';
    else out = new Intl.NumberFormat(locale, { style: 'currency', currency: currency, currencyDisplay: 'narrowSymbol' }).format(a);
    return (cents < 0 ? '−' : signed && cents > 0 ? '+' : '') + out;
  }
  function pct(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(x) * 100) + ' %'; }
  function dateText(ms, short) {
    var span = range || (points.length ? now - points[0][0] : 0);
    var opt = short ? (span <= 2 * 86400e3 ? { hour: '2-digit', minute: '2-digit' } : span <= 200 * 86400e3 ? { day: 'numeric', month: 'short' } : { month: 'short', year: '2-digit' })
      : { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Intl.DateTimeFormat(locale, opt).format(new Date(ms));
  }

  var preview = null, elPreview = $('[data-preview]'), elPreviewLegend = $('[data-preview-legend]');
  root.addEventListener('pf:preview', function (e) { preview = e.detail && e.detail.length ? e.detail : null; if (elPreviewLegend) elPreviewLegend.hidden = !preview; draw(); });

  /** Points visibles sur la période : valeur reportée au début de la fenêtre, puis jusqu'à maintenant. */
  function windowed(src) {
    var points = src;
    if (!points.length) return [];
    var from = range ? now - range : points[0][0], out = [], before = null;
    points.forEach(function (p) { if (p[0] < from) before = p; else if (p[0] <= now) out.push(p); });
    if (range) out.unshift([from, before ? before[1] : 0, before ? before[2] : 0]);
    var last = out[out.length - 1];
    if (last[0] < now) out.push([now, last[1], last[2]]);
    return out;
  }

  function draw() {
    view = windowed(points);
    var pv = preview && elPreview ? windowed(preview) : [];
    var has = view.length > 1;
    el.empty.hidden = has;
    el.chart.classList.toggle('is-empty', !has);
    if (!has) {
      el.empty.textContent = el.chart.getAttribute('data-empty');
      el.line.setAttribute('d', ''); el.net.setAttribute('d', ''); el.area.setAttribute('d', ''); el.grid.innerHTML = ''; el.axisY.innerHTML = ''; el.axisX.innerHTML = '';
      el.change.textContent = ''; el.date.innerHTML = '&nbsp;';
      return;
    }
    var t0 = view[0][0], t1 = view[view.length - 1][0], vals = view.map(function (p) { return p[1]; }).concat(view.map(function (p) { return p[2]; }), pv.map(function (p) { return p[1]; }));
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var pad = (hi - lo) * 0.12 || Math.abs(hi) * 0.05 || 100;
    lo -= pad; hi += pad;
    var x = function (t) { return (t - t0) / Math.max(1, t1 - t0) * W; };
    var y = function (v) { return PAD_T + (hi - v) / (hi - lo) * (H - PAD_T - PAD_B); };
    // Tracé en escalier : la valeur reste constante entre deux écritures
    var d = 'M' + x(view[0][0]).toFixed(1) + ' ' + y(view[0][1]).toFixed(1);
    var dn = 'M' + x(view[0][0]).toFixed(1) + ' ' + y(view[0][2]).toFixed(1);
    for (var i = 1; i < view.length; i++) { d += ' H' + x(view[i][0]).toFixed(1) + ' V' + y(view[i][1]).toFixed(1); dn += ' H' + x(view[i][0]).toFixed(1) + ' V' + y(view[i][2]).toFixed(1); }
    el.net.setAttribute('d', dn);
    if (elPreview) {
      var dp = '';
      if (pv.length > 1) { dp = 'M' + x(Math.max(pv[0][0], t0)).toFixed(1) + ' ' + y(pv[0][1]).toFixed(1); for (var q = 1; q < pv.length; q++) dp += ' H' + x(Math.min(Math.max(pv[q][0], t0), t1)).toFixed(1) + ' V' + y(pv[q][1]).toFixed(1); }
      elPreview.setAttribute('d', dp);
    }
    // Couleur selon le gain ou la perte de la période (hors dépôts et retraits)
    var a = view[0], b = view[view.length - 1], up = (b[1] - b[2]) - (a[1] - a[2]) >= 0;
    el.line.setAttribute('d', d);
    el.area.setAttribute('d', d + ' V' + H + ' H0 Z');
    el.area.setAttribute('fill', 'url(#' + (up ? 'pf-up' : 'pf-down') + ')');
    el.chart.setAttribute('data-tone', up ? 'up' : 'down');
    var g = '', ay = '';
    for (var k = 0; k <= 4; k++) {
      var v = hi - (hi - lo) * k / 4, yy = y(v);
      g += '<line x1="0" x2="' + W + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '"/>';
      ay += '<span style="top:' + (yy / H * 100).toFixed(2) + '%">' + money(Math.round(v)) + '</span>';
    }
    el.grid.innerHTML = g; el.axisY.innerHTML = ay;
    var ax = '';
    for (var j = 0; j <= 4; j++) ax += '<span>' + dateText(t0 + (t1 - t0) * j / 4, true) + '</span>';
    el.axisX.innerHTML = ax;
    headline(null);
    el.x = x; el.y = y;
  }

  /** Bandeau au-dessus du graphique : valeur finale et variation de la période, ou valeur au point survolé. */
  function headline(p) {
    var a = view[0], b = p || view[view.length - 1], diff = b[1] - a[1], pl = (b[1] - b[2]) - (a[1] - a[2]);
    el.value.textContent = money(b[1]);
    el.change.className = pl > 0 ? 'pos' : pl < 0 ? 'neg' : '';
    el.change.textContent = diff === 0 && pl === 0 ? el.chart.getAttribute('data-flat') : money(pl, true) + ' ' + el.chart.getAttribute('data-pl-label');
    el.date.textContent = (p ? dateText(p[0]) + ' · ' : '') + el.chart.getAttribute('data-change-label') + ' ' + money(diff, true);
  }

  function hover(clientX) {
    if (view.length < 2 || !el.x) return;
    var r = el.chart.getBoundingClientRect(), t = view[0][0] + (clientX - r.left) / r.width * (view[view.length - 1][0] - view[0][0]);
    var p = view[0];
    for (var i = 0; i < view.length; i++) { if (view[i][0] <= t) p = view[i]; else break; }
    var px = Math.min(Math.max(clientX - r.left, 0), r.width), sx = px / r.width * W;
    el.cross.setAttribute('x1', sx); el.cross.setAttribute('x2', sx); el.cross.style.opacity = 1;
    el.dot.style.left = px + 'px'; el.dot.style.top = (el.y(p[1]) / H * r.height) + 'px'; el.dot.style.opacity = 1;
    headline([t, p[1], p[2]]);
  }
  function leave() { el.cross.style.opacity = 0; el.dot.style.opacity = 0; if (view.length > 1) headline(null); }
  el.chart.addEventListener('mousemove', function (e) { hover(e.clientX); });
  el.chart.addEventListener('mouseleave', leave);
  el.chart.addEventListener('touchstart', function (e) { hover(e.touches[0].clientX); }, { passive: true });
  el.chart.addEventListener('touchmove', function (e) { hover(e.touches[0].clientX); }, { passive: true });
  el.chart.addEventListener('touchend', leave);

  Array.prototype.forEach.call(root.querySelectorAll('[data-range]'), function (b) {
    b.addEventListener('click', function () {
      Array.prototype.forEach.call(root.querySelectorAll('[data-range]'), function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
      range = parseInt(b.getAttribute('data-range'), 10) || 0;
      draw();
    });
  });

  /** Actualisation : relit les données enregistrées sur le serveur (aucune valeur calculée côté navigateur). */
  function refresh() {
    if (document.hidden || !root.getAttribute('data-url')) return;
    fetch(root.getAttribute('data-url'), { credentials: 'same-origin', headers: { accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return;
        points = j.points; now = j.now;
        Object.keys(j.stats).forEach(function (k) {
          var n = root.querySelector('[data-stat="' + k + '"]');
          if (!n) return;
          n.textContent = j.stats[k].text;
          if (j.stats[k].tone !== undefined) n.className = j.stats[k].tone;
        });
        if (el.updated) el.updated.textContent = j.updated;
        draw();
      }).catch(function () { /* nouvelle tentative à la prochaine minute */ });
  }
  draw();
  setInterval(refresh, 60000);
})();
