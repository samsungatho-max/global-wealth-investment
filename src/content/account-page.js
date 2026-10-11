'use strict';
/** Textes du tableau de bord client (anglais et français ; les autres langues affichent l'anglais). */
const L = (en, fr) => ({ en, fr });

module.exports = {
  title: L('Portfolio dashboard', 'Tableau de bord du portefeuille'),
  account: L('Client account', 'Compte client'),
  deposit: L('Deposit Funds', 'Déposer des fonds'),
  withdraw: L('Withdraw Funds', 'Retirer des fonds'),
  stats: {
    value: L('Portfolio Value', 'Valeur du portefeuille'),
    valueNote: L('Cash balance and open positions at their latest recorded valuation', 'Liquidités et positions ouvertes à leur dernière valorisation enregistrée'),
    available: L('Available Balance', 'Solde disponible'),
    invested: L('Invested Funds', 'Fonds investis'),
    deposits: L('Total Deposits', 'Total des dépôts'),
    withdrawals: L('Total Withdrawals', 'Total des retraits'),
    pl: L('Profit / Loss', 'Gain / Perte'),
    perf: L('Performance', 'Performance'),
    perfNote: L('Profit / loss relative to total deposits', 'Gain / perte rapporté au total des dépôts'),
    reserved: L('reserved for pending withdrawals', 'réservés pour des retraits en cours'),
    positions: L('open position(s)', 'position(s) ouverte(s)')
  },
  chart: {
    title: L('Portfolio evolution', 'Évolution du portefeuille'),
    ranges: [['1H', 3600e3], ['1D', 86400e3], ['1W', 7 * 86400e3], ['1M', 30 * 86400e3], ['3M', 91 * 86400e3], ['6M', 182 * 86400e3], ['1Y', 365 * 86400e3], ['ALL', 0]],
    change: L('Change in value over the period, deposits and withdrawals included:', 'Variation de la valeur sur la période, dépôts et retraits compris :'),
    pl: L('profit / loss over the period', 'gain / perte sur la période'),
    net: L('Net deposits (deposits − withdrawals)', 'Dépôts nets (dépôts − retraits)'),
    updated: L('Updated', 'Mis à jour'),
    auto: L('refreshed every minute', 'actualisé chaque minute'),
    basis: L('Built only from confirmed transactions and valuations recorded on your account. The value changes when an operation or a valuation is recorded; it is not a forecast.',
      'Établi uniquement à partir des transactions confirmées et des valorisations enregistrées sur votre compte. La valeur change lorsqu’une opération ou une valorisation est enregistrée ; ce n’est pas une prévision.'),
    empty: L('No confirmed operation yet. Your chart will appear after your first confirmed deposit.', 'Aucune opération confirmée pour l’instant. Votre graphique apparaîtra après votre premier dépôt confirmé.'),
    flat: L('No change recorded over this period.', 'Aucune variation enregistrée sur cette période.')
  },
  history: {
    title: L('Portfolio history', 'Historique du portefeuille'),
    time: L('Time', 'Date et heure'), value: L('Portfolio value', 'Valeur du portefeuille'), change: L('Change', 'Variation'), perf: L('Performance', 'Performance'),
    none: L('No entry yet.', 'Aucune écriture pour l’instant.')
  },
  positions: {
    title: L('Positions', 'Positions'), all: L('All positions', 'Toutes les positions'),
    project: L('Position', 'Position'), invested: L('Invested', 'Investi'), value: L('Current value', 'Valeur actuelle'), perf: L('Performance', 'Performance'),
    asOf: L('valued on', 'valorisée le'), cost: L('at cost, no valuation yet', 'au coût, pas encore valorisée'),
    none: L('No open position.', 'Aucune position ouverte.')
  },
  withdrawals: {
    title: L('Withdrawal requests', 'Demandes de retrait'),
    steps: [L('Pending', 'En attente'), L('Under review', 'En cours d’examen'), L('Approved', 'Approuvé'), L('Completed', 'Effectué')],
    rejected: L('Rejected', 'Refusé'), cancelled: L('Cancelled', 'Annulé'),
    none: L('No withdrawal request.', 'Aucune demande de retrait.')
  },
  tx: {
    title: L('Transaction History', 'Historique des transactions'), all: L('All transactions', 'Toutes les transactions'),
    date: L('Date', 'Date'), type: L('Transaction', 'Transaction'), ref: L('Reference', 'Référence'), amount: L('Amount', 'Montant'), status: L('Status', 'Statut'),
    none: L('No transaction yet.', 'Aucune transaction pour l’instant.')
  },
  requests: L('My requests', 'Mes demandes')
};
