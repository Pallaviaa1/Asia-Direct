const { query } = require('../../helpers/dbQuery');

function num(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
}

function mapBatchRow(row) {
    if (!row) return null;
    const dim = num(row.total_dimensions) || num(row.total_freight_dimension);
    const weight = num(row.total_weight) || num(row.total_freight_weight);
    const packages = num(row.total_boxes) || num(row.total_freight_packages);
    const totalFreight = num(row.count_freight) || num(row.no_of_shipments);

    return {
        ...row,
        dimensions: dim,
        weight,
        packages,
        total_freight: totalFreight,
        forwarding_agent_label: row.forwarding_agent || row.agent || null,
        origin_label: row.origin_country_name || null,
        destination_label: row.destination_country_name || null,
        status_label:
            (row.track_status && String(row.track_status).trim()) ||
            (Number(row.assign_to_shipment) === 1 ? 'Assigned to shipment' : 'Open'),
    };
}

function buildBatchScope(ctx) {
    const conditions = ['b.is_deleted = 0'];
    const params = [];

    if (ctx.isCustomer) {
        conditions.push(`EXISTS (
            SELECT 1 FROM freight_assig_to_batch fa
            LEFT JOIN tbl_orders o ON o.id = fa.order_id
            LEFT JOIN tbl_freight f ON f.id = fa.freight_id
            WHERE fa.batch_id = b.id
              AND (o.client_id = ? OR f.client_id = ?)
        )`);
        params.push(ctx.userId, ctx.userId);
    } else if (!ctx.hasFullAccess && ctx.isStaff) {
        if (ctx.accessCountries.length) {
            const ph = ctx.accessCountries.map(() => '?').join(',');
            conditions.push(
                `(b.origin_country_id IN (${ph}) OR b.detination_country_id IN (${ph}))`
            );
            params.push(...ctx.accessCountries, ...ctx.accessCountries);
        }
    }

    return { conditions, params };
}

const SELECT = `
    b.id,
    b.batch_number,
    b.batch_name,
    b.warehouse_id,
    b.freight,
    b.freight_option,
    b.freight_speed,
    b.track_status,
    b.waybill,
    b.master_waybill,
    b.house_waybill,
    b.vessel,
    b.carrier,
    b.container_no,
    b.ETD,
    b.date_dispatch,
    b.dispatched,
    b.assign_to_shipment,
    b.origin_country_id,
    b.detination_country_id,
    b.total_weight,
    b.total_dimensions,
    b.total_boxes,
    b.volumentric_weight,
    b.agent,
    b.forwarding_agent,
    b.freight_cost,
    b.no_of_shipments,
    b.created_at,
    oc.name AS origin_country_name,
    dc.name AS destination_country_name,
    w.warehouse_name,
    w.warehouse_number
`;

async function attachFreightTotals(batch) {
    if (!batch?.id) return batch;
    const rows = await query(
        `SELECT
            COUNT(DISTINCT fa.id) AS count_freight,
            SUM(COALESCE(f.dimension, o.dimensions, 0)) AS total_dimension,
            SUM(COALESCE(f.weight, o.weight, 0)) AS total_weight,
            SUM(COALESCE(f.no_of_packages, o.cartons, 0)) AS total_packages
         FROM freight_assig_to_batch fa
         LEFT JOIN tbl_orders o ON o.id = fa.order_id
         LEFT JOIN tbl_freight f ON f.id = COALESCE(fa.freight_id, o.freight_id)
         WHERE fa.batch_id = ?`,
        [batch.id]
    );
    const totals = rows[0] || {};
    batch.count_freight = Number(totals.count_freight || 0);
    batch.total_freight_dimension = num(totals.total_dimension);
    batch.total_freight_weight = num(totals.total_weight);
    batch.total_freight_packages = num(totals.total_packages);

    if (!num(batch.total_weight)) batch.total_weight = batch.total_freight_weight;
    if (!num(batch.total_dimensions)) batch.total_dimensions = batch.total_freight_dimension;
    if (!num(batch.total_boxes)) batch.total_boxes = batch.total_freight_packages;

    return mapBatchRow(batch);
}

