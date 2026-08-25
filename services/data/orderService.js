const { query } = require('../../helpers/dbQuery');
const { canAccessOrder } = require('../permissions/authorizeTool');
const {
    getOrderDisplayStatus,
    getWarehouseStatusLabel,
    isWarehouseOnlyStatus,
} = require('../permissions/constants');

function normalizeOrderId(orderNumber) {
    if (orderNumber == null || orderNumber === '') return null;
    const raw = String(orderNumber).trim();
    const digits = raw.replace(/^OR0*/i, '').replace(/\D/g, '');
    if (!digits) return null;
    const id = Number(digits);
    return Number.isFinite(id) && id > 0 ? id : null;
}

function formatOrderNumber(id) {
    return `OR000${id}`;
}

function cleanDate(value) {
    if (value == null || value === '') return null;
    const s = String(value);
    if (/^0000-00-00/.test(s) || s.startsWith('0000-00-00')) return null;
    return s;
}

function mapOrderRow(row) {
    if (!row) return null;
    const warehouse_status_label = getWarehouseStatusLabel(row.warehouse_status);
    const goods =
        row.goods_description ||
        row.product_desc ||
        row.freight_product_desc ||
        null;
    return {
        ...row,
        order_number: row.order_number || formatOrderNumber(row.id),
        goods_description: goods,
        date_of_collection: cleanDate(row.date_of_collection),
        warehouse_status_label,
        tracking_started: !isWarehouseOnlyStatus(row),
        status_label: getOrderDisplayStatus(row),
    };
}

function buildOrderScopeCondition(ctx, alias = 'o', freightAlias = 'f') {
    const conditions = ['1=1'];
    const params = [];

    if (ctx.isCustomer) {
        conditions.push(`(${alias}.client_id = ? OR ${freightAlias}.client_id = ?)`);
        params.push(ctx.userId, ctx.userId);
    } else if (!ctx.hasFullAccess && ctx.isStaff) {
        if (ctx.accessCountries.length) {
            const placeholders = ctx.accessCountries.map(() => '?').join(',');
            conditions.push(
                `(${freightAlias}.collection_from IN (${placeholders}) OR ${freightAlias}.delivery_to IN (${placeholders}))`
            );
            params.push(...ctx.accessCountries, ...ctx.accessCountries);
        }
        // empty access_country → no ownership cage
    }

    return { conditions, params };
}

const ORDER_SELECT = `
    o.id,
    o.freight_id,
    o.client_id,
    o.client_name AS order_client_name,
    o.goods_description,
    o.dimensions,
    o.weight,
    o.cartons,
    o.CBM,
    o.date_of_collection,
    o.warehouse_status,
    o.track_status,
    o.created_at,
    o.updated_at,
    CONCAT('OR000', o.id) AS order_number,
    (
        SELECT ot.status
        FROM order_track ot
        WHERE ot.order_id = o.id
        ORDER BY ot.created_at DESC, ot.id DESC
        LIMIT 1
    ) AS latest_track_status,
    (
        SELECT b.track_status
        FROM freight_assig_to_batch fa
        INNER JOIN batches b ON b.id = fa.batch_id
        WHERE fa.order_id = o.id
          AND b.track_status IS NOT NULL
          AND TRIM(b.track_status) != ''
        ORDER BY fa.id DESC
        LIMIT 1
    ) AS batch_track_status,
    (
        SELECT ot.status
        FROM freight_assig_to_batch fa
        INNER JOIN order_track ot ON ot.batch_id = fa.batch_id
        WHERE fa.order_id = o.id
          AND ot.status IS NOT NULL
          AND TRIM(ot.status) != ''
        ORDER BY ot.created_at DESC, ot.id DESC
        LIMIT 1
    ) AS latest_batch_track_status,
    (
        SELECT b.track_status
        FROM warehouse_assign_order ws
        INNER JOIN batches b ON b.id = ws.batch_id
        WHERE ws.order_id = o.id
          AND ws.batch_id IS NOT NULL
          AND ws.batch_id != 0
          AND b.track_status IS NOT NULL
          AND TRIM(b.track_status) != ''
        ORDER BY ws.id DESC
        LIMIT 1
    ) AS warehouse_batch_track_status,
    f.freight_number,
    f.freight,
    f.fcl_lcl,
    f.type AS freight_speed,
    f.product_desc AS freight_product_desc,
    f.collection_from,
    f.delivery_to,
    f.client_id AS freight_client_id,
    f.user_id AS freight_user_id,
    f.sales_representative,
    CASE
        WHEN o.client_id = 0 OR o.client_id IS NULL THEN COALESCE(o.client_name, u.full_name)
        ELSE COALESCE(u.full_name, o.client_name)
    END AS client_name,
    u.client_number,
    co.name AS collection_from_name,
    cd.name AS delivery_to_name,
    sales.full_name AS sales_rep_name
`;

