const { query } = require('../../helpers/dbQuery');
const { canAccessInvoices, canAccessClient } = require('../permissions/authorizeTool');

/**
 * Invoices live in multiple tables in this system:
 * 1) quote_invoice          → ADINV* references (Workspace freight quote invoices)
 * 2) tbl_invoices           → cashbook / order invoices
 * 3) sage_invoice_list      → Sage imports (matched via tbl_invoices or customer name)
 */
async function getInvoicesByClientId(clientId, ctx) {
    if (!canAccessClient(ctx, clientId)) {
        return { allowed: false, invoices: [], message: 'You are not authorized to view this client.' };
    }

    if (!canAccessInvoices(ctx)) {
        return { allowed: false, invoices: [], message: 'Invoice access is restricted for your role.' };
    }

    const clients = await query(
        `SELECT id, full_name, client_number, email
         FROM tbl_users
         WHERE id = ? AND is_deleted = 0
         LIMIT 1`,
        [clientId]
    );
    const client = clients[0] || null;
    const clientName = client?.full_name || null;

    const [quoteInvoices, cashbookInvoices, sageInvoices] = await Promise.all([
        getQuoteInvoices(clientId, clientName),
        getCashbookInvoices(clientId),
        getSageInvoicesByCustomerName(clientName),
    ]);

    // Prefer quote invoices (ADINV), then cashbook, then sage-only rows not already linked
    const seen = new Set();
    const invoices = [];

    for (const inv of [...quoteInvoices, ...cashbookInvoices, ...sageInvoices]) {
        const key = inv.reference_no || inv.sage_invoice_number || inv.document_number || `id-${inv.invoice_id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        invoices.push(inv);
    }

    return { allowed: true, invoices, message: null };
}

async function getQuoteInvoices(clientId, clientName) {
    try {
        const params = [clientId];
        let nameClause = '';
        if (clientName) {
            nameClause = ' OR qi.client_name LIKE ? ';
            params.push(`%${clientName}%`);
        }

        return await query(
            `SELECT
                qi.id AS invoice_id,
                qi.id AS quote_invoice_id,
                qi.reference_no,
                qi.reference_no AS sage_invoice_number,
                qi.reference_no AS document_number,
                qi.client_id,
                qi.client_name,
                qi.customer_invoice_no AS customer_ref,
                qi.final_base_currency AS invoice_currency,
                qi.sumof_finalamount AS invoice_amt,
                qi.sumof_finalamount AS sage_total,
                qi.sumof_vatincl,
                qi.status AS invoice_status,
                qi.created_at AS invoice_date,
                qi.created_at AS inv_date,
                qi.freight_id,
                qi.order_id,
                tf.freight_number,
                tf.client_ref_name AS customer_ref_name,
                ca.country AS country_name,
                'quote_invoice' AS invoice_source
             FROM quote_invoice qi
             LEFT JOIN freight_quote_estimate fqe ON fqe.id = qi.freight_quote_estimate_id
             LEFT JOIN tbl_freight tf ON tf.id = COALESCE(qi.freight_id, fqe.freight_id)
             LEFT JOIN company_addresses ca ON ca.id = qi.company_id AND ca.is_deleted = 0
             WHERE qi.is_deleted = 0
               AND (qi.client_id = ? ${nameClause})
             ORDER BY qi.id DESC
             LIMIT 50`,
            params
        );
    } catch (err) {
        console.error('quote_invoice lookup error:', err.message);
        return [];
    }
}

async function getCashbookInvoices(clientId) {
    try {
        return await query(
            `SELECT
                i.id AS invoice_id,
                i.date AS invoice_date,
                i.transaction,
                i.order_id,
                i.client_id,
                i.sage_invoice_id,
                i.Excl,
                i.Vat,
                i.invoice_amt,
                i.invoice_currency,
                i.due_date,
                i.status AS invoice_status,
                i.payment,
                i.balance,
                i.day_overdue,
                i.allocated,
                i.created_at,
                CONCAT('OR000', o.id) AS order_number,
                f.freight_number,
                f.id AS freight_id,
                sil.id AS sage_id,
                sil.document_number AS sage_invoice_number,
                sil.document_number,
                sil.document_number AS reference_no,
                sil.customer_name AS sage_customer_name,
                sil.customer_ref AS customer_ref,
                sil.total AS sage_total,
                sil.date AS sage_date,
                COALESCE(u.full_name, sil.customer_name, 'Unknown Client') AS client_name,
                'tbl_invoices' AS invoice_source
             FROM tbl_invoices i
             LEFT JOIN tbl_orders o ON o.id = i.order_id
             LEFT JOIN tbl_freight f ON f.id = o.freight_id
             LEFT JOIN sage_invoice_list sil ON sil.id = i.sage_invoice_id
             LEFT JOIN tbl_users u ON u.id = i.client_id
             WHERE i.client_id = ?
             ORDER BY i.id DESC
             LIMIT 50`,
            [clientId]
        );
    } catch (err) {
        console.error('tbl_invoices lookup error:', err.message);
        return [];
    }
}

async function getSageInvoicesByCustomerName(clientName) {
    if (!clientName || clientName.length < 2) return [];
    try {
        return await query(
            `SELECT
                sil.id AS invoice_id,
                sil.id AS sage_id,
                sil.document_number AS sage_invoice_number,
                sil.document_number AS reference_no,
                sil.document_number,
                sil.customer_name AS client_name,
                sil.customer_ref AS customer_ref,
                sil.total AS invoice_amt,
                sil.total AS sage_total,
                sil.date AS invoice_date,
                sil.document AS sage_document,
                'sage_invoice_list' AS invoice_source
             FROM sage_invoice_list sil
             WHERE sil.customer_name LIKE ?
             ORDER BY sil.id DESC
             LIMIT 50`,
            [`%${clientName}%`]
        );
    } catch (err) {
        console.error('sage_invoice_list lookup error:', err.message);
        return [];
    }
}

function formatSageDate(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        const [y, m, d] = value.slice(0, 10).split('-');
        if (Number(y) <= 1970) return null;
        return `${d}/${m}/${y}`;
    }
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    // Use local calendar day — MySQL DATE often arrives as local midnight (e.g. IST),
    // so UTC parts wrongly show the previous day (07/10 → 06/10).
    if (d.getFullYear() <= 1970) return null;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

function cleanText(value) {
    if (value == null) return null;
    const s = String(value).replace(/\s+/g, ' ').trim();
    if (!s) return null;
    if (/^document number$/i.test(s) || /^customer name$/i.test(s) || /^customer ref\.?$/i.test(s)) {
        return null;
    }
    return s;
}

async function attachInvoiceAdDocs(rows) {
    if (!rows?.length) return rows || [];
    return Promise.all(
        rows.map(async (row) => {
            if (!row.freight_id) {
                return { ...row, freight_invoice_docs: [], invoice_ad: null };
            }
            try {
                const docs = await query(
                    `SELECT id, freight_id, document_name, document, uploaded_by, created_at
                     FROM freight_doc
                     WHERE freight_id = ? AND document_name = 'Invoice (AD)'
                     ORDER BY id DESC
                     LIMIT 5`,
                    [row.freight_id]
                );
                return {
                    ...row,
                    freight_invoice_docs: docs,
                    invoice_ad: docs[0]?.document || null,
                };
            } catch (_) {
                return { ...row, freight_invoice_docs: [], invoice_ad: null };
            }
        })
    );
}

function mapSageInvoiceRow(row) {
    if (!row) return null;
    const documentNumber = cleanText(row.document_number);
    const customerName = cleanText(row.customer_name);
    const customerRef = cleanText(row.customer_ref);
    const dateLabel = formatSageDate(row.date);
    const total = row.total != null && row.total !== '' ? Number(row.total) : null;
    const hasUpload = Boolean(cleanText(row.document));
    const hasInvoiceAd = Boolean(row.invoice_ad || (row.freight_invoice_docs && row.freight_invoice_docs.length));

    return {
        ...row,
        sage_id: row.sage_id || row.id,
        document_number: documentNumber,
        customer_name: customerName,
        customer_ref: customerRef,
        date_label: dateLabel,
        total,
        total_label: total != null && !Number.isNaN(total) ? String(total) : '—',
        upload_label: hasUpload ? 'Uploaded' : '—',
        invoice_ad_label: hasInvoiceAd ? 'Yes' : '—',
        invoice_source: 'sage_invoice_list',
        sage_invoice_number: documentNumber,
        reference_no: documentNumber,
        client_name: customerName,
        invoice_amt: total,
        sage_total: total,
        invoice_date: row.date,
        display_title: documentNumber || customerName || `Sage #${row.id}`,
    };
}

