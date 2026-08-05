const { query } = require('../../helpers/dbQuery');
const { canAccessInvoices, canAccessClient } = require('../permissions/authorizeTool');

function clean(text) {
    if (text == null || text === '') return null;
    const s = String(text).replace(/\s+/g, ' ').trim();
    return s || null;
}

function num(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
}

function formatDate(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        const [y, m, d] = value.slice(0, 10).split('-');
        if (Number(y) <= 1970) return null;
        return `${d}/${m}/${y}`;
    }
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime()) || d.getFullYear() <= 1970) return null;
    // Local calendar day (MySQL DATE often arrives as local midnight)
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
}

function formatOrderNumber(orderId) {
    if (!orderId) return null;
    const id = Number(orderId);
    if (!Number.isFinite(id) || id <= 0) return null;
    return `OR000${id}`;
}

function allocatedLabel(value) {
    const s = clean(value);
    if (!s) return '—';
    if (/^y(es)?$/i.test(s) || s === '1') return 'YES';
    if (/^n(o)?$/i.test(s) || s === '0') return 'NO';
    return s.toUpperCase();
}

function mapCashbookRow(row) {
    if (!row) return null;
    const orderNumber = clean(row.order_number) || formatOrderNumber(row.order_id);
    const hasPop = Boolean(row.invoice_pop || (row.freight_pop_docs && row.freight_pop_docs.length));
    const receipt = row.receipt != null && row.receipt !== '' ? num(row.receipt) : 0;
    const payment = row.payment != null && row.payment !== '' ? num(row.payment) : 0;
    return {
        id: row.id || row.cashbook_id,
        date_label: formatDate(row.date),
        bank_ref: clean(row.bank_ref),
        description: clean(row.description_on_receipt),
        receipt,
        receipt_label: receipt,
        payment,
        payment_label: payment,
        customer_id: row.customer_id,
        customer_name: clean(row.customer_name) || clean(row.full_name),
        order_id: row.order_id,
        shipment_ref: orderNumber,
        order_number: orderNumber,
        freight_id: row.freight_id || null,
        freight_number: clean(row.freight_number),
        allocated_label: allocatedLabel(row.allocated),
        invoice_pop_label: hasPop ? 'Yes' : '—',
        freight_pop_docs: row.freight_pop_docs || [],
    };
}

function canSee(ctx, row) {
    if (!row) return false;
    if (ctx.isAdmin || ctx.hasFullAccess || ctx.isStaff) return true;
    if (ctx.isCustomer) return Number(row.customer_id) === Number(ctx.userId);
    return false;
}

function buildScope(ctx) {
    const conditions = ['1=1'];
    const params = [];
    if (ctx.isCustomer) {
        conditions.push('cb.customer_id = ?');
        params.push(ctx.userId);
    }
    return { conditions, params };
}

const SELECT = `
    cb.id,
    cb.id AS cashbook_id,
    cb.date,
    cb.bank_ref,
    cb.description_on_receipt,
    cb.receipt,
    cb.payment,
    cb.customer_id,
    cb.order_id,
    cb.allocated,
    cb.created_at,
    u.full_name AS customer_name,
    o.freight_id,
    f.freight_number
`;

const FROM = `
    FROM tbl_cashbook cb
    LEFT JOIN tbl_users u ON u.id = cb.customer_id
    LEFT JOIN tbl_orders o ON o.id = cb.order_id
    LEFT JOIN tbl_freight f ON f.id = o.freight_id
`;

async function attachPopDocs(rows) {
    if (!rows?.length) return rows || [];
    const freightIds = [...new Set(rows.map((r) => r.freight_id).filter(Boolean))];
    if (!freightIds.length) {
        return rows.map((r) => ({ ...r, freight_pop_docs: [], invoice_pop: null }));
    }
    try {
        const placeholders = freightIds.map(() => '?').join(',');
        const docs = await query(
            `SELECT id, freight_id, document_name, document, uploaded_by, created_at
             FROM freight_doc
             WHERE freight_id IN (${placeholders})
               AND document_name = 'POP (AD)'
             ORDER BY id DESC`,
            freightIds
        );
        const byFreight = {};
        for (const doc of docs) {
            if (!byFreight[doc.freight_id]) byFreight[doc.freight_id] = [];
            byFreight[doc.freight_id].push(doc);
        }
        return rows.map((r) => {
            const list = r.freight_id ? byFreight[r.freight_id] || [] : [];
            return {
                ...r,
                freight_pop_docs: list,
                invoice_pop: list[0]?.document || null,
            };
        });
    } catch (_) {
        return rows.map((r) => ({ ...r, freight_pop_docs: [], invoice_pop: null }));
    }
}

async function runList(ctx, conditions, params, limit = 25) {
    if (!canAccessInvoices(ctx)) return { allowed: false, rows: [], message: 'Cashbook access is restricted for your role.' };
    const rows = await query(
        `SELECT ${SELECT} ${FROM}
         WHERE ${conditions.join(' AND ')}
         ORDER BY cb.id DESC
         LIMIT ?`,
        [...params, Math.min(Number(limit) || 25, 50)]
    );
    const withDocs = await attachPopDocs(rows);
    return {
        allowed: true,
        rows: withDocs.map(mapCashbookRow).filter((r) => canSee(ctx, r)),
        message: null,
    };
}

