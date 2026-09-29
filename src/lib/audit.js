'use strict';
/** Journal d'audit en ajout seul (les triggers SQL interdisent UPDATE/DELETE). */
const { run } = require('../db');

function audit(req, action, targetType, targetId, details) {
  const u = req && req.user;
  run(`INSERT INTO audit_log (actor_id, actor_email, action, target_type, target_id, details, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    u ? u.id : null, u ? u.email : null, action, targetType || null,
    targetId != null ? String(targetId) : null,
    details ? JSON.stringify(details) : null,
    req ? req.ip : null);
}

module.exports = { audit };
