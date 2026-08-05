/**
 * Warehouse / batch / shipment / clearance AI tools + rules routing.
 */
const { getClientById, findClientsByName, pickBestClientMatch } = require('../../services/data/clientService');
const {
    getWarehouseOrderById,
    listWarehouseOrdersByClientId,
    listWarehouseOrdersByFreightNumber,
    listWarehouseOrdersByOrderNumber,
    listWarehouseOrdersByBatchNumber,
    countWarehouseOrders,
    listWarehouseProducts,
    listWarehouseCandidateFreightsByClientId,
} = require('../../services/data/warehouseService');
const {
    listSupplierWarehouseByOrderNumber,
    listSupplierWarehouseByFreightNumber,
    listSupplierWarehouseByClientId,
    listSupplierWarehouseByBatchNumber,
    countSupplierWarehouseOrders,
} = require('../../services/data/supplierWarehouseService');
const {
    getBatchByNumber,
    listBatchContents,
    listBatches,
    countBatches,
} = require('../../services/data/batchService');
const {
    getShipmentByWaybill,
    listShipmentLinks,
    listShipmentsByFreightNumber,
    listShipmentsByClientId,
    countShipments,
    listShipmentClearances,
} = require('../../services/data/shipmentService');
const {
    getClearanceByNumber,
    listClearancesByClientId,
    listClearancesByFreightNumber,
    countClearances,
    listClearanceOrders,
    countClearanceOrders,
} = require('../../services/data/clearanceService');
const {
    formatClientDisambiguation,
    formatWarehouseResponse,
    formatWarehouseListResponse,
    formatBatchResponse,
    formatBatchListResponse,
    formatShipmentResponse,
    formatShipmentListResponse,
    formatClearanceResponse,
    formatClearanceListResponse,
    formatClearanceOrderResponse,
    formatClearanceOrderListResponse,
} = require('./responseFormatter');
const {
    setPendingDisambiguation,
    setLastFreightNumber,
    getLastFreightNumber,
} = require('./conversationStore');
const {
    extractFreightNumber,
    extractClientId,
    extractOrderNumber,
    extractBatchNumber,
    extractBatchFocus,
    extractClearanceNumber,
    extractWaybill,
    extractWarehouseOrderId,
    extractClientNameForEntity,
    extractShipmentFocus,
    extractClearanceFocus,
    extractClearanceOrderSearchTerm,
    isWarehouseRequest,
    isBatchRequest,
    isShipmentRequest,
    isClearanceRequest,
    isClearanceOrderRequest,
    isCountWarehouseRequest,
    isCountBatchRequest,
    isCountShipmentRequest,
    isCountClearanceRequest,
    isCountClearanceOrderRequest,
    refersToPriorFreight,
} = require('./messageParser');

const LOGISTICS_TOOL_DEFINITIONS = [
    {
        name: 'getWarehouseOrderDetails',
        description: 'Get a warehouse order by numeric warehouse_assign_order id.',
        parameters: {
            type: 'object',
            properties: { warehouseOrderId: { type: 'number' } },
            required: ['warehouseOrderId'],
        },
    },
    {
        name: 'getWarehouseOrders',
        description:
            'List warehouse orders. Pass clientId, freightNumber, orderNumber (OR000…), or batchNumber. Use for "warehouse orders for John", "warehouse of F-…", "warehouse of OR000…", "warehouse of ADSWB…".',
        parameters: {
            type: 'object',
            properties: {
                clientId: { type: 'number' },
                freightNumber: { type: 'string' },
                orderNumber: { type: 'string' },
                batchNumber: { type: 'string' },
            },
        },
    },
    {
        name: 'countWarehouseOrders',
        description: 'Count warehouse orders visible to the user. Optional clientId.',
        parameters: {
            type: 'object',
            properties: { clientId: { type: 'number' } },
        },
    },
    {
        name: 'getBatchDetails',
        description:
            'Get batch details by batch_number (e.g. ADAWB2405032). Pass focus for origin, destination, route, status, mode, waybill, vessel, carrier.',
        parameters: {
            type: 'object',
            properties: {
                batchNumber: { type: 'string' },
                focus: {
                    type: 'string',
                    description:
                        'Optional field: origin, destination, route, status, mode, dimensions, weight, packages, forwarding_agent, total_freight, waybill, vessel, carrier, etd, contents',
                },
            },
            required: ['batchNumber'],
        },
    },
    {
        name: 'listBatches',
        description: 'List batches. Optional clientId to filter batches that include that client.',
        parameters: {
            type: 'object',
            properties: { clientId: { type: 'number' } },
        },
    },
    {
        name: 'countBatches',
        description: 'Count batches. Optional clientId.',
        parameters: {
            type: 'object',
            properties: { clientId: { type: 'number' } },
        },
    },
    {
        name: 'getShipmentDetails',
        description:
            'Get Shipment Details by waybill/load (e.g. DL26S0000776, 999-94052044). Matches the Update Shipment form: vessel, carrier, ETD, ETA, agents, ports, container, seal, status, assigned orders/clearances. Pass focus for one field.',
        parameters: {
            type: 'object',
            properties: {
                waybill: { type: 'string', description: 'Waybill or load number' },
                focus: {
                    type: 'string',
                    description:
                        'Optional field: status, mode, vessel, carrier, etd, eta, date_of_dispatch, origin_agent, destination_agent, port_of_loading, port_of_discharge, load, release_type, container, seal, origin_country, destination_country, assigned, clearances, waybill',
                },
            },
            required: ['waybill'],
        },
    },
    {
        name: 'getShipments',
        description: 'List shipments by freightNumber or clientId.',
        parameters: {
            type: 'object',
            properties: {
                freightNumber: { type: 'string' },
                clientId: { type: 'number' },
            },
        },
    },
    {
        name: 'countShipments',
        description: 'Count shipments. Optional clientId.',
        parameters: {
            type: 'object',
            properties: { clientId: { type: 'number' } },
        },
    },
    {
        name: 'getClearanceDetails',
        description:
            'Get Custom Clearance / Update Clearance form by clearance_number (e.g. C-202607001). Fields: mode, client, shipper/consignee, import/export, shipment ref, sales rep, ports, cargo, packing, packages, weight, dimension. Pass focus for one field.',
        parameters: {
            type: 'object',
            properties: {
                clearanceNumber: { type: 'string' },
                focus: {
                    type: 'string',
                    description:
                        'Optional: mode, client, party, import_export, shipment_ref, sales_rep, loading_country, exit_country, port_of_loading, port_of_discharge, product_desc, nature_of_goods, packing, comment_docs, packages, dimensions, weight, status',
                },
            },
            required: ['clearanceNumber'],
        },
    },
    {
        name: 'getClearances',
        description: 'List clearances by clientId or freightNumber.',
        parameters: {
            type: 'object',
            properties: {
                clientId: { type: 'number' },
                freightNumber: { type: 'string' },
            },
        },
    },
    {
        name: 'countClearances',
        description: 'Count clearances. Optional clientId.',
        parameters: {
            type: 'object',
            properties: { clientId: { type: 'number' } },
        },
    },
    {
        name: 'getClearanceOrders',
        description:
            'List Order Clearance rows (client, C-number, date, goods, origin/destination, action). Filter by clientId, clearanceNumber (C-…), or search (client/goods/status).',
        parameters: {
            type: 'object',
            properties: {
                clientId: { type: 'number' },
                clearanceNumber: { type: 'string' },
                search: { type: 'string', description: 'Client name, goods, or status search' },
            },
        },
    },
    {
        name: 'countClearanceOrders',
        description: 'Count clearance orders. Optional clientId.',
        parameters: {
            type: 'object',
            properties: { clientId: { type: 'number' } },
        },
    },
];