async function getCashbookByBankRef(bankRef, ctx) {
    const ref = clean(bankRef);
    if (!ref) return { allowed: true, entry: null, message: null };
    if (!canAccessInvoices(ctx)) {
        return { allowed: false, entry: null, message: 'Cashbook access is restricted for your role.' };
    }
    const { conditions, params } = buildScope(ctx);
    conditions.push('TRIM(cb.bank_ref) = ?');
    params.push(ref);
    const result = await runList(ctx, conditions, params, 5);
    if (!result.allowed) return { allowed: false, entry: null, message: result.message };
    return { allowed: true, entry: result.rows[0] || null, message: null };
}

async function getCashbookById(id, ctx) {
    if (!id) return { allowed: true, entry: null, message: null };
    if (!canAccessInvoices(ctx)) {
        return { allowed: false, entry: null, message: 'Cashbook access is restricted for your role.' };
    }
    const { conditions, params } = buildScope(ctx);
    conditions.push('cb.id = ?');
    params.push(Number(id));
    const result = await runList(ctx, conditions, params, 1);
    if (!result.allowed) return { allowed: false, entry: null, message: result.message };
    return { allowed: true, entry: result.rows[0] || null, message: null };
}

async function searchCashbook(search, ctx, { limit = 25, allocated } = {}) {
    if (!canAccessInvoices(ctx)) {
        return { allowed: false, entries: [], message: 'Cashbook access is restricted for your role.' };
    }
    const { conditions, params } = buildScope(ctx);
    const term = clean(search);
    if (term) {
        if (/^20\d{8,11}$/.test(term)) {
            conditions.push('TRIM(cb.bank_ref) = ?');
            params.push(term);
        } else if (/^OR0*\d+/i.test(term)) {
            const digits = term.replace(/^OR0*/i, '');
            conditions.push('(cb.order_id = ? OR CONCAT(\'OR000\', cb.order_id) LIKE ?)');
            params.push(Number(digits) || 0, `%${term}%`);
        } else if (/^F-\d+/i.test(term)) {
            conditions.push('LOWER(TRIM(f.freight_number)) = LOWER(TRIM(?))');
            params.push(term);
        } else {
            conditions.push(
                `(cb.bank_ref LIKE ? OR cb.description_on_receipt LIKE ?
                  OR u.full_name LIKE ? OR f.freight_number LIKE ?
                  OR CONCAT('OR000', cb.order_id) LIKE ?)`
            );
            const like = `%${term}%`;
            params.push(like, like, like, like, like);
        }
    }
    if (allocated === 'Yes' || allocated === 'YES') {
        conditions.push(`(LOWER(TRIM(IFNULL(cb.allocated,''))) IN ('yes','y','1'))`);
    } else if (allocated === 'No' || allocated === 'NO') {
        conditions.push(
            `(cb.allocated IS NULL OR TRIM(cb.allocated) = '' OR LOWER(TRIM(cb.allocated)) IN ('no','n','0'))`
        );
    }
    const result = await runList(ctx, conditions, params, limit);
    if (!result.allowed) return { allowed: false, entries: [], message: result.message };
    return { allowed: true, entries: result.rows, message: null };
}

async function listCashbookByClientId(clientId, ctx, { limit = 25 } = {}) {
    if (!clientId || !canAccessClient(ctx, clientId)) {
        return { allowed: true, entries: [], message: null };
    }
    if (!canAccessInvoices(ctx)) {
        return { allowed: false, entries: [], message: 'Cashbook access is restricted for your role.' };
    }
    const { conditions, params } = buildScope(ctx);
    conditions.push('cb.customer_id = ?');
    params.push(clientId);
    const result = await runList(ctx, conditions, params, limit);
    if (!result.allowed) return { allowed: false, entries: [], message: result.message };
    return { allowed: true, entries: result.rows, message: null };
}

async function listCashbookByOrderId(orderId, ctx, { limit = 25 } = {}) {
    if (!orderId) return { allowed: true, entries: [], message: null };
    const { conditions, params } = buildScope(ctx);
    conditions.push('cb.order_id = ?');
    params.push(Number(orderId));
    const result = await runList(ctx, conditions, params, limit);
    if (!result.allowed) return { allowed: false, entries: [], message: result.message };
    return { allowed: true, entries: result.rows, message: null };
}

async function countCashbook(ctx, { search, allocated } = {}) {
    if (!canAccessInvoices(ctx)) {
        return { allowed: false, total: 0, message: 'Cashbook access is restricted for your role.' };
    }
    const { conditions, params } = buildScope(ctx);
    const term = clean(search);
    if (term) {
        conditions.push(
            `(cb.bank_ref LIKE ? OR cb.description_on_receipt LIKE ?
              OR u.full_name LIKE ? OR f.freight_number LIKE ?)`
        );
        const like = `%${term}%`;
        params.push(like, like, like, like);
    }
    if (allocated === 'Yes' || allocated === 'YES') {
        conditions.push(`(LOWER(TRIM(IFNULL(cb.allocated,''))) IN ('yes','y','1'))`);
    } else if (allocated === 'No' || allocated === 'NO') {
        conditions.push(
            `(cb.allocated IS NULL OR TRIM(cb.allocated) = '' OR LOWER(TRIM(cb.allocated)) IN ('no','n','0'))`
        );
    }
    const rows = await query(
        `SELECT COUNT(DISTINCT cb.id) AS total ${FROM} WHERE ${conditions.join(' AND ')}`,
        params
    );
    return { allowed: true, total: Number(rows[0]?.total || 0), message: null };
}

module.exports = {
    getCashbookByBankRef,
    getCashbookById,
    searchCashbook,
    listCashbookByClientId,
    listCashbookByOrderId,
    countCashbook,
    mapCashbookRow,
};
