'use strict';
/** Mise à jour des taux de change depuis une source publique (BCE via frankfurter.app). */
const settings = require('./settings');

const XOF_PEG = 655.957; // Parité fixe EUR/XOF (franc CFA) : le taux USD/XOF en découle

async function refreshRates({ force = false } = {}) {
  const current = settings.get('rates');
  if (current.manual && !force) return current;
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR,GBP', { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const next = {
      ...current,
      manual: false,
      base: 'USD',
      source: 'ECB · frankfurter.app — XOF 655.957 / EUR (fixed peg)',
      date: data.date,
      values: { USD: 1, EUR: data.rates.EUR, GBP: data.rates.GBP, XOF: Math.round(data.rates.EUR * XOF_PEG * 1000) / 1000 },
      fetched_at: new Date().toISOString()
    };
    await settings.set('rates', next);
    return next;
  } catch (err) {
    console.warn('[rates] Échec de la mise à jour des taux :', err.message);
    return current;
  }
}

module.exports = { refreshRates, XOF_PEG };
