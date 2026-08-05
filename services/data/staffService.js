const { query } = require('../../helpers/dbQuery');
const { canAccessStaff } = require('../permissions/authorizeTool');

/** Assigned role IDs used in tbl_users.assigned_roles */
const STAFF_ROLE_LABELS = {
    1: 'Quoting clerk',
    2: 'Operation controller',
    3: 'Customs clerk',
    4: 'Sales',
    5: 'Accounts',
    6: 'Booking',
    7: 'Role 7',
    8: 'Accounts',
};

function clean(text) {
    if (text == null || text === '') return null;
    const s = String(text).replace(/\s+/g, ' ').trim();
    return s || null;
}

function splitIds(raw) {
    if (raw == null || raw === '') return [];
    return String(raw)
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
}

function roleLabels(assignedRolesRaw) {
    const ids = splitIds(assignedRolesRaw);
    if (!ids.length) return [];
    return ids.map((id) => STAFF_ROLE_LABELS[Number(id)] || `Role ${id}`);
}

async function resolveCountryNames(ids) {
    const nums = ids.map((id) => Number(id)).filter((n) => Number.isFinite(n) && n > 0);
    if (!nums.length) return [];
    const placeholders = nums.map(() => '?').join(',');
    const rows = await query(
        `SELECT id, name FROM countries WHERE id IN (${placeholders})`,
        nums
    );
    const map = {};
    rows.forEach((r) => {
        map[String(r.id)] = clean(r.name);
    });
    return nums.map((id) => map[String(id)] || null).filter(Boolean);
}

async function loadPermissionSummary(permissionIds) {
    const ids = (permissionIds || []).map(String);
    if (!ids.length) {
        return {
            permission_count: 0,
            menus: [],
            permission_labels: [],
        };
    }

    const rows = await query(
        `SELECT m.id AS menu_id, m.menu_name, r.id AS route_id, r.name AS route_name
         FROM tbl_menu_routes r
         LEFT JOIN tbl_menus m ON m.id = r.menu_id
         WHERE r.id IN (${ids.map(() => '?').join(',')})
         ORDER BY m.menu_name ASC, r.name ASC`,
        ids
    );

    const byMenu = {};
    const labels = [];
    rows.forEach((row) => {
        const menuName = clean(row.menu_name) || 'Other';
        const routeName = clean(row.route_name) || `Permission ${row.route_id}`;
        if (!byMenu[menuName]) byMenu[menuName] = [];
        byMenu[menuName].push(routeName);
        labels.push(`${menuName}: ${routeName}`);
    });

    return {
        permission_count: labels.length,
        menus: Object.keys(byMenu).map((menu_name) => ({
            menu_name,
            routes: byMenu[menu_name],
            route_count: byMenu[menu_name].length,
        })),
        permission_labels: labels,
    };
}

async function mapStaffRow(row, { includePermissions = true } = {}) {
    if (!row) return null;
    const active = Number(row.status) === 1;
    const roleIds = splitIds(row.assigned_roles);
    const accessCountryIds = splitIds(row.access_country);
    const permissionIds = splitIds(row.staff_permissions);
    const accessCountryNames = await resolveCountryNames(accessCountryIds);
    const permissionSummary = includePermissions
        ? await loadPermissionSummary(permissionIds)
        : { permission_count: permissionIds.length, menus: [], permission_labels: [] };

    const roles = roleLabels(row.assigned_roles);
    const countryCodeRaw = clean(row.country_code) || (row.phonecode != null ? String(row.phonecode) : null);
    const digits = String(countryCodeRaw || '').replace(/\D/g, '');
    const iso = clean(row.country_shortname);
    const countryCodeLabel = digits
        ? iso
            ? `+${digits} ${iso}`
            : `+${digits}`
        : null;

    return {
        id: row.id,
        // Edit Staff form fields
        email: clean(row.email),
        full_name: clean(row.full_name) || '',
        country_code: countryCodeRaw,
        country_code_label: countryCodeLabel || countryCodeRaw,
        phone_no: clean(row.cellphone) || clean(row.telephone) || clean(row.phone_no),
        country_id: row.country,
        country_name: clean(row.country_name),
        assigned_role_ids: roleIds,
        assigned_roles: roles,
        assigned_roles_label: roles.length ? roles.join(', ') : '—',
        access_country_ids: accessCountryIds,
        access_countries: accessCountryNames,
        access_countries_label:
            accessCountryNames.length === 0
                ? 'None selected'
                : accessCountryNames.length === 1
                  ? `1 selected · ${accessCountryNames[0]}`
                  : `${accessCountryNames.length} selected · ${accessCountryNames.join(', ')}`,
        access_countries_count_label:
            accessCountryNames.length === 1
                ? '1 selected'
                : `${accessCountryNames.length} selected`,
        // Never expose password — form field is write-only
        password_label: 'Not shown (••••••••• / leave blank to keep current)',
        permission_ids: permissionIds,
        permission_count: permissionSummary.permission_count,
        permission_menus: permissionSummary.menus,
        permission_labels: permissionSummary.permission_labels,
        status: row.status,
        status_label: active ? 'Active' : 'Inactive',
        display_name: clean(row.full_name) || clean(row.email) || `Staff ${row.id}`,
    };
}