function isMeaningfulSageRow(mapped) {
    if (!mapped) return false;
    if (!mapped.document_number && !mapped.customer_name && !mapped.customer_ref) return false;
    if (!mapped.document_number && (mapped.total == null || mapped.total === 0) && !mapped.date_label) {
        return false;
    }
    return true;
}

const SAGE_SELECT = `
    sil.id,
    sil.id AS sage_id,
    sil.document_number,
    sil.customer_name,
    sil.customer_ref,
    sil.date,
    sil.total,
    sil.document,
    ti.id AS invoice_id,
    ti.order_id,
    ti.client_id,
    o.freight_id,
    f.freight_number
`;

const SAGE_FROM = `
    FROM sage_invoice_list sil
    LEFT JOIN tbl_invoices ti ON ti.sage_invoice_id = sil.id
    LEFT JOIN tbl_orders o ON o.id = ti.order_id
    LEFT JOIN tbl_freight f ON f.id = o.freight_id
`;

function dedupeSageRows(rows) {
    const seenIds = new Set();
    const seenDocs = new Set();
    return (rows || []).filter((r) => {
        const id = r.sage_id || r.id;
        const doc = String(r.document_number || '')
            .replace(/\s+/g, '')
            .toUpperCase();
        if (seenIds.has(id)) return false;
        if (doc && seenDocs.has(doc)) return false;
        seenIds.add(id);
        if (doc) seenDocs.add(doc);
        return true;
    });
}

