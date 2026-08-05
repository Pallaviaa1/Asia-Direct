const { query } = require('../../helpers/dbQuery');
const { canAccessClient } = require('../permissions/authorizeTool');

function clean(text) {
    if (text == null || text === '') return null;
    const s = String(text).replace(/\s+/g, ' ').trim();
    return s || null;
}

function num(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
}

function paymentLabel(row) {
    const status = clean(row.invoice_status);
    if (status) return status;
    const amt = num(row.invoice_amt);
    const paid = num(row.payment);
    if (amt > 0 && paid <= 0) return 'Unpaid';
    if (amt > 0 && paid > 0 && paid + 0.01 < amt) return 'Part Paid';
    if (amt > 0 && paid + 0.01 >= amt) return 'Paid';
    if (paid > 0) return 'Part Paid';
    return null;
}

function mapReleaseRow(row) {
    if (!row) return null;
    const releaseStatus = clean(row.release_status) || 'Open';
    return {
        id: row.realese_id || row.id || null,
        invoice_id: row.invoice_id,
        order_id: row.order_id,
        order_number: row.order_id ? `OR000${row.order_id}` : clean(row.order_number),
        customer_name: clean(row.customer_name) || clean(row.order_user_name) || clean(row.client_name),
        client_id: row.client_id,
        clearing_status: clean(row.clearance_status) || clean(row.clearing_status),
        cargo_inspection: clean(row.cargo_inspection),
        payment_label: paymentLabel(row),
        invoice_amt: row.invoice_amt != null ? num(row.invoice_amt) : null,
        payment_amount: row.payment != null ? num(row.payment) : null,
        balance: row.balance != null ? num(row.balance) : null,
        release_instruction: clean(row.release_instruction),
        delivery_label: clean(row.order_status) || clean(row.track_status),
        status_label: releaseStatus,
        outcome_label: releaseStatus,
        sage_document_number: clean(row.sage_document_number),
        sage_customer_name: clean(row.sage_customer_name),
        freight_number: clean(row.freight_number),
    };
}

function buildScope(ctx) {
    const conditions = ['1=1'];
    const params = [];
    if (ctx.isCustomer) {
        conditions.push('(o.client_id = ? OR i.client_id = ?)');
        params.push(ctx.userId, ctx.userId);
    }
    return { conditions, params };
}

function canSee(ctx, row) {
    if (!row) return false;
    if (ctx.isAdmin || ctx.hasFullAccess || ctx.isStaff) return true;
    if (ctx.isCustomer) return Number(row.client_id) === Number(ctx.userId);
    return false;
}

const SELECT = `
    i.id AS invoice_id,
    i.order_id,
    i.client_id AS invoice_client_id,
    i.status AS invoice_status,
    i.payment,
    i.balance,
    i.invoice_amt,
    i.invoice_currency,
    CONCAT('OR000', o.id) AS order_number,
    o.client_id,
    o.client_name,
    o.track_status AS order_status,
    u.full_name AS customer_name,
    u.full_name AS order_user_name,
    c.order_status AS clearance_status,
    r.id AS realese_id,
    r.cargo_inspection,
    r.release_instruction,
    r.Status AS release_status,
    s.document_number AS sage_document_number,
    s.customer_name AS sage_customer_name,
    f.freight_number
`;

const FROM = `
    FROM tbl_invoices i
    INNER JOIN tbl_orders o ON o.id = i.order_id
    LEFT JOIN tbl_users u ON u.id = COALESCE(NULLIF(o.client_id, 0), NULLIF(i.client_id, 0))
    LEFT JOIN clearance_order c ON c.order_id = i.order_id
    LEFT JOIN realese_dashboard r ON r.invoice_id = i.id
    LEFT JOIN sage_invoice_list s ON s.id = i.sage_invoice_id
    LEFT JOIN tbl_freight f ON f.id = NULLIF(o.freight_id, 0)
`;

