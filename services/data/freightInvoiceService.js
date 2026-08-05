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

function formatDate(value) {
    if (!value) return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        const [y, m, day] = value.slice(0, 10).split('-');
        if (Number(y) < 1971) return null;
        return `${day}/${m}/${y}`;
    }
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime()) || d.getFullYear() < 1971) return null;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
}

function yesNo(v) {
    if (v == null || v === '') return null;
    if (/^(1|yes|true|y)$/i.test(String(v))) return 'Yes';
    if (/^(0|no|false|n)$/i.test(String(v))) return 'No';
    return clean(v);
}

function amountDue(row) {
    const total = num(row.sumof_finalamount ?? row.sumof_totalcost);
    const status = String(row.status || '').toLowerCase();
    if (/paid|complete|settled/.test(status) && !/unpaid|partial/.test(status)) return 0;
    return total;
}

function mapInvoiceRow(row) {
    if (!row) return null;
    const total = num(row.sumof_finalamount ?? row.sumof_totalcost);
    const due = amountDue(row);
    const freightNumber = clean(row.freight_number);
    const orderNumber = clean(row.order_number);
    const freightOrOrder = freightNumber || orderNumber || null;
    return {
        id: row.id || row.quote_invoice_id,
        reference_no: clean(row.reference_no),
        freight_id: row.freight_id,
        freight_number: freightNumber,
        order_id: row.order_id,
        order_number: orderNumber,
        freight_or_order: freightOrOrder,
        client_id: row.client_id,
        customer_name: clean(row.client_name) || clean(row.customer_name),
        customer_ref: clean(row.customer_ref) || clean(row.client_ref_name) || null,
        customer_invoice_no: clean(row.customer_invoice_no) || null,
        inv_date_label: formatDate(row.inv_date || row.created_at || row.quote_invoice_date),
        quote_date_label: formatDate(row.quote_date),
        country: clean(row.invoice_for_country) || clean(row.company_country) || clean(row.destination_country),
        currency: clean(row.final_base_currency),
        total,
        total_label: total,
        amount_due: due,
        amount_due_label: due,
        status_label: clean(row.status) || '—',
        vat_incl: row.sumof_vatincl != null ? num(row.sumof_vatincl) : null,
        chargeable: row.chargeable != null && Number(row.chargeable) !== 0 ? num(row.chargeable) : null,
        payment_terms: clean(row.payment_terms),
        quote_validity: row.quote_validity != null && row.quote_validity !== '' ? row.quote_validity : null,
        supplier_name: clean(row.supplier_name),
        company_name: clean(row.company_name),
        product_desc: clean(row.product_desc),
        commodity_name: clean(row.commodity_name),
        hazardous_label: yesNo(row.hazardous),
        packages: row.no_of_packages != null ? num(row.no_of_packages) : null,
        package_type: clean(row.package_type),
        weight: row.weight != null ? num(row.weight) : null,
        dimension: row.dimension != null ? num(row.dimension) : null,
        volumetric_weight:
            row.volumetric_weight != null && row.volumetric_weight !== ''
                ? num(row.volumetric_weight)
                : null,
        origin_country: clean(row.origin_country),
        destination_country: clean(row.destination_country),
        place_of_receipt: clean(row.collection_address),
        port_of_loading: clean(row.port_of_loading_name) || clean(row.port_of_loading),
        port_of_discharge: clean(row.port_of_discharge_name) || clean(row.post_of_discharge),
        place_of_delivery: clean(row.place_of_delivery),
        incoterm: clean(row.incoterm),
        mode_of_transport: clean(row.freight),
        load_type: clean(row.fcl_lcl),
        transit_priority: clean(row.priority) || clean(row.type),
        insurance_label: yesNo(row.insurance),
    };
}

function mapInvoiceLine(row) {
    const category = clean(row.component_name) || clean(row.name) || 'Charges';
    return {
        id: row.id,
        category,
        code: clean(row.code),
        description: clean(row.component_description) || clean(row.description) || clean(row.name),
        qty: row.qty != null ? num(row.qty) : null,
        currency: clean(row.currency),
        cost: row.cost != null ? num(row.cost) : null,
        unit_type: clean(row.unit_type),
        unit: row.unit != null ? num(row.unit) : null,
        total_cost: row.total_cost != null ? num(row.total_cost) : null,
        gp_percent: row.gp_percent != null ? num(row.gp_percent) : null,
        sales_price: row.sales_price != null ? num(row.sales_price) : null,
        roe: row.roe != null ? num(row.roe) : null,
        final_amount: row.final_amount != null ? num(row.final_amount) : null,
        vat_percent: row.vat_type != null ? clean(row.vat_type) : null,
        disc_percent: row.disc_percent != null ? num(row.disc_percent) : null,
        discount: row.discount != null ? num(row.discount) : null,
        exclusive: row.exclusive != null ? num(row.exclusive) : null,
        vat: row.vat != null ? num(row.vat) : null,
        vat_incl: row.vat_incl != null ? num(row.vat_incl) : null,
        comment: clean(row.comment),
    };
}

