const { query } = require('../../helpers/dbQuery');
const { getFreightByNumber } = require('./freightService');
const { getInvoicesByClientId } = require('./invoiceService');
const { getSupplierById } = require('./supplierService');
const { canAccessInvoices } = require('../permissions/authorizeTool');

async function getQuotationsByFreightId(freightId) {
    const [estimates, quotes, freightQuotes] = await Promise.all([
        query(
            `SELECT id, freight_id, client_id, total_amount, des_currency, freight_amount,
                    freight_currency, freight_gp, freight, type, incoterm,
                    origin_amount, des_amount, sub_amount, exchange_rate, serial_number,
                    Supplier_Quote_Amount, is_assigned, created_at,
                    origin_pick_up, origin_pickup_gp, origin_customs, origin_customs_gp,
                    origin_document, origin_document_gp, origin_warehouse, origin_warehouse_gp,
                    origin_port_fees, origin_port_fees_gp, origin_other, origin_other_gp,
                    des_delivery, des_delivery_gp, des_customs, des_customs_gp,
                    des_document, des_document_gp, des_warehouse, des_warehouse_gp,
                    des_port_fees, des_port_fees_gp, des_unpack, des_unpack_gp,
                    des_other, des_other_gp
             FROM shipping_estimate
             WHERE freight_id = ?
             ORDER BY id DESC`,
            [freightId]
        ).catch(() => []),
        query(
            `SELECT id, freight_id, client_id, supplier_id, serial_number, date,
                    totalChageswithOutExchange, sumofall, sumofRoe, created_at
             FROM estimate_shipping_quote
             WHERE freight_id = ?
             ORDER BY id DESC`,
            [freightId]
        ).catch(() => []),
        query(
            `SELECT id, freight_id, reference_no, client_id, client_name,
                    final_base_currency, sumof_totalcost, sumof_finalamount, sumof_vatincl,
                    chargeable, status, quote_type, created_at, updated_at
             FROM freight_quote_estimate
             WHERE freight_id = ?
               AND (is_deleted = 0 OR is_deleted IS NULL)
             ORDER BY id DESC`,
            [freightId]
        ).catch(() => []),
    ]);

    return { estimates, quotes, freightQuotes };
}

function chargePair(amount, gp) {
    const a = amount == null || amount === '' ? null : amount;
    const g = gp == null || gp === '' ? null : gp;
    if (a == null && g == null) return null;
    if (g == null || g === 0 || g === '0') return String(a);
    return `${a} / ${g}`;
}

function buildEstimateBreakdown(quotations) {
    if (!quotations?.estimates?.length) return null;
    const e = quotations.estimates[0];
    return {
        freight_type: e.type || e.freight || null,
        freight_cost: e.freight_amount ?? null,
        freight_billing: e.freight_currency || e.des_currency || null,
        origin: {
            pickup: chargePair(e.origin_pick_up, e.origin_pickup_gp),
            customs: chargePair(e.origin_customs, e.origin_customs_gp),
            document: chargePair(e.origin_document, e.origin_document_gp),
            warehouse: chargePair(e.origin_warehouse, e.origin_warehouse_gp),
            port_fees: chargePair(e.origin_port_fees, e.origin_port_fees_gp),
            other: chargePair(e.origin_other, e.origin_other_gp),
        },
        destination: {
            delivery: chargePair(e.des_delivery, e.des_delivery_gp),
            customs: chargePair(e.des_customs, e.des_customs_gp),
            documents: chargePair(e.des_document, e.des_document_gp),
            warehouse: chargePair(e.des_warehouse, e.des_warehouse_gp),
            port_fees: chargePair(e.des_port_fees, e.des_port_fees_gp),
            unpack: chargePair(e.des_unpack, e.des_unpack_gp),
            other: chargePair(e.des_other, e.des_other_gp),
        },
        total_amount: e.total_amount ?? null,
        currency: e.des_currency || e.freight_currency || null,
        serial_number: e.serial_number || null,
    };
}

/** Pick the best available estimate/quote amount for display */
function getLatestEstimateSummary(quotations) {
    if (!quotations) return null;

    if (quotations.freightQuotes?.length) {
        const q = quotations.freightQuotes[0];
        return {
            source: 'freight_quote_estimate',
            reference: (q.reference_no || '').trim() || `Quote #${q.id}`,
            amount: q.sumof_finalamount ?? q.sumof_totalcost,
            currency: q.final_base_currency || '',
            status: q.status || null,
            chargeable:
                q.chargeable != null && q.chargeable !== '' && Number(q.chargeable) !== 0
                    ? q.chargeable
                    : null,
            vat_incl: q.sumof_vatincl != null ? q.sumof_vatincl : null,
        };
    }

    if (quotations.estimates?.length) {
        const e = quotations.estimates[0];
        return {
            source: 'shipping_estimate',
            reference: e.serial_number || `Estimate #${e.id}`,
            amount: e.total_amount ?? e.freight_amount ?? e.Supplier_Quote_Amount,
            currency: e.des_currency || '',
            status: e.is_assigned == 1 ? 'assigned' : 'draft',
            chargeable: null,
        };
    }

    if (quotations.quotes?.length) {
        const q = quotations.quotes[0];
        return {
            source: 'estimate_shipping_quote',
            reference: q.serial_number || `Quote #${q.id}`,
            amount: q.sumofall ?? q.totalChageswithOutExchange,
            currency: '',
            status: null,
            chargeable: null,
        };
    }

    return null;
}

