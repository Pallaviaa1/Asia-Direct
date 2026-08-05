const { query } = require('../../helpers/dbQuery');
const { canAccessClient } = require('../permissions/authorizeTool');

function clean(text) {
    if (text == null || text === '') return null;
    const s = String(text).replace(/\s+/g, ' ').trim();
    return s || null;
}

function formatDate(value) {
    if (!value) return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        const [y, m, day] = value.slice(0, 10).split('-');
        return `${day}/${m}/${y}`;
    }
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
}

function mapDisputeRow(row) {
    if (!row) return null;
    const outcome = clean(row.outcome) || 'Pending';
    return {
        id: row.id,
        user_id: row.user_id,
        dispute_id: clean(row.Dispute_ID) || clean(row.dispute_id),
        name: clean(row.name),
        freight_no: clean(row.freight_no),
        email: clean(row.email),
        subject: clean(row.subject),
        message: clean(row.message),
        nature_of_heading: clean(row.nature_of_Heading) || clean(row.nature_of_heading),
        outcome: outcome,
        outcome_label: outcome,
        resolution: clean(row.resolution),
        date_label: formatDate(row.created),
        created: row.created,
        action_label: outcome,
    };
}

function buildScope(ctx) {
    const conditions = ['1=1'];
    const params = [];
    if (ctx.isCustomer) {
        conditions.push('q.user_id = ?');
        params.push(ctx.userId);
    }
    return { conditions, params };
}

function canSee(ctx, row) {
    if (!row) return false;
    if (ctx.isAdmin || ctx.hasFullAccess || ctx.isStaff) return true;
    if (ctx.isCustomer) return Number(row.user_id) === Number(ctx.userId);
    return false;
}

async function getDisputeById(disputeId, ctx) {
    if (!disputeId) return null;
    const { conditions, params } = buildScope(ctx);
    conditions.push('LOWER(TRIM(q.Dispute_ID)) = LOWER(TRIM(?))');
    params.push(disputeId);
    const rows = await query(
        `SELECT q.* FROM tbl_queries q WHERE ${conditions.join(' AND ')} LIMIT 1`,
        params
    );
    const row = mapDisputeRow(rows[0]);
    if (!row || !canSee(ctx, row)) return null;
    return row;
}

async function searchDisputes(search, ctx, { limit = 25, outcome } = {}) {
    const { conditions, params } = buildScope(ctx);
    const term = clean(search);
    if (term) {
        conditions.push(
            `(q.name LIKE ? OR q.email LIKE ? OR q.message LIKE ? OR q.subject LIKE ?
              OR q.Dispute_ID LIKE ? OR q.freight_no LIKE ? OR q.nature_of_Heading LIKE ?)`
        );
        const like = `%${term}%`;
        params.push(like, like, like, like, like, like, like);
    }
    if (outcome) {
        conditions.push('LOWER(TRIM(q.outcome)) = LOWER(TRIM(?))');
        params.push(outcome);
    }
    const rows = await query(
        `SELECT q.* FROM tbl_queries q
         WHERE ${conditions.join(' AND ')}
         ORDER BY q.created DESC
         LIMIT ?`,
        [...params, Math.min(Number(limit) || 25, 50)]
    );
    return rows.map(mapDisputeRow).filter((r) => canSee(ctx, r));
}

async function listDisputesByFreightOrOrder(ref, ctx, { limit = 25 } = {}) {
    const token = clean(ref);
    if (!token) return [];
    const { conditions, params } = buildScope(ctx);
    conditions.push('q.freight_no LIKE ?');
    params.push(`%${token}%`);
    const rows = await query(
        `SELECT q.* FROM tbl_queries q
         WHERE ${conditions.join(' AND ')}
         ORDER BY q.created DESC
         LIMIT ?`,
        [...params, Math.min(Number(limit) || 25, 50)]
    );
    return rows.map(mapDisputeRow).filter((r) => canSee(ctx, r));
}

async function listDisputesByUserId(userId, ctx, { limit = 25 } = {}) {
    if (!userId || !canAccessClient(ctx, userId)) return [];
    if (ctx.isCustomer && Number(userId) !== Number(ctx.userId)) return [];
    const rows = await query(
        `SELECT q.* FROM tbl_queries q
         WHERE q.user_id = ?
         ORDER BY q.created DESC
         LIMIT ?`,
        [userId, Math.min(Number(limit) || 25, 50)]
    );
    return rows.map(mapDisputeRow).filter((r) => canSee(ctx, r));
}

async function countDisputes(ctx, { search, outcome } = {}) {
    const { conditions, params } = buildScope(ctx);
    const term = clean(search);
    if (term) {
        conditions.push(
            `(q.name LIKE ? OR q.email LIKE ? OR q.message LIKE ? OR q.subject LIKE ?
              OR q.Dispute_ID LIKE ? OR q.freight_no LIKE ? OR q.nature_of_Heading LIKE ?)`
        );
        const like = `%${term}%`;
        params.push(like, like, like, like, like, like, like);
    }
    if (outcome) {
        conditions.push('LOWER(TRIM(q.outcome)) = LOWER(TRIM(?))');
        params.push(outcome);
    }
    const rows = await query(
        `SELECT COUNT(*) AS total FROM tbl_queries q WHERE ${conditions.join(' AND ')}`,
        params
    );
    return Number(rows[0]?.total || 0);
}

module.exports = {
    getDisputeById,
    searchDisputes,
    listDisputesByFreightOrOrder,
    listDisputesByUserId,
    countDisputes,
    mapDisputeRow,
};
