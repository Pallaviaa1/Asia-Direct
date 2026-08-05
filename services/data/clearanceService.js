const { query } = require('../../helpers/dbQuery');
const { canAccessClient } = require('../permissions/authorizeTool');

const CLEARING_LABELS = {
    Cleared: 'Cleared',
    'In process': 'In process',
    'Still to clear': 'Still to clear',
};

const INQUIRY_LABELS = {
    0: 'Pending',
    1: 'Accepted',
    2: 'Declined',
    3: 'Estimated',
};

const QUOTE_LABELS = {
    0: 'Pending',
    1: 'Accepted',
    2: 'Declined',
    3: 'Moved to Order',
};

function clean(text) {
    if (text == null || text === '') return null;
    const s = String(text).replace(/\s+/g, ' ').trim();
    if (!s || /^select\.\.\.?$/i.test(s)) return null;
    return s;
}

/** Are You: Shipper / Consignee */
function labelPartyRole(value) {
    if (value == null || value === '') return null;
    const s = String(value).trim().toLowerCase();
    if (s === '1' || s === 'shipper') return 'Shipper';
    if (s === '2' || s === 'consignee' || s === '0') return 'Consignee';
    if (/shipper/i.test(s)) return 'Shipper';
    if (/consignee/i.test(s)) return 'Consignee';
    return clean(value);
}

/** Is this: Import / Export */
function labelImportExport(value) {
    if (value == null || value === '') return null;
    const s = String(value).trim().toLowerCase();
    if (s === '1' || s === 'import') return 'Import';
    if (s === '2' || s === 'export' || s === '0') return 'Export';
    if (/import/i.test(s)) return 'Import';
    if (/export/i.test(s)) return 'Export';
    return clean(value);
}

function mapClearanceRow(row) {
    if (!row) return null;
    const mode = [clean(row.freight), clean(row.freight_option)].filter(Boolean).join(' · ') || null;
    const loadingCountry = clean(row.loading_country_name);
    const exitCountry = clean(row.discharge_country_name);
    return {
        ...row,
        goods_desc: clean(row.goods_desc),
        customer_ref: clean(row.customer_ref),
        nature_of_goods_label: clean(row.nature_of_goods_name) || clean(row.nature_of_goods),
        packing_type: clean(row.packing_type),
        comment_on_docs: clean(row.comment_on_docs),
        comment_on_goods: clean(row.comment_on_goods),
        port_of_loading: clean(row.port_of_loading),
        port_of_discharge: clean(row.port_of_discharge),
        sales_name: clean(row.sales_name),
        client_name: clean(row.client_name),
        freight_number: clean(row.freight_number),
        mode_label: mode,
        party_role_label: labelPartyRole(row.is_cong_shipp),
        import_export_label: labelImportExport(row.is_Import_Export),
        loading_country_name: loadingCountry,
        discharge_country_name: exitCountry,
        packages_label: row.total_box != null && row.total_box !== '' ? Number(row.total_box) : null,
        dimension_label: row.total_dimension != null && row.total_dimension !== '' ? Number(row.total_dimension) : null,
        weight_label: row.total_weight != null && row.total_weight !== '' ? Number(row.total_weight) : null,
        weight_display:
            row.total_weight != null && row.total_weight !== ''
                ? `${row.total_weight}${row.weight_unit ? ` ${row.weight_unit}` : ''}`
                : null,
        dimension_display:
            row.total_dimension != null && row.total_dimension !== ''
                ? `${row.total_dimension}${row.dimension_unit ? ` ${row.dimension_unit}` : ''}`
                : null,
        clearing_status_label: CLEARING_LABELS[row.clearing_status] || clean(row.clearing_status) || 'Not set',
        inquiry_status_label: INQUIRY_LABELS[String(row.inquery_status)] || String(row.inquery_status ?? '—'),
        quotation_status_label: QUOTE_LABELS[String(row.quotation_status)] || String(row.quotation_status ?? '—'),
        status_label:
            CLEARING_LABELS[row.clearing_status] ||
            QUOTE_LABELS[String(row.quotation_status)] ||
            INQUIRY_LABELS[String(row.inquery_status)] ||
            'Pending',
        route_label:
            loadingCountry || exitCountry ? `${loadingCountry || '?'} → ${exitCountry || '?'}` : null,
    };
}

function formatClearanceOrderDate(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        const [y, m, d] = value.slice(0, 10).split('-');
        if (Number(y) < 1971) return null;
        return `${d}/${m}/${y}`;
    }
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime()) || d.getFullYear() < 1971) return null;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

