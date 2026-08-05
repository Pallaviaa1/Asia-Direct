const { query } = require('../../helpers/dbQuery');
const { canAccessClient } = require('../permissions/authorizeTool');

function clean(text) {
    if (text == null || text === '') return null;
    const s = String(text).replace(/\s+/g, ' ').trim();
    return s || null;
}

/** Shipment form dates use mm/dd/yyyy (match Update Shipment UI) */
function formatShipmentDate(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        const [y, m, d] = value.slice(0, 10).split('-');
        if (Number(y) < 1971) return null;
        return `${m}/${d}/${y}`;
    }
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const yyyy = d.getFullYear();
    if (yyyy < 1971) return null;
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    if (mm === '00' || dd === '00') return null;
    return `${mm}/${dd}/${yyyy}`;
}

function mapShipmentRow(row) {
    if (!row) return null;
    const originCountry = clean(row.origin_country_name);
    const destCountry = clean(row.des_country_name);
    return {
        ...row,
        waybill: clean(row.waybill),
        freight: clean(row.freight),
        carrier: clean(row.carrier),
        vessel: clean(row.vessel),
        status: clean(row.status),
        status_label: clean(row.status) || 'Unknown',
        origin_agent: clean(row.origin_agent),
        destination_agent: clean(row.destination_agent),
        port_of_loading: clean(row.port_of_loading),
        port_of_discharge: clean(row.port_of_discharge),
        load: clean(row.load),
        release_type: clean(row.release_type),
        container: clean(row.container),
        seal: clean(row.seal),
        origin_country_name: originCountry,
        des_country_name: destCountry,
        date_of_dispatch_label: formatShipmentDate(row.date_of_dispatch),
        etd_label: formatShipmentDate(row.ETD),
        // Form labels this ETA; stored as ATD in tbl_shipments
        eta_label: formatShipmentDate(row.ATD),
        atd_label: formatShipmentDate(row.ATD),
        route_label:
            originCountry || destCountry ? `${originCountry || '?'} → ${destCountry || '?'}` : null,
    };
}

function buildShipmentScope(ctx) {
    const conditions = ['1=1'];
    const params = [];

    if (ctx.isCustomer) {
        conditions.push(`EXISTS (
            SELECT 1 FROM shipment_details sd2
            LEFT JOIN tbl_orders o2 ON o2.id = sd2.order_id
            LEFT JOIN tbl_freight f2 ON f2.id = o2.freight_id
            WHERE sd2.shipment_id = s.id
              AND (o2.client_id = ? OR f2.client_id = ?)
        )`);
        params.push(ctx.userId, ctx.userId);
    } else if (!ctx.hasFullAccess && ctx.isStaff) {
        if (ctx.accessCountries.length) {
            const ph = ctx.accessCountries.map(() => '?').join(',');
            conditions.push(`(s.origin_country_id IN (${ph}) OR s.des_country_id IN (${ph}))`);
            params.push(...ctx.accessCountries, ...ctx.accessCountries);
        }
    }

    return { conditions, params };
}

const SELECT = `
    s.id,
    s.waybill,
    s.freight,
    s.carrier,
    s.vessel,
    s.ETD,
    s.ATD,
    s.status,
    s.port_of_loading,
    s.port_of_discharge,
    s.container,
    s.seal,
    s.date_of_dispatch,
    s.origin_agent,
    s.destination_agent,
    s.\`load\`,
    s.release_type,
    s.origin_country_id,
    s.des_country_id,
    s.created_at,
    oc.name AS origin_country_name,
    dc.name AS des_country_name
`;

async function getShipmentByWaybill(waybill, ctx) {
    if (!waybill) return null;
    const { conditions, params } = buildShipmentScope(ctx);
    const compact = String(waybill).trim();
    conditions.push(
        `(LOWER(TRIM(s.waybill)) = LOWER(TRIM(?)) OR LOWER(TRIM(s.\`load\`)) = LOWER(TRIM(?)))`
    );
    params.push(compact, compact);
    const rows = await query(
        `SELECT ${SELECT}
         FROM tbl_shipments s
         LEFT JOIN countries oc ON oc.id = s.origin_country_id
         LEFT JOIN countries dc ON dc.id = s.des_country_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY s.id DESC
         LIMIT 1`,
        params
    );
    return mapShipmentRow(rows[0]);
}

async function getShipmentById(id, ctx) {
    if (!id) return null;
    const { conditions, params } = buildShipmentScope(ctx);
    conditions.push('s.id = ?');
    params.push(id);
    const rows = await query(
        `SELECT ${SELECT}
         FROM tbl_shipments s
         LEFT JOIN countries oc ON oc.id = s.origin_country_id
         LEFT JOIN countries dc ON dc.id = s.des_country_id
         WHERE ${conditions.join(' AND ')}
         LIMIT 1`,
        params
    );
    return mapShipmentRow(rows[0]);
}