function groupChargeTotals(lines) {
    const groups = {};
    for (const line of lines) {
        const key = line.category || 'Charges';
        if (!groups[key]) groups[key] = { category: key, total: 0, vat_incl: 0, lines: [] };
        groups[key].total += num(line.final_amount);
        groups[key].vat_incl += num(line.vat_incl);
        groups[key].lines.push(line);
    }
    return Object.values(groups);
}

function buildScope(ctx) {
    const conditions = ['(qi.is_deleted = 0 OR qi.is_deleted IS NULL)'];
    const params = [];
    if (ctx.isCustomer) {
        conditions.push('qi.client_id = ?');
        params.push(ctx.userId);
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
    qi.id,
    qi.id AS quote_invoice_id,
    qi.reference_no,
    qi.freight_quote_estimate_id,
    qi.freight_id,
    qi.order_id,
    qi.client_id,
    qi.client_name,
    qi.supplier_id,
    qi.customer_invoice_no,
    qi.invoice_for_country,
    qi.quote_date,
    qi.due_date,
    qi.payment_terms,
    qi.quote_validity,
    qi.final_base_currency,
    qi.chargeable,
    qi.sumof_totalcost,
    qi.sumof_finalamount,
    qi.sumof_vatincl,
    qi.status,
    qi.created_at AS inv_date,
    ord.order_number,
    tf.freight_number,
    tf.client_ref_name AS customer_ref,
    tf.quote_invoice_date,
    tf.product_desc,
    tf.hazardous,
    tf.no_of_packages,
    tf.package_type,
    tf.weight,
    tf.dimension,
    tf.volumetric_weight,
    tf.incoterm,
    tf.freight,
    tf.fcl_lcl,
    tf.type,
    tf.insurance,
    tf.port_of_loading,
    tf.post_of_discharge,
    tf.place_of_delivery,
    tf.collection_address,
    tf.priority,
    pol.name AS port_of_loading_name,
    pod.name AS port_of_discharge_name,
    co.name AS origin_country,
    cd.name AS destination_country,
    cm.name AS commodity_name,
    ca.company_name,
    ca.country AS company_country,
    ts.name AS supplier_name
`;

const FROM = `
    FROM quote_invoice qi
    LEFT JOIN freight_quote_estimate fqe ON fqe.id = qi.freight_quote_estimate_id
    LEFT JOIN tbl_freight tf ON tf.id = COALESCE(NULLIF(qi.freight_id, 0), fqe.freight_id)
    LEFT JOIN tbl_orders ord ON ord.id = qi.order_id
    LEFT JOIN countries co ON co.id = tf.collection_from
    LEFT JOIN countries cd ON cd.id = tf.delivery_to
    LEFT JOIN cities pol ON pol.id = tf.port_of_loading
    LEFT JOIN cities pod ON pod.id = tf.post_of_discharge
    LEFT JOIN tbl_commodity cm ON cm.id = tf.commodity
    LEFT JOIN company_addresses ca ON ca.id = qi.company_id AND ca.is_deleted = 0
    LEFT JOIN tbl_suppliers ts ON ts.id = qi.supplier_id
`;

async function listInvoiceLines(invoiceId) {
    if (!invoiceId) return [];
    const rows = await query(
        `SELECT
            qid.*,
            afc.code,
            afc.description AS component_description,
            afc.name AS component_name
         FROM quote_invoice_details qid
         LEFT JOIN admin_frieght_component afc ON afc.id = qid.admin_frieght_component_id
         WHERE qid.quote_invoice_id = ?
         ORDER BY qid.id ASC
         LIMIT 100`,
        [invoiceId]
    );
    return rows.map(mapInvoiceLine);
}

async function runList(ctx, conditions, params, limit = 25) {
    const rows = await query(
        `SELECT ${SELECT} ${FROM}
         WHERE ${conditions.join(' AND ')}
         ORDER BY qi.id DESC
         LIMIT ?`,
        [...params, Math.min(Number(limit) || 25, 50)]
    );
    return rows.map(mapInvoiceRow).filter((r) => canSee(ctx, r));
}

async function getFreightInvoiceByReference(reference, ctx) {
    const ref = clean(reference);
    if (!ref) return null;
    const { conditions, params } = buildScope(ctx);
    conditions.push('LOWER(TRIM(qi.reference_no)) = LOWER(TRIM(?))');
    params.push(ref);
    const rows = await runList(ctx, conditions, params, 1);
    const row = rows[0] || null;
    if (!row) return null;
    row.lines = await listInvoiceLines(row.id);
    row.charge_groups = groupChargeTotals(row.lines);
    return row;
}

async function getFreightInvoiceById(id, ctx) {
    if (!id) return null;
    const { conditions, params } = buildScope(ctx);
    conditions.push('qi.id = ?');
    params.push(Number(id));
    const rows = await runList(ctx, conditions, params, 1);
    const row = rows[0] || null;
    if (!row) return null;
    row.lines = await listInvoiceLines(row.id);
    row.charge_groups = groupChargeTotals(row.lines);
    return row;
}

async function searchFreightInvoices(search, ctx, { limit = 25, status } = {}) {
    const { conditions, params } = buildScope(ctx);
    const term = clean(search);
    if (term) {
        if (/^ADINV\d+$/i.test(term)) {
            conditions.push('LOWER(TRIM(qi.reference_no)) = LOWER(TRIM(?))');
            params.push(term);
        } else if (/^F-\d+/i.test(term)) {
            conditions.push('LOWER(TRIM(tf.freight_number)) = LOWER(TRIM(?))');
            params.push(term);
        } else if (/^OR0*\d+/i.test(term)) {
            conditions.push('(LOWER(TRIM(ord.order_number)) = LOWER(TRIM(?)) OR qi.order_id = ?)');
            const digits = term.replace(/^OR0*/i, '');
            params.push(term, Number(digits) || 0);
        } else {
            conditions.push(
                `(qi.reference_no LIKE ? OR qi.client_name LIKE ? OR qi.customer_invoice_no LIKE ?
                  OR tf.freight_number LIKE ? OR tf.client_ref_name LIKE ?
                  OR ord.order_number LIKE ? OR ts.name LIKE ? OR qi.invoice_for_country LIKE ?)`
            );
            const like = `%${term}%`;
            params.push(like, like, like, like, like, like, like, like);
        }
    }
    if (status) {
        conditions.push('LOWER(TRIM(qi.status)) = LOWER(TRIM(?))');
        params.push(status);
    }
    return runList(ctx, conditions, params, limit);
}

async function listFreightInvoicesByFreightNumber(freightNumber, ctx, { limit = 25 } = {}) {
    if (!freightNumber) return [];
    const { conditions, params } = buildScope(ctx);
    conditions.push('LOWER(TRIM(tf.freight_number)) = LOWER(TRIM(?))');
    params.push(freightNumber);
    return runList(ctx, conditions, params, limit);
}

async function listFreightInvoicesByClientId(clientId, ctx, { limit = 25 } = {}) {
    if (!clientId || !canAccessClient(ctx, clientId)) return [];
    const { conditions, params } = buildScope(ctx);
    conditions.push('qi.client_id = ?');
    params.push(clientId);
    return runList(ctx, conditions, params, limit);
}

async function countFreightInvoices(ctx, { search, status } = {}) {
    const { conditions, params } = buildScope(ctx);
    const term = clean(search);
    if (term) {
        conditions.push(
            `(qi.reference_no LIKE ? OR qi.client_name LIKE ? OR qi.customer_invoice_no LIKE ?
              OR tf.freight_number LIKE ? OR ord.order_number LIKE ? OR ts.name LIKE ?)`
        );
        const like = `%${term}%`;
        params.push(like, like, like, like, like, like);
    }
    if (status) {
        conditions.push('LOWER(TRIM(qi.status)) = LOWER(TRIM(?))');
        params.push(status);
    }
    const rows = await query(
        `SELECT COUNT(DISTINCT qi.id) AS total ${FROM} WHERE ${conditions.join(' AND ')}`,
        params
    );
    return Number(rows[0]?.total || 0);
}

module.exports = {
    getFreightInvoiceByReference,
    getFreightInvoiceById,
    searchFreightInvoices,
    listFreightInvoicesByFreightNumber,
    listFreightInvoicesByClientId,
    countFreightInvoices,
    mapInvoiceRow,
};