async function getOrderByNumber(orderNumber, ctx) {
    const orderId = normalizeOrderId(orderNumber);
    if (!orderId) return null;

    const { conditions, params } = buildOrderScopeCondition(ctx);
    conditions.push('o.id = ?');
    params.push(orderId);

    const rows = await query(
        `SELECT ${ORDER_SELECT}
         FROM tbl_orders o
         LEFT JOIN tbl_freight f ON f.id = o.freight_id
         LEFT JOIN tbl_users u ON u.id = o.client_id
         LEFT JOIN tbl_users sales ON sales.id = f.sales_representative
         LEFT JOIN countries co ON co.id = f.collection_from
         LEFT JOIN countries cd ON cd.id = f.delivery_to
         WHERE ${conditions.join(' AND ')}
         LIMIT 1`,
        params
    );

    if (!rows.length) return null;
    const order = mapOrderRow(rows[0]);
    if (!canAccessOrder(ctx, order)) return null;
    return order;
}

async function listOrdersByClientId(clientId, ctx, { limit = 25, kpiOnly = false } = {}) {
    if (!clientId) return [];

    const { conditions, params } = buildOrderScopeCondition(ctx);
    if (kpiOnly) {
        // Client KPI: orders linked to this client's non-deleted freights
        conditions.push('f.client_id = ?');
        conditions.push('COALESCE(f.is_deleted, 0) = 0');
        params.push(clientId);
    } else {
        conditions.push('(o.client_id = ? OR f.client_id = ?)');
        params.push(clientId, clientId);
    }

    const rows = await query(
        `SELECT ${ORDER_SELECT}
         FROM tbl_orders o
         LEFT JOIN tbl_freight f ON f.id = o.freight_id
         LEFT JOIN tbl_users u ON u.id = o.client_id
         LEFT JOIN tbl_users sales ON sales.id = f.sales_representative
         LEFT JOIN countries co ON co.id = f.collection_from
         LEFT JOIN countries cd ON cd.id = f.delivery_to
         WHERE ${conditions.join(' AND ')}
         ORDER BY o.id DESC
         LIMIT ?`,
        [...params, Math.min(Number(limit) || 25, 50)]
    );

    return rows
        .map(mapOrderRow)
        .filter((order) => canAccessOrder(ctx, order));
}

async function listOrdersByFreightNumber(freightNumber, ctx, { limit = 25 } = {}) {
    if (!freightNumber) return [];

    const { conditions, params } = buildOrderScopeCondition(ctx);
    conditions.push('LOWER(TRIM(f.freight_number)) = LOWER(TRIM(?))');
    params.push(freightNumber);

    const rows = await query(
        `SELECT ${ORDER_SELECT}
         FROM tbl_orders o
         LEFT JOIN tbl_freight f ON f.id = o.freight_id
         LEFT JOIN tbl_users u ON u.id = o.client_id
         LEFT JOIN tbl_users sales ON sales.id = f.sales_representative
         LEFT JOIN countries co ON co.id = f.collection_from
         LEFT JOIN countries cd ON cd.id = f.delivery_to
         WHERE ${conditions.join(' AND ')}
         ORDER BY o.id DESC
         LIMIT ?`,
        [...params, Math.min(Number(limit) || 25, 50)]
    );

    return rows
        .map(mapOrderRow)
        .filter((order) => canAccessOrder(ctx, order));
}

async function countOrders(ctx, { clientId, kpiOnly = false } = {}) {
    const { conditions, params } = buildOrderScopeCondition(ctx);
    if (clientId) {
        if (kpiOnly) {
            conditions.push('f.client_id = ?');
            conditions.push('COALESCE(f.is_deleted, 0) = 0');
            params.push(clientId);
        } else {
            conditions.push('(o.client_id = ? OR f.client_id = ?)');
            params.push(clientId, clientId);
        }
    }

    const rows = await query(
        `SELECT COUNT(DISTINCT o.id) AS total
         FROM tbl_orders o
         LEFT JOIN tbl_freight f ON f.id = o.freight_id
         WHERE ${conditions.join(' AND ')}`,
        params
    );
    return Number(rows[0]?.total || 0);
}

module.exports = {
    getOrderByNumber,
    listOrdersByClientId,
    listOrdersByFreightNumber,
    countOrders,
    normalizeOrderId,
    formatOrderNumber,
};
