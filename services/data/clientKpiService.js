const { query } = require('../../helpers/dbQuery');

function clean(text) {
    if (text == null || text === '') return null;
    const s = String(text).replace(/\s+/g, ' ').trim();
    return s || null;
}

function num(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
}

function canAccessClientKpi(ctx) {
    if (ctx.isAdmin || ctx.hasFullAccess || ctx.isStaff) return true;
    return false;
}

function mapRow(row, index = 0) {
    if (!row) return null;
    return {
        sr_no: index + 1,
        client_id: row.client_id,
        name: clean(row.full_name) || clean(row.name) || '—',
        freight: Number(row.total_freight) || 0,
        orders: Number(row.total_orders) || 0,
        delivered_orders: Number(row.total_delivered) || 0,
        total_amount: num(row.total_amount),
        total_amount_label: Number(num(row.total_amount)).toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }),
        is_new: Number(row.is_new) === 1,
    };
}

const KPI_FROM = `
    FROM tbl_users u
    LEFT JOIN tbl_freight f
        ON f.client_id = u.id
        AND f.is_deleted = 0
    LEFT JOIN tbl_orders o
        ON o.freight_id = f.id
    LEFT JOIN (
        SELECT
            f.id AS freight_id,
            COALESCE(esq.sumofRoe, se.total_amount, 0) AS amount,
            CASE WHEN esq.sumofRoe IS NOT NULL THEN 1 ELSE 0 END AS is_new
        FROM tbl_freight f
        LEFT JOIN estimate_shipping_quote esq ON esq.id = f.shipping_estimate_id
        LEFT JOIN shipping_estimate se ON se.freight_id = f.id
    ) AS f_amount ON f_amount.freight_id = f.id
`;

const KPI_WHERE = `
    WHERE f.id IN (SELECT DISTINCT freight_id FROM tbl_orders)
`;

async function searchClientKpi(search, ctx, { limit = 25 } = {}) {
    if (!canAccessClientKpi(ctx)) {
        // Customers: only their own KPI row if present
        if (ctx.isCustomer) {
            const self = await getClientKpiByClientId(ctx.userId, ctx);
            return self ? [self] : [];
        }
        return [];
    }

    const conditions = [KPI_WHERE.trim()];
    const params = [];
    const term = clean(search);
    if (term) {
        if (/^\d+$/.test(term)) {
            conditions.push('u.id = ?');
            params.push(Number(term));
        } else {
            conditions.push('u.full_name LIKE ?');
            params.push(`%${term}%`);
        }
    }

    const rows = await query(
        `SELECT
            u.id AS client_id,
            u.full_name,
            COUNT(DISTINCT f.id) AS total_freight,
            COUNT(DISTINCT o.id) AS total_orders,
            COUNT(DISTINCT CASE WHEN o.track_status = 'Delivered' THEN o.id END) AS total_delivered,
            COALESCE(ROUND(SUM(f_amount.amount), 2), 0) AS total_amount,
            MAX(f_amount.is_new) AS is_new
         ${KPI_FROM}
         ${conditions.join(' AND ')}
         GROUP BY u.id, u.full_name
         ORDER BY is_new DESC, total_amount DESC
         LIMIT ?`,
        [...params, Math.min(Number(limit) || 25, 50)]
    );

    return rows.map((row, i) => mapRow(row, i));
}

async function getClientKpiByClientId(clientId, ctx) {
    if (!clientId) return null;
    if (ctx.isCustomer && Number(clientId) !== Number(ctx.userId)) return null;
    if (!ctx.isCustomer && !canAccessClientKpi(ctx)) return null;

    const rows = await query(
        `SELECT
            u.id AS client_id,
            u.full_name,
            COUNT(DISTINCT f.id) AS total_freight,
            COUNT(DISTINCT o.id) AS total_orders,
            COUNT(DISTINCT CASE WHEN o.track_status = 'Delivered' THEN o.id END) AS total_delivered,
            COALESCE(ROUND(SUM(f_amount.amount), 2), 0) AS total_amount,
            MAX(f_amount.is_new) AS is_new
         ${KPI_FROM}
         ${KPI_WHERE}
           AND u.id = ?
         GROUP BY u.id, u.full_name
         LIMIT 1`,
        [clientId]
    );
    return mapRow(rows[0], 0);
}

async function countClientKpi(ctx, { search } = {}) {
    if (!canAccessClientKpi(ctx)) {
        if (ctx.isCustomer) {
            const self = await getClientKpiByClientId(ctx.userId, ctx);
            return { allowed: true, total: self ? 1 : 0 };
        }
        return { allowed: false, total: 0, message: 'Client KPI is not available for your account.' };
    }

    const conditions = [
        `f.id IN (SELECT DISTINCT freight_id FROM tbl_orders)`,
    ];
    const params = [];
    const term = clean(search);
    if (term) {
        if (/^\d+$/.test(term)) {
            conditions.push('u.id = ?');
            params.push(Number(term));
        } else {
            conditions.push('u.full_name LIKE ?');
            params.push(`%${term}%`);
        }
    }

    const rows = await query(
        `SELECT COUNT(*) AS total FROM (
            SELECT u.id
            FROM tbl_users u
            LEFT JOIN tbl_freight f ON f.client_id = u.id AND f.is_deleted = 0
            WHERE ${conditions.join(' AND ')}
            GROUP BY u.id
         ) AS t`,
        params
    );
    return { allowed: true, total: Number(rows[0]?.total || 0) };
}

module.exports = {
    searchClientKpi,
    getClientKpiByClientId,
    countClientKpi,
};