/** Assigned freights/orders on the shipment (Assign Shipment table) */
async function listShipmentLinks(shipmentId) {
    const rows = await query(
        `SELECT
            sd.id AS shipment_details_id,
            sd.shipment_id,
            sd.order_id,
            sd.batch_id,
            sd.clearance_id,
            CONCAT('OR000', o.id) AS order_number,
            COALESCE(o.weight, f.weight) AS weight,
            COALESCE(o.dimensions, f.dimension) AS dimensions,
            f.nature_of_goods,
            f.freight_number,
            b.batch_number,
            b.house_waybill,
            b.master_waybill,
            b.waybill AS batch_waybill,
            CASE
                WHEN o.client_id = 0 THEN o.client_name
                ELSE u.full_name
            END AS client_name
         FROM shipment_details sd
         LEFT JOIN tbl_orders o ON o.id = sd.order_id
         LEFT JOIN tbl_freight f ON f.id = o.freight_id
         LEFT JOIN batches b ON b.id = sd.batch_id
         LEFT JOIN tbl_users u ON u.id = o.client_id
         WHERE sd.shipment_id = ?
         ORDER BY sd.id ASC
         LIMIT 50`,
        [shipmentId]
    );

    return rows
        .filter((r) => r.order_id || r.batch_id || r.clearance_id)
        .map((r) => ({
            ...r,
            client_name: clean(r.client_name),
            freight_number: clean(r.freight_number),
            nature_of_goods: clean(r.nature_of_goods),
            hawb_tracking: clean(r.house_waybill) || clean(r.batch_waybill) || clean(r.master_waybill),
            weight_label: r.weight != null && r.weight !== '' ? Number(r.weight) : null,
            cbm_label: r.dimensions != null && r.dimensions !== '' ? Number(r.dimensions) : null,
            freight_order_label: [clean(r.freight_number), clean(r.order_number)].filter(Boolean).join(' / '),
        }));
}

/** Clearance rows linked on Assign Shipment → Clearance Order */
async function listShipmentClearances(shipmentId) {
    const rows = await query(
        `SELECT DISTINCT
            cl.id AS clearance_id,
            cl.clearance_number,
            cl.clearing_status,
            cl.nature_of_goods,
            cl.total_weight,
            cl.total_dimension,
            cl.freight,
            cl.freight_option,
            cl.created_at,
            u.full_name AS client_name
         FROM shipment_details sd
         INNER JOIN tbl_clearance cl ON cl.id = sd.clearance_id
         LEFT JOIN tbl_users u ON u.id = cl.user_id
         WHERE sd.shipment_id = ?
           AND sd.clearance_id IS NOT NULL
           AND cl.is_deleted = 0
         ORDER BY cl.created_at DESC
         LIMIT 50`,
        [shipmentId]
    );

    return rows.map((r) => ({
        ...r,
        client_name: clean(r.client_name),
        clearance_number: clean(r.clearance_number),
        nature_of_goods: clean(r.nature_of_goods),
        clearing_status_label: clean(r.clearing_status) || '—',
        weight_label: r.total_weight != null ? Number(r.total_weight) : null,
        dimension_label: r.total_dimension != null ? Number(r.total_dimension) : null,
    }));
}

async function listShipmentsByFreightNumber(freightNumber, ctx, { limit = 25 } = {}) {
    if (!freightNumber) return [];
    const { conditions, params } = buildShipmentScope(ctx);
    conditions.push(`(
        EXISTS (
            SELECT 1 FROM shipment_details sd
            INNER JOIN tbl_orders o ON o.id = sd.order_id
            INNER JOIN tbl_freight f ON f.id = o.freight_id
            WHERE sd.shipment_id = s.id AND LOWER(TRIM(f.freight_number)) = LOWER(TRIM(?))
        )
        OR s.freight LIKE ?
        OR s.waybill LIKE ?
        OR s.\`load\` LIKE ?
    )`);
    params.push(freightNumber, `%${freightNumber}%`, `%${freightNumber}%`, `%${freightNumber}%`);
    const rows = await query(
        `SELECT ${SELECT}
         FROM tbl_shipments s
         LEFT JOIN countries oc ON oc.id = s.origin_country_id
         LEFT JOIN countries dc ON dc.id = s.des_country_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY s.id DESC
         LIMIT ?`,
        [...params, Math.min(Number(limit) || 25, 50)]
    );
    return rows.map(mapShipmentRow);
}

async function listShipmentsByClientId(clientId, ctx, { limit = 25 } = {}) {
    if (!clientId || !canAccessClient(ctx, clientId)) return [];
    const { conditions, params } = buildShipmentScope(ctx);
    conditions.push(`EXISTS (
        SELECT 1 FROM shipment_details sd
        LEFT JOIN tbl_orders o ON o.id = sd.order_id
        LEFT JOIN tbl_freight f ON f.id = o.freight_id
        WHERE sd.shipment_id = s.id AND (o.client_id = ? OR f.client_id = ?)
    )`);
    params.push(clientId, clientId);
    const rows = await query(
        `SELECT ${SELECT}
         FROM tbl_shipments s
         LEFT JOIN countries oc ON oc.id = s.origin_country_id
         LEFT JOIN countries dc ON dc.id = s.des_country_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY s.id DESC
         LIMIT ?`,
        [...params, Math.min(Number(limit) || 25, 50)]
    );
    return rows.map(mapShipmentRow);
}

async function countShipments(ctx, { clientId } = {}) {
    const { conditions, params } = buildShipmentScope(ctx);
    if (clientId) {
        conditions.push(`EXISTS (
            SELECT 1 FROM shipment_details sd
            LEFT JOIN tbl_orders o ON o.id = sd.order_id
            LEFT JOIN tbl_freight f ON f.id = o.freight_id
            WHERE sd.shipment_id = s.id AND (o.client_id = ? OR f.client_id = ?)
        )`);
        params.push(clientId, clientId);
    }
    const rows = await query(
        `SELECT COUNT(*) AS total FROM tbl_shipments s WHERE ${conditions.join(' AND ')}`,
        params
    );
    return Number(rows[0]?.total || 0);
}

module.exports = {
    getShipmentByWaybill,
    getShipmentById,
    listShipmentLinks,
    listShipmentClearances,
    listShipmentsByFreightNumber,
    listShipmentsByClientId,
    countShipments,
    mapShipmentRow,
    formatShipmentDate,
};