const STAFF_SELECT = `
    u.id, u.full_name, u.email, u.country_code, u.cellphone, u.telephone, u.country,
    u.assigned_roles, u.access_country, u.staff_permissions, u.status, u.created_at,
    c.name AS country_name,
    c.shortname AS country_shortname,
    c.phonecode AS phonecode
`;

const STAFF_FROM = `
    FROM tbl_users u
    LEFT JOIN countries c ON c.id = u.country
`;

async function findStaffByName(name, ctx) {
    if (!name || String(name).trim().length < 2) return [];
    if (ctx.isCustomer) return [];

    const term = String(name).trim();
    const search = `%${term}%`;
    const starts = `${term}%`;

    if (ctx.isStaff && !ctx.isAdmin && !ctx.hasFullAccess) {
        const self = await getStaffById(ctx.userId, ctx, { includePermissions: true });
        if (!self) return [];
        const hay = `${self.full_name || ''} ${self.email || ''} ${self.id}`.toLowerCase();
        return hay.includes(term.toLowerCase()) ? [self] : [];
    }

    const rows = await query(
        `SELECT ${STAFF_SELECT}
         ${STAFF_FROM}
         WHERE u.user_type = 2 AND u.is_deleted = 0
           AND (
             u.full_name LIKE ?
             OR u.email LIKE ?
             OR u.cellphone LIKE ?
             OR CAST(u.id AS CHAR) = ?
           )
         ORDER BY
           CASE
             WHEN CAST(u.id AS CHAR) = ? THEN 0
             WHEN LOWER(u.email) = LOWER(?) THEN 0
             WHEN LOWER(u.full_name) = LOWER(?) THEN 0
             WHEN LOWER(u.full_name) LIKE LOWER(?) THEN 1
             ELSE 2
           END,
           u.full_name ASC
         LIMIT 15`,
        [search, search, search, term, term, term, term, starts]
    );

    const mapped = [];
    for (const row of rows) {
        if (!canAccessStaff(ctx, row.id)) continue;
        mapped.push(await mapStaffRow(row, { includePermissions: true }));
    }
    return mapped;
}

async function getStaffById(staffId, ctx, { includePermissions = true } = {}) {
    if (!staffId || !canAccessStaff(ctx, staffId)) return null;
    const rows = await query(
        `SELECT ${STAFF_SELECT}
         ${STAFF_FROM}
         WHERE u.id = ? AND u.user_type = 2 AND u.is_deleted = 0
         LIMIT 1`,
        [staffId]
    );
    return mapStaffRow(rows[0], { includePermissions });
}

async function getStaffByEmail(email, ctx, { includePermissions = true } = {}) {
    const term = clean(email);
    if (!term || !term.includes('@')) return null;
    const rows = await query(
        `SELECT ${STAFF_SELECT}
         ${STAFF_FROM}
         WHERE u.user_type = 2 AND u.is_deleted = 0
           AND LOWER(TRIM(u.email)) = LOWER(TRIM(?))
         LIMIT 1`,
        [term]
    );
    if (!rows.length || !canAccessStaff(ctx, rows[0].id)) return null;
    return mapStaffRow(rows[0], { includePermissions });
}

async function countStaff(ctx) {
    if (ctx.isCustomer) {
        return { allowed: false, total: 0, message: 'Staff directory is not available for customer accounts.' };
    }
    if (ctx.isStaff && !ctx.isAdmin && !ctx.hasFullAccess) {
        return { allowed: true, total: 1 };
    }
    const rows = await query(
        `SELECT COUNT(*) AS total FROM tbl_users
         WHERE user_type = 2 AND is_deleted = 0 AND status = 1`
    );
    return { allowed: true, total: Number(rows[0]?.total || 0) };
}

module.exports = {
    findStaffByName,
    getStaffById,
    getStaffByEmail,
    countStaff,
    STAFF_ROLE_LABELS,
};
