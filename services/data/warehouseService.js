const { query } = require('../../helpers/dbQuery');
const { canAccessFreight, canAccessClient } = require('../permissions/authorizeTool');
const { getWarehouseStatusLabel } = require('../permissions/constants');

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
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

function clean(text) {
    if (text == null || text === '') return null;
    const s = String(text).replace(/\s+/g, ' ').trim();
    if (!s || /^undefined$/i.test(s) || /^null$/i.test(s)) return null;
    return s;
}

function mapWarehouseRow(row) {
    if (!row) return null;
    const track = String(row.order_track_status || row.batch_track_status || '').trim();
    const rawStatus = track || row.warehouse_item_status || 'In Store';
    const inStore = String(rawStatus).toLowerCase() !== 'out';
    const freightMode = clean(row.freight_mode);
    const destinationLabel = row.delivery_to_name
        ? `${row.delivery_to_name}${freightMode ? `(${freightMode})` : ''}`
        : null;
    const batchAssigned = Number(row.assign_to_batch) === 1 || Number(row.batch_id) > 0;
    const clientName =
        clean(row.client_name) || clean(row.customer_name) || clean(row.freight_client_name);

    return {
        ...row,
        source: row.source || 'warehouse',
        client_name: clientName,
        customer_ref: clean(row.customer_ref) || clean(row.client_ref_name),
        order_number: row.order_id ? `OR000${row.order_id}` : null,
        warehouse_status_label: getWarehouseStatusLabel(row.warehouse_status),
        item_status: inStore ? 'In Store' : 'Out',
        status_label: inStore ? 'In Store' : track || 'Out',
        weight: num(row.display_weight),
        dimensions: num(row.display_dimension),
        packages: num(row.display_packages),
        days_in_warehouse: Number(row.days_in_warehouse || 0),
        date_received_label: formatDate(row.arrival_date || row.date_received || row.created_at),
        goods_label: clean(row.goods_label_src || row.product_desc || row.goods_description),
        destination_label: destinationLabel,
        freight_mode: freightMode,
        collection_from_name: clean(row.collection_from_name),
        delivery_to_name: clean(row.delivery_to_name),
        batch_assigned: batchAssigned,
        batch_action_label: batchAssigned ? 'Batch Assigned' : 'Select Batch',
        refs_label: [clean(row.batch_number), clean(row.freight_number), row.order_id ? `OR000${row.order_id}` : null]
            .filter(Boolean)
            .join(' / '),
        box_marking: clean(row.box_marking),
        packing_type: clean(row.package_type || row.packing_type),
        hazardous_label:
            row.hazardous == null || row.hazardous === ''
                ? null
                : /^(1|yes|true|y)$/i.test(String(row.hazardous))
                    ? 'Yes'
                    : /^(0|no|false|n)$/i.test(String(row.hazardous))
                        ? 'No'
                        : clean(row.hazardous),
        supplier_company: clean(row.supplier_company),
        supplier_person: clean(row.supplier_person),
        supplier_address: clean(row.supplier_address),
        supplier_contact: clean(row.supplier_contact_no || row.supplier_contact),
        package_comment: clean(row.package_comment),
        warehouse_comment: clean(row.warehouse_comment),
        damage_goods: clean(row.damage_goods),
        damage_comment: clean(row.damage_comment),
        courier_waybill_ref: clean(row.courier_waybill_ref),
        tracking_number: clean(row.tracking_number),
        ware_receipt_no: clean(row.ware_receipt_no),
        groupage: clean(row.batch_number),
    };
}

function buildScope(ctx, freightAlias = 'f', orderAlias = 'o') {
    const conditions = ['ws.warehouse_status = 1'];
    const params = [];

    if (ctx.isCustomer) {
        conditions.push(`(${orderAlias}.client_id = ? OR ${freightAlias}.client_id = ?)`);
        params.push(ctx.userId, ctx.userId);
    } else if (!ctx.hasFullAccess && ctx.isStaff) {
        if (ctx.accessCountries.length) {
            const ph = ctx.accessCountries.map(() => '?').join(',');
            conditions.push(
                `(${freightAlias}.collection_from IN (${ph}) OR ${freightAlias}.delivery_to IN (${ph})
                  OR ${orderAlias}.collection_from IN (${ph}) OR ${orderAlias}.delivery_to IN (${ph}))`
            );
            params.push(
                ...ctx.accessCountries,
                ...ctx.accessCountries,
                ...ctx.accessCountries,
                ...ctx.accessCountries
            );
        }
        // empty access_country → no ownership cage
    }

    return { conditions, params };
}

