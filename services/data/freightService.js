const { query } = require('../../helpers/dbQuery');
const { canAccessFreight } = require('../permissions/authorizeTool');
const { getFreightDisplayStatus } = require('../permissions/constants');

function buildFreightScopeCondition(ctx) {
    const conditions = ['f.is_deleted = 0'];
    const params = [];

    if (!ctx.hasFullAccess && ctx.isStaff) {
        // Country-scoped staff → only those countries.
        // Empty access_country → no extra filter (all freights).
        if (ctx.accessCountries.length) {
            const placeholders = ctx.accessCountries.map(() => '?').join(',');
            conditions.push(
                `(f.collection_from IN (${placeholders}) OR f.delivery_to IN (${placeholders}))`
            );
            params.push(...ctx.accessCountries, ...ctx.accessCountries);
        }
    }

    if (ctx.isCustomer) {
        conditions.push('f.client_id = ?');
        params.push(ctx.userId);
    }

    return { conditions, params };
}

async function getFreightByNumber(freightNumber, ctx) {
    const { conditions, params } = buildFreightScopeCondition(ctx);
    conditions.push('LOWER(TRIM(f.freight_number)) = LOWER(TRIM(?))');
    params.push(freightNumber);

    const rows = await query(
        `SELECT f.*,
                c.name AS delivery_to_name,
                co.name AS collection_from_name,
                cm.name AS commodity_name,
                client.full_name AS client_name,
                client.email AS client_email,
                client.client_number,
                client.cellphone AS client_cellphone,
                client.telephone AS client_telephone,
                client.contact_person AS client_contact_person,
                client.address_1 AS client_address_1,
                client.address_2 AS client_address_2,
                client.city AS client_city,
                client.tax_ref AS client_tax_ref,
                client.code AS client_export_code,
                client.country AS client_country_id,
                client.province AS client_province,
                cc.name AS client_country_name,
                sales.full_name AS sales_rep_name,
                sup.name AS assigned_supplier_name
         FROM tbl_freight f
         LEFT JOIN countries c ON c.id = f.delivery_to
         LEFT JOIN countries co ON co.id = f.collection_from
         LEFT JOIN tbl_commodity cm ON cm.id = f.commodity
         LEFT JOIN tbl_users client ON client.id = f.client_id
         LEFT JOIN countries cc ON cc.id = client.country
         LEFT JOIN tbl_users sales ON sales.id = f.sales_representative
         LEFT JOIN tbl_suppliers sup ON sup.id = f.supplier_task_assign_id
         WHERE ${conditions.join(' AND ')}
         LIMIT 1`,
        params
    );

    if (!rows.length) return null;

    const freight = rows[0];
    if (!canAccessFreight(ctx, freight)) return null;

    return enrichFreightDetail({
        ...freight,
        status_code: freight.status,
        order_status_code: freight.order_status,
        status_label: getFreightDisplayStatus(freight),
    });
}

function cleanText(v) {
    if (v == null || v === '') return null;
    const s = String(v).replace(/\s+/g, ' ').trim();
    return s || null;
}

function yesNo(v) {
    if (v == null || v === '') return null;
    if (/^(1|yes|true|y)$/i.test(String(v))) return 'Yes';
    if (/^(0|no|false|n)$/i.test(String(v))) return 'No';
    return cleanText(v);
}

function enrichFreightDetail(freight) {
    if (!freight) return null;
    const consigneeAddress = [freight.client_address_1, freight.client_address_2]
        .map(cleanText)
        .filter(Boolean)
        .join(', ');
    const pickupAddress =
        cleanText(freight.collection_address) || cleanText(freight.supplier_address);
    const deliveryAddress =
        cleanText(freight.delivery_address) ||
        consigneeAddress ||
        cleanText(freight.place_of_delivery);
    const warehouseFlag = yesNo(freight.assign_warehouse) || yesNo(freight.send_to_warehouse) || 'No';

    return {
        ...freight,
        shipper_label: cleanText(freight.shipper_name),
        consignee_label: cleanText(freight.client_name),
        consignee_contact: cleanText(freight.client_contact_person) || cleanText(freight.client_ref_name),
        consignee_email: cleanText(freight.client_email) || cleanText(freight.client_ref_name),
        consignee_cell: cleanText(freight.client_cellphone),
        consignee_telephone: cleanText(freight.client_telephone),
        pickup_address_label: pickupAddress,
        delivery_address_label: deliveryAddress,
        place_of_delivery_label: cleanText(freight.place_of_delivery),
        port_of_loading_label: cleanText(freight.port_of_loading),
        port_of_discharge_label: cleanText(freight.post_of_discharge),
        collection_instructions: cleanText(freight.shipment_origin),
        delivery_instructions: cleanText(freight.shipment_des),
        hazardous_label: yesNo(freight.hazardous) || cleanText(freight.hazardous),
        insurance_label: yesNo(freight.insurance) || cleanText(freight.insurance),
        warehouse_label: warehouseFlag,
        industry_label: cleanText(freight.industry),
        packing_label: cleanText(freight.package_type),
        packages_label: freight.no_of_packages != null && freight.no_of_packages !== '' ? freight.no_of_packages : null,
        weight_label: freight.weight != null && freight.weight !== '' ? freight.weight : null,
        dimension_label: freight.dimension != null && freight.dimension !== '' ? freight.dimension : null,
        volumetric_weight_label:
            freight.volumetric_weight != null && freight.volumetric_weight !== ''
                ? freight.volumetric_weight
                : null,
        incoterm_label: cleanText(freight.incoterm),
        freight_option_label: cleanText(freight.freight),
        efficiency_label: cleanText(freight.type),
        fcl_lcl_label: cleanText(freight.fcl_lcl),
        vat_tax_label: cleanText(freight.client_tax_ref),
        export_code_label: cleanText(freight.client_export_code),
        consignee_city: cleanText(freight.client_city),
        consignee_province: cleanText(freight.client_province),
        consignee_country: cleanText(freight.client_country_name),
        consignee_postal: cleanText(freight.client_export_code),
        nature_of_hazard_label: cleanText(freight.nature_of_hazard),
        attachment_estimate_label: cleanText(freight.attachment_Estimate) || cleanText(freight.add_attachment_file),
    };
}

