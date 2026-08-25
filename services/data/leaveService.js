const { query } = require('../../helpers/dbQuery');

const STATUS_LABELS = {
    0: 'Pending',
    1: 'Approved',
    2: 'Rejected',
};

function clean(text) {
    if (text == null || text === '') return null;
    const s = String(text).replace(/\s+/g, ' ').trim();
    return s || null;
}

function formatDate(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'string' && /^0000-00-00/.test(value)) return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        const [y, m, day] = value.slice(0, 10).split('-');
        if (Number(y) < 1971) return null;
        return `${day}/${m}/${y}`;
    }
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime()) || d.getFullYear() < 1971) return null;
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

function canAccessLeaves(ctx) {
    return !!(ctx && (ctx.isAdmin || ctx.hasFullAccess || ctx.isStaff));
}

function canSeeAllLeaves(ctx) {
    return !!(ctx && (ctx.isAdmin || ctx.hasFullAccess));
}

function normalizeStatus(status) {
    if (status == null || status === '') return null;
    if (typeof status === 'number' || /^\d+$/.test(String(status).trim())) {
        const n = Number(status);
        if ([0, 1, 2].includes(n)) return n;
        return null;
    }
    const s = String(status).toLowerCase().trim().replace(/\s+/g, '_');
    if (s === 'pending' || s === 'open') return 0;
    if (s === 'approved' || s === 'approve' || s === 'accepted') return 1;
    if (s === 'rejected' || s === 'reject' || s === 'declined') return 2;
    return null;
}

function statusLabel(status) {
    const n = normalizeStatus(status);
    if (n != null) return STATUS_LABELS[n];
    return clean(status) || '—';
}

function mapLeaveRow(row, index = 0) {
    if (!row) return null;
    const status = normalizeStatus(row.status);
    return {
        sr_no: index + 1,
        id: row.leave_id || row.id,
        leave_id: row.leave_id || row.id,
        staff_id: row.staff_id,
        staff_name: clean(row.staff_name) || '—',
        leave_from: row.leave_from,
        leave_to: row.leave_to,
        leave_from_label: formatDate(row.leave_from) || '—',
        leave_to_label: formatDate(row.leave_to) || '—',
        reason: clean(row.reason),
        status: status != null ? status : row.status,
        status_label: statusLabel(row.status),
        admin_remark: clean(row.admin_remark),
        created_at: row.created_at,
        updated_at: row.updated_at,
        date_range_label: `${formatDate(row.leave_from) || '?'} → ${formatDate(row.leave_to) || '?'}`,
    };
}

function monthBounds(year, month) {
    const y = Number(year);
    const m = Number(month);
    if (!Number.isFinite(y) || y < 1971 || !Number.isFinite(m) || m < 1 || m > 12) return null;
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { start, end, year: y, month: m };
}

function buildLeaveScope(ctx, { staffId, status, search, year, month } = {}) {
    const conditions = ['COALESCE(l.is_deleted, 0) = 0'];
    const params = [];

    if (!canSeeAllLeaves(ctx)) {
        conditions.push('l.staff_id = ?');
        params.push(ctx.userId);
    } else if (staffId) {
        conditions.push('l.staff_id = ?');
        params.push(Number(staffId));
    }

    const statusCode = normalizeStatus(status);
    if (statusCode != null) {
        conditions.push('l.status = ?');
        params.push(statusCode);
    }

    const bounds = monthBounds(year, month);
    if (bounds) {
        conditions.push('l.leave_from <= ? AND l.leave_to >= ?');
        params.push(bounds.end, bounds.start);
    }

    const term = clean(search);
    if (term && term.length >= 2) {
        const like = `%${term}%`;
        conditions.push(`(s.full_name LIKE ? OR l.reason LIKE ? OR CAST(l.id AS CHAR) LIKE ?)`);
        params.push(like, like, like);
    }

    return { conditions, params, bounds };
}

const LEAVE_SELECT = `
    l.id AS leave_id,
    l.staff_id,
    DATE_FORMAT(l.leave_from, '%Y-%m-%d') AS leave_from,
    DATE_FORMAT(l.leave_to, '%Y-%m-%d') AS leave_to,
    l.reason,
    l.status,
    l.admin_remark,
    l.created_at,
    l.updated_at,
    s.full_name AS staff_name
`;

const LEAVE_FROM = `
    FROM tbl_leaves l
    INNER JOIN tbl_users s ON s.id = l.staff_id
`;

async function searchLeaves(search, ctx, { limit = 25, status, staffId, year, month } = {}) {
    if (!canAccessLeaves(ctx)) return [];
    const { conditions, params } = buildLeaveScope(ctx, {
        staffId,
        status,
        search,
        year,
        month,
    });
    const rows = await query(
        `SELECT ${LEAVE_SELECT}
         ${LEAVE_FROM}
         WHERE ${conditions.join(' AND ')}
         ORDER BY l.id DESC
         LIMIT ?`,
        [...params, Math.min(Number(limit) || 25, 50)]
    );
    return rows.map((r, i) => mapLeaveRow(r, i));
}

async function getLeaveById(leaveId, ctx) {
    if (!leaveId || !canAccessLeaves(ctx)) return null;
    const id = Number(leaveId);
    if (!Number.isFinite(id)) return null;

    const conditions = ['COALESCE(l.is_deleted, 0) = 0', 'l.id = ?'];
    const params = [id];
    if (!canSeeAllLeaves(ctx)) {
        conditions.push('l.staff_id = ?');
        params.push(ctx.userId);
    }

    const rows = await query(
        `SELECT ${LEAVE_SELECT}
         ${LEAVE_FROM}
         WHERE ${conditions.join(' AND ')}
         LIMIT 1`,
        params
    );
    return rows.length ? mapLeaveRow(rows[0], 0) : null;
}

async function countLeaves(ctx, { search, status, staffId, year, month } = {}) {
    if (!canAccessLeaves(ctx)) {
        return { ok: false, total: 0, message: 'Leave Calendar is available to staff and admin only.' };
    }
    const { conditions, params, bounds } = buildLeaveScope(ctx, {
        staffId,
        status,
        search,
        year,
        month,
    });
    const rows = await query(
        `SELECT COUNT(*) AS total
         ${LEAVE_FROM}
         WHERE ${conditions.join(' AND ')}`,
        params
    );
    return {
        ok: true,
        total: Number(rows[0]?.total || 0),
        status: normalizeStatus(status),
        month: bounds || null,
    };
}

module.exports = {
    searchLeaves,
    getLeaveById,
    countLeaves,
    canAccessLeaves,
    canSeeAllLeaves,
    normalizeStatus,
    STATUS_LABELS,
    mapLeaveRow,
};
