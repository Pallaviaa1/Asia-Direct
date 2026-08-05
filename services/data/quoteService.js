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

function mapQuoteRow(row) {
    if (!row) return null;
    const total = num(row.sumof_finalamount ?? row.sumof_totalcost);
    const due = amountDue(row);
    const reference = clean(row.reference_no);
    return {
        id: row.id || row.freight_quote_estimate_id,
        reference_no: reference,
        freight_id: row.freight_id,
        freight_number: clean(row.freight_number),
        client_id: row.client_id,
        customer_name: clean(row.client_name) || clean(row.customer_name),
        customer_invoice_no: clean(row.customer_invoice_no) || null,
        inv_date_label: formatDate(row.inv_date),
        quote_date_label: formatDate(row.quote_date || row.date),
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
        quote_type: clean(row.quote_type),
        supplier_name: clean(row.supplier_name),
        company_name: clean(row.company_name),
        quote_source: 'freight_quote_estimate',
        // cargo / routing from freight
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

/** Map estimate_shipping_quote (also uses ADQO… refs) into the same shape as freight quotes. */
function mapEstimateShippingQuoteRow(row) {
    if (!row) return null;
    const total = num(row.sumofRoe ?? row.sumofall);
    const status = clean(row.status);
    const due =
        status && /paid|complete|settled/i.test(status) && !/unpaid|partial/i.test(status)
            ? 0
            : total;
    return {
        id: row.id,
        reference_no: clean(row.reference_no),
        freight_id: row.freight_id,
        freight_number: clean(row.freight_number),
        client_id: row.client_id,
        customer_name: clean(row.client_name) || clean(row.customer_name),
        customer_invoice_no: clean(row.customer_invoice_no) || clean(row.client_ref) || null,
        inv_date_label: null,
        quote_date_label: formatDate(row.date),
        country: clean(row.destination_country) || clean(row.origin_country),
        currency: clean(row.final_base_currency),
        total,
        total_label: total,
        amount_due: due,
        amount_due_label: due,
        status_label: status || '—',
        vat_incl: null,
        chargeable: row.chargable_rate != null && Number(row.chargable_rate) !== 0 ? num(row.chargable_rate) : null,
        payment_terms: null,
        quote_validity: null,
        quote_type: clean(row.type),
        supplier_name: clean(row.supplier_name),
        company_name: null,
        quote_source: 'estimate_shipping_quote',
        product_desc: clean(row.product_desc) || clean(row.freight_product_desc),
        commodity_name: clean(row.commodity_name),
        hazardous_label: yesNo(row.hazardous),
        packages: row.no_of_packages != null ? num(row.no_of_packages) : null,
        package_type: clean(row.package_type),
        weight: row.weight != null ? num(row.weight) : row.freight_weight != null ? num(row.freight_weight) : null,
        dimension:
            row.dimension != null ? num(row.dimension) : row.freight_dimension != null ? num(row.freight_dimension) : null,
        volumetric_weight: null,
        origin_country: clean(row.origin_country),
        destination_country: clean(row.destination_country),
        place_of_receipt: clean(row.collection_address),
        port_of_loading: clean(row.port_of_loading_name) || clean(row.port_of_loading),
        port_of_discharge: clean(row.port_of_discharge_name) || clean(row.post_of_discharge),
        place_of_delivery: clean(row.place_of_delivery),
        incoterm: clean(row.incoterm),
        mode_of_transport: clean(row.freight) || clean(row.mode_of_transport),
        load_type: clean(row.fcl_lcl),
        transit_priority: clean(row.priority) || clean(row.type),
        insurance_label: yesNo(row.insurance),
        lines: [],
        charge_groups: [],
    };
}

function buildEstimateScope(ctx) {
    const conditions = ['1=1'];
    const params = [];
    if (ctx.isCustomer) {
        conditions.push('(esq.client_id = ? OR tf.client_id = ?)');
        params.push(ctx.userId, ctx.userId);
    }
    return { conditions, params };
}

const ESQ_SELECT = `
    esq.id,
    esq.reference_no,
    esq.freight_id,
    esq.client_id,
    esq.client_name,
    esq.customer_invoice_no,
    esq.client_ref,
    esq.date,
    esq.status,
    esq.final_base_currency,
    esq.sumofRoe,
    esq.sumofall,
    esq.product_desc,
    esq.type,
    esq.freight,
    esq.incoterm,
    esq.dimension,
    esq.weight,
    esq.chargable_rate,
    tf.freight_number,
    tf.product_desc AS freight_product_desc,
    tf.weight AS freight_weight,
    tf.dimension AS freight_dimension,
    tf.hazardous,
    tf.no_of_packages,
    tf.package_type,
    tf.fcl_lcl,
    tf.priority,
    tf.insurance,
    tf.port_of_loading,
    tf.post_of_discharge,
    tf.place_of_delivery,
    tf.collection_address,
    tf.freight AS mode_of_transport,
    pol.name AS port_of_loading_name,
    pod.name AS port_of_discharge_name,
    co.name AS origin_country,
    cd.name AS destination_country,
    cm.name AS commodity_name,
    ts.name AS supplier_name,
    u.full_name AS customer_name
`;

const ESQ_FROM = `
    FROM estimate_shipping_quote esq
    LEFT JOIN tbl_freight tf ON tf.id = esq.freight_id
    LEFT JOIN countries co ON co.id = tf.collection_from
    LEFT JOIN countries cd ON cd.id = tf.delivery_to
    LEFT JOIN cities pol ON pol.id = tf.port_of_loading
    LEFT JOIN cities pod ON pod.id = tf.post_of_discharge
    LEFT JOIN tbl_commodity cm ON cm.id = tf.commodity
    LEFT JOIN tbl_suppliers ts ON ts.id = esq.supplier_id
    LEFT JOIN tbl_users u ON u.id = esq.client_id
`;

async function runEstimateList(ctx, conditions, params, limit = 25) {
    const rows = await query(
        `SELECT ${ESQ_SELECT} ${ESQ_FROM}
         WHERE ${conditions.join(' AND ')}
         ORDER BY esq.id DESC
         LIMIT ?`,
        [...params, Math.min(Number(limit) || 25, 50)]
    );
    return rows.map(mapEstimateShippingQuoteRow).filter((r) => canSee(ctx, r));
}

async function getEstimateQuoteByReference(reference, ctx) {
    const ref = clean(reference);
    if (!ref) return null;
    const { conditions, params } = buildEstimateScope(ctx);
    conditions.push('LOWER(TRIM(esq.reference_no)) = LOWER(TRIM(?))');
    params.push(ref);
    const rows = await runEstimateList(ctx, conditions, params, 1);
    return rows[0] || null;
}

function mapQuoteLine(row) {
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
    const conditions = ['(fqe.is_deleted = 0 OR fqe.is_deleted IS NULL)'];
    const params = [];
    if (ctx.isCustomer) {
        conditions.push('fqe.client_id = ?');
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
    fqe.id,
    fqe.reference_no,
    fqe.freight_id,
    fqe.client_id,
    fqe.client_name,
    fqe.supplier_id,
    fqe.customer_invoice_no,
    fqe.invoice_for_country,
    fqe.quote_date,
    fqe.inv_date,
    fqe.payment_terms,
    fqe.quote_validity,
    fqe.quote_type,
    fqe.final_base_currency,
    fqe.chargeable,
    fqe.sumof_totalcost,
    fqe.sumof_finalamount,
    fqe.sumof_vatincl,
    fqe.status,
    tf.freight_number,
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
    FROM freight_quote_estimate fqe
    LEFT JOIN tbl_freight tf ON tf.id = fqe.freight_id
    LEFT JOIN countries co ON co.id = tf.collection_from
    LEFT JOIN countries cd ON cd.id = tf.delivery_to
    LEFT JOIN cities pol ON pol.id = tf.port_of_loading
    LEFT JOIN cities pod ON pod.id = tf.post_of_discharge
    LEFT JOIN tbl_commodity cm ON cm.id = tf.commodity
    LEFT JOIN company_addresses ca ON ca.id = fqe.company_id AND ca.is_deleted = 0
    LEFT JOIN tbl_suppliers ts ON ts.id = fqe.supplier_id
`;

async function listQuoteLines(quoteId) {
    if (!quoteId) return [];
    const rows = await query(
        `SELECT
            fqed.*,
            afc.code,
            afc.description AS component_description,
            afc.name AS component_name
         FROM freight_quote_estimate_details fqed
         LEFT JOIN admin_frieght_component afc ON afc.id = fqed.admin_frieght_component_id
         WHERE fqed.freight_quote_estimate_id = ?
         ORDER BY fqed.id ASC
         LIMIT 100`,
        [quoteId]
    );
    return rows.map(mapQuoteLine);
}

async function runList(ctx, conditions, params, limit = 25) {
    const rows = await query(
        `SELECT ${SELECT} ${FROM}
         WHERE ${conditions.join(' AND ')}
         ORDER BY fqe.id DESC
         LIMIT ?`,
        [...params, Math.min(Number(limit) || 25, 50)]
    );
    return rows.map(mapQuoteRow).filter((r) => canSee(ctx, r));
}

async function getQuoteByReference(reference, ctx) {
    const ref = clean(reference);
    if (!ref) return null;
    const { conditions, params } = buildScope(ctx);
    conditions.push('LOWER(TRIM(fqe.reference_no)) = LOWER(TRIM(?))');
    params.push(ref);
    const rows = await runList(ctx, conditions, params, 1);
    const row = rows[0] || null;
    if (row) {
        row.lines = await listQuoteLines(row.id);
        row.charge_groups = groupChargeTotals(row.lines);
        return row;
    }
    // ADQO… also used on shipping estimate quotes
    return getEstimateQuoteByReference(ref, ctx);
}

async function getQuoteById(id, ctx) {
    if (!id) return null;
    const { conditions, params } = buildScope(ctx);
    conditions.push('fqe.id = ?');
    params.push(Number(id));
    const rows = await runList(ctx, conditions, params, 1);
    const row = rows[0] || null;
    if (row) {
        row.lines = await listQuoteLines(row.id);
        row.charge_groups = groupChargeTotals(row.lines);
        return row;
    }
    // Fallback: estimate_shipping_quote id (e.g. 300 → ADQO10300)
    const { conditions: eCond, params: eParams } = buildEstimateScope(ctx);
    eCond.push('esq.id = ?');
    eParams.push(Number(id));
    const eRows = await runEstimateList(ctx, eCond, eParams, 1);
    return eRows[0] || null;
}

async function searchQuotes(search, ctx, { limit = 25, status } = {}) {
    const { conditions, params } = buildScope(ctx);
    const term = clean(search);
    if (term) {
        if (/^ADQO\d+$/i.test(term)) {
            conditions.push('LOWER(TRIM(fqe.reference_no)) = LOWER(TRIM(?))');
            params.push(term);
        } else if (/^F-\d+/i.test(term)) {
            conditions.push('LOWER(TRIM(tf.freight_number)) = LOWER(TRIM(?))');
            params.push(term);
        } else {
            conditions.push(
                `(fqe.reference_no LIKE ? OR fqe.client_name LIKE ? OR fqe.customer_invoice_no LIKE ?
                  OR tf.freight_number LIKE ? OR ts.name LIKE ? OR fqe.invoice_for_country LIKE ?)`
            );
            const like = `%${term}%`;
            params.push(like, like, like, like, like, like);
        }
    }
    if (status) {
        conditions.push('LOWER(TRIM(fqe.status)) = LOWER(TRIM(?))');
        params.push(status);
    }
    const fqeRows = await runList(ctx, conditions, params, limit);

    // Also search shipping estimate quotes (same ADQO namespace)
    const { conditions: eCond, params: eParams } = buildEstimateScope(ctx);
    if (term) {
        if (/^ADQO\d+$/i.test(term)) {
            eCond.push('LOWER(TRIM(esq.reference_no)) = LOWER(TRIM(?))');
            eParams.push(term);
        } else if (/^F-\d+/i.test(term)) {
            eCond.push('LOWER(TRIM(tf.freight_number)) = LOWER(TRIM(?))');
            eParams.push(term);
        } else {
            eCond.push(
                `(esq.reference_no LIKE ? OR esq.client_name LIKE ? OR esq.customer_invoice_no LIKE ?
                  OR esq.client_ref LIKE ? OR tf.freight_number LIKE ? OR u.full_name LIKE ? OR ts.name LIKE ?)`
            );
            const like = `%${term}%`;
            eParams.push(like, like, like, like, like, like, like);
        }
    }
    if (status) {
        eCond.push('LOWER(TRIM(esq.status)) = LOWER(TRIM(?))');
        eParams.push(status);
    }
    const esqRows = await runEstimateList(ctx, eCond, eParams, limit);

    const seen = new Set();
    const merged = [];
    for (const row of [...fqeRows, ...esqRows]) {
        const key = `${row.quote_source}:${row.reference_no || row.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(row);
        if (merged.length >= Math.min(Number(limit) || 25, 50)) break;
    }
    return merged;
}

async function listQuotesByFreightNumber(freightNumber, ctx, { limit = 25 } = {}) {
    if (!freightNumber) return [];
    const { conditions, params } = buildScope(ctx);
    conditions.push('LOWER(TRIM(tf.freight_number)) = LOWER(TRIM(?))');
    params.push(freightNumber);
    const fqeRows = await runList(ctx, conditions, params, limit);

    const { conditions: eCond, params: eParams } = buildEstimateScope(ctx);
    eCond.push('LOWER(TRIM(tf.freight_number)) = LOWER(TRIM(?))');
    eParams.push(freightNumber);
    const esqRows = await runEstimateList(ctx, eCond, eParams, limit);

    return [...fqeRows, ...esqRows].slice(0, Math.min(Number(limit) || 25, 50));
}

async function listQuotesByClientId(clientId, ctx, { limit = 25 } = {}) {
    if (!clientId || !canAccessClient(ctx, clientId)) return [];
    const { conditions, params } = buildScope(ctx);
    conditions.push('fqe.client_id = ?');
    params.push(clientId);
    return runList(ctx, conditions, params, limit);
}

async function countQuotes(ctx, { search, status } = {}) {
    const { conditions, params } = buildScope(ctx);
    const term = clean(search);
    if (term) {
        conditions.push(
            `(fqe.reference_no LIKE ? OR fqe.client_name LIKE ? OR fqe.customer_invoice_no LIKE ?
              OR tf.freight_number LIKE ? OR ts.name LIKE ?)`
        );
        const like = `%${term}%`;
        params.push(like, like, like, like, like);
    }
    if (status) {
        conditions.push('LOWER(TRIM(fqe.status)) = LOWER(TRIM(?))');
        params.push(status);
    }
    const fqeRows = await query(
        `SELECT COUNT(DISTINCT fqe.id) AS total ${FROM} WHERE ${conditions.join(' AND ')}`,
        params
    );

    const { conditions: eCond, params: eParams } = buildEstimateScope(ctx);
    if (term) {
        eCond.push(
            `(esq.reference_no LIKE ? OR esq.client_name LIKE ? OR esq.customer_invoice_no LIKE ?
              OR tf.freight_number LIKE ? OR u.full_name LIKE ? OR ts.name LIKE ?)`
        );
        const like = `%${term}%`;
        eParams.push(like, like, like, like, like, like);
    }
    if (status) {
        eCond.push('LOWER(TRIM(esq.status)) = LOWER(TRIM(?))');
        eParams.push(status);
    }
    const esqRows = await query(
        `SELECT COUNT(DISTINCT esq.id) AS total ${ESQ_FROM} WHERE ${eCond.join(' AND ')}`,
        eParams
    );

    return Number(fqeRows[0]?.total || 0) + Number(esqRows[0]?.total || 0);
}

module.exports = {
    getQuoteByReference,
    getQuoteById,
    searchQuotes,
    listQuotesByFreightNumber,
    listQuotesByClientId,
    countQuotes,
    mapQuoteRow,
    mapEstimateShippingQuoteRow,
};
