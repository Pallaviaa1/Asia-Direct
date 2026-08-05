const { query } = require('../../helpers/dbQuery');
const { ACCOUNTS_ROLES, USER_TYPE } = require('./constants');

async function hasRoutePermission(ctx, routeUrl) {
    if (ctx.isAdmin || ctx.hasFullAccess) return true;
    if (!ctx.isStaff) return false;
    if (!ctx.staffPermissions.length) return false;

    const routes = await query(
        'SELECT id FROM tbl_menu_routes WHERE route_url = ? LIMIT 1',
        [routeUrl]
    );
    if (!routes.length) return true;

    return ctx.staffPermissions.includes(String(routes[0].id));
}

function canAccessInvoices(ctx) {
    if (ctx.isAdmin || ctx.hasFullAccess) return true;
    if (ctx.isCustomer) return true;
    if (ctx.isStaff) return true;
    return false;
}

function canAccessFreight(ctx, freight) {
    if (!freight) return false;
    if (ctx.isAdmin || ctx.hasFullAccess) return true;

    if (ctx.isCustomer) {
        return Number(freight.client_id) === Number(ctx.userId);
    }

    if (ctx.isStaff) {
        if (ctx.accessCountries.length) {
            const origin = Number(freight.collection_from);
            const destination = Number(freight.delivery_to);
            const inScope = ctx.accessCountries.includes(origin) || ctx.accessCountries.includes(destination);
            if (!inScope) return false;
        }

        const ownsRecord =
            Number(freight.user_id) === Number(ctx.userId) ||
            Number(freight.sales_representative) === Number(ctx.userId);

        return ownsRecord || !ctx.accessCountries.length;
    }

    return false;
}

function canAccessClient(ctx, clientId) {
    if (ctx.isAdmin || ctx.hasFullAccess || ctx.isStaff) return true;
    if (ctx.isCustomer) return Number(clientId) === Number(ctx.userId);
    return false;
}

function canAccessOrder(ctx, order) {
    if (!order) return false;
    if (ctx.isAdmin || ctx.hasFullAccess) return true;

    if (ctx.isCustomer) {
        return (
            Number(order.client_id) === Number(ctx.userId) ||
            Number(order.freight_client_id) === Number(ctx.userId)
        );
    }

    if (ctx.isStaff) {
        return canAccessFreight(ctx, {
            client_id: order.freight_client_id || order.client_id,
            collection_from: order.collection_from,
            delivery_to: order.delivery_to,
            user_id: order.freight_user_id,
            sales_representative: order.sales_representative,
        });
    }

    return false;
}

function canAccessStaff(ctx, staffId) {
    if (!staffId) return false;
    if (ctx.isAdmin || ctx.hasFullAccess) return true;
    if (ctx.isStaff) return Number(staffId) === Number(ctx.userId);
    return false;
}

module.exports = {
    hasRoutePermission,
    canAccessInvoices,
    canAccessFreight,
    canAccessClient,
    canAccessOrder,
    canAccessStaff,
};
