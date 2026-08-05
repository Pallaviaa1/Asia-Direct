const { query } = require('../../helpers/dbQuery');

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
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
}

function canAccessTasks(ctx) {
    if (ctx.isAdmin || ctx.hasFullAccess || ctx.isStaff) return true;
    return false;
}

function normalizeTaskType(type) {
    const t = String(type || '').toLowerCase().trim();
    if (t === 'freight' || t === 'freights') return 'freight';
    if (t === 'clearance' || t === 'clearances' || t === 'clearing') return 'clearance';
    if (t === 'custom' || t === 'customs' || t === 'general') return 'custom';
    if (t === 'all' || t === '') return null;
    return null;
}

function normalizeStatus(status) {
    const s = String(status || '').toLowerCase().trim().replace(/\s+/g, '_');
    if (!s) return null;
    if (s === 'pending' || s === 'open') return 'pending';
    if (s === 'in_progress' || s === 'in-progress' || s === 'progress') return 'in_progress';
    if (s === 'completed' || s === 'complete' || s === 'done' || s === 'closed') return 'completed';
    return s;
}

function statusLabel(status) {
    const s = normalizeStatus(status) || clean(status) || '—';
    if (s === 'in_progress') return 'in_progress';
    return s;
}

function mapTaskRow(row, index = 0) {
    if (!row) return null;
    const taskType = clean(row.task_type) || 'custom';
    return {
        sr_no: index + 1,
        id: row.task_id || row.id,
        task_type: taskType,
        task_type_label:
            taskType === 'freight'
                ? 'Freight'
                : taskType === 'clearance'
                  ? 'Clearance'
                  : 'Custom',
        name: clean(row.staff_name) || '—',
        staff_id: row.staff_id,
        staff_email: clean(row.staff_email),
        freight_number: clean(row.freight_number),
        clearance_number: clean(row.clearance_number),
        title: clean(row.task_title) || clean(row.title) || null,
        due_date: row.due_date,
        due_date_label: formatDate(row.due_date) || '—',
        notes: clean(row.notes),
        status: normalizeStatus(row.task_status || row.status) || clean(row.task_status),
        status_label: statusLabel(row.task_status || row.status),
        action_required: clean(row.action_required),
        action_required_label: clean(row.action_required) || '—',
        priority: clean(row.priority),
        description: clean(row.description),
        reference_id: row.reference_id || row.freight_id || row.clearance_id || null,
        created_at: row.task_created_at || row.created_at,
        updated_at: row.task_updated_at || row.updated_at,
        display_ref:
            taskType === 'freight'
                ? clean(row.freight_number)
                : taskType === 'clearance'
                  ? clean(row.clearance_number)
                  : clean(row.task_title) || clean(row.title) || `Task #${row.task_id || row.id}`,
    };
}

const FREIGHT_SELECT = `
    t.id AS task_id,
    t.task_type,
    t.reference_id AS freight_id,
    t.assigned_to AS staff_id,
    t.priority,
    t.notes,
    t.status AS task_status,
    t.action_required,
    t.due_date,
    t.created_at AS task_created_at,
    t.updated_at AS task_updated_at,
    f.freight_number,
    s.full_name AS staff_name,
    s.email AS staff_email
`;

const FREIGHT_FROM = `
    FROM tasks t
    INNER JOIN tbl_freight f ON f.id = t.reference_id AND f.is_deleted = 0
    INNER JOIN tbl_users s ON s.id = t.assigned_to AND s.is_deleted = 0
`;

const CLEARANCE_SELECT = `
    t.id AS task_id,
    t.task_type,
    t.reference_id AS clearance_id,
    t.assigned_to AS staff_id,
    t.priority,
    t.notes,
    t.status AS task_status,
    t.action_required,
    t.due_date,
    t.created_at AS task_created_at,
    t.updated_at AS task_updated_at,
    c.clearance_number,
    s.full_name AS staff_name,
    s.email AS staff_email
`;

const CLEARANCE_FROM = `
    FROM tasks t
    INNER JOIN tbl_clearance c ON c.id = t.reference_id AND c.is_deleted = 0
    INNER JOIN tbl_users s ON s.id = t.assigned_to AND s.is_deleted = 0
`;

const CUSTOM_SELECT = `
    t.id AS task_id,
    t.task_type,
    t.title AS task_title,
    t.description,
    t.assigned_to AS staff_id,
    t.priority,
    t.notes,
    t.status AS task_status,
    t.action_required,
    t.due_date,
    t.created_at AS task_created_at,
    t.updated_at AS task_updated_at,
    s.full_name AS staff_name,
    s.email AS staff_email
`;