async function getFreightById(freightId, ctx) {
    const { conditions, params } = buildFreightScopeCondition(ctx);
    conditions.push('f.id = ?');
    params.push(freightId);

    const rows = await query(
        `SELECT f.* FROM tbl_freight f WHERE ${conditions.join(' AND ')} LIMIT 1`,
        params
    );

    if (!rows.length) return null;
    const freight = rows[0];
    if (!canAccessFreight(ctx, freight)) return null;
    return freight;
}

async function listFreightsByClientId(clientId, ctx, { limit = 25, kpiOnly = false } = {}) {
    if (!clientId) return [];

    const { conditions, params } = buildFreightScopeCondition(ctx);
    conditions.push('f.client_id = ?');
    params.push(clientId);

    // Client KPI: only freights that have at least one order
    if (kpiOnly) {
        conditions.push(
            'f.id IN (SELECT DISTINCT freight_id FROM tbl_orders WHERE freight_id IS NOT NULL AND freight_id != 0)'
        );
    }

    const rows = await query(
        `SELECT f.id, f.freight_number, f.status, f.order_status, f.isConfirmed,
                f.freight, f.fcl_lcl, f.priority, f.product_desc, f.created_at, f.date,
                f.client_id, f.user_id, f.sales_representative,
                f.collection_from, f.delivery_to,
                f.weight, f.dimension, f.no_of_packages, f.package_type,
                f.send_to_warehouse, f.assign_warehouse, f.warehouse_status, f.asigned_to_batch,
                c.name AS delivery_to_name,
                co.name AS collection_from_name,
                client.full_name AS client_name,
                client.client_number,
                sales.full_name AS sales_rep_name
         FROM tbl_freight f
         LEFT JOIN countries c ON c.id = f.delivery_to
         LEFT JOIN countries co ON co.id = f.collection_from
         LEFT JOIN tbl_users client ON client.id = f.client_id
         LEFT JOIN tbl_users sales ON sales.id = f.sales_representative
         WHERE ${conditions.join(' AND ')}
         ORDER BY f.id DESC
         LIMIT ?`,
        [...params, Math.min(Number(limit) || 25, 50)]
    );

    return rows
        .filter((row) => canAccessFreight(ctx, row))
        .map((freight) => ({
            ...freight,
            status_code: freight.status,
            order_status_code: freight.order_status,
            status_label: getFreightDisplayStatus(freight),
        }));
}

/**
 * Count freights visible to the current user (permission-scoped).
 * Optional clientId narrows to that client's freights.
 * kpiOnly: match Client KPI (freights that have orders).
 */
async function countFreights(ctx, { clientId, kpiOnly = false } = {}) {
    const { conditions, params } = buildFreightScopeCondition(ctx);
    if (clientId) {
        conditions.push('f.client_id = ?');
        params.push(clientId);
    }
    if (kpiOnly) {
        conditions.push(
            'f.id IN (SELECT DISTINCT freight_id FROM tbl_orders WHERE freight_id IS NOT NULL AND freight_id != 0)'
        );
    }

    const rows = await query(
        `SELECT COUNT(*) AS total FROM tbl_freight f WHERE ${conditions.join(' AND ')}`,
        params
    );
    return Number(rows[0]?.total || 0);
}

async function getFreightByNumberUnscoped(freightNumber) {
    if (!freightNumber) return null;
    const rows = await query(
        `SELECT id, freight_number, client_id, user_id, sales_representative,
                collection_from, delivery_to
         FROM tbl_freight
         WHERE is_deleted = 0 AND LOWER(TRIM(freight_number)) = LOWER(TRIM(?))
         LIMIT 1`,
        [freightNumber]
    );
    return rows[0] || null;
}

module.exports = {
    getFreightByNumber,
    getFreightById,
    getFreightByNumberUnscoped,
    listFreightsByClientId,
    countFreights,
    buildFreightScopeCondition,
};