function normalizeLogisticsToolName(toolName) {
    const name = String(toolName || '')
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/-/g, '_')
        .toLowerCase();
    const map = {
        get_warehouse_order_details: 'getWarehouseOrderDetails',
        get_warehouse_orders: 'getWarehouseOrders',
        count_warehouse_orders: 'countWarehouseOrders',
        get_batch_details: 'getBatchDetails',
        list_batches: 'listBatches',
        count_batches: 'countBatches',
        get_shipment_details: 'getShipmentDetails',
        get_shipments: 'getShipments',
        count_shipments: 'countShipments',
        get_clearance_details: 'getClearanceDetails',
        get_clearances: 'getClearances',
        count_clearances: 'countClearances',
        get_clearance_orders: 'getClearanceOrders',
        count_clearance_orders: 'countClearanceOrders',
    };
    return map[name] || toolName;
}

async function resolveClientThen(sessionId, ctx, name, pendingTool, intentLabel) {
    const clients = await findClientsByName(name, ctx);
    if (!clients.length) {
        return { reply: `No clients named "${name}" were found.`, data: null };
    }
    const best = pickBestClientMatch(clients, name) || (clients.length === 1 ? clients[0] : null);
    if (best) {
        return executeLogisticsTool(pendingTool, { clientId: best.id }, ctx, sessionId);
    }
    setPendingDisambiguation(sessionId, pendingTool, clients);
    const intentKey =
        pendingTool === 'getWarehouseOrders'
            ? 'warehouse_orders'
            : pendingTool === 'countWarehouseOrders'
                ? 'count_warehouse_orders'
                : pendingTool === 'listBatches'
                    ? 'batches'
                    : pendingTool === 'countBatches'
                        ? 'count_batches'
                        : pendingTool === 'getShipments'
                            ? 'shipments'
                            : pendingTool === 'countShipments'
                                ? 'count_shipments'
                                : pendingTool === 'getClearances'
                                    ? 'clearances'
                                    : pendingTool === 'countClearances'
                                        ? 'count_clearances'
                                        : pendingTool === 'getClearanceOrders'
                                            ? 'clearance_orders'
                                            : pendingTool === 'countClearanceOrders'
                                                ? 'count_clearance_orders'
                                                : intentLabel;
    return {
        reply: formatClientDisambiguation(clients, intentLabel),
        data: { candidates: clients, pendingIntent: intentKey },
        needsDisambiguation: true,
    };
}

async function enrichWarehouseRow(row) {
    if (!row || row.source === 'supplier_warehouse') return row;
    if (row.packages_detail) return row;
    row.packages_detail = await listWarehouseProducts(row.id);
    return row;
}