const SELECT = `
    ws.id,
    ws.freight_id,
    ws.order_id,
    ws.batch_id,
    ws.warehouse_id,
    ws.warehouse_status,
    ws.assign_to_batch,
    ws.ware_receipt_no,
    ws.tracking_number,
    ws.courier_waybill_ref,
    ws.date_received,
    ws.warehousing_date,
    ws.dispatched_date,
    ws.goods_description,
    ws.customer_name,
    ws.customer_ref,
    ws.box_marking,
    ws.hazardous,
    ws.hazard_description,
    ws.package_comment,
    ws.damage_goods,
    ws.damaged_pkg_qty,
    ws.damage_comment,
    ws.supplier_company,
    ws.supplier_person,
    ws.supplier_address,
    ws.supplier_contact_no,
    ws.warehouse_comment,
    ws.warehouse_collect,
    ws.costs_to_collect,
    ws.warehouse_cost,
    ws.warehouse_dispatch,
    ws.cost_to_dispatch,
    ws.warehouse_storage,
    ws.handling_required,
    ws.handling_cost,
    ws.total_weight AS ws_total_weight,
    ws.total_cbm AS ws_total_cbm,
    ws.total_dimension AS ws_total_dimension,
    ws.total_packeges AS ws_total_packages,
    ws.created_at,
    f.freight_number,
    f.client_id AS freight_client_id,
    f.client_name AS freight_client_name,
    f.client_ref_name,
    f.collection_from,
    f.delivery_to,
    f.user_id AS freight_user_id,
    f.sales_representative,
    f.product_desc,
    f.package_type,
    COALESCE(ws.goods_description, f.product_desc, o.goods_description) AS goods_label_src,
    COALESCE(f.freight, o.freight) AS freight_mode,
    o.client_id AS order_client_id,
    o.track_status AS order_track_status,
    o.goods_description AS order_goods_description,
    b.batch_number,
    b.track_status AS batch_track_status,
    b.date_dispatch AS batch_date_dispatch,
    CASE
        WHEN o.client_id = 0 THEN COALESCE(o.client_name, ws.customer_name)
        ELSE COALESCE(u.full_name, ws.customer_name, f.client_name)
    END AS client_name,
    u.client_number,
    w.warehouse_name,
    w.warehouse_number,
    co.name AS collection_from_name,
    cd.name AS delivery_to_name,
    COALESCE(
        NULLIF(f.weight, 0),
        NULLIF(CAST(o.weight AS DECIMAL(12, 4)), 0),
        NULLIF(wp.wp_total_weight, 0),
        NULLIF(ws.total_weight, 0),
        0
    ) AS display_weight,
    COALESCE(
        NULLIF(f.dimension, 0),
        NULLIF(CAST(o.dimensions AS DECIMAL(12, 4)), 0),
        NULLIF(wp.wp_total_dimension, 0),
        NULLIF(ws.total_dimension, 0),
        NULLIF(ws.total_cbm, 0),
        0
    ) AS display_dimension,
    COALESCE(
        NULLIF(f.no_of_packages, 0),
        NULLIF(CAST(o.cartons AS UNSIGNED), 0),
        NULLIF(wp.wp_total_packages, 0),
        NULLIF(ws.total_packeges, 0),
        0
    ) AS display_packages,
    COALESCE(ws.date_received, DATE(ws.warehousing_date), DATE(ws.created_at)) AS arrival_date,
    CASE
        WHEN (
            ot_order.first_track_at IS NOT NULL
            OR ot_batch.first_track_at IS NOT NULL
            OR (o.track_status IS NOT NULL AND o.track_status != '')
            OR (b.track_status IS NOT NULL AND b.track_status != '')
        ) THEN 'Out'
        ELSE 'In Store'
    END AS warehouse_item_status,
    CASE
        WHEN COALESCE(ws.date_received, DATE(ws.warehousing_date), DATE(ws.created_at)) IS NULL THEN 0
        WHEN COALESCE(ot_order.first_track_at, ot_batch.first_track_at) IS NOT NULL THEN
            GREATEST(
                DATEDIFF(
                    DATE(COALESCE(ot_order.first_track_at, ot_batch.first_track_at)),
                    COALESCE(ws.date_received, DATE(ws.warehousing_date), DATE(ws.created_at))
                ),
                0
            )
        WHEN (o.track_status IS NOT NULL AND o.track_status != '')
            OR (b.track_status IS NOT NULL AND b.track_status != '') THEN
            GREATEST(
                DATEDIFF(
                    COALESCE(b.date_dispatch, ws.dispatched_date, CURDATE()),
                    COALESCE(ws.date_received, DATE(ws.warehousing_date), DATE(ws.created_at))
                ),
                0
            )
        ELSE GREATEST(
            DATEDIFF(
                CURDATE(),
                COALESCE(ws.date_received, DATE(ws.warehousing_date), DATE(ws.created_at))
            ),
            0
        )
    END AS days_in_warehouse
`;

