const { query } = require('../../helpers/dbQuery');
const { ALL_ACCESS_USERS, USER_TYPE } = require('./constants');

async function loadUserContext(userId) {
    const rows = await query(
        `SELECT id, full_name, email, user_type, assigned_roles, staff_permissions,
                access_country, country, client_number, status, is_deleted
         FROM tbl_users
         WHERE id = ? AND is_deleted = 0 AND status = 1`,
        [userId]
    );

    if (!rows.length) {
        return null;
    }

    const user = rows[0];

    const accessCountries = user.access_country
        ? user.access_country.split(',').map((id) => Number(id.trim())).filter(Boolean)
        : [];

    const staffPermissions = user.staff_permissions
        ? user.staff_permissions.split(',').map((id) => id.trim()).filter(Boolean)
        : [];

    const assignedRoles = user.assigned_roles
        ? String(user.assigned_roles).split(',').map((r) => r.trim()).filter(Boolean)
        : [];

    let accessCountryNames = [];
    if (accessCountries.length) {
        const placeholders = accessCountries.map(() => '?').join(',');
        const countries = await query(
            `SELECT id, name FROM countries WHERE id IN (${placeholders})`,
            accessCountries
        );
        accessCountryNames = countries.map((c) => c.name);
    }

    return {
        userId: user.id,
        fullName: user.full_name,
        email: user.email,
        userType: Number(user.user_type),
        clientNumber: user.client_number,
        accessCountries,
        accessCountryNames,
        staffPermissions,
        assignedRoles,
        isAdmin: Number(user.user_type) === USER_TYPE.ADMIN,
        isStaff: Number(user.user_type) === USER_TYPE.STAFF,
        isCustomer: Number(user.user_type) === USER_TYPE.CUSTOMER,
        hasFullAccess: ALL_ACCESS_USERS.includes(Number(user.id)),
    };
}

module.exports = { loadUserContext };