async function resolveWarehouseRows({ freightNumber, orderNumber, batchNumber, clientId }, ctx) {
    // Prefer admin Warehouse Order Manage (warehouse_assign_order), then supplier warehouse,
    // then freights marked send_to_warehouse / assign_warehouse.
    let rows = [];
    if (freightNumber) rows = await listWarehouseOrdersByFreightNumber(freightNumber, ctx);
    else if (orderNumber) rows = await listWarehouseOrdersByOrderNumber(orderNumber, ctx);
    else if (batchNumber) rows = await listWarehouseOrdersByBatchNumber(batchNumber, ctx);
    else if (clientId) rows = await listWarehouseOrdersByClientId(clientId, ctx);

    if (!clientId) {
        const adminRows = rows.filter((r) => r && r.source !== 'freight_warehouse_view');
        if (adminRows.length) return { rows: adminRows, source: 'warehouse' };

        let supplierRows = [];
        if (orderNumber) {
            supplierRows = await listSupplierWarehouseByOrderNumber(orderNumber, ctx);
        } else if (freightNumber) {
            supplierRows = await listSupplierWarehouseByFreightNumber(freightNumber, ctx);
        } else if (batchNumber) {
            supplierRows = await listSupplierWarehouseByBatchNumber(batchNumber, ctx);
        }
        if (supplierRows.length) return { rows: supplierRows, source: 'supplier_warehouse' };
        if (rows.length) return { rows, source: 'freight_warehouse_view' };
        return { rows: [], source: 'warehouse' };
    }

    const supplierRows = await listSupplierWarehouseByClientId(clientId, ctx);
    const freightViews = await listWarehouseCandidateFreightsByClientId(clientId, ctx, { limit: 8 });

    const merged = [];
    const seenFreight = new Set();
    const seenOrder = new Set();
    const seenKey = new Set();
    const pushUnique = (r) => {
        if (!r) return;
        const freightKey = String(r.freight_number || '').toLowerCase();
        const orderKey = String(r.order_number || r.order_id || '').toLowerCase();
        if (freightKey && seenFreight.has(freightKey)) return;
        if (orderKey && seenOrder.has(orderKey)) return;
        const key = [r.source || '', r.id || '', freightKey, orderKey, r.goods_label || '']
            .join('|')
            .toLowerCase();
        if (seenKey.has(key)) return;
        seenKey.add(key);
        if (freightKey) seenFreight.add(freightKey);
        if (orderKey) seenOrder.add(orderKey);
        merged.push(r);
    };

    // Recent warehouse-bound freights + supplier receipts first, then assign-order history.
    freightViews.forEach(pushUnique);
    supplierRows.forEach(pushUnique);
    rows.forEach(pushUnique);

    return {
        rows: merged.slice(0, 25),
        source: 'warehouse_mixed',
    };
}

