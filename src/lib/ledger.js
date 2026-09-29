'use strict';
/**
 * Calculs financiers — toujours dérivés des écritures de la base de données.
 * Aucun solde n'est stocké en dur : il est recalculé à partir des transactions confirmées.
 */
const { one, all } = require('../db');
const { parseI18n } = require('./content');

const CREDIT = ['deposit', 'payout'];
const DEBIT = ['withdrawal', 'investment', 'fee'];

function cashBalance(userId) {
  const r = one(`SELECT
      COALESCE(SUM(CASE WHEN type IN ('deposit','payout') THEN amount_cents END), 0) AS credit,
      COALESCE(SUM(CASE WHEN type IN ('withdrawal','investment','fee') THEN amount_cents END), 0) AS debit
    FROM transactions WHERE user_id = ? AND status = 'confirmed'`, userId);
  return r.credit - r.debit;
}

function reservedForWithdrawals(userId) {
  return one(`SELECT COALESCE(SUM(amount_cents),0) AS s FROM transactions
    WHERE user_id = ? AND type = 'withdrawal' AND status IN ('pending','processing')`, userId).s;
}

function availableBalance(userId) {
  return cashBalance(userId) - reservedForWithdrawals(userId);
}

/** Portefeuille : investissements + dernière valorisation enregistrée par l'administration. */
function portfolio(userId, lang) {
  const rows = all(`SELECT i.*, p.i18n AS p_i18n, p.slug AS p_slug, p.sector, p.country,
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

function summary(userId, lang) {
  const items = portfolio(userId, lang);
  const active = items.filter((i) => i.status === 'active');
  const invested = active.reduce((s, i) => s + i.amount_cents, 0);
  const value = active.reduce((s, i) => s + i.current_value, 0);
  return {
    items,
    active,
    matured: items.filter((i) => i.status !== 'active'),
    invested,
    value,
    unvalued: active.filter((i) => !i.valued).length,
    cash: cashBalance(userId),
    available: availableBalance(userId),
    reserved: reservedForWithdrawals(userId)
  };
}

/** Historique réel des valorisations (dates précises) pour tous les investissements du client. */
function valuationHistory(userId, lang) {
  return all(`SELECT v.*, i.amount_cents, i.start_date, p.i18n AS p_i18n FROM valuations v
      JOIN investments i ON i.id = v.investment_id JOIN projects p ON p.id = i.project_id
      WHERE i.user_id = ? ORDER BY v.valuation_date DESC, v.id DESC`, userId)
    .map((v) => ({
      ...v,
      title: parseI18n(v.p_i18n, lang).title,
      perf: (v.value_cents - v.amount_cents) / v.amount_cents
    }));
}

/** Montant mobilisé : uniquement la somme des investissements enregistrés et confirmés. */
function raisedForProject(projectId) {
  return one(`SELECT COALESCE(SUM(amount_cents),0) AS s FROM investments
    WHERE project_id = ? AND status IN ('active','matured')`, projectId).s;
}

module.exports = { cashBalance, availableBalance, reservedForWithdrawals, portfolio, summary, valuationHistory, raisedForProject, CREDIT, DEBIT };