function mapClearanceOrderRow(row) {
    if (!row) return null;
    const origin = clean(row.origin_country_name) || clean(row.loading_country_name) || clean(row.port_of_entry_name);
    const destination =
        clean(row.destination_country_name) ||
        clean(row.discharge_country_name) ||
        clean(row.port_of_exit_name);
    const action =
        clean(row.order_status) ||
        CLEARING_LABELS[row.clearing_status] ||
        clean(row.clearing_status) ||
        'Accepted';
    return {
        ...row,
        clearance_number: clean(row.clearance_number),
        client_name: clean(row.client_name),
        goods_desc: clean(row.goods_desc),
        freight_mode: clean(row.freight),
        origin_country_name: origin,
        destination_country_name: destination,
        date_label: formatClearanceOrderDate(row.order_date || row.created_at),
        action_label: action,
        status_label: action,
        route_label: origin || destination ? `${origin || '?'} → ${destination || '?'}` : null,
    };
}

function buildClearanceScope(ctx, alias = 'cl') {
    const conditions = [`${alias}.is_deleted = 0`];
    const params = [];

    if (ctx.isCustomer) {
        conditions.push(`${alias}.user_id = ?`);
        params.push(ctx.userId);
    } else if (!ctx.hasFullAccess && ctx.isStaff) {
        if (ctx.accessCountries.length) {
            const ph = ctx.accessCountries.map(() => '?').join(',');
            conditions.push(
                `(${alias}.loading_country IN (${ph}) OR ${alias}.discharge_country IN (${ph}))`
            );
            params.push(...ctx.accessCountries, ...ctx.accessCountries);
        }
        conditions.push(
            `(${alias}.added_user_id = ? OR ${alias}.sales_representative = ? OR ${alias}.user_id = ?)`
        );
        params.push(ctx.userId, ctx.userId, ctx.userId);
    }

    return { conditions, params };
}

const CLEARANCE_SELECT = `
    cl.id,
    cl.clearance_number,
    cl.user_id,
    cl.customer_ref,
    cl.goods_desc,
    cl.nature_of_goods,
    cl.packing_type,
    cl.total_dimension,
    cl.total_box,
    cl.total_weight,
    cl.weight_unit,
    cl.dimension_unit,
    cl.comment_on_docs,
    cl.clearing_status,
    cl.inquery_status,
    cl.quotation_status,
    cl.freight,
    cl.freight_option,
    cl.freight_id,
    cl.is_Import_Export,
    cl.is_cong_shipp,
    cl.port_of_loading,
    cl.port_of_discharge,
    cl.loading_country,
    cl.discharge_country,
    cl.destination,
    cl.sales_representative,
    cl.created_at,
    u.full_name AS client_name,
    u.client_number,
    f.freight_number,
    ss.full_name AS sales_name,
    co.name AS loading_country_name,
    cd.name AS discharge_country_name
`;

const CLEARANCE_FROM = `
    FROM tbl_clearance cl
    LEFT JOIN tbl_users u ON u.id = cl.user_id
    LEFT JOIN tbl_freight f ON f.id = cl.freight_id
    LEFT JOIN tbl_users ss ON ss.id = cl.sales_representative
    LEFT JOIN countries co ON co.id = cl.loading_country
    LEFT JOIN countries cd ON cd.id = cl.discharge_country
`;

async function getClearanceByNumber(clearanceNumber, ctx) {
    if (!clearanceNumber) return null;
    const { conditions, params } = buildClearanceScope(ctx);
    conditions.push('LOWER(TRIM(cl.clearance_number)) = LOWER(TRIM(?))');
    params.push(clearanceNumber);
    const rows = await query(
        `SELECT ${CLEARANCE_SELECT}
         ${CLEARANCE_FROM}
         WHERE ${conditions.join(' AND ')}
         LIMIT 1`,
        params
    );
    return mapClearanceRow(rows[0]);
}

async function listClearancesByClientId(clientId, ctx, { limit = 25 } = {}) {
    if (!clientId || !canAccessClient(ctx, clientId)) return [];
    const { conditions, params } = buildClearanceScope(ctx);
    conditions.push('cl.user_id = ?');
    params.push(clientId);
    const rows = await query(
        `SELECT ${CLEARANCE_SELECT}
         ${CLEARANCE_FROM}
         WHERE ${conditions.join(' AND ')}
         ORDER BY cl.id DESC
         LIMIT ?`,
        [...params, Math.min(Number(limit) || 25, 50)]
    );
    return rows.map(mapClearanceRow);
}

async function listClearancesByFreightNumber(freightNumber, ctx, { limit = 25 } = {}) {
    if (!freightNumber) return [];
    const { conditions, params } = buildClearanceScope(ctx);
    conditions.push('LOWER(TRIM(f.freight_number)) = LOWER(TRIM(?))');
    params.push(freightNumber);
    const rows = await query(
        `SELECT ${CLEARANCE_SELECT}
         ${CLEARANCE_FROM}
         WHERE ${conditions.join(' AND ')}
         ORDER BY cl.id DESC
         LIMIT ?`,
        [...params, Math.min(Number(limit) || 25, 50)]
    );
    return rows.map(mapClearanceRow);
}

