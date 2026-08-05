const { query } = require('../../helpers/dbQuery');
const { canAccessClient } = require('../permissions/authorizeTool');

function num(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
}

function formatDate(value) {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) {
        const s = String(value).slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
            const [y, m, day] = s.split('-');
            return `${day}/${m}/${y}`;
        }
        return String(value);
    }
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

function clean(text) {
    return text ? String(text).replace(/\s+/g, ' ').trim() : null;
}

function mapSupplierWarehouseRow(row) {
    if (!row) return null;
    const itemStatus = row.warehouse_item_status || 'In Store';
    const moved = Number(row.move_to_adminWarhouse) === 1;
    const freightMode = clean(row.freight_mode || row.Freight || row.freight);
    const deliveryName = clean(row.destination_country_name);
    const batchAssigned = Number(row.batch_id) > 0;
    return {
        ...row,
        source: 'supplier_warehouse',
        id: row.id,
        order_number: row.order_id ? `OR000${row.order_id}` : null,
        client_name: clean(row.customer_name || row.client_full_name || row.client_name),
        customer_ref: clean(row.customer_ref),
        goods_label: clean(row.goods_description),
        weight: num(row.total_weight),
        dimensions: num(row.total_cbm),
        packages: num(row.total_packages),
        days_in_warehouse: Number(row.days_in_warehouse || 0),
        date_received_label: formatDate(row.date_received || row.created_at),
        collection_from_name: row.collection_from_name || null,
        delivery_to_name: deliveryName,
        freight_mode: freightMode,
        destination_label: deliveryName
            ? `${deliveryName}${freightMode ? `(${freightMode})` : ''}`
            : null,
        warehouse_name: row.warehouse_name || null,
        warehouse_number: row.warehouse_number || null,
        batch_number: row.batch_number || null,
        batch_assigned: batchAssigned,
        batch_action_label: batchAssigned ? 'Batch Assigned' : 'Select Batch',
        freight_number: row.freight_number || row.order_freight_number || null,
        refs_label: [
            row.batch_number || row.groupage_number,
            row.freight_number || row.order_freight_number,
            row.order_id ? `OR000${row.order_id}` : null,
        ]
            .filter(Boolean)
            .join(' / '),
        item_status: itemStatus,
        status_label: itemStatus,
        move_status_label: moved ? 'Moved To Warehouse' : null,
        warehouse_status_label: moved ? 'Moved To Warehouse' : 'Supplier warehouse',
        box_marking: clean(row.box_marking),
        packing_type: clean(row.package_type),
        hazardous_label: clean(row.hazardous),
        supplier_company: clean(row.supplier_company),
        supplier_person: clean(row.supplier_person),
        supplier_address: clean(row.supplier_address),
        supplier_contact: clean(row.supplier_contact),
        groupage: clean(row.groupage_number || row.batch_number),
        courier_waybill_ref: clean(row.courier_waybill_ref),
    };
}

const TRACKING_STARTED = `
    (
        SELECT MIN(ot.created_at)
        FROM order_track ot
        WHERE
            (s.order_id IS NOT NULL AND s.order_id > 0 AND ot.order_id = s.order_id)
            OR (NULLIF(s.batch_id, 0) IS NOT NULL AND ot.batch_id = s.batch_id)
    )
`;

const HAS_TRACKING = `
    (
        ${TRACKING_STARTED} IS NOT NULL
        OR (o.track_status IS NOT NULL AND o.track_status != '')
        OR (b.track_status IS NOT NULL AND b.track_status != '')
    )
`;

const SELECT = `
    s.*,
    ${TRACKING_STARTED} AS tracking_started_at,
    CASE WHEN ${HAS_TRACKING} THEN 'Out' ELSE 'In Store' END AS warehouse_item_status,
    CASE
        WHEN s.date_received IS NULL THEN 0
        WHEN ${TRACKING_STARTED} IS NOT NULL THEN
            GREATEST(DATEDIFF(DATE(${TRACKING_STARTED}), s.date_received), 0)
        WHEN (o.track_status IS NOT NULL AND o.track_status != '')
            OR (b.track_status IS NOT NULL AND b.track_status != '') THEN
            GREATEST(
                COALESCE(
                    DATEDIFF(b.date_dispatch, s.date_received),
                    DATEDIFF(s.dispatch_date, s.date_received),
                    0
                ),
                0
            )
        ELSE GREATEST(DATEDIFF(CURDATE(), s.date_received), 0)
    END AS days_in_warehouse,
    c.name AS destination_country_name,
    cd.name AS collection_from_name,
    w.warehouse_name,
    w.warehouse_number,
    su.name AS supplier_name,
    u.full_name AS client_full_name,
    COALESCE(NULLIF(TRIM(s.freight_number), ''), f.freight_number) AS freight_number,
    f.freight_number AS order_freight_number,
    COALESCE(f.freight, o.freight) AS freight_mode,
    COALESCE(b.batch_number, NULLIF(TRIM(s.groupage_number), ''), '') AS batch_number
`;