const FROM = `
    FROM warehouse_assign_order ws
    LEFT JOIN tbl_orders o ON o.id = NULLIF(ws.order_id, 0)
    LEFT JOIN tbl_freight f ON f.id = COALESCE(NULLIF(ws.freight_id, 0), NULLIF(o.freight_id, 0))
    LEFT JOIN batches b ON b.id = NULLIF(ws.batch_id, 0)
    LEFT JOIN tbl_users u ON u.id = COALESCE(NULLIF(o.client_id, 0), NULLIF(f.client_id, 0))
    LEFT JOIN warehouse_tbl w ON w.id = COALESCE(NULLIF(ws.warehouse_id, 0), NULLIF(b.warehouse_id, 0))
    LEFT JOIN countries co ON co.id = COALESCE(f.collection_from, o.collection_from)
    LEFT JOIN countries cd ON cd.id = COALESCE(f.delivery_to, o.delivery_to)
    LEFT JOIN (
        SELECT
            warehouse_order_id,
            SUM(IFNULL(dimension, 0)) AS wp_total_dimension,
            SUM(IFNULL(weight, 0)) AS wp_total_weight,
            SUM(IFNULL(packages, 0)) AS wp_total_packages
        FROM warehouse_products
        GROUP BY warehouse_order_id
    ) wp ON wp.warehouse_order_id = ws.id
    LEFT JOIN (
        SELECT order_id, MIN(created_at) AS first_track_at
        FROM order_track
        WHERE order_id IS NOT NULL AND order_id > 0
        GROUP BY order_id
    ) ot_order ON ot_order.order_id = ws.order_id AND ws.order_id IS NOT NULL AND ws.order_id > 0
    LEFT JOIN (
        SELECT batch_id, MIN(created_at) AS first_track_at
        FROM order_track
        WHERE batch_id IS NOT NULL AND batch_id > 0
        GROUP BY batch_id
    ) ot_batch ON ot_batch.batch_id = ws.batch_id AND NULLIF(ws.batch_id, 0) IS NOT NULL
`;

function canSee(ctx, row) {
    if (!row) return false;
    if (ctx.isAdmin || ctx.hasFullAccess) return true;
    if (ctx.isCustomer) {
        return (
            Number(row.order_client_id) === Number(ctx.userId) ||
            Number(row.freight_client_id) === Number(ctx.userId)
        );
    }
    return canAccessFreight(ctx, {
        client_id: row.freight_client_id || row.order_client_id,
        collection_from: row.collection_from,
        delivery_to: row.delivery_to,
        user_id: row.freight_user_id,
        sales_representative: row.sales_representative,
    });
}

async function getWarehouseOrderById(id, ctx) {
    if (!id) return null;
    const { conditions, params } = buildScope(ctx);
    conditions.push('ws.id = ?');
    params.push(id);
    const rows = await query(`SELECT ${SELECT} ${FROM} WHERE ${conditions.join(' AND ')} LIMIT 1`, params);
    const row = mapWarehouseRow(rows[0]);
    if (!row || !canSee(ctx, row)) return null;
    row.packages_detail = await listWarehouseProducts(row.id, row);
    return row;
}

/**
 * Package details match Warehouse Order Manage / getWarehouseProductById:
 * freight cargo line first (when freight_id is set), then warehouse_products rows.
 */