async function countClearances(ctx, { clientId } = {}) {
    const { conditions, params } = buildClearanceScope(ctx);
    if (clientId) {
        conditions.push('cl.user_id = ?');
        params.push(clientId);
    }
    const rows = await query(
        `SELECT COUNT(*) AS total FROM tbl_clearance cl WHERE ${conditions.join(' AND ')}`,
        params
    );
    return Number(rows[0]?.total || 0);
}

async function listClearanceOrders(ctx, { clientId, clearanceNumber, search, limit = 25 } = {}) {
    const conditions = ['COALESCE(co.is_deleted, 0) = 0', 'cl.is_deleted = 0'];
    const params = [];

    if (ctx.isCustomer) {
        conditions.push('(co.user_id = ? OR cl.user_id = ?)');
        params.push(ctx.userId, ctx.userId);
    } else if (!ctx.hasFullAccess && ctx.isStaff) {
        if (ctx.accessCountries.length) {
            const ph = ctx.accessCountries.map(() => '?').join(',');
            conditions.push(`(cl.loading_country IN (${ph}) OR cl.discharge_country IN (${ph}))`);
            params.push(...ctx.accessCountries, ...ctx.accessCountries);
        }
    }

    if (clientId) {
        if (!canAccessClient(ctx, clientId)) return [];
        conditions.push('(co.user_id = ? OR cl.user_id = ?)');
        params.push(clientId, clientId);
    }
    if (clearanceNumber) {
        conditions.push('LOWER(TRIM(cl.clearance_number)) = LOWER(TRIM(?))');
        params.push(clearanceNumber);
    }
    if (search && String(search).trim().length >= 2) {
        const like = `%${String(search).trim()}%`;
        conditions.push(`(
            u.full_name LIKE ?
            OR u.client_number LIKE ?
            OR cl.clearance_number LIKE ?
            OR cl.goods_desc LIKE ?
            OR cl.customer_ref LIKE ?
            OR co.order_status LIKE ?
            OR cl.clearing_status LIKE ?
            OR origin_c.name LIKE ?
            OR dest_c.name LIKE ?
            OR cl.freight LIKE ?
        )`);
        params.push(like, like, like, like, like, like, like, like, like, like);
    }

    const rows = await query(
        `SELECT
            co.id,
            co.clearance_id,
            co.user_id,
            co.order_status,
            co.created_at,
            COALESCE(cl.created_at, co.created_at) AS order_date,
            cl.clearance_number,
            cl.clearing_status,
            cl.goods_desc,
            cl.customer_ref,
            cl.freight,
            cl.freight_option,
            cl.port_of_loading,
            cl.port_of_discharge,
            u.full_name AS client_name,
            u.client_number,
            f.freight_number,
            origin_c.name AS origin_country_name,
            dest_c.name AS destination_country_name,
            origin_c.name AS port_of_entry_name,
            dest_c.name AS port_of_exit_name
         FROM clearance_order co
         INNER JOIN tbl_clearance cl ON cl.id = co.clearance_id
         LEFT JOIN tbl_users u ON u.id = COALESCE(co.user_id, cl.user_id)
         LEFT JOIN tbl_freight f ON f.id = cl.freight_id
         LEFT JOIN countries origin_c ON origin_c.id = cl.loading_country
         LEFT JOIN countries dest_c ON dest_c.id = cl.discharge_country
         WHERE ${conditions.join(' AND ')}
         ORDER BY co.created_at DESC
         LIMIT ?`,
        [...params, Math.min(Number(limit) || 25, 50)]
    );
    return rows.map(mapClearanceOrderRow);
}

async function countClearanceOrders(ctx, { clientId } = {}) {
    const conditions = ['COALESCE(co.is_deleted, 0) = 0', 'cl.is_deleted = 0'];
    const params = [];
    if (ctx.isCustomer) {
        conditions.push('(co.user_id = ? OR cl.user_id = ?)');
        params.push(ctx.userId, ctx.userId);
    }
    if (clientId) {
        conditions.push('(co.user_id = ? OR cl.user_id = ?)');
        params.push(clientId, clientId);
    }
    const rows = await query(
        `SELECT COUNT(*) AS total
         FROM clearance_order co
         INNER JOIN tbl_clearance cl ON cl.id = co.clearance_id
         WHERE ${conditions.join(' AND ')}`,
        params
    );
    return Number(rows[0]?.total || 0);
}

module.exports = {
    getClearanceByNumber,
    listClearancesByClientId,
    listClearancesByFreightNumber,
    countClearances,
    listClearanceOrders,
    countClearanceOrders,
    CLEARING_LABELS,
    INQUIRY_LABELS,
    QUOTE_LABELS,
    mapClearanceRow,
};