async function runList(ctx, conditions, params, limit = 25) {
    const rows = await query(
        `SELECT ${SELECT} ${FROM}
         WHERE ${conditions.join(' AND ')}
         ORDER BY i.id DESC
         LIMIT ?`,
        [...params, Math.min(Number(limit) || 25, 50)]
    );
    return rows.map(mapReleaseRow).filter((r) => canSee(ctx, r));
}

async function getReleaseByOrderNumber(orderNumber, ctx) {
    const digits = String(orderNumber || '').replace(/^OR0*/i, '').replace(/\D/g, '');
    if (!digits) return null;
    const { conditions, params } = buildScope(ctx);
    conditions.push('o.id = ?');
    params.push(Number(digits));
    const rows = await runList(ctx, conditions, params, 5);
    return rows[0] || null;
}

async function searchReleaseDashboard(search, ctx, { limit = 25, status } = {}) {
    const { conditions, params } = buildScope(ctx);
    const term = clean(search);
    if (term) {
        const orderDigits = String(term).replace(/^OR0*/i, '').replace(/\D/g, '');
        if (/^OR0*\d+$/i.test(term) && orderDigits) {
            conditions.push('o.id = ?');
            params.push(Number(orderDigits));
        } else {
            conditions.push(
                `(u.full_name LIKE ? OR o.client_name LIKE ? OR s.customer_name LIKE ?
                  OR CONCAT('OR000', o.id) LIKE ? OR f.freight_number LIKE ?
                  OR o.track_status LIKE ? OR i.status LIKE ?
                  OR r.cargo_inspection LIKE ? OR r.release_instruction LIKE ?
                  OR c.order_status LIKE ?)`
            );
            const like = `%${term}%`;
            params.push(like, like, like, like, like, like, like, like, like, like);
        }
    }
    if (status) {
        if (/^open$/i.test(status)) {
            conditions.push(`(r.Status IS NULL OR r.Status = '' OR LOWER(TRIM(r.Status)) = 'open')`);
        } else if (/^close/i.test(status)) {
            conditions.push(`LOWER(TRIM(r.Status)) = 'close'`);
        } else {
            conditions.push('LOWER(TRIM(r.Status)) = LOWER(TRIM(?))');
            params.push(status);
        }
    }
    return runList(ctx, conditions, params, limit);
}

async function listReleaseByClientId(clientId, ctx, { limit = 25 } = {}) {
    if (!clientId || !canAccessClient(ctx, clientId)) return [];
    const { conditions, params } = buildScope(ctx);
    conditions.push('(o.client_id = ? OR i.client_id = ?)');
    params.push(clientId, clientId);
    return runList(ctx, conditions, params, limit);
}

async function countReleaseDashboard(ctx, { search, status } = {}) {
    const { conditions, params } = buildScope(ctx);
    const term = clean(search);
    if (term) {
        const orderDigits = String(term).replace(/^OR0*/i, '').replace(/\D/g, '');
        if (/^OR0*\d+$/i.test(term) && orderDigits) {
            conditions.push('o.id = ?');
            params.push(Number(orderDigits));
        } else {
            conditions.push(
                `(u.full_name LIKE ? OR o.client_name LIKE ? OR s.customer_name LIKE ?
                  OR CONCAT('OR000', o.id) LIKE ? OR f.freight_number LIKE ?)`
            );
            const like = `%${term}%`;
            params.push(like, like, like, like, like);
        }
    }
    if (status) {
        if (/^open$/i.test(status)) {
            conditions.push(`(r.Status IS NULL OR r.Status = '' OR LOWER(TRIM(r.Status)) = 'open')`);
        } else if (/^close/i.test(status)) {
            conditions.push(`LOWER(TRIM(r.Status)) = 'close'`);
        } else {
            conditions.push('LOWER(TRIM(r.Status)) = LOWER(TRIM(?))');
            params.push(status);
        }
    }
    const rows = await query(
        `SELECT COUNT(DISTINCT i.id) AS total ${FROM} WHERE ${conditions.join(' AND ')}`,
        params
    );
    return Number(rows[0]?.total || 0);
}

module.exports = {
    getReleaseByOrderNumber,
    searchReleaseDashboard,
    listReleaseByClientId,
    countReleaseDashboard,
    mapReleaseRow,
};
