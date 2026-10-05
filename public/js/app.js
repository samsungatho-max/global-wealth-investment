/* GLOBACOR Partners INC — scripts client (aucun script inline : CSP stricte) */
(function () {
  'use strict';

  // Menu mobile
  var toggle = document.querySelector('[data-menu-toggle]');
  var mobileNav = document.getElementById('mobile-nav');
  if (toggle && mobileNav) {
    toggle.addEventListener('click', function () {
      var open = mobileNav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // En-tête : état « défilé »
  var header = document.querySelector('.site-header');
  if (header) {
    var onScroll = function () { header.classList.toggle('scrolled', window.scrollY > 24); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Apparition progressive des sections
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }
  // Filet de sécurité : tout élément déjà dépassé (défilement rapide, ancre) est révélé.
  var revealTick = false;
  function revealPassed() {
    revealTick = false;
    var limit = window.innerHeight;
    document.querySelectorAll('.reveal:not(.in)').forEach(function (el) {
      if (el.getBoundingClientRect().top < limit) el.classList.add('in');
    });
  }
  window.addEventListener('scroll', function () {
    if (!revealTick) { revealTick = true; window.requestAnimationFrame(revealPassed); }
  }, { passive: true });
  window.addEventListener('load', revealPassed);
  setTimeout(revealPassed, 1500);

  // Fermer les menus déroulants au clic extérieur
  document.addEventListener('click', function (e) {
    document.querySelectorAll('details.dropdown[open]').forEach(function (d) {
      if (!d.contains(e.target)) d.removeAttribute('open');
    });
  });

  // Compte à rebours du bouton « Renvoyer le code »
  document.querySelectorAll('[data-countdown]').forEach(function (btn) {
    var left = parseInt(btn.getAttribute('data-countdown'), 10) || 0;
    var label = btn.getAttribute('data-label');
    if (!left) return;
    var timer = setInterval(function () {
      left -= 1;
      if (left <= 0) { clearInterval(timer); btn.disabled = false; btn.textContent = label; return; }
      btn.textContent = label + ' (' + left + ' s)';
    }, 1000);
  });

  // Confirmation des actions sensibles
  document.addEventListener('submit', function (e) {
    var msg = e.target.getAttribute('data-confirm');
    if (msg && !window.confirm(msg)) e.preventDefault();
  });

  // Onglets de langue (formulaires d'administration)
  document.querySelectorAll('[data-lang-tabs]').forEach(function (group) {
    var buttons = group.querySelectorAll('[data-lang-tab]');
    var scope = group.parentElement;
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var lang = btn.getAttribute('data-lang-tab');
        buttons.forEach(function (b) { b.setAttribute('aria-selected', b === btn ? 'true' : 'false'); });
        scope.querySelectorAll('[data-lang-pane]').forEach(function (p) {
          p.hidden = p.getAttribute('data-lang-pane') !== lang;
        });
      });
    });
  });

  // ---------------- Simulateur ----------------
  var sim = document.getElementById('simulator');
  if (!sim) return;

  var cfg = JSON.parse(sim.getAttribute('data-config'));
  var rates = JSON.parse(sim.getAttribute('data-rates'));
  var locale = sim.getAttribute('data-locale');
  var labels = JSON.parse(sim.getAttribute('data-labels'));

  var el = {
    capital: document.getElementById('sim-capital'),
    rate: document.getElementById('sim-rate'),
    rateRange: document.getElementById('sim-rate-range'),
    years: document.getElementById('sim-years'),
    yearsRange: document.getElementById('sim-years-range'),
    currency: document.getElementById('sim-currency'),
    final: document.getElementById('sim-final'),
    gain: document.getElementById('sim-gain'),
    chart: document.getElementById('sim-chart'),
    table: document.getElementById('sim-table'),
    presets: document.querySelectorAll('[data-preset]')
  };

  function fmt(v, cur) {
    if (!isFinite(v)) return '—';
    if (cur === 'XOF') return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(v)) + ' FCFA';
    return new Intl.NumberFormat(locale, { style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol' }).format(v);
  }
  function num(input, fallback) {
    var v = parseFloat(String(input.value).replace(',', '.'));
    return isFinite(v) ? v : fallback;
  }
  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  function render() {
    var cur = el.currency ? el.currency.value : 'USD';
    var capital = clamp(num(el.capital, 0), 0, cfg.max_capital * (rates[cur] || 1));
    var rate = clamp(num(el.rate, 0), cfg.min_rate, cfg.max_rate);
    var years = Math.round(clamp(num(el.years, 1), 1, cfg.max_years));

    var values = [capital];
    for (var i = 1; i <= years; i++) values.push(capital * Math.pow(1 + rate / 100, i));
    var final = values[values.length - 1];
    var gain = final - capital;

    el.final.textContent = fmt(final, cur);
    el.gain.textContent = (gain > 0 ? '+' : '') + fmt(gain, cur);
    el.gain.className = 'sim-gain ' + (gain >= 0 ? 'pos' : 'neg');
    el.presets.forEach(function (b) { b.classList.toggle('active', parseFloat(b.getAttribute('data-preset')) === rate); });

    // Tableau année par année
    var rows = '';
    for (var y = 0; y < values.length; y++) {
      var d = values[y] - capital;
      rows += '<tr><td>' + y + '</td><td class="num">' + fmt(values[y], cur) + '</td><td class="num ' + (d >= 0 ? 'pos' : 'neg') + '">' + (d > 0 ? '+' : '') + fmt(d, cur) + '</td></tr>';
    }
    el.table.innerHTML = rows;

    // Graphique en barres (SVG)
    var W = 600, H = 170, pad = 4;
    var max = Math.max.apply(null, values.concat([capital])) || 1;
    var bw = (W - pad * 2) / values.length;
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + labels.chart + '">';
    var baseY = H - (capital / max) * (H - 10);
    for (var k = 0; k < values.length; k++) {
      var h = (values[k] / max) * (H - 10);
      var x = pad + k * bw + bw * 0.18;
      var col = k === 0 ? 'rgba(255,255,255,.35)' : (values[k] >= capital ? '#c9a96e' : '#e38b83');
      svg += '<rect x="' + x.toFixed(1) + '" y="' + (H - h).toFixed(1) + '" width="' + (bw * 0.64).toFixed(1) + '" height="' + h.toFixed(1) + '" rx="3" fill="' + col + '"><title>' + labels.year + ' ' + k + ' : ' + fmt(values[k], cur) + '</title></rect>';
    }
    svg += '<line x1="0" x2="' + W + '" y1="' + baseY.toFixed(1) + '" y2="' + baseY.toFixed(1) + '" stroke="rgba(255,255,255,.45)" stroke-dasharray="4 4"/>';
    svg += '</svg>';
    el.chart.innerHTML = svg;
  }

  var simForm = sim.querySelector('[data-sim-form]');
  if (simForm) simForm.addEventListener('submit', function (e) { e.preventDefault(); });

  function sync(from, to) { from.addEventListener('input', function () { to.value = from.value; render(); }); }
  sync(el.rate, el.rateRange); sync(el.rateRange, el.rate);
  sync(el.years, el.yearsRange); sync(el.yearsRange, el.years);
  el.capital.addEventListener('input', render);

  if (el.currency) {
    var prev = el.currency.value;
    el.currency.addEventListener('change', function () {
      var next = el.currency.value;
      var inEur = num(el.capital, 0) / (rates[prev] || 1);
      var converted = inEur * (rates[next] || 1);
      el.capital.value = next === 'XOF' ? Math.round(converted) : Math.round(converted * 100) / 100;
      prev = next;
      render();
    });
  }
  el.presets.forEach(function (b) {
    b.addEventListener('click', function () {
      el.rate.value = el.rateRange.value = b.getAttribute('data-preset');
      render();
    });
  });
  render();
})();

/* Page Contact : les champs du dossier de financement suivent le motif choisi */
(function () {
  var form = document.querySelector('[data-req-form]');
  if (!form) return;
  var funding = (form.getAttribute('data-funding') || '').split(',');
  function apply() {
    var c = form.querySelector('input[name="motive"]:checked');
    var on = !!c && funding.indexOf(c.value) !== -1;
    form.querySelectorAll('[data-funding-block]').forEach(function (b) { b.hidden = !on; });
    form.querySelectorAll('[data-funding-required]').forEach(function (i) { i.required = on; });
    form.querySelectorAll('[data-req-star], [data-label-funding]').forEach(function (s) { s.hidden = !on; });
    form.querySelectorAll('[data-label-other]').forEach(function (s) { s.hidden = on; });
  }
  form.querySelectorAll('input[name="motive"]').forEach(function (r) { r.addEventListener('change', apply); });
  apply();
})();