async function executeLogisticsTool(toolName, args = {}, ctx, sessionId) {
    const normalized = normalizeLogisticsToolName(toolName);

    switch (normalized) {
        case 'getWarehouseOrderDetails': {
            const id = Number(args.warehouseOrderId || args.warehouse_order_id || args.id);
            const row = await getWarehouseOrderById(id, ctx);
            if (!row) {
                return { reply: `I could not find warehouse order #${id}, or access is denied.`, data: null };
            }
            if (row.freight_number && sessionId) setLastFreightNumber(sessionId, row.freight_number);
            return {
                reply: formatWarehouseResponse(row, row.packages_detail || []),
                data: { warehouseOrder: row, warehousePackages: row.packages_detail || [] },
            };
        }
        case 'getWarehouseOrders': {
            const clientId = args.clientId || args.client_id ? Number(args.clientId || args.client_id) : null;
            const freightNumber = args.freightNumber || args.freight_number;
            const orderNumber = args.orderNumber || args.order_number;
            const batchNumber = args.batchNumber || args.batch_number;
            let label = 'warehouse';

            if (!freightNumber && !orderNumber && !batchNumber && !clientId) {
                return {
                    reply: 'Whose warehouse orders? Try a client name, freight number, order number (OR000…), or batch number.',
                    data: null,
                };
            }

            if (freightNumber) {
                label = freightNumber;
                if (sessionId) setLastFreightNumber(sessionId, freightNumber);
            } else if (orderNumber) {
                label = orderNumber;
            } else if (batchNumber) {
                label = batchNumber;
            } else if (clientId) {
                const client = await getClientById(clientId, ctx);
                if (!client) return { reply: 'Client not found or access denied.', data: null };
                label = client.full_name;
                const { rows } = await resolveWarehouseRows({ clientId }, ctx);
                if (rows.length === 1) {
                    const row = await enrichWarehouseRow(rows[0]);
                    return {
                        reply: formatWarehouseResponse(row),
                        data: {
                            client,
                            warehouseOrder: row,
                            warehousePackages: row.packages_detail || [],
                        },
                    };
                }
                return {
                    reply: formatWarehouseListResponse(rows, label),
                    data: { client, warehouseOrders: rows },
                };
            }

            const { rows } = await resolveWarehouseRows(
                { freightNumber, orderNumber, batchNumber, clientId },
                ctx
            );

            if (rows.length === 1) {
                const row = await enrichWarehouseRow(rows[0]);
                if (row.freight_number && sessionId) setLastFreightNumber(sessionId, row.freight_number);
                return {
                    reply: formatWarehouseResponse(row),
                    data: { warehouseOrder: row, warehousePackages: row.packages_detail || [] },
                };
            }
            return {
                reply: formatWarehouseListResponse(rows, label),
                data: {
                    warehouseOrders: rows,
                    freightNumber: freightNumber || null,
                    orderNumber: orderNumber || null,
                    batchNumber: batchNumber || null,
                },
            };
        }
        case 'countWarehouseOrders': {
            const clientId = args.clientId || args.client_id ? Number(args.clientId || args.client_id) : null;
            let scope = ctx.isCustomer ? 'your account' : ctx.isAdmin || ctx.hasFullAccess ? 'the system' : 'your accessible records';
            if (clientId) {
                const client = await getClientById(clientId, ctx);
                if (!client) return { reply: 'Client not found or access denied.', data: null };
                scope = client.full_name;
            }
            const total = await countWarehouseOrders(ctx, { clientId: clientId || undefined });
            return {
                reply: `Total warehouse orders for ${scope}: ${total.toLocaleString()}.`,
                data: { count: { entity: 'warehouse_orders', total, scope } },
            };
        }
        case 'getBatchDetails': {
            const batchNumber = args.batchNumber || args.batch_number;
            const batch = await getBatchByNumber(batchNumber, ctx);
            if (!batch) {
                return { reply: `I could not find batch "${batchNumber}", or access is denied.`, data: null };
            }
            const contents = (await listBatchContents(batch.id, ctx)).filter(
                (c) => c.freight_number || (c.order_number && c.order_id)
            );

            const focus = args.focus || null;
            const straight = (label, value, detail) => ({
                reply: detail
                    ? `${label} for batch ${batch.batch_number}: ${value} (${detail}).`
                    : `${label} for batch ${batch.batch_number}: ${value}.`,
                data: {
                    focusedAnswer: {
                        freightNumber: batch.batch_number,
                        label,
                        value: value == null || value === '' ? 'Not available' : String(value),
                        detail: detail || null,
                    },
                    batch,
                },
            });

            if (focus === 'origin') {
                if (batch.origin_country_name) {
                    return straight('Origin', batch.origin_country_name);
                }
                return straight('Origin', batch.warehouse_name || 'Not available');
            }
            if (focus === 'destination') {
                return straight('Destination', batch.destination_country_name || 'Not available');
            }
            if (focus === 'route') {
                const route =
                    batch.origin_country_name || batch.destination_country_name
                        ? `${batch.origin_country_name || '?'} → ${batch.destination_country_name || '?'}`
                        : batch.warehouse_name
                            ? `Via ${batch.warehouse_name}`
                            : 'Not available';
                return straight('Route', route);
            }
            if (focus === 'dimensions') {
                return straight('Dim.', String(batch.dimensions ?? 0));
            }
            if (focus === 'weight') {
                return straight('Weight', String(batch.weight ?? 0));
            }
            if (focus === 'packages') {
                return straight('Packages', String(batch.packages ?? 0));
            }
            if (focus === 'forwarding_agent') {
                return straight('Forwarding agent', batch.forwarding_agent_label || 'Not available');
            }
            if (focus === 'total_freight') {
                return straight('Total freight', String(batch.total_freight ?? 0));
            }
            if (focus === 'status') {
                return straight('Status', batch.status_label || 'Not available');
            }
            if (focus === 'mode') {
                const mode = batch.freight
                    ? `${batch.freight}${batch.freight_option ? ` · ${batch.freight_option}` : ''}${batch.freight_speed ? ` · ${batch.freight_speed}` : ''}`
                    : 'Not available';
                return straight('Freight', mode);
            }
            if (focus === 'waybill') {
                return straight('Waybill', batch.master_waybill || batch.waybill || 'Not available');
            }
            if (focus === 'vessel') {
                return straight('Vessel', batch.vessel || 'Not available');
            }
            if (focus === 'carrier') {
                return straight('Carrier', batch.carrier || 'Not available');
            }
            if (focus === 'etd') {
                return straight('ETD', batch.ETD || batch.date_dispatch || 'Not available');
            }
            if (focus === 'contents') {
                if (!contents.length) return straight('Linked items', 'None');
                const summary = contents
                    .slice(0, 8)
                    .map((c) => [c.freight_number, c.order_number].filter(Boolean).join('/'))
                    .join(', ');
                return straight('Linked items', summary, `${contents.length} total`);
            }

            return {
                reply: formatBatchResponse(batch, contents),
                data: { batch, batchContents: contents },
            };
        }
        case 'listBatches': {
            const clientId = args.clientId || args.client_id ? Number(args.clientId || args.client_id) : null;
            let label = 'all accessible';
            if (clientId) {
                const client = await getClientById(clientId, ctx);
                if (!client) return { reply: 'Client not found or access denied.', data: null };
                label = client.full_name;
                const batches = await listBatches(ctx, { clientId });
                return { reply: formatBatchListResponse(batches, label), data: { client, batches } };
            }
            const batches = await listBatches(ctx);
            return { reply: formatBatchListResponse(batches, label), data: { batches } };
        }
        case 'countBatches': {
            const clientId = args.clientId || args.client_id ? Number(args.clientId || args.client_id) : null;
            let scope = ctx.isCustomer ? 'your account' : ctx.isAdmin || ctx.hasFullAccess ? 'the system' : 'your accessible records';
            if (clientId) {
                const client = await getClientById(clientId, ctx);
                if (!client) return { reply: 'Client not found or access denied.', data: null };
                scope = client.full_name;
            }
            const total = await countBatches(ctx, { clientId: clientId || undefined });
            return {
                reply: `Total batches for ${scope}: ${total.toLocaleString()}.`,
                data: { count: { entity: 'batches', total, scope } },
            };
        }
        case 'getShipmentDetails': {
            const waybill = args.waybill;
            const shipment = await getShipmentByWaybill(waybill, ctx);
            if (!shipment) {
                return { reply: `I could not find shipment waybill "${waybill}", or access is denied.`, data: null };
            }
            const [links, clearances] = await Promise.all([
                listShipmentLinks(shipment.id),
                listShipmentClearances(shipment.id),
            ]);
            const assignedOrders = links.filter((l) => l.order_id);
            const focus = args.focus || null;
            const ref = shipment.waybill || waybill;
            const straight = (label, value, detail) => ({
                reply: detail
                    ? `${label} for shipment ${ref}: ${value} (${detail}).`
                    : `${label} for shipment ${ref}: ${value}.`,
                data: {
                    focusedAnswer: {
                        freightNumber: ref,
                        label,
                        value: value == null || value === '' ? 'Not available' : String(value),
                        detail: detail || null,
                    },
                    shipment,
                    shipmentLinks: links,
                    shipmentClearances: clearances,
                },
            });

            if (focus === 'status') return straight('Status', shipment.status_label || 'Not available');
            if (focus === 'mode') return straight('Freight', shipment.freight || 'Not available');
            if (focus === 'vessel') return straight('Vessel', shipment.vessel || 'Not available');
            if (focus === 'carrier') return straight('Carrier', shipment.carrier || 'Not available');
            if (focus === 'etd') return straight('ETD', shipment.etd_label || 'Not available');
            if (focus === 'eta') return straight('ETA', shipment.eta_label || 'Not available');
            if (focus === 'date_of_dispatch') {
                return straight('Date of dispatch', shipment.date_of_dispatch_label || 'Not available');
            }
            if (focus === 'origin_agent') {
                return straight('Origin agent', shipment.origin_agent || 'Not available');
            }
            if (focus === 'destination_agent') {
                return straight('Destination agent', shipment.destination_agent || 'Not available');
            }
            if (focus === 'port_of_loading') {
                return straight('Port of loading', shipment.port_of_loading || 'Not available');
            }
            if (focus === 'port_of_discharge') {
                return straight('Port of discharge', shipment.port_of_discharge || 'Not available');
            }
            if (focus === 'load') return straight('Load', shipment.load || shipment.waybill || 'Not available');
            if (focus === 'release_type') {
                return straight('Release type', shipment.release_type || 'Not available');
            }
            if (focus === 'container') {
                return straight('Container number', shipment.container || 'Not available');
            }
            if (focus === 'seal') return straight('Seal number', shipment.seal || 'Not available');
            if (focus === 'origin_country') {
                return straight('Country of origin', shipment.origin_country_name || 'Not available');
            }
            if (focus === 'destination_country') {
                return straight('Destination country', shipment.des_country_name || 'Not available');
            }
            if (focus === 'waybill') return straight('Waybill', shipment.waybill || 'Not available');
            if (focus === 'assigned') {
                if (!assignedOrders.length) return straight('Assigned freights/orders', 'None');
                const summary = assignedOrders
                    .slice(0, 8)
                    .map((l) => l.freight_order_label || l.order_number || '—')
                    .join(', ');
                return straight('Assigned freights/orders', summary, `${assignedOrders.length} total`);
            }
            if (focus === 'clearances') {
                if (!clearances.length) return straight('Clearance orders', 'None');
                const summary = clearances
                    .slice(0, 8)
                    .map((c) => c.clearance_number || '—')
                    .join(', ');
                return straight('Clearance orders', summary, `${clearances.length} total`);
            }

            return {
                reply: formatShipmentResponse(shipment, links, clearances),
                data: { shipment, shipmentLinks: links, shipmentClearances: clearances },
            };
        }
        case 'getShipments': {
            const clientId = args.clientId || args.client_id ? Number(args.clientId || args.client_id) : null;
            const freightNumber = args.freightNumber || args.freight_number;
            if (freightNumber) {
                if (sessionId) setLastFreightNumber(sessionId, freightNumber);
                const rows = await listShipmentsByFreightNumber(freightNumber, ctx);
                return {
                    reply: formatShipmentListResponse(rows, freightNumber),
                    data: { shipments: rows, freightNumber },
                };
            }
            if (clientId) {
                const client = await getClientById(clientId, ctx);
                if (!client) return { reply: 'Client not found or access denied.', data: null };
                const rows = await listShipmentsByClientId(clientId, ctx);
                return {
                    reply: formatShipmentListResponse(rows, client.full_name),
                    data: { client, shipments: rows },
                };
            }
            return {
                reply: 'Which shipments? Provide a freight number, waybill, or client name.',
                data: null,
            };
        }
        case 'countShipments': {
            const clientId = args.clientId || args.client_id ? Number(args.clientId || args.client_id) : null;
            let scope = ctx.isCustomer ? 'your account' : ctx.isAdmin || ctx.hasFullAccess ? 'the system' : 'your accessible records';
            if (clientId) {
                const client = await getClientById(clientId, ctx);
                if (!client) return { reply: 'Client not found or access denied.', data: null };
                scope = client.full_name;
            }
            const total = await countShipments(ctx, { clientId: clientId || undefined });
            return {
                reply: `Total shipments for ${scope}: ${total.toLocaleString()}.`,
                data: { count: { entity: 'shipments', total, scope } },
            };
        }
        case 'getClearanceDetails': {
            const clearanceNumber = args.clearanceNumber || args.clearance_number;
            const row = await getClearanceByNumber(clearanceNumber, ctx);
            if (!row) {
                return { reply: `I could not find clearance ${clearanceNumber}, or access is denied.`, data: null };
            }
            if (row.freight_number && sessionId) setLastFreightNumber(sessionId, row.freight_number);

            const focus = args.focus || null;
            const ref = row.clearance_number || clearanceNumber;
            const straight = (label, value, detail) => ({
                reply: detail
                    ? `${label} for clearance ${ref}: ${value} (${detail}).`
                    : `${label} for clearance ${ref}: ${value}.`,
                data: {
                    focusedAnswer: {
                        freightNumber: ref,
                        label,
                        value: value == null || value === '' ? 'Not available' : String(value),
                        detail: detail || null,
                    },
                    clearance: row,
                },
            });

            if (focus === 'mode') return straight('Mode of freight', row.mode_label || 'Not available');
            if (focus === 'client') return straight('Client', row.client_name || 'Not available');
            if (focus === 'party') return straight('Are you', row.party_role_label || 'Not available');
            if (focus === 'import_export') {
                return straight('Is this', row.import_export_label || 'Not available');
            }
            if (focus === 'shipment_ref') {
                return straight('Shipment reference', row.customer_ref || 'Not available');
            }
            if (focus === 'sales_rep') {
                return straight('Sales representative', row.sales_name || 'Not available');
            }
            if (focus === 'loading_country') {
                return straight('Port of loading country', row.loading_country_name || 'Not available');
            }
            if (focus === 'exit_country') {
                return straight('Port of exit country', row.discharge_country_name || 'Not available');
            }
            if (focus === 'port_of_loading') {
                return straight('Port of loading', row.port_of_loading || 'Not available');
            }
            if (focus === 'port_of_discharge') {
                return straight('Port of discharge', row.port_of_discharge || 'Not available');
            }
            if (focus === 'product_desc') {
                return straight('Product description', row.goods_desc || 'Not available');
            }
            if (focus === 'nature_of_goods') {
                return straight('Nature of goods', row.nature_of_goods_label || 'Not available');
            }
            if (focus === 'packing') {
                return straight('Type of packing', row.packing_type || 'Not available');
            }
            if (focus === 'comment_docs') {
                return straight('Comment on docs', row.comment_on_docs || 'Not available');
            }
            if (focus === 'comment_goods') {
                return straight('Comment on goods', row.comment_on_goods || 'Not available');
            }
            if (focus === 'packages') {
                return straight(
                    'No of package',
                    row.packages_label != null ? String(row.packages_label) : 'Not available'
                );
            }
            if (focus === 'dimensions') {
                return straight(
                    'Total dimension',
                    row.dimension_display || String(row.dimension_label ?? 'Not available')
                );
            }
            if (focus === 'weight') {
                return straight(
                    'Weight',
                    row.weight_display || String(row.weight_label ?? 'Not available')
                );
            }
            if (focus === 'status') {
                return straight('Clearing status', row.clearing_status_label || 'Not available');
            }

            return { reply: formatClearanceResponse(row), data: { clearance: row } };
        }
        case 'getClearances': {
            const clientId = args.clientId || args.client_id ? Number(args.clientId || args.client_id) : null;
            const freightNumber = args.freightNumber || args.freight_number;
            if (freightNumber) {
                if (sessionId) setLastFreightNumber(sessionId, freightNumber);
                const rows = await listClearancesByFreightNumber(freightNumber, ctx);
                return {
                    reply: formatClearanceListResponse(rows, freightNumber),
                    data: { clearances: rows, freightNumber },
                };
            }
            if (clientId) {
                const client = await getClientById(clientId, ctx);
                if (!client) return { reply: 'Client not found or access denied.', data: null };
                const rows = await listClearancesByClientId(clientId, ctx);
                return {
                    reply: formatClearanceListResponse(rows, client.full_name),
                    data: { client, clearances: rows },
                };
            }
            return {
                reply: 'Which clearances? Provide a clearance number (C-…), freight number, or client name.',
                data: null,
            };
        }
        case 'countClearances': {
            const clientId = args.clientId || args.client_id ? Number(args.clientId || args.client_id) : null;
            let scope = ctx.isCustomer ? 'your account' : ctx.isAdmin || ctx.hasFullAccess ? 'the system' : 'your accessible records';
            if (clientId) {
                const client = await getClientById(clientId, ctx);
                if (!client) return { reply: 'Client not found or access denied.', data: null };
                scope = client.full_name;
            }
            const total = await countClearances(ctx, { clientId: clientId || undefined });
            return {
                reply: `Total clearances for ${scope}: ${total.toLocaleString()}.`,
                data: { count: { entity: 'clearances', total, scope } },
            };
        }
        case 'getClearanceOrders': {
            const clientId = args.clientId || args.client_id ? Number(args.clientId || args.client_id) : null;
            const clearanceNumber = args.clearanceNumber || args.clearance_number;
            const search = args.search || args.name || null;
            let label = 'Order Clearance';
            let rows = [];

            if (clientId) {
                const client = await getClientById(clientId, ctx);
                if (!client) return { reply: 'Client not found or access denied.', data: null };
                label = client.full_name || client.display_name || label;
                rows = await listClearanceOrders(ctx, { clientId });
                if (rows.length === 1) {
                    return {
                        reply: formatClearanceOrderResponse(rows[0]),
                        data: { client, clearanceOrder: rows[0], clearanceOrders: rows },
                    };
                }
                return {
                    reply: formatClearanceOrderListResponse(rows, label),
                    data: { client, clearanceOrders: rows },
                };
            }
            if (clearanceNumber) {
                rows = await listClearanceOrders(ctx, { clearanceNumber });
                label = clearanceNumber;
                if (rows.length === 1) {
                    return {
                        reply: formatClearanceOrderResponse(rows[0]),
                        data: { clearanceOrder: rows[0], clearanceOrders: rows },
                    };
                }
                return {
                    reply: formatClearanceOrderListResponse(rows, label),
                    data: { clearanceOrders: rows },
                };
            }
            if (search) {
                rows = await listClearanceOrders(ctx, { search });
                label = search;
                if (rows.length === 1) {
                    return {
                        reply: formatClearanceOrderResponse(rows[0]),
                        data: { clearanceOrder: rows[0], clearanceOrders: rows },
                    };
                }
                return {
                    reply: formatClearanceOrderListResponse(rows, label),
                    data: { clearanceOrders: rows, search },
                };
            }
            if (ctx.isCustomer) {
                rows = await listClearanceOrders(ctx, { clientId: ctx.userId });
                return {
                    reply: formatClearanceOrderListResponse(rows, 'your account'),
                    data: { clearanceOrders: rows },
                };
            }
            // Admin/staff: recent list when they ask to show all
            rows = await listClearanceOrders(ctx, { limit: 25 });
            return {
                reply: formatClearanceOrderListResponse(rows, 'recent'),
                data: { clearanceOrders: rows },
            };
        }
        case 'countClearanceOrders': {
            const clientId = args.clientId || args.client_id ? Number(args.clientId || args.client_id) : null;
            let scope = ctx.isCustomer ? 'your account' : ctx.isAdmin || ctx.hasFullAccess ? 'the system' : 'your accessible records';
            if (clientId) {
                const client = await getClientById(clientId, ctx);
                if (!client) return { reply: 'Client not found or access denied.', data: null };
                scope = client.full_name;
            }
            const total = await countClearanceOrders(ctx, { clientId: clientId || undefined });
            return {
                reply: `Total clearance orders for ${scope}: ${total.toLocaleString()}.`,
                data: { count: { entity: 'clearance_orders', total, scope } },
            };
        }
        default:
            return null;
    }
}

