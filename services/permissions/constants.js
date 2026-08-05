const ALL_ACCESS_USERS = [1, 19855];

const USER_TYPE = {
    ADMIN: 1,
    STAFF: 2,
    CUSTOMER: 3,
};

/**
 * tbl_freight.status values used across the app:
 * 0 = New enquiry
 * 1 = Accepted (ops) / estimate ready in some flows
 * 2 = Declined
 * 3 = Partially accepted
 * 4 = Quote issued to client (awaiting response) — MOST COMMON, not completed
 * 5 = Quote accepted / order moving forward
 * 6 = Quote rejected by client
 */
const FREIGHT_STATUS_LABELS = {
    0: 'New',
    1: 'Accepted',
    2: 'Declined',
    3: 'Partial',
    4: 'Quote Issued',
    5: 'Quote Accepted',
    6: 'Quote Rejected',
    7: 'Cancelled',
};

const ORDER_STATUS_LABELS = {
    0: 'Pending',
    1: 'Order Accepted',
    2: 'Order Rejected',
    3: 'Partial Order',
};

/** tbl_orders.warehouse_status: 0 = not assigned, 1 = assigned to warehouse */
const WAREHOUSE_STATUS_LABELS = {
    0: 'Not assigned to warehouse',
    1: 'Assigned to warehouse',
};

/**
 * Build a clear status label using status + order_status + isConfirmed
 */
function getFreightDisplayStatus(freight) {
    const status = Number(freight.status);
    const orderStatus = Number(freight.order_status);
    const confirmed = Number(freight.isConfirmed) === 1;

    if (confirmed) {
        return 'Confirmed';
    }

    if (orderStatus === 1) {
        return 'Order Accepted';
    }
    if (orderStatus === 2) {
        return 'Order Rejected';
    }
    if (orderStatus === 3) {
        return 'Partial Order';
    }

    return FREIGHT_STATUS_LABELS[status] || `Status ${status}`;
}

/**
 * Prefer real shipment tracking text over warehouse assignment codes.
 * Priority: order.track_status → order_track → batch.track_status → batch order_track → warehouse label.
 */
function getOrderDisplayStatus(order) {
    if (!order) return 'Unknown';

    const candidates = [
        order.track_status,
        order.latest_track_status,
        order.batch_track_status,
        order.warehouse_batch_track_status,
        order.latest_batch_track_status,
    ];

    for (const raw of candidates) {
        const track = String(raw || '').trim();
        if (track && !/^(0|null|undefined)$/i.test(track)) {
            return track;
        }
    }

    if (order.warehouse_status != null && order.warehouse_status !== '') {
        const wh = Number(order.warehouse_status);
        if (WAREHOUSE_STATUS_LABELS[wh]) {
            return WAREHOUSE_STATUS_LABELS[wh];
        }
    }

    return 'Status not set';
}

/** True when status is only warehouse assignment (no shipment tracking yet). */
function isWarehouseOnlyStatus(order) {
    if (!order) return false;
    const hasTrack = [
        order.track_status,
        order.latest_track_status,
        order.batch_track_status,
        order.warehouse_batch_track_status,
        order.latest_batch_track_status,
    ].some((v) => {
        const t = String(v || '').trim();
        return Boolean(t) && !/^(0|null|undefined)$/i.test(t);
    });
    return !hasTrack && Number(order.warehouse_status) === 1;
}

function getWarehouseStatusLabel(warehouseStatus) {
    if (warehouseStatus == null || warehouseStatus === '') return null;
    const wh = Number(warehouseStatus);
    return WAREHOUSE_STATUS_LABELS[wh] || null;
}

const ACCOUNTS_ROLES = ['5', '8'];

module.exports = {
    ALL_ACCESS_USERS,
    USER_TYPE,
    FREIGHT_STATUS_LABELS,
    ORDER_STATUS_LABELS,
    WAREHOUSE_STATUS_LABELS,
    getFreightDisplayStatus,
    getOrderDisplayStatus,
    getWarehouseStatusLabel,
    isWarehouseOnlyStatus,
    ACCOUNTS_ROLES,
};