async function getBatchByNumber(batchNumber, ctx) {
    if (!batchNumber) return null;
    const { conditions, params } = buildBatchScope(ctx);
    conditions.push('LOWER(TRIM(b.batch_number)) = LOWER(TRIM(?))');
    params.push(batchNumber);

    const rows = await query(
        `SELECT ${SELECT}
         FROM batches b
         LEFT JOIN countries oc ON oc.id = b.origin_country_id
         LEFT JOIN countries dc ON dc.id = b.detination_country_id
         LEFT JOIN warehouse_tbl w ON w.id = b.warehouse_id
         WHERE ${conditions.join(' AND ')}
         LIMIT 1`,
        params
    );
    if (!rows[0]) return null;
    return attachFreightTotals(rows[0]);
}

async function getBatchById(id, ctx) {
    if (!id) return null;
    const { conditions, params } = buildBatchScope(ctx);
    conditions.push('b.id = ?');
    params.push(id);
    const rows = await query(
        `SELECT ${SELECT}
         FROM batches b
         LEFT JOIN countries oc ON oc.id = b.origin_country_id
         LEFT JOIN countries dc ON dc.id = b.detination_country_id
         LEFT JOIN warehouse_tbl w ON w.id = b.warehouse_id
         WHERE ${conditions.join(' AND ')}
         LIMIT 1`,
        params
    );
    if (!rows[0]) return null;
    return attachFreightTotals(rows[0]);
}

async function listBatchContents(batchId, ctx) {
    if (!batchId) return [];
    const rows = await query(
        `SELECT fa.id, fa.freight_id, fa.order_id, fa.batch_id,
                f.freight_number,
                CONCAT('OR000', o.id) AS order_number,
                COALESCE(u.full_name, o.client_name, f.client_name) AS client_name,
                o.track_status
         FROM freight_assig_to_batch fa
         LEFT JOIN tbl_freight f ON f.id = fa.freight_id
         LEFT JOIN tbl_orders o ON o.id = fa.order_id
         LEFT JOIN tbl_users u ON u.id = COALESCE(NULLIF(o.client_id, 0), NULLIF(f.client_id, 0))
         WHERE fa.batch_id = ?
         ORDER BY fa.id DESC
         LIMIT 50`,
        [batchId]
    );

    return rows.filter((r) => r.freight_number || (r.order_id && r.order_number));
}

async function listBatches(ctx, { limit = 25, clientId } = {}) {
    const { conditions, params } = buildBatchScope(ctx);
    if (clientId) {
        conditions.push(`EXISTS (
            SELECT 1 FROM freight_assig_to_batch fa
            LEFT JOIN tbl_orders o ON o.id = fa.order_id
            LEFT JOIN tbl_freight f ON f.id = fa.freight_id
            WHERE fa.batch_id = b.id AND (o.client_id = ? OR f.client_id = ?)
        )`);
        params.push(clientId, clientId);
    }
    const rows = await query(
        `SELECT ${SELECT}
         FROM batches b
         LEFT JOIN countries oc ON oc.id = b.origin_country_id
         LEFT JOIN countries dc ON dc.id = b.detination_country_id
         LEFT JOIN warehouse_tbl w ON w.id = b.warehouse_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY b.id DESC
         LIMIT ?`,
        [...params, Math.min(Number(limit) || 25, 50)]
    );
    const mapped = [];
    for (const row of rows) {
        mapped.push(await attachFreightTotals(row));
    }
    return mapped;
}

async function countBatches(ctx, { clientId } = {}) {
    const { conditions, params } = buildBatchScope(ctx);
    if (clientId) {
        conditions.push(`EXISTS (
            SELECT 1 FROM freight_assig_to_batch fa
            LEFT JOIN tbl_orders o ON o.id = fa.order_id
            LEFT JOIN tbl_freight f ON f.id = fa.freight_id
            WHERE fa.batch_id = b.id AND (o.client_id = ? OR f.client_id = ?)
        )`);
        params.push(clientId, clientId);
    }
    const rows = await query(
        `SELECT COUNT(*) AS total FROM batches b WHERE ${conditions.join(' AND ')}`,
        params
    );
    return Number(rows[0]?.total || 0);
}

module.exports = {
    getBatchByNumber,
    getBatchById,
    listBatchContents,
    listBatches,
    countBatches,
};
