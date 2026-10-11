'use strict';
/**
 * Calculs financiers — toujours dérivés des écritures de la base de données.
 * Aucun solde n'est stocké en dur : il est recalculé à partir des transactions confirmées.
 */
const { one, all } = require('../db');
const { parseI18n } = require('./content');

const CREDIT = ['deposit', 'payout'];
const DEBIT = ['withdrawal', 'investment', 'fee'];

async function cashBalance(userId) {
  const r = await one(`SELECT
      COALESCE(SUM(CASE WHEN type IN ('deposit','payout') THEN amount_cents END), 0) AS credit,
      COALESCE(SUM(CASE WHEN type IN ('withdrawal','investment','fee') THEN amount_cents END), 0) AS debit
    FROM transactions WHERE user_id = ? AND status = 'confirmed'`, userId);
  return r.credit - r.debit;
}

async function reservedForWithdrawals(userId) {
  return (await one(`SELECT COALESCE(SUM(amount_cents),0) AS s FROM transactions
    WHERE user_id = ? AND type = 'withdrawal' AND status IN ('pending','processing','approved')`, userId)).s;
}

async function availableBalance(userId) {
  return (await cashBalance(userId)) - (await reservedForWithdrawals(userId));
}

/** Portefeuille : investissements + dernière valorisation enregistrée par l'administration. */
async function portfolio(userId, lang) {
  const rows = await all(`SELECT i.*, p.i18n AS p_i18n, p.slug AS p_slug, p.sector, p.country,
      (SELECT value_cents FROM valuations v WHERE v.investment_id = i.id ORDER BY valuation_date DESC, id DESC LIMIT 1) AS last_value,
      (SELECT valuation_date FROM valuations v WHERE v.investment_id = i.id ORDER BY valuation_date DESC, id DESC LIMIT 1) AS last_value_date
    FROM investments i JOIN projects p ON p.id = i.project_id
    WHERE i.user_id = ? ORDER BY i.start_date DESC`, userId);
  return rows.map((r) => ({
    ...r,
    title: parseI18n(r.p_i18n, lang).title,
    current_value: r.last_value != null ? r.last_value : r.amount_cents,
    valued: r.last_value != null,
    perf: r.last_value != null ? (r.last_value - r.amount_cents) / r.amount_cents : null
  }));
}

async function summary(userId, lang) {
  const items = await portfolio(userId, lang);
  const active = items.filter((i) => i.status === 'active');
  const invested = active.reduce((s, i) => s + i.amount_cents, 0);
  const value = active.reduce((s, i) => s + i.current_value, 0);
  const [cash, reserved] = await Promise.all([cashBalance(userId), reservedForWithdrawals(userId)]);
  return {
    items,
    active,
    matured: items.filter((i) => i.status !== 'active'),
    invested,
    value,
    unvalued: active.filter((i) => !i.valued).length,
    cash,
    available: cash - reserved,
    reserved
  };
}

/** Historique réel des valorisations (dates précises) pour tous les investissements du client. */
async function valuationHistory(userId, lang) {
  return (await all(`SELECT v.*, i.amount_cents, i.start_date, p.i18n AS p_i18n FROM valuations v
      JOIN investments i ON i.id = v.investment_id JOIN projects p ON p.id = i.project_id
      WHERE i.user_id = ? ORDER BY v.valuation_date DESC, v.id DESC`, userId))
    .map((v) => ({
      ...v,
      title: parseI18n(v.p_i18n, lang).title,
      perf: (v.value_cents - v.amount_cents) / v.amount_cents
    }));
}

/** Montant mobilisé : uniquement la somme des investissements enregistrés et confirmés. */
async function raisedForProject(projectId) {
  return (await one(`SELECT COALESCE(SUM(amount_cents),0) AS s FROM investments
    WHERE project_id = ? AND status IN ('active','matured')`, projectId)).s;
}

module.exports = { cashBalance, availableBalance, reservedForWithdrawals, portfolio, summary, valuationHistory, raisedForProject, CREDIT, DEBIT };