async function listWarehouseProducts(warehouseOrderId, warehouseRow = null) {
    if (!warehouseOrderId) return [];
    let products = [];
    try {
        const rows = await query(
            `SELECT
                id,
                product_description,
                waybill_ref AS waybill,
                warehouse_ref,
                date_received,
                package_type,
                packages,
                dimension,
                weight
             FROM warehouse_products
             WHERE warehouse_order_id = ?
             ORDER BY id ASC
             LIMIT 50`,
            [warehouseOrderId]
        );
        products = rows.map((p) => ({
            ...p,
            source: 'warehouse_product',
            product_description: clean(p.product_description),
            waybill: clean(p.waybill),
            warehouse_ref: clean(p.warehouse_ref),
            package_type: clean(p.package_type),
            date_received_label: formatDate(p.date_received),
            packages: num(p.packages),
            dimension: num(p.dimension),
            weight: num(p.weight),
        }));
    } catch (err) {
        console.error('warehouse_products lookup error:', err.message);
        return [];
    }

    const freightId = Number(warehouseRow?.freight_id || 0);
    if (!freightId) return products;

    try {
        const freightRows = await query(
            `SELECT
                product_desc AS product_description,
                date AS date_received,
                hazardous,
                package_type,
                no_of_packages AS packages,
                dimension,
                weight
             FROM tbl_freight
             WHERE id = ?
             LIMIT 1`,
            [freightId]
        );
        if (!freightRows.length) return products;
        const f = freightRows[0];
        const freightLine = {
            id: null,
            source: 'freight',
            product_description: clean(f.product_description),
            waybill: null,
            warehouse_ref: null,
            date_received: f.date_received,
            date_received_label: formatDate(f.date_received),
            package_type: clean(f.package_type),
            packages: num(f.packages),
            dimension: num(f.dimension),
            weight: num(f.weight),
            hazardous: f.hazardous,
        };
        if (
            freightLine.product_description ||
            freightLine.packages ||
            freightLine.weight ||
            freightLine.dimension
        ) {
            return [freightLine, ...products];
        }
    } catch (err) {
        console.error('freight package line lookup error:', err.message);
    }
    return products;
}

async function listWarehouseOrdersByClientId(clientId, ctx, { limit = 25 } = {}) {
    if (!clientId || !canAccessClient(ctx, clientId)) return [];
    const { conditions, params } = buildScope(ctx);
    conditions.push(
        `(o.client_id = ? OR f.client_id = ? OR (
            NULLIF(o.client_id, 0) IS NULL AND NULLIF(f.client_id, 0) IS NULL
            AND LOWER(TRIM(ws.customer_name)) = (
                SELECT LOWER(TRIM(full_name)) FROM tbl_users WHERE id = ? LIMIT 1
            )
        ))`
    );
    params.push(clientId, clientId, clientId);
    return runListWithCtx(ctx, conditions, params, limit);
}

async function listWarehouseCandidateFreightsByClientId(clientId, ctx, { limit = 10 } = {}) {
    if (!clientId || !canAccessClient(ctx, clientId) || limit <= 0) return [];
    try {
        const { listFreightsByClientId } = require('./freightService');
        const freights = await listFreightsByClientId(clientId, ctx, { limit: 50 });
        const now = Date.now();
        const maxAgeMs = 45 * 24 * 60 * 60 * 1000;
        const candidates = freights.filter((f) => {
            const send = String(f.send_to_warehouse || '').toLowerCase();
            const assign = String(f.assign_warehouse || '').toLowerCase();
            if (!(send === 'yes' || assign === 'yes' || Number(f.warehouse_status) === 1)) return false;
            const raw = f.date || f.created_at;
            if (!raw) return true;
            const t = new Date(raw).getTime();
            if (Number.isNaN(t)) return true;
            return now - t <= maxAgeMs;
        });
        const out = [];
        for (const f of candidates.slice(0, Math.min(limit, 10))) {
            const row = await buildFreightWarehouseFallback(f.freight_number, ctx);
            if (row) out.push(row);
        }
        return out;
    } catch (err) {
        console.error('warehouse candidate freights error:', err.message);
        return [];
    }
}

async function listWarehouseOrdersByFreightNumber(freightNumber, ctx, { limit = 25 } = {}) {
    if (!freightNumber) return [];
    const { conditions, params } = buildScope(ctx);
    conditions.push('LOWER(TRIM(f.freight_number)) = LOWER(TRIM(?))');
    params.push(freightNumber);
    const rows = await runListWithCtx(ctx, conditions, params, limit);
    if (rows.length) return rows;
    const fallback = await buildFreightWarehouseFallback(freightNumber, ctx);
    return fallback ? [fallback] : [];
}

/**
 * When freight is not yet in warehouse_assign_order, still answer warehouse-style
 * lookups from freight fields (client, route, weight/dim/packages, Sea/Air).
 */
