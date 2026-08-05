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

function amountDue(row) {
    const total = num(row.sumof_finalamount ?? row.sumof_vatincl ?? row.sumof_totalcost);
    const status = String(row.status || '').toLowerCase();
    if (/paid|complete|settled/.test(status) && !/unpaid|partial/.test(status)) return 0;
    return total;
}

function mapSupplierInvoiceRow(row) {
    if (!row) return null;
    const total = num(row.sumof_finalamount ?? row.sumof_vatincl ?? row.sumof_totalcost);
    const due = amountDue(row);
    return {
        id: row.id || row.supplier_shipment_invoice_id,
        reference_no: clean(row.reference_no),
        supplier_id: row.supplier_id,
        supplier_name: clean(row.supplier_name),
        shipment_id: row.shipment_id,
        waybill: clean(row.waybill),
        supplier_invoice_no: clean(row.customer_invoice_no) || clean(row.supplier_invoice_no),
        inv_date_label: formatDate(row.supplier_invoice_date || row.inv_date || row.quote_date || row.created_at),
        due_date_label: formatDate(row.due_date),
        quote_date_label: formatDate(row.quote_date),
        country: clean(row.invoice_for_country) || clean(row.company_country),
        currency: clean(row.final_base_currency),
        total,
        total_label: total,
        amount_due: due,
        amount_due_label: due,
        status_label: clean(row.status) || '—',
        vat_incl: row.sumof_vatincl != null ? num(row.sumof_vatincl) : null,
        chargeable: row.chargeable != null && Number(row.chargeable) !== 0 ? num(row.chargeable) : null,
        company_name: clean(row.company_name),
        // shipment / cargo strip
        carrier: clean(row.carrier),
        vessel: clean(row.vessel),
        etd_label: formatDate(row.ETD),
        atd_label: formatDate(row.ATD),
        shipment_status: clean(row.shipment_status) || clean(row.status_ship),
        origin_agent: clean(row.origin_agent),
        destination_agent: clean(row.destination_agent),
        freight_mode: clean(row.freight),
        port_of_loading: clean(row.port_of_loading),
        port_of_discharge: clean(row.port_of_discharge),
        container: clean(row.container),
        load_type: clean(row.load),
        release_type: clean(row.release_type),
        origin_country: clean(row.origin_country),
        destination_country: clean(row.destination_country),
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

function canAccessSupplierInvoices(ctx) {
    return Boolean(ctx.isAdmin || ctx.hasFullAccess || ctx.isStaff);
}

function buildScope(ctx) {
    const conditions = ['1=1'];
    const params = [];
    return { conditions, params };
}

const SELECT = `
    ssi.id,
    ssi.id AS supplier_shipment_invoice_id,
    ssi.reference_no,
    ssi.supplier_id,
    ssi.shipment_id,
    ssi.customer_invoice_no,
    ssi.invoice_for_country,
    ssi.due_date,
    ssi.quote_date,
    ssi.final_base_currency,
    ssi.chargeable,
    ssi.sumof_totalcost,
    ssi.sumof_finalamount,
    ssi.sumof_vatincl,
    ssi.status,
    ssi.created_at,
    s.name AS supplier_name,
    ca.company_name,
    ca.country AS company_country,
    ts.id AS shipment_row_id,
    COALESCE(ts.id, ssi.shipment_id) AS resolved_shipment_id,
    ts.waybill,
    ts.supplier_invoice_date,
    ts.carrier,
    ts.vessel,
    ts.ETD,
    ts.ATD,
    ts.status AS shipment_status,
    ts.origin_agent,
    ts.destination_agent,
    ts.freight,
    ts.port_of_loading,
    ts.port_of_discharge,
    ts.container,
    ts.load,
    ts.release_type,
    co.name AS origin_country,
    cd.name AS destination_country
`;

const FROM = `
    FROM supplier_shipment_invoice ssi
    LEFT JOIN tbl_suppliers s ON s.id = ssi.supplier_id
    LEFT JOIN company_addresses ca ON ca.id = ssi.company_id AND ca.is_deleted = 0
    LEFT JOIN tbl_shipments ts ON ts.id = COALESCE(
        (SELECT t2.id FROM tbl_shipments t2 WHERE t2.supplier_invoice_id = ssi.id ORDER BY t2.id DESC LIMIT 1),
        ssi.shipment_id
    )
    LEFT JOIN countries co ON co.id = ts.origin_country_id
    LEFT JOIN countries cd ON cd.id = ts.des_country_id
`;

async function listInvoiceLines(invoiceId) {
    if (!invoiceId) return [];
    const rows = await query(
        `SELECT
            ssid.*,
            afc.code,
            afc.description AS component_description,
            afc.name AS component_name
         FROM supplier_shipment_invoice_details ssid
         LEFT JOIN admin_frieght_component afc ON afc.id = ssid.admin_frieght_component_id
         WHERE ssid.supplier_shipment_invoice_id = ?
         ORDER BY ssid.id ASC
         LIMIT 100`,
        [invoiceId]
    );
    return rows.map(mapInvoiceLine);
}

async function runList(ctx, conditions, params, limit = 25) {
    if (!canAccessSupplierInvoices(ctx)) {
        return { allowed: false, rows: [], message: 'Supplier invoice access is restricted for your role.' };
    }
    const rows = await query(
        `SELECT ${SELECT} ${FROM}
         WHERE ${conditions.join(' AND ')}
         ORDER BY ssi.id DESC
         LIMIT ?`,
        [...params, Math.min(Number(limit) || 25, 50)]
    );
    return {
        allowed: true,
        rows: rows.map(mapSupplierInvoiceRow),
        message: null,
    };
}

async function enrichDetail(row) {
    if (!row) return null;
    row.lines = await listInvoiceLines(row.id);
    row.charge_groups = groupChargeTotals(row.lines);
    return row;
}

async function getSupplierInvoiceByReference(reference, ctx) {
    const ref = clean(reference);
    if (!ref) return { allowed: true, invoice: null, message: null };
    if (!canAccessSupplierInvoices(ctx)) {
        return { allowed: false, invoice: null, message: 'Supplier invoice access is restricted for your role.' };
    }
    const { conditions, params } = buildScope(ctx);
    conditions.push('LOWER(TRIM(ssi.reference_no)) = LOWER(TRIM(?))');
    params.push(ref);
    const result = await runList(ctx, conditions, params, 1);
    if (!result.allowed) return { allowed: false, invoice: null, message: result.message };
    const row = result.rows[0] || null;
    return { allowed: true, invoice: row ? await enrichDetail(row) : null, message: null };
}

async function getSupplierInvoiceById(id, ctx) {
    if (!id) return { allowed: true, invoice: null, message: null };
    if (!canAccessSupplierInvoices(ctx)) {
        return { allowed: false, invoice: null, message: 'Supplier invoice access is restricted for your role.' };
    }
    const { conditions, params } = buildScope(ctx);
    conditions.push('ssi.id = ?');
    params.push(Number(id));
    const result = await runList(ctx, conditions, params, 1);
    if (!result.allowed) return { allowed: false, invoice: null, message: result.message };
    const row = result.rows[0] || null;
    return { allowed: true, invoice: row ? await enrichDetail(row) : null, message: null };
}

async function searchSupplierInvoices(search, ctx, { limit = 25, status } = {}) {
    if (!canAccessSupplierInvoices(ctx)) {
        return { allowed: false, invoices: [], message: 'Supplier invoice access is restricted for your role.' };
    }
    const { conditions, params } = buildScope(ctx);
    const term = clean(search);
    if (term) {
        if (/^SUPINV\d+$/i.test(term)) {
            conditions.push('LOWER(TRIM(ssi.reference_no)) = LOWER(TRIM(?))');
            params.push(term);
        } else {
            conditions.push(
                `(ssi.reference_no LIKE ? OR ssi.customer_invoice_no LIKE ?
                  OR s.name LIKE ? OR ts.waybill LIKE ?
                  OR ssi.invoice_for_country LIKE ?)`
            );
            const like = `%${term}%`;
            params.push(like, like, like, like, like);
        }
    }
    if (status) {
        conditions.push('LOWER(TRIM(ssi.status)) = LOWER(TRIM(?))');
        params.push(status);
    }
    const result = await runList(ctx, conditions, params, limit);
    if (!result.allowed) return { allowed: false, invoices: [], message: result.message };
    return { allowed: true, invoices: result.rows, message: null };
}

async function countSupplierInvoices(ctx, { search, status } = {}) {
    if (!canAccessSupplierInvoices(ctx)) {
        return { allowed: false, total: 0, message: 'Supplier invoice access is restricted for your role.' };
    }
    const { conditions, params } = buildScope(ctx);
    const term = clean(search);
    if (term) {
        conditions.push(
            `(ssi.reference_no LIKE ? OR ssi.customer_invoice_no LIKE ?
              OR s.name LIKE ? OR ts.waybill LIKE ?)`
        );
        const like = `%${term}%`;
        params.push(like, like, like, like);
    }
    if (status) {
        conditions.push('LOWER(TRIM(ssi.status)) = LOWER(TRIM(?))');
        params.push(status);
    }
    const rows = await query(
        `SELECT COUNT(DISTINCT ssi.id) AS total ${FROM} WHERE ${conditions.join(' AND ')}`,
        params
    );
    return { allowed: true, total: Number(rows[0]?.total || 0), message: null };
}

module.exports = {
    getSupplierInvoiceByReference,
    getSupplierInvoiceById,
    searchSupplierInvoices,
    countSupplierInvoices,
    mapSupplierInvoiceRow,
};