// ---------- Historique du portefeuille ----------
/** Date/heure enregistrée en base (UTC) → millisecondes. */
function toMs(s) {
  if (s instanceof Date) return s.getTime();
  const str = String(s || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return Date.parse(str + 'T23:59:59Z');
  return Date.parse(/[TZ]/.test(str) ? str : str.replace(' ', 'T') + 'Z');
}

/**
 * Évolution du portefeuille, reconstruite uniquement à partir des écritures enregistrées :
 * transactions confirmées (dépôts, retraits, investissements, revenus, frais) et valorisations datées des positions.
 * Aucun point n'est généré ou extrapolé : la valeur ne change qu'à la date d'une écriture réelle.
 * Valeur = liquidités + positions ouvertes (dernière valorisation connue, à défaut le montant investi).
 */
async function timeline(userId) {
  const [txs, invs, vals] = await Promise.all([
    all(`SELECT id, type, amount_cents, investment_id, reference, created_at, processed_at FROM transactions WHERE user_id = ? AND status = 'confirmed'`, userId),
    all('SELECT id, amount_cents, status FROM investments WHERE user_id = ?', userId),
    all(`SELECT v.id, v.investment_id, v.value_cents, v.valuation_date, v.created_at FROM valuations v JOIN investments i ON i.id = v.investment_id WHERE i.user_id = ?`, userId)
  ]);
  const inv = new Map(invs.map((i) => [String(i.id), i]));
  const events = [];
  for (const t of txs) events.push({ ms: toMs(t.processed_at || t.created_at), order: 1, kind: 'tx', t });
  // Une valorisation prend effet à sa date de valeur, sans jamais précéder son enregistrement réel dans l'avenir
  for (const v of vals) events.push({ ms: Math.min(toMs(v.valuation_date), toMs(v.created_at)), order: 0, kind: 'val', v });
  // Clôture d'une position échue : au dernier versement lié, à défaut à la dernière valorisation
  const closeAt = new Map();
  for (const i of invs.filter((x) => x.status !== 'active')) {
    const pays = txs.filter((t) => t.type === 'payout' && String(t.investment_id) === String(i.id)).map((t) => toMs(t.processed_at || t.created_at));
    const lastVal = vals.filter((v) => String(v.investment_id) === String(i.id)).map((v) => toMs(v.created_at));
    const at = pays.length ? Math.max(...pays) : (lastVal.length ? Math.max(...lastVal) : null);
    if (at != null) { closeAt.set(String(i.id), at); events.push({ ms: at, order: 2, kind: 'close', id: String(i.id) }); }
  }
  events.sort((a, b) => a.ms - b.ms || a.order - b.order);

  let cash = 0, deposits = 0, withdrawals = 0;
  const open = new Map();      // position ouverte → coût
  const lastValue = new Map(); // position → dernière valorisation connue
  const points = [];
  for (const e of events) {
    if (!Number.isFinite(e.ms)) continue;
    if (e.kind === 'tx') {
      const a = Number(e.t.amount_cents);
      if (CREDIT.includes(e.t.type)) cash += a; else cash -= a;
      if (e.t.type === 'deposit') deposits += a;
      if (e.t.type === 'withdrawal') withdrawals += a;
      if (e.t.type === 'investment' && e.t.investment_id != null) open.set(String(e.t.investment_id), a);
    } else if (e.kind === 'val') {
      lastValue.set(String(e.v.investment_id), Number(e.v.value_cents));
    } else if (e.kind === 'close') {
      open.delete(e.id);
    }
    let positions = 0;
    for (const [id, cost] of open) positions += lastValue.has(id) ? lastValue.get(id) : cost;
    const value = cash + positions, net = deposits - withdrawals;
    const p = { t: e.ms, value, net, pl: value - net, perf: deposits > 0 ? (value - net) / deposits : null };
    if (points.length && points[points.length - 1].t === p.t) points[points.length - 1] = p; else points.push(p);
  }
  return { points: points.map((p, i) => ({ ...p, change: i ? p.value - points[i - 1].value : p.value })), deposits, withdrawals, positions: inv.size };
}

/** Indicateurs du tableau de bord client, tous dérivés des écritures. */
async function dashboard(userId, lang) {
  const [s, tl] = await Promise.all([summary(userId, lang), timeline(userId)]);
  const value = s.cash + s.value, net = tl.deposits - tl.withdrawals, pl = value - net;
  return {
    s, points: tl.points,
    stats: { value, available: s.available, invested: s.invested, deposits: tl.deposits, withdrawals: tl.withdrawals, pl, perf: tl.deposits > 0 ? pl / tl.deposits : null }
  };
}

module.exports.timeline = timeline;
module.exports.dashboard = dashboard;