async function buildFreightWarehouseFallback(freightNumber, ctx) {
    if (!freightNumber) return null;
    try {
        const { getFreightByNumber } = require('./freightService');
        const freight = await getFreightByNumber(freightNumber, ctx);
        if (!freight) return null;

        const orderRows = await query(
            `SELECT id, track_status, goods_description, weight, dimensions, cartons
             FROM tbl_orders
             WHERE freight_id = ?
             ORDER BY id DESC
             LIMIT 1`,
            [freight.id]
        );
        const order = orderRows[0] || null;
        const freightMode = clean(freight.freight);
        const deliveryName = clean(freight.delivery_to_name);
        const track = clean(order?.track_status);
        const out = Boolean(track);

        return mapWarehouseRow({
            source: 'freight_warehouse_view',
            id: null,
            freight_id: freight.id,
            order_id: order?.id || null,
            batch_id: null,
            assign_to_batch: 0,
            warehouse_status: 1,
            freight_number: freight.freight_number,
            freight_mode: freightMode,
            freight_client_id: freight.client_id,
            freight_client_name: freight.client_name,
            freight_user_id: freight.user_id,
            sales_representative: freight.sales_representative,
            collection_from: freight.collection_from,
            delivery_to: freight.delivery_to,
            collection_from_name: freight.collection_from_name,
            delivery_to_name: deliveryName,
            client_name: freight.client_name,
            client_ref_name: freight.client_ref_name,
            product_desc: freight.product_desc,
            goods_label_src: freight.product_desc || order?.goods_description,
            order_track_status: track,
            warehouse_item_status: out ? 'Out' : 'In Store',
            display_weight: freight.weight || order?.weight || 0,
            display_dimension: freight.dimension || order?.dimensions || 0,
            display_packages: freight.no_of_packages || order?.cartons || 0,
            days_in_warehouse: 0,
            arrival_date: freight.date || freight.created_at,
            date_received: freight.date || null,
            created_at: freight.created_at,
            package_type: freight.package_type,
        });
    } catch (err) {
        console.error('freight warehouse fallback error:', err.message);
        return null;
    }
}

async function listWarehouseOrdersByOrderNumber(orderNumber, ctx, { limit = 25 } = {}) {
    const digits = String(orderNumber || '').replace(/^OR0*/i, '').replace(/\D/g, '');
    if (!digits) return [];
    const { conditions, params } = buildScope(ctx);
    conditions.push('ws.order_id = ?');
    params.push(Number(digits));
    return runListWithCtx(ctx, conditions, params, limit);
}

async function listWarehouseOrdersByBatchNumber(batchNumber, ctx, { limit = 25 } = {}) {
    if (!batchNumber) return [];
    const { conditions, params } = buildScope(ctx);
    conditions.push('LOWER(TRIM(b.batch_number)) = LOWER(TRIM(?))');
    params.push(batchNumber);
    return runListWithCtx(ctx, conditions, params, limit);
}

async function runListWithCtx(ctx, conditions, params, limit = 25) {
    const rows = await query(
        `SELECT ${SELECT} ${FROM}
         WHERE ${conditions.join(' AND ')}
         ORDER BY ws.id DESC
         LIMIT ?`,
        [...params, Math.min(Number(limit) || 25, 50)]
    );
    return rows.map(mapWarehouseRow).filter((r) => canSee(ctx, r));
}

async function countWarehouseOrders(ctx, { clientId } = {}) {
    const { conditions, params } = buildScope(ctx);
    if (clientId) {
        // Same client match as listWarehouseOrdersByClientId / GetWarehouseOrders
        conditions.push(
            `(o.client_id = ? OR f.client_id = ? OR (
                NULLIF(o.client_id, 0) IS NULL AND NULLIF(f.client_id, 0) IS NULL
                AND LOWER(TRIM(ws.customer_name)) = (
                    SELECT LOWER(TRIM(full_name)) FROM tbl_users WHERE id = ? LIMIT 1
                )
            ))`
        );
        params.push(clientId, clientId, clientId);
    }
    const rows = await query(
        `SELECT COUNT(DISTINCT ws.id) AS total ${FROM} WHERE ${conditions.join(' AND ')}`,
        params
    );
    return Number(rows[0]?.total || 0);
}

/**
 * Freights marked Send/Assign to Warehouse for a client (may be higher than assigned warehouse orders).
 */
async function countFreightsMarkedForWarehouse(clientId) {
    if (!clientId) return 0;
    const rows = await query(
        `SELECT COUNT(*) AS total
         FROM tbl_freight f
         WHERE f.is_deleted = 0
           AND f.client_id = ?
           AND (
             LOWER(TRIM(f.send_to_warehouse)) = 'yes'
             OR LOWER(TRIM(f.assign_warehouse)) = 'yes'
             OR f.warehouse_status = 1
           )`,
        [Number(clientId)]
    );
    return Number(rows[0]?.total || 0);
}

module.exports = {
    getWarehouseOrderById,
    listWarehouseOrdersByClientId,
    listWarehouseOrdersByFreightNumber,
    listWarehouseOrdersByOrderNumber,
    listWarehouseOrdersByBatchNumber,
    listWarehouseProducts,
    countWarehouseOrders,
    countFreightsMarkedForWarehouse,
    buildFreightWarehouseFallback,
    listWarehouseCandidateFreightsByClientId,
    mapWarehouseRow,
};