const CUSTOM_FROM = `
    FROM tasks t
    INNER JOIN tbl_users s ON s.id = t.assigned_to AND s.is_deleted = 0
`;

function buildSearchConditions(taskType, search, status, aliasStaff = 's') {
    const conditions = [];
    const params = [];
    const term = clean(search);
    const st = normalizeStatus(status);

    if (st) {
        conditions.push('LOWER(TRIM(t.status)) = ?');
        params.push(st);
    }

    if (term) {
        if (/^F-\d+/i.test(term) && (!taskType || taskType === 'freight')) {
            conditions.push('LOWER(TRIM(f.freight_number)) = LOWER(TRIM(?))');
            params.push(term);
        } else if (/^C-\d+/i.test(term) && (!taskType || taskType === 'clearance')) {
            conditions.push('LOWER(TRIM(c.clearance_number)) = LOWER(TRIM(?))');
            params.push(term);
        } else if (/^\d+$/.test(term)) {
            conditions.push('t.id = ?');
            params.push(Number(term));
        } else if (taskType === 'freight') {
            conditions.push(
                `(${aliasStaff}.full_name LIKE ? OR f.freight_number LIKE ? OR t.notes LIKE ? OR t.action_required LIKE ? OR t.status LIKE ?)`
            );
            const like = `%${term}%`;
            params.push(like, like, like, like, like);
        } else if (taskType === 'clearance') {
            conditions.push(
                `(${aliasStaff}.full_name LIKE ? OR c.clearance_number LIKE ? OR t.notes LIKE ? OR t.action_required LIKE ? OR t.status LIKE ?)`
            );
            const like = `%${term}%`;
            params.push(like, like, like, like, like);
        } else if (taskType === 'custom') {
            conditions.push(
                `(${aliasStaff}.full_name LIKE ? OR t.title LIKE ? OR t.description LIKE ? OR t.notes LIKE ? OR t.action_required LIKE ? OR t.status LIKE ?)`
            );
            const like = `%${term}%`;
            params.push(like, like, like, like, like, like);
        } else {
            // mixed — caller builds per-type
        }
    }

    return { conditions, params };
}

async function searchFreightTasks(search, ctx, { limit = 25, status } = {}) {
    if (!canAccessTasks(ctx)) return [];
    const { conditions, params } = buildSearchConditions('freight', search, status);
    conditions.unshift(`t.task_type = 'freight'`);
    if (ctx.isStaff && !ctx.isAdmin && !ctx.hasFullAccess) {
        conditions.push('t.assigned_to = ?');
        params.push(ctx.userId);
    }
    const rows = await query(
        `SELECT ${FREIGHT_SELECT} ${FREIGHT_FROM}
         WHERE ${conditions.join(' AND ')}
         ORDER BY t.created_at DESC
         LIMIT ?`,
        [...params, Math.min(Number(limit) || 25, 50)]
    );
    return rows.map((r, i) => mapTaskRow(r, i));
}

async function searchClearanceTasks(search, ctx, { limit = 25, status } = {}) {
    if (!canAccessTasks(ctx)) return [];
    const { conditions, params } = buildSearchConditions('clearance', search, status);
    conditions.unshift(`t.task_type = 'clearance'`);
    if (ctx.isStaff && !ctx.isAdmin && !ctx.hasFullAccess) {
        conditions.push('t.assigned_to = ?');
        params.push(ctx.userId);
    }
    const rows = await query(
        `SELECT ${CLEARANCE_SELECT} ${CLEARANCE_FROM}
         WHERE ${conditions.join(' AND ')}
         ORDER BY t.created_at DESC
         LIMIT ?`,
        [...params, Math.min(Number(limit) || 25, 50)]
    );
    return rows.map((r, i) => mapTaskRow(r, i));
}

async function searchCustomTasks(search, ctx, { limit = 25, status } = {}) {
    if (!canAccessTasks(ctx)) return [];
    const { conditions, params } = buildSearchConditions('custom', search, status);
    conditions.unshift(`t.task_type = 'custom'`);
    if (ctx.isStaff && !ctx.isAdmin && !ctx.hasFullAccess) {
        conditions.push('t.assigned_to = ?');
        params.push(ctx.userId);
    }
    const rows = await query(
        `SELECT ${CUSTOM_SELECT} ${CUSTOM_FROM}
         WHERE ${conditions.join(' AND ')}
         ORDER BY t.created_at DESC
         LIMIT ?`,
        [...params, Math.min(Number(limit) || 25, 50)]
    );
    return rows.map((r, i) => mapTaskRow(r, i));
}