async function getSageInvoiceByDocumentNumber(documentNumber, ctx) {
    if (!canAccessInvoices(ctx)) {
        return { allowed: false, invoice: null, message: 'Invoice access is restricted for your role.' };
    }
    const doc = String(documentNumber || '').trim();
    if (!doc) {
        return { allowed: true, invoice: null, message: null };
    }

    let rows = await query(
        `SELECT ${SAGE_SELECT}
         ${SAGE_FROM}
         WHERE REPLACE(IFNULL(sil.document_number,''), ' ', '') = ?
            OR REPLACE(IFNULL(sil.document_number,''), ' ', '') LIKE ?
         ORDER BY sil.id DESC
         LIMIT 20`,
        [doc.replace(/\s+/g, ''), `%${doc.replace(/\s+/g, '')}%`]
    );

    if (ctx.isCustomer) {
        rows = rows.filter(
            (r) =>
                Number(r.client_id) === Number(ctx.userId) ||
                String(r.customer_name || '')
                    .toLowerCase()
                    .includes(String(ctx.fullName || '').toLowerCase())
        );
    }

    rows = dedupeSageRows(rows);
    const withDocs = await attachInvoiceAdDocs(rows);
    const mapped = withDocs.map(mapSageInvoiceRow).filter(isMeaningfulSageRow);
    return { allowed: true, invoice: mapped[0] || null, message: null };
}

async function searchSageInvoices(searchTerm, ctx, { limit = 30 } = {}) {
    if (!canAccessInvoices(ctx)) {
        return { allowed: false, invoices: [], message: 'Invoice access is restricted for your role.' };
    }
    const term = String(searchTerm || '').trim();
    const max = Math.min(Number(limit) || 30, 50);

    let rows;
    if (term.length >= 2) {
        const like = `%${term}%`;
        rows = await query(
            `SELECT ${SAGE_SELECT}
             ${SAGE_FROM}
             WHERE sil.customer_name LIKE ?
                OR sil.document_number LIKE ?
                OR sil.customer_ref LIKE ?
             ORDER BY sil.id DESC
             LIMIT 80`,
            [like, like, like]
        );
    } else {
        // Recent meaningful sage invoices (list screen default)
        rows = await query(
            `SELECT ${SAGE_SELECT}
             ${SAGE_FROM}
             WHERE IFNULL(sil.document_number,'') <> ''
               AND LOWER(TRIM(sil.document_number)) <> 'document number'
             ORDER BY sil.id DESC
             LIMIT 80`
        );
    }

    rows = dedupeSageRows(rows).slice(0, max);

    if (ctx.isCustomer) {
        rows = rows.filter(
            (r) =>
                Number(r.client_id) === Number(ctx.userId) ||
                String(r.customer_name || '')
                    .toLowerCase()
                    .includes(String(ctx.fullName || '').toLowerCase())
        );
    }

    const withDocs = await attachInvoiceAdDocs(rows);
    const invoices = withDocs.map(mapSageInvoiceRow).filter(isMeaningfulSageRow);
    return { allowed: true, invoices, message: null };
}

async function countSageInvoices(ctx) {
    if (!canAccessInvoices(ctx)) {
        return { allowed: false, total: 0, message: 'Invoice access is restricted for your role.' };
    }
    if (ctx.isCustomer) {
        const rows = await query(
            `SELECT COUNT(DISTINCT sil.id) AS total
             FROM sage_invoice_list sil
             INNER JOIN tbl_invoices ti ON ti.sage_invoice_id = sil.id
             WHERE ti.client_id = ?`,
            [ctx.userId]
        );
        return { allowed: true, total: Number(rows[0]?.total || 0), message: null };
    }
    const rows = await query(
        `SELECT COUNT(*) AS total FROM sage_invoice_list
         WHERE IFNULL(document_number,'') <> ''
           AND LOWER(TRIM(document_number)) <> 'document number'`
    );
    return { allowed: true, total: Number(rows[0]?.total || 0), message: null };
}

module.exports = {
    getInvoicesByClientId,
    getSageInvoiceByDocumentNumber,
    searchSageInvoices,
    countSageInvoices,
    mapSageInvoiceRow,
};
