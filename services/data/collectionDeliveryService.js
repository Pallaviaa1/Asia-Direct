const { query } = require('../../helpers/dbQuery');
const { canAccessFreight } = require('../permissions/authorizeTool');

function clean(text) {
    if (text == null || text === '') return null;
    const s = String(text).replace(/\s+/g, ' ').trim();
    return s || null;
}

function num(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
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

function formatOrderNumber(orderId) {
    if (!orderId) return null;
    const id = Number(orderId);
    if (!Number.isFinite(id) || id <= 0) return null;
    return `OR000${id}`;
}

function yesNo(v) {
    if (v == null || v === '') return null;
    if (/^(1|yes|true|y)$/i.test(String(v))) return 'Yes';
    if (/^(0|no|false|n)$/i.test(String(v))) return 'No';
    return clean(v);
}

function statusLabel(raw, flagYes) {
    const s = clean(raw);
    if (s) return s;
    if (/^yes$/i.test(String(flagYes || ''))) return 'Pending';
    return '—';
}

function buildScope(ctx) {
    const conditions = [
        'f.is_deleted = 0',
        'f.added_by IN (1, 2)',
        'f.order_status = 1',
    ];
    const params = [];

    if (ctx.isCustomer) {
        conditions.push('f.client_id = ?');
        params.push(ctx.userId);
    } else if (!ctx.hasFullAccess && ctx.isStaff) {
        if (ctx.accessCountries?.length) {
            const placeholders = ctx.accessCountries.map(() => '?').join(',');
            conditions.push(
                `(f.collection_from IN (${placeholders}) OR f.delivery_to IN (${placeholders}))`
            );
            params.push(...ctx.accessCountries, ...ctx.accessCountries);
        }
        // empty access_country → no ownership cage
    }

    return { conditions, params };
}

function canSee(ctx, row) {
    if (!row) return false;
    return canAccessFreight(ctx, {
        client_id: row.client_id,
        collection_from: row.collection_from,
        delivery_to: row.delivery_to,
        user_id: row.user_id,
        sales_representative: row.sales_representative,
    });
}

function mapRow(row, detail = null) {
    if (!row) return null;
    const collectionFlag = yesNo(row.ready_for_collection) || 'No';
    const deliveryFlag = yesNo(row.require_for_delivery) || 'No';
    const orderNumber = clean(row.order_number) || formatOrderNumber(row.order_id);
    const mapped = {
        freight_id: row.freight_id || row.id,
        freight_number: clean(row.freight_number),
        order_id: row.order_id || null,
        order_number: orderNumber,
        client_id: row.client_id,
        customer_name: clean(row.client_name) || clean(row.full_name),
        type_label: clean(row.type) || '—',
        mode_label: clean(row.freight) || '—',
        collection_flag: collectionFlag,
        delivery_flag: deliveryFlag,
        collection_status: statusLabel(row.ready_for_collection_status, row.ready_for_collection),
        delivery_status: statusLabel(row.require_for_delivery_status, row.require_for_delivery),
        // List card "Status" uses the active tab context; default collection status when collection=Yes
        status_label:
            collectionFlag === 'Yes'
                ? statusLabel(row.ready_for_collection_status, row.ready_for_collection)
                : statusLabel(row.require_for_delivery_status, row.require_for_delivery),
        collection_supplier: clean(row.collection_supplier_name) || '—',
        delivery_supplier: clean(row.delivery_supplier_name) || '—',
        origin_country: clean(row.origin_country) || clean(row.collection_from_name),
        destination_country: clean(row.destination_country) || clean(row.delivery_to_name),
        collection_from: row.collection_from,
        delivery_to: row.delivery_to,
        user_id: row.user_id,
        sales_representative: row.sales_representative,
        // Detail form (collection_and_delivery) — may be empty if table missing / not saved
        customer_ref: null,
        date_picked_up_label: null,
        supplier_name: null,
        supplier_contact_person: null,
        supplier_contact: null,
        pickup_address: null,
        create_new_warehouse_order: null,
        warehouse_number: null,
        warehouse_order_id: null,
        courier_waybill_ref: null,
        box_marking: null,
        package_type: null,
        goods_description: null,
        total_packages: null,
        total_cbm: null,
        total_weight: null,
        package_comments: null,
        hazardous_label: null,
        hazardous_description: null,
        costs_to_collect: null,
        handling_cost: null,
        warehouse_cost: null,
        warehouse_comment: null,
        assign_supplier_id: null,
        has_detail: false,
    };

    if (detail) {
        mapped.has_detail = true;
        mapped.customer_ref = clean(detail.customer_ref);
        mapped.date_picked_up_label = formatDate(detail.date_picked_up);
        mapped.supplier_name = clean(detail.supplier_name);
        mapped.supplier_contact_person = clean(detail.supplier_contact_person);
        mapped.supplier_contact = clean(detail.supplier_contact);
        mapped.pickup_address = clean(detail.pickup_address);
        mapped.create_new_warehouse_order = yesNo(detail.create_new_warehouse_order);
        mapped.warehouse_number = clean(detail.warehouse_number);
        mapped.warehouse_order_id =
            detail.warehouse_order_id != null && detail.warehouse_order_id !== ''
                ? clean(String(detail.warehouse_order_id)) || detail.warehouse_order_id
                : null;
        mapped.courier_waybill_ref = clean(detail.courier_waybill_ref);
        mapped.box_marking = clean(detail.box_marking);
        mapped.package_type = clean(detail.package_type);
        mapped.goods_description = clean(detail.goods_description);
        mapped.total_packages = detail.total_packages != null ? num(detail.total_packages) : null;
        mapped.total_cbm = detail.total_cbm != null ? num(detail.total_cbm) : null;
        mapped.total_weight = detail.total_weight != null ? num(detail.total_weight) : null;
        mapped.package_comments = clean(detail.package_comments);
        mapped.hazardous_label = yesNo(detail.hazardous) || 'No';
        mapped.hazardous_description = clean(detail.hazardous_description);
        mapped.costs_to_collect = detail.costs_to_collect != null ? num(detail.costs_to_collect) : null;
        mapped.handling_cost = detail.handling_cost != null ? num(detail.handling_cost) : null;
        mapped.warehouse_cost = detail.warehouse_cost != null ? num(detail.warehouse_cost) : null;
        mapped.warehouse_comment = clean(detail.warehouse_comment);
        mapped.assign_supplier_id = detail.assign_supplier_id != null ? Number(detail.assign_supplier_id) : null;
        if (detail.order_id && !mapped.order_id) {
            mapped.order_id = detail.order_id;
            mapped.order_number = formatOrderNumber(detail.order_id);
        }
        // Prefer form supplier over freight collection supplier when present
        if (mapped.supplier_name) mapped.collection_supplier = mapped.supplier_name;
    }

    return mapped;
}

const SELECT = `
    f.id AS freight_id,
    f.id,
    f.freight_number,
    f.type,
    f.freight,
    f.ready_for_collection,
    f.ready_for_collection_status,
    f.require_for_delivery,
    f.require_for_delivery_status,
    f.collection_supplier_id,
    f.delivery_supplier_id,
    f.client_id,
    f.collection_from,
    f.delivery_to,
    f.user_id,
    f.sales_representative,
    u.full_name AS client_name,
    co.name AS origin_country,
    cd.name AS destination_country,
    cs.name AS collection_supplier_name,
    ds.name AS delivery_supplier_name,
    (
        SELECT o.id FROM tbl_orders o
        WHERE o.freight_id = f.id
        ORDER BY o.id DESC
        LIMIT 1
    ) AS order_id
`;

const FROM = `
    FROM tbl_freight f
    LEFT JOIN tbl_users u ON u.id = f.client_id
    LEFT JOIN countries co ON co.id = f.collection_from
    LEFT JOIN countries cd ON cd.id = f.delivery_to
    LEFT JOIN tbl_suppliers cs ON cs.id = f.collection_supplier_id
    LEFT JOIN tbl_suppliers ds ON ds.id = f.delivery_supplier_id
`;

let detailTableAvailable = null;

async function hasDetailTable() {
    if (detailTableAvailable != null) return detailTableAvailable;
    try {
        await query('SELECT 1 FROM collection_and_delivery LIMIT 1');
        detailTableAvailable = true;
    } catch (err) {
        if (err?.code === 'ER_NO_SUCH_TABLE') {
            detailTableAvailable = false;
        } else {
            // Other errors: retry next time instead of caching a wrong "true"
            detailTableAvailable = null;
            return false;
        }
    }
    return Boolean(detailTableAvailable);
}

async function loadDetail(freightId, freightNumber) {
    if (!(await hasDetailTable())) return null;
    try {
        if (freightId) {
            const rows = await query(
                `SELECT * FROM collection_and_delivery WHERE freight_id = ? ORDER BY id DESC LIMIT 1`,
                [freightId]
            );
            if (rows[0]) return rows[0];
        }
        const num = clean(freightNumber);
        if (num) {
            const rows = await query(
                `SELECT * FROM collection_and_delivery WHERE freight_number = ? ORDER BY id DESC LIMIT 1`,
                [num]
            );
            if (rows[0]) return rows[0];
        }
        return null;
    } catch (err) {
        if (err?.code === 'ER_NO_SUCH_TABLE') detailTableAvailable = false;
        return null;
    }
}

async function runList(ctx, conditions, params, limit = 25) {
    const rows = await query(
        `SELECT ${SELECT} ${FROM}
         WHERE ${conditions.join(' AND ')}
         ORDER BY f.id DESC
         LIMIT ?`,
        [...params, Math.min(Number(limit) || 25, 50)]
    );
    return rows.map((r) => mapRow(r)).filter((r) => canSee(ctx, r));
}

async function searchCollectionDelivery(search, ctx, { kind = 'collection', status, limit = 25 } = {}) {
    const { conditions, params } = buildScope(ctx);
    const tab = String(kind || 'collection').toLowerCase();
    if (tab === 'delivery') {
        conditions.push(`f.require_for_delivery = 'Yes'`);
    } else if (tab === 'all') {
        conditions.push(`(f.ready_for_collection = 'Yes' OR f.require_for_delivery = 'Yes')`);
    } else {
        conditions.push(`f.ready_for_collection = 'Yes'`);
    }

    const term = clean(search);
    if (term) {
        if (/^F-\d+/i.test(term)) {
            conditions.push('LOWER(TRIM(f.freight_number)) = LOWER(TRIM(?))');
            params.push(term);
        } else if (/^OR0*\d+/i.test(term)) {
            const digits = term.replace(/^OR0*/i, '');
            conditions.push(`EXISTS (
                SELECT 1 FROM tbl_orders o2
                WHERE o2.freight_id = f.id AND o2.id = ?
            )`);
            params.push(Number(digits) || 0);
        } else {
            conditions.push(
                `(f.freight_number LIKE ? OR u.full_name LIKE ?
                  OR co.name LIKE ? OR cd.name LIKE ?
                  OR cs.name LIKE ? OR ds.name LIKE ?
                  OR f.type LIKE ? OR f.freight LIKE ?)`
            );
            const like = `%${term}%`;
            params.push(like, like, like, like, like, like, like, like);
        }
    }

    if (status) {
        const st = String(status).trim();
        if (tab === 'delivery') {
            conditions.push(
                `(LOWER(TRIM(IFNULL(f.require_for_delivery_status,''))) = LOWER(?)
                  OR (TRIM(IFNULL(f.require_for_delivery_status,'')) = '' AND LOWER(?) = 'pending'))`
            );
            params.push(st, st);
        } else {
            conditions.push(
                `(LOWER(TRIM(IFNULL(f.ready_for_collection_status,''))) = LOWER(?)
                  OR (TRIM(IFNULL(f.ready_for_collection_status,'')) = '' AND LOWER(?) = 'pending'))`
            );
            params.push(st, st);
        }
    }

    return runList(ctx, conditions, params, limit);
}

async function getCollectionDeliveryByFreight(freightNumber, ctx) {
    if (!freightNumber) return null;
    const { conditions, params } = buildScope(ctx);
    conditions.push('LOWER(TRIM(f.freight_number)) = LOWER(TRIM(?))');
    params.push(freightNumber);
    const rows = await query(
        `SELECT ${SELECT} ${FROM}
         WHERE ${conditions.join(' AND ')}
         LIMIT 1`,
        params
    );
    if (!rows.length) return null;
    const raw = rows[0];
    if (!canSee(ctx, raw)) return null;
    const detail = await loadDetail(raw.freight_id || raw.id, raw.freight_number);
    return mapRow(raw, detail);
}

async function getCollectionDeliveryByOrder(orderNumber, ctx) {
    const digits = String(orderNumber || '').replace(/^OR0*/i, '').replace(/\D/g, '');
    if (!digits) return null;
    const { conditions, params } = buildScope(ctx);
    conditions.push(`EXISTS (
        SELECT 1 FROM tbl_orders o2 WHERE o2.freight_id = f.id AND o2.id = ?
    )`);
    params.push(Number(digits));
    const rows = await query(
        `SELECT ${SELECT} ${FROM}
         WHERE ${conditions.join(' AND ')}
         LIMIT 1`,
        params
    );
    if (!rows.length) return null;
    const raw = rows[0];
    if (!canSee(ctx, raw)) return null;
    const detail = await loadDetail(raw.freight_id || raw.id, raw.freight_number);
    return mapRow(raw, detail);
}

async function countCollectionDelivery(ctx, { search, kind = 'collection', status } = {}) {
    const { conditions, params } = buildScope(ctx);
    const tab = String(kind || 'collection').toLowerCase();
    if (tab === 'delivery') conditions.push(`f.require_for_delivery = 'Yes'`);
    else if (tab === 'all') conditions.push(`(f.ready_for_collection = 'Yes' OR f.require_for_delivery = 'Yes')`);
    else conditions.push(`f.ready_for_collection = 'Yes'`);

    const term = clean(search);
    if (term) {
        conditions.push(
            `(f.freight_number LIKE ? OR u.full_name LIKE ? OR co.name LIKE ? OR cd.name LIKE ?)`
        );
        const like = `%${term}%`;
        params.push(like, like, like, like);
    }
    if (status) {
        const st = String(status).trim();
        if (tab === 'delivery') {
            conditions.push(
                `(LOWER(TRIM(IFNULL(f.require_for_delivery_status,''))) = LOWER(?)
                  OR (TRIM(IFNULL(f.require_for_delivery_status,'')) = '' AND LOWER(?) = 'pending'))`
            );
            params.push(st, st);
        } else {
            conditions.push(
                `(LOWER(TRIM(IFNULL(f.ready_for_collection_status,''))) = LOWER(?)
                  OR (TRIM(IFNULL(f.ready_for_collection_status,'')) = '' AND LOWER(?) = 'pending'))`
            );
            params.push(st, st);
        }
    }

    const rows = await query(
        `SELECT COUNT(DISTINCT f.id) AS total ${FROM} WHERE ${conditions.join(' AND ')}`,
        params
    );
    return Number(rows[0]?.total || 0);
}

module.exports = {
    searchCollectionDelivery,
    getCollectionDeliveryByFreight,
    getCollectionDeliveryByOrder,
    countCollectionDelivery,
    mapRow,
};