const FROM = `
    FROM supplier_warehouse_orders s
    LEFT JOIN countries c ON c.id = s.destination_country
    LEFT JOIN countries cd ON cd.id = s.collection_from
    LEFT JOIN warehouse_tbl w ON w.id = s.warehouse_id
    LEFT JOIN tbl_suppliers su ON su.id = s.supplier_id
    LEFT JOIN tbl_orders o ON o.id = s.order_id
    LEFT JOIN tbl_freight f ON f.id = NULLIF(o.freight_id, 0)
    LEFT JOIN batches b ON b.id = NULLIF(s.batch_id, 0)
    LEFT JOIN tbl_users u ON u.id = COALESCE(NULLIF(s.client_id, 0), NULLIF(o.client_id, 0))
`;

function buildScope(ctx) {
    const conditions = ['1=1'];
    const params = [];
    if (ctx.isCustomer) {
        conditions.push('(s.client_id = ? OR o.client_id = ?)');
        params.push(ctx.userId, ctx.userId);
    }
    return { conditions, params };
}

async function runList(ctx, conditions, params, limit = 25) {
    const rows = await query(
        `SELECT ${SELECT} ${FROM}
         WHERE ${conditions.join(' AND ')}
         ORDER BY s.id DESC
         LIMIT ?`,
        [...params, Math.min(Number(limit) || 25, 50)]
    );
    return rows.map(mapSupplierWarehouseRow);
}

async function getSupplierWarehouseById(id, ctx) {
    if (!id) return null;
    const { conditions, params } = buildScope(ctx);
    conditions.push('s.id = ?');
    params.push(id);
    const rows = await runList(ctx, conditions, params, 1);
    return rows[0] || null;
}

async function listSupplierWarehouseByOrderNumber(orderNumber, ctx, { limit = 25 } = {}) {
    const digits = String(orderNumber || '').replace(/^OR0*/i, '').replace(/\D/g, '');
    if (!digits) return [];
    const { conditions, params } = buildScope(ctx);
    conditions.push('s.order_id = ?');
    params.push(Number(digits));
    return runList(ctx, conditions, params, limit);
}

async function listSupplierWarehouseByFreightNumber(freightNumber, ctx, { limit = 25 } = {}) {
    if (!freightNumber) return [];
    const { conditions, params } = buildScope(ctx);
    conditions.push(
        `(LOWER(TRIM(f.freight_number)) = LOWER(TRIM(?)) OR LOWER(TRIM(s.freight_number)) = LOWER(TRIM(?)))`
    );
    params.push(freightNumber, freightNumber);
    return runList(ctx, conditions, params, limit);
}

async function listSupplierWarehouseByClientId(clientId, ctx, { limit = 25 } = {}) {
    if (!clientId || !canAccessClient(ctx, clientId)) return [];
    const { conditions, params } = buildScope(ctx);
    conditions.push(
        `(s.client_id = ? OR o.client_id = ? OR LOWER(TRIM(s.customer_name)) = (
            SELECT LOWER(TRIM(full_name)) FROM tbl_users WHERE id = ? LIMIT 1
        ))`
    );
    params.push(clientId, clientId, clientId);
    return runList(ctx, conditions, params, limit);
}

async function listSupplierWarehouseByBatchNumber(batchNumber, ctx, { limit = 25 } = {}) {
    if (!batchNumber) return [];
    const { conditions, params } = buildScope(ctx);
    conditions.push('LOWER(TRIM(b.batch_number)) = LOWER(TRIM(?))');
    params.push(batchNumber);
    return runList(ctx, conditions, params, limit);
}

async function countSupplierWarehouseOrders(ctx, { clientId } = {}) {
    const { conditions, params } = buildScope(ctx);
    if (clientId) {
        conditions.push('(s.client_id = ? OR o.client_id = ?)');
        params.push(clientId, clientId);
    }
    const rows = await query(
        `SELECT COUNT(*) AS total ${FROM} WHERE ${conditions.join(' AND ')}`,
        params
    );
    return Number(rows[0]?.total || 0);
}

module.exports = {
    getSupplierWarehouseById,
    listSupplierWarehouseByOrderNumber,
    listSupplierWarehouseByFreightNumber,
    listSupplierWarehouseByClientId,
    listSupplierWarehouseByBatchNumber,
    countSupplierWarehouseOrders,
};