async function ruleBasedLogisticsRoute(message, ctx, sessionId) {
    // Counts
    if (isCountWarehouseRequest(message)) {
        const clientId = extractClientId(message);
        if (clientId) return executeLogisticsTool('countWarehouseOrders', { clientId }, ctx, sessionId);
        const name = extractClientNameForEntity(message, 'warehouse');
        if (name) return resolveClientThen(sessionId, ctx, name, 'countWarehouseOrders', 'count warehouse orders');
        return executeLogisticsTool('countWarehouseOrders', {}, ctx, sessionId);
    }
    if (isCountBatchRequest(message)) {
        const clientId = extractClientId(message);
        if (clientId) return executeLogisticsTool('countBatches', { clientId }, ctx, sessionId);
        const name = extractClientNameForEntity(message, 'batch');
        if (name) return resolveClientThen(sessionId, ctx, name, 'countBatches', 'count batches');
        return executeLogisticsTool('countBatches', {}, ctx, sessionId);
    }
    if (isCountShipmentRequest(message)) {
        const clientId = extractClientId(message);
        if (clientId) return executeLogisticsTool('countShipments', { clientId }, ctx, sessionId);
        const name = extractClientNameForEntity(message, 'shipment');
        if (name) return resolveClientThen(sessionId, ctx, name, 'countShipments', 'count shipments');
        return executeLogisticsTool('countShipments', {}, ctx, sessionId);
    }
    if (isCountClearanceOrderRequest(message)) {
        const clientId = extractClientId(message);
        if (clientId) return executeLogisticsTool('countClearanceOrders', { clientId }, ctx, sessionId);
        const name = extractClientNameForEntity(message, 'clearance order');
        if (name) return resolveClientThen(sessionId, ctx, name, 'countClearanceOrders', 'count clearance orders');
        return executeLogisticsTool('countClearanceOrders', {}, ctx, sessionId);
    }
    if (isCountClearanceRequest(message)) {
        const clientId = extractClientId(message);
        if (clientId) return executeLogisticsTool('countClearances', { clientId }, ctx, sessionId);
        const name = extractClientNameForEntity(message, 'clearance');
        if (name) return resolveClientThen(sessionId, ctx, name, 'countClearances', 'count clearances');
        return executeLogisticsTool('countClearances', {}, ctx, sessionId);
    }

    // Direct lookups
    const clearanceNumber = extractClearanceNumber(message);
    if (clearanceNumber && isClearanceRequest(message)) {
        if (isClearanceOrderRequest(message)) {
            return executeLogisticsTool('getClearanceOrders', { clearanceNumber }, ctx, sessionId);
        }
        return executeLogisticsTool(
            'getClearanceDetails',
            { clearanceNumber, focus: extractClearanceFocus(message) || undefined },
            ctx,
            sessionId
        );
    }

    const batchNumber = extractBatchNumber(message);
    if (batchNumber && (isBatchRequest(message) || extractBatchFocus(message)) && !isWarehouseRequest(message)) {
        return executeLogisticsTool(
            'getBatchDetails',
            { batchNumber, focus: extractBatchFocus(message) || undefined },
            ctx,
            sessionId
        );
    }

    const waybill = extractWaybill(message);
    if (waybill && (isShipmentRequest(message) || extractShipmentFocus(message))) {
        return executeLogisticsTool(
            'getShipmentDetails',
            { waybill, focus: extractShipmentFocus(message) || undefined },
            ctx,
            sessionId
        );
    }

    const warehouseId = extractWarehouseOrderId(message);
    if (warehouseId && isWarehouseRequest(message)) {
        return executeLogisticsTool('getWarehouseOrderDetails', { warehouseOrderId: warehouseId }, ctx, sessionId);
    }

    // Lists by entity keyword
    if (isWarehouseRequest(message)) {
        const freightNumber =
            extractFreightNumber(message) ||
            (refersToPriorFreight(message) ? getLastFreightNumber(sessionId) : null);
        const orderNumber = extractOrderNumber(message);
        const batchNumber = extractBatchNumber(message);
        if (freightNumber) {
            return executeLogisticsTool('getWarehouseOrders', { freightNumber }, ctx, sessionId);
        }
        if (orderNumber) {
            return executeLogisticsTool('getWarehouseOrders', { orderNumber }, ctx, sessionId);
        }
        if (batchNumber) {
            return executeLogisticsTool('getWarehouseOrders', { batchNumber }, ctx, sessionId);
        }
        const clientId = extractClientId(message);
        if (clientId) return executeLogisticsTool('getWarehouseOrders', { clientId }, ctx, sessionId);
        const name = extractClientNameForEntity(message, 'warehouse');
        if (name) return resolveClientThen(sessionId, ctx, name, 'getWarehouseOrders', 'show warehouse orders');
        if (ctx.isCustomer) {
            return executeLogisticsTool('getWarehouseOrders', { clientId: ctx.userId }, ctx, sessionId);
        }
        return {
            reply: 'Whose warehouse orders?\n\nExamples:\n- Warehouse orders for John\n- Warehouse status of F-2026xxxxxx\n- Warehouse of OR000xxx\n- Warehouse of batch ADAWBxxxxxxx\n- Count warehouse orders',
            data: null,
        };
    }

    if (isBatchRequest(message)) {
        const clientId = extractClientId(message);
        if (clientId) return executeLogisticsTool('listBatches', { clientId }, ctx, sessionId);
        const name = extractClientNameForEntity(message, 'batch');
        if (name) return resolveClientThen(sessionId, ctx, name, 'listBatches', 'show batches');
        if (/\b(list|show|all|my)\b/i.test(message) || ctx.isCustomer) {
            return executeLogisticsTool('listBatches', ctx.isCustomer ? { clientId: ctx.userId } : {}, ctx, sessionId);
        }
        return {
            reply: 'Which batch?\n\nExamples:\n- Status of batch ADAWBxxxxxxx\n- Show batches for John\n- Count batches',
            data: null,
        };
    }

    if (isShipmentRequest(message)) {
        const freightNumber =
            extractFreightNumber(message) ||
            (refersToPriorFreight(message) ? getLastFreightNumber(sessionId) : null);
        if (freightNumber) {
            return executeLogisticsTool('getShipments', { freightNumber }, ctx, sessionId);
        }
        const clientId = extractClientId(message);
        if (clientId) return executeLogisticsTool('getShipments', { clientId }, ctx, sessionId);
        const name = extractClientNameForEntity(message, 'shipment');
        if (name) return resolveClientThen(sessionId, ctx, name, 'getShipments', 'show shipments');
        if (ctx.isCustomer) {
            return executeLogisticsTool('getShipments', { clientId: ctx.userId }, ctx, sessionId);
        }
        return {
            reply: 'Which shipment?\n\nExamples:\n- Shipment details 999-xxxxxxxx\n- Vessel of DLxxxxxxxxx\n- Shipments of freight F-2026xxxxxx\n- Shipments for John\n- Count shipments',
            data: null,
        };
    }

    if (isClearanceOrderRequest(message)) {
        const clearanceNumber = extractClearanceNumber(message);
        if (clearanceNumber) {
            return executeLogisticsTool('getClearanceOrders', { clearanceNumber }, ctx, sessionId);
        }
        const clientId = extractClientId(message);
        if (clientId) return executeLogisticsTool('getClearanceOrders', { clientId }, ctx, sessionId);
        const name = extractClientNameForEntity(message, 'clearance order');
        if (name) return resolveClientThen(sessionId, ctx, name, 'getClearanceOrders', 'show clearance orders');
        const orderClearanceName = extractClientNameForEntity(message, 'order clearance');
        if (orderClearanceName) {
            return resolveClientThen(
                sessionId,
                ctx,
                orderClearanceName,
                'getClearanceOrders',
                'show clearance orders'
            );
        }
        const search = extractClearanceOrderSearchTerm(message);
        if (search) {
            return executeLogisticsTool('getClearanceOrders', { search }, ctx, sessionId);
        }
        if (ctx.isCustomer || /\b(list|show|all|my|recent)\b/i.test(message)) {
            return executeLogisticsTool(
                'getClearanceOrders',
                ctx.isCustomer ? { clientId: ctx.userId } : {},
                ctx,
                sessionId
            );
        }
        return {
            reply: 'Which Order Clearance?\n\nExamples:\n- Clearance order C-2026xxxxx\n- Order clearance for Dominic\n- Find clearance order Multimeter\n- Show clearance orders\n- Count clearance orders',
            data: null,
        };
    }

    if (isClearanceRequest(message)) {
        const freightNumber =
            extractFreightNumber(message) ||
            (refersToPriorFreight(message) ? getLastFreightNumber(sessionId) : null);
        if (freightNumber) {
            return executeLogisticsTool('getClearances', { freightNumber }, ctx, sessionId);
        }
        const clientId = extractClientId(message);
        if (clientId) return executeLogisticsTool('getClearances', { clientId }, ctx, sessionId);
        const name = extractClientNameForEntity(message, 'clearance');
        if (name) return resolveClientThen(sessionId, ctx, name, 'getClearances', 'show clearances');
        if (ctx.isCustomer) {
            return executeLogisticsTool('getClearances', { clientId: ctx.userId }, ctx, sessionId);
        }
        return {
            reply: 'Which clearance?\n\nExamples:\n- Status of C-2026xxxxx\n- Clearances for John\n- Clearance of freight F-2026xxxxxx\n- Count clearances',
            data: null,
        };
    }

    return null;
}

module.exports = {
    LOGISTICS_TOOL_DEFINITIONS,
    executeLogisticsTool,
    ruleBasedLogisticsRoute,
    normalizeLogisticsToolName,
};