async function searchTasks(search, ctx, { limit = 25, status, taskType } = {}) {
    if (!canAccessTasks(ctx)) return [];
    const type = normalizeTaskType(taskType);
    if (type === 'freight') return searchFreightTasks(search, ctx, { limit, status });
    if (type === 'clearance') return searchClearanceTasks(search, ctx, { limit, status });
    if (type === 'custom') return searchCustomTasks(search, ctx, { limit, status });

    const term = clean(search);
    if (term && /^F-\d+/i.test(term)) return searchFreightTasks(search, ctx, { limit, status });
    if (term && /^C-\d+/i.test(term)) return searchClearanceTasks(search, ctx, { limit, status });

    const per = Math.min(Math.ceil((Number(limit) || 25) / 3) + 5, 25);
    const [freight, clearance, custom] = await Promise.all([
        searchFreightTasks(search, ctx, { limit: per, status }),
        searchClearanceTasks(search, ctx, { limit: per, status }),
        searchCustomTasks(search, ctx, { limit: per, status }),
    ]);
    const merged = [...freight, ...clearance, ...custom]
        .sort((a, b) => Number(b.id) - Number(a.id))
        .slice(0, Math.min(Number(limit) || 25, 50));
    return merged.map((row, i) => ({ ...row, sr_no: i + 1 }));
}

async function getTaskById(taskId, ctx) {
    if (!taskId || !canAccessTasks(ctx)) return null;
    const id = Number(taskId);
    if (!Number.isFinite(id)) return null;

    const baseParams = [id];
    let staffFilter = '';
    if (ctx.isStaff && !ctx.isAdmin && !ctx.hasFullAccess) {
        staffFilter = ' AND t.assigned_to = ?';
        baseParams.push(ctx.userId);
    }

    const freightRows = await query(
        `SELECT ${FREIGHT_SELECT} ${FREIGHT_FROM}
         WHERE t.id = ? AND t.task_type = 'freight'${staffFilter}
         LIMIT 1`,
        baseParams
    );
    if (freightRows.length) return mapTaskRow(freightRows[0], 0);

    const clearanceRows = await query(
        `SELECT ${CLEARANCE_SELECT} ${CLEARANCE_FROM}
         WHERE t.id = ? AND t.task_type = 'clearance'${staffFilter}
         LIMIT 1`,
        baseParams
    );
    if (clearanceRows.length) return mapTaskRow(clearanceRows[0], 0);

    const customRows = await query(
        `SELECT ${CUSTOM_SELECT} ${CUSTOM_FROM}
         WHERE t.id = ? AND t.task_type = 'custom'${staffFilter}
         LIMIT 1`,
        baseParams
    );
    if (customRows.length) return mapTaskRow(customRows[0], 0);
    return null;
}

async function countTasks(ctx, { search, status, taskType } = {}) {
    if (!canAccessTasks(ctx)) {
        return { allowed: false, total: 0, message: 'Task Manager is not available for your account.' };
    }

    const type = normalizeTaskType(taskType);
    const types = type ? [type] : ['freight', 'clearance', 'custom'];
    let total = 0;

    for (const t of types) {
        let fromSql;
        let conditions = [`t.task_type = '${t}'`];
        const params = [];

        if (t === 'freight') fromSql = FREIGHT_FROM;
        else if (t === 'clearance') fromSql = CLEARANCE_FROM;
        else fromSql = CUSTOM_FROM;

        const built = buildSearchConditions(t, search, status);
        conditions = conditions.concat(built.conditions);
        params.push(...built.params);

        if (ctx.isStaff && !ctx.isAdmin && !ctx.hasFullAccess) {
            conditions.push('t.assigned_to = ?');
            params.push(ctx.userId);
        }

        const rows = await query(
            `SELECT COUNT(*) AS total ${fromSql} WHERE ${conditions.join(' AND ')}`,
            params
        );
        total += Number(rows[0]?.total || 0);
    }

    return { allowed: true, total };
}

module.exports = {
    searchTasks,
    searchFreightTasks,
    searchClearanceTasks,
    searchCustomTasks,
    getTaskById,
    countTasks,
    canAccessTasks,
    normalizeTaskType,
    normalizeStatus,
    mapTaskRow,
};