async function getOrdersByFreightId(freightId) {
    return query(
        `SELECT o.*, CONCAT('OR000', o.id) AS order_number,
                u.full_name AS client_name
         FROM tbl_orders o
         LEFT JOIN tbl_users u ON u.id = o.client_id
         WHERE o.freight_id = ?
         ORDER BY o.created_at DESC`,
        [freightId]
    );
}

async function getShipmentsByFreightId(freightId, freightNumber) {
    const byOrder = await query(
        `SELECT DISTINCT s.id, s.waybill, s.freight, s.carrier, s.vessel, s.ETD, s.ATD,
                s.status, s.port_of_loading, s.port_of_discharge, s.container, s.seal,
                s.date_of_dispatch, s.created_at,
                oc.name AS origin_country_name, dc.name AS des_country_name
         FROM tbl_shipments s
         INNER JOIN shipment_details sd ON sd.shipment_id = s.id
         INNER JOIN tbl_orders o ON o.id = sd.order_id
         LEFT JOIN countries oc ON oc.id = s.origin_country_id
         LEFT JOIN countries dc ON dc.id = s.des_country_id
         WHERE o.freight_id = ?
         ORDER BY s.created_at DESC`,
        [freightId]
    );

    if (byOrder.length) return byOrder;

    if (freightNumber) {
        return query(
            `SELECT s.id, s.waybill, s.freight, s.carrier, s.vessel, s.ETD, s.ATD,
                    s.status, s.port_of_loading, s.port_of_discharge, s.container, s.seal,
                    s.date_of_dispatch, s.created_at,
                    oc.name AS origin_country_name, dc.name AS des_country_name
             FROM tbl_shipments s
             LEFT JOIN countries oc ON oc.id = s.origin_country_id
             LEFT JOIN countries dc ON dc.id = s.des_country_id
             WHERE s.freight LIKE ?
             ORDER BY s.created_at DESC`,
            [`%${freightNumber}%`]
        );
    }

    return [];
}

async function getClearanceByFreightId(freightId) {
    return query(
        `SELECT cl.id, cl.clearance_number, cl.clearing_status, cl.freight_option,
                cl.port_of_loading, cl.port_of_discharge, cl.nature_of_goods,
                cl.total_weight, cl.total_dimension, cl.created_at,
                u.full_name AS client_name
         FROM tbl_clearance cl
         LEFT JOIN tbl_users u ON u.id = cl.user_id
         WHERE cl.freight_id = ? AND cl.is_deleted = 0
         ORDER BY cl.created_at DESC`,
        [freightId]
    );
}

async function getFreightFullDetails(freightNumber, ctx) {
    const freight = await getFreightByNumber(freightNumber, ctx);
    if (!freight) {
        return null;
    }

    const freightId = freight.id;

    const [quotations, orders, shipments, clearance] = await Promise.all([
        getQuotationsByFreightId(freightId),
        getOrdersByFreightId(freightId),
        getShipmentsByFreightId(freightId, freight.freight_number),
        getClearanceByFreightId(freightId),
    ]);

    let invoices = { allowed: false, invoices: [], message: 'Invoice access is restricted for your role.' };
    if (freight.client_id && canAccessInvoices(ctx)) {
        try {
            invoices = await getInvoicesByClientId(freight.client_id, ctx);
            if (invoices.allowed) {
                invoices.invoices = invoices.invoices.filter(
                    (inv) => Number(inv.freight_id) === Number(freightId) || !inv.freight_id
                );
            }
        } catch (err) {
            console.error('Invoice fetch error (freight still returned):', err.message);
            invoices = {
                allowed: false,
                invoices: [],
                message: 'Invoice details could not be loaded.',
            };
        }
    }

    let supplier = null;
    const supplierId = freight.supplier_task_assign_id || freight.confirmed_supplier_id;
    if (supplierId) {
        supplier = await getSupplierById(supplierId);
    }

    const estimateSummary = getLatestEstimateSummary(quotations);
    const estimateBreakdown = buildEstimateBreakdown(quotations);

    return {
        freight,
        client: {
            id: freight.client_id,
            full_name: freight.client_name,
            email: freight.client_email,
            client_number: freight.client_number,
            cellphone: freight.client_cellphone,
            telephone: freight.client_telephone,
            contact_person: freight.client_contact_person,
            address_1: freight.client_address_1,
            address_2: freight.client_address_2,
            city: freight.client_city,
            province: freight.client_province,
            country: freight.client_country_name,
            tax_ref: freight.client_tax_ref,
            export_code: freight.client_export_code,
        },
        supplier,
        quotations,
        estimateSummary,
        estimateBreakdown,
        orders,
        shipments,
        clearance,
        invoices: invoices.invoices,
        invoices_access: invoices.allowed,
        invoices_message: invoices.message,
    };
}

module.exports = { getFreightFullDetails, getLatestEstimateSummary };
