function statusBadge(label) {
    return label || 'Unknown';
}

function formatFreightResponse(data) {
    const f = data.freight;
    const client = data.client || {};
    const est = data.estimateSummary;
    const br = data.estimateBreakdown;
    const lines = [
        `Freight order details · ${f.freight_number}:`,
        '',
        `Status: ${statusBadge(f.status_label || f.status)}`,
        `Client: ${client.full_name || f.client_name || 'N/A'}${client.client_number ? ` (${client.client_number})` : ''}`,
        `Route: ${f.collection_from_name || 'Unknown'} → ${f.delivery_to_name || 'Unknown'}`,
        '',
        'Shipper details',
        `Shipper: ${f.shipper_label || '—'}`,
        `Pickup address: ${f.pickup_address_label || '—'}`,
        `Origin country: ${f.collection_from_name || '—'}`,
        '',
        'Consignee details',
        `Consignee: ${f.consignee_label || client.full_name || '—'}`,
        `Contact: ${f.consignee_contact || '—'}`,
        `Cell: ${f.consignee_cell || '—'}`,
        `Telephone: ${f.consignee_telephone || '—'}`,
        `Email: ${f.consignee_email || '—'}`,
        `Delivery address: ${f.delivery_address_label || '—'}`,
        `City: ${f.consignee_city || '—'}`,
        `Province: ${f.consignee_province || '—'}`,
        `Country: ${f.consignee_country || f.delivery_to_name || '—'}`,
        `Postal / export code: ${f.export_code_label || '—'}`,
        `Vat/Tax No: ${f.vat_tax_label || '—'}`,
        '',
        'Cargo details',
        `Product: ${f.product_desc || '—'}`,
        `Commodity: ${f.commodity_name || '—'}`,
        `Industry: ${f.industry_label || '—'}`,
        `Hazardous: ${f.hazardous_label || '—'}`,
        `Packaging: ${f.packing_label || '—'}`,
        `No of packages: ${f.packages_label != null ? f.packages_label : '—'}`,
        `Dimensions (CBM): ${f.dimension_label != null ? f.dimension_label : '—'}`,
        `Weight (KGS): ${f.weight_label != null ? f.weight_label : '—'}`,
        `Vol weight (kgs): ${f.volumetric_weight_label != null ? f.volumetric_weight_label : '—'}`,
        `Chargeable weight: ${est?.chargeable != null ? est.chargeable : '—'}`,
        '',
        'Booking information',
        `Freight number: ${f.freight_number}`,
        `Port of loading: ${f.port_of_loading_label || '—'}`,
        `Collection instructions: ${f.collection_instructions || '—'}`,
        `Freight option: ${f.freight_option_label || '—'}`,
        `Efficiency: ${f.efficiency_label || '—'}`,
        `Incoterms: ${f.incoterm_label || '—'}`,
        `Insurance: ${f.insurance_label || '—'}`,
        `Type: ${f.fcl_lcl_label || '—'}`,
        `Warehouse: ${f.warehouse_label || '—'}`,
        `Place of delivery: ${f.place_of_delivery_label || '—'}`,
        `Port of discharge: ${f.port_of_discharge_label || '—'}`,
        `Delivery instructions: ${f.delivery_instructions || '—'}`,
    ];

    if (f.priority) lines.push(`Priority: ${f.priority}`);
    if (data.supplier?.name || f.assigned_supplier_name) {
        lines.push(`Supplier: ${data.supplier?.name || f.assigned_supplier_name}`);
    }
    if (f.sales_rep_name) lines.push(`Sales rep: ${f.sales_rep_name}`);

    lines.push('', 'Shipping estimate');
    if (est && est.amount != null) {
        lines.push(
            `Estimate: ${`${est.currency || ''} ${Number(est.amount).toLocaleString()}`.trim()}${
                est.reference ? ` · ${est.reference}` : ''
            }${est.status ? ` · ${est.status}` : ''}`
        );
        if (est.vat_incl != null) {
            lines.push(`VAT incl: ${est.currency || ''} ${Number(est.vat_incl).toLocaleString()}`.trim());
        }
        if (est.chargeable != null) lines.push(`Chargeable: ${est.chargeable}`);
    } else {
        lines.push('Estimate: Not available yet');
    }

    if (br) {
        if (br.freight_type || br.freight_cost != null) {
            lines.push(
                `Freight cost: ${br.freight_billing || ''} ${br.freight_cost != null ? br.freight_cost : '—'}`.trim()
            );
        }
        const originBits = Object.entries(br.origin || {})
            .filter(([, v]) => v != null)
            .map(([k, v]) => `${k} ${v}`);
        if (originBits.length) lines.push(`Origin charges: ${originBits.join(' · ')}`);
        const desBits = Object.entries(br.destination || {})
            .filter(([, v]) => v != null)
            .map(([k, v]) => `${k} ${v}`);
        if (desBits.length) lines.push(`Destination charges: ${desBits.join(' · ')}`);
    }

    if (f.attachment_estimate_label) {
        lines.push(`Invoice / packing list: ${f.attachment_estimate_label}`);
    }

    if (data.orders?.length) {
        lines.push(`Orders: ${data.orders.map((o) => o.order_number || `OR000${o.id}`).join(', ')}`);
    }

    if (data.invoices_access && data.invoices?.length) {
        const summary = data.invoices
            .filter((inv) => inv.invoice_id || inv.sage_invoice_number || inv.document_number)
            .slice(0, 5)
            .map((inv) => inv.sage_invoice_number || inv.document_number || `Invoice #${inv.invoice_id}`)
            .join(', ');
        lines.push(`Invoices: ${summary || 'None on file'}`);
    } else if (!data.invoices_access) {
        lines.push(`Invoices: ${data.invoices_message || 'Not available for your role'}`);
    }

    if (data.shipments?.length) {
        const s = data.shipments[0];
        lines.push(`Shipment: ${s.waybill || 'N/A'} · ${s.vessel || 'No vessel'} · ${s.status || 'No status'}`);
    }

    if (data.clearance?.length) {
        const c = data.clearance[0];
        lines.push(`Clearance: ${c.clearance_number || 'N/A'} — ${c.clearing_status || 'Pending'}`);
    }

    return lines.join('\n');
}

function formatSupplierResponse(suppliers, searchName) {
    if (!suppliers?.length) {
        return `No suppliers matching "${searchName}" were found in the system.`;
    }
    if (suppliers.length === 1) {
        return formatSupplierProfileResponse(suppliers[0]);
    }
    const list = suppliers
        .slice(0, 15)
        .map((s, i) => {
            const label = s.company_name || s.name || '—';
            return `${i + 1}. ${label} (ID: ${s.id}${s.country_based || s.country_name ? `, ${s.country_based || s.country_name}` : ''}${s.service_type ? `, ${s.service_type}` : ''})`;
        })
        .join('\n');
    return `I found ${suppliers.length} suppliers matching "${searchName}":\n\n${list}`;
}

function formatSupplierProfileResponse(supplier) {
    if (!supplier) return 'Supplier not found.';
    const lines = [
        `Edit Supplier · ${supplier.company_name || supplier.name || supplier.id}:`,
        '',
        'Company Details',
        `Company name: ${supplier.company_name || '—'}`,
        `Type of service: ${supplier.service_type || '—'}`,
        `Address: ${supplier.address || '—'}`,
        `Country based: ${supplier.country_based || '—'}`,
        `Country of origin: ${supplier.country_of_origin || '—'}`,
        '',
        'Account Details',
        `Email: ${supplier.email || '—'}`,
        `Full name: ${supplier.full_name || '—'}`,
        `Country code: ${supplier.country_code_label || supplier.country_code || '—'}`,
        `Phone number: ${supplier.phone_no || '—'}`,
        `Profile image: ${supplier.profile_label || (supplier.profile ? supplier.profile : 'No file chosen')}`,
        `Password: ${supplier.password_label || 'Not shown (leave blank to keep current)'}`,
        `Supplier ID: ${supplier.id}`,
    ];
    return lines.join('\n');
}

function formatSupplierListResponse(suppliers, label) {
    if (!suppliers.length) return `No suppliers found for ${label}.`;
    const lines = suppliers.slice(0, 20).map((s) => {
        return [
            `• ${s.company_name || s.name || '—'}`,
            s.service_type,
            s.country_based || s.country_name,
            s.email,
            `ID ${s.id}`,
        ]
            .filter(Boolean)
            .join(' · ');
    });
    const more = suppliers.length > 20 ? `\n…and ${suppliers.length - 20} more.` : '';
    return `Suppliers for ${label} (${suppliers.length} found):\n\n${lines.join('\n')}${more}`;
}

function formatInvoiceResponse(invoices, clientName) {
    if (!invoices.length) {
        return `No invoices found for ${clientName}.`;
    }
    const count = invoices.filter(
        (inv) => inv.invoice_id || inv.reference_no || inv.sage_invoice_number || inv.document_number
    ).length;
    return `Invoices for ${clientName} (${count} record${count === 1 ? '' : 's'}).`;
}

function formatSageInvoiceResponse(invoice) {
    if (!invoice) return 'Sage invoice not found.';
    const lines = [
        `Sage invoice ${invoice.document_number || invoice.display_title}:`,
        '',
        `Document number: ${invoice.document_number || '—'}`,
        `Customer name: ${invoice.customer_name || '—'}`,
        `Customer ref.: ${invoice.customer_ref || '—'}`,
        `Date: ${invoice.date_label || '—'}`,
        `Total: ${invoice.total_label || '—'}`,
        `Upload: ${invoice.upload_label || '—'}`,
        `Invoice (AD): ${invoice.invoice_ad_label || '—'}`,
    ];
    if (invoice.freight_number) lines.push(`Freight: ${invoice.freight_number}`);
    if (invoice.order_id) lines.push(`Order: OR000${invoice.order_id}`);
    return lines.join('\n');
}

function formatSageInvoiceListResponse(invoices, label) {
    if (!invoices.length) return `No Sage invoices found for ${label}.`;
    const lines = invoices.slice(0, 20).map((inv) => {
        return [
            `• ${inv.document_number || '—'}`,
            inv.customer_name || '—',
            inv.customer_ref || '—',
            inv.date_label || '—',
            inv.total_label || '—',
            `Upload ${inv.upload_label || '—'}`,
            `AD ${inv.invoice_ad_label || '—'}`,
        ].join(' · ');
    });
    const more = invoices.length > 20 ? `\n…and ${invoices.length - 20} more.` : '';
    return `Sage invoices for ${label} (${invoices.length} found):\n\n${lines.join('\n')}${more}`;
}

function formatClientDisambiguation(candidates, actionLabel) {
    const list = candidates
        .map((c, i) => {
            const name = c.display_name || c.full_name || c.email || 'Client';
            return `${i + 1}. ${name} (ID: ${c.id}${c.client_number ? `, ${c.client_number}` : ''})`;
        })
        .join('\n');
    return `I found ${candidates.length} clients with that name. Which one do you mean?\n\n${list}\n\nTap a name above, or reply with the number (1, 2, …) or Client ID to ${actionLabel}.`;
}

function formatClientResponse(client) {
    if (!client) return 'Client not found.';
    const lines = [
        `Customer Profile · ${client.customer_id || client.id}:`,
        '',
        `Name: ${client.full_name || '—'}`,
        `Email: ${client.email || '—'}`,
        `Address 1: ${client.address_1 || '—'}`,
        `Address 2: ${client.address_2 || '—'}`,
        `Cellphone: ${client.cellphone || '—'}`,
        `Telephone: ${client.telephone || '—'}`,
        `City: ${client.city || '—'}`,
        `Code: ${client.code || '—'}`,
        `Company ID: ${client.company_id || '—'}`,
        `Contact person: ${client.contact_person || '—'}`,
        `Country: ${client.country_name || '—'}`,
        `Importer reference: ${client.importers_ref || '—'}`,
        `Province: ${client.province || '—'}`,
        `Tax reference: ${client.tax_ref || '—'}`,
        `Client ref: ${client.client_ref || '—'}`,
        `Customer ID: ${client.customer_id || client.id}`,
        `Date of reg: ${client.date_of_reg || '—'}`,
        `Status: ${client.status_label || '—'}`,
    ];
    if (client.profile) lines.push(`Customer image: ${client.profile}`);

    const freights = client.related_freights || [];
    if (freights.length) {
        lines.push('', `Related freight (${freights.length}):`);
        freights.slice(0, 15).forEach((f) => {
            lines.push(
                [
                    `${f.sr_no}.`,
                    f.client_name || '—',
                    f.client_reference || '—',
                    f.country || '—',
                    f.dimension != null ? String(f.dimension) : '—',
                    f.freight || '—',
                    f.incoterm || '—',
                    f.province || '—',
                    f.freight_number ? `(${f.freight_number})` : null,
                ]
                    .filter(Boolean)
                    .join(' · ')
            );
        });
        if (freights.length > 15) lines.push(`…and ${freights.length - 15} more.`);
    }
    return lines.join('\n');
}

function formatClientListResponse(clients, label) {
    if (!clients.length) return `No clients found for ${label}.`;
    const lines = clients.slice(0, 20).map((c) => {
        const name = c.full_name || c.email || '—';
        return `• ${c.customer_id || c.id} · ${name}${c.email ? ` · ${c.email}` : ''} · ${c.status_label || '—'}`;
    });
    const more = clients.length > 20 ? `\n…and ${clients.length - 20} more.` : '';
    return `Clients for ${label} (${clients.length} found):\n\n${lines.join('\n')}${more}`;
}

function formatFreightListResponse(freights, clientName) {
    if (!freights.length) {
        return `No freights found for ${clientName}.`;
    }
    const lines = freights.slice(0, 20).map((f) => {
        const route = `${f.collection_from_name || '?'} → ${f.delivery_to_name || '?'}`;
        const mode = f.freight ? `${f.freight}${f.fcl_lcl ? ` · ${f.fcl_lcl}` : ''}` : '';
        return `• ${f.freight_number} · ${f.status_label || f.status || '—'}${mode ? ` · ${mode}` : ''} · ${route}`;
    });
    const more = freights.length > 20 ? `\n…and ${freights.length - 20} more.` : '';
    return `Freights for ${clientName} (${freights.length} found):\n\n${lines.join('\n')}${more}`;
}

function formatOrderResponse(order) {
    if (!order) return 'Order not found.';
    const lines = [
        `Here is what I found for order ${order.order_number}:`,
        '',
    ];

    if (order.tracking_started === false) {
        lines.push('Tracking status: Not started yet');
        if (order.warehouse_status_label) {
            lines.push(`Warehouse: ${order.warehouse_status_label}`);
        }
    } else {
        lines.push(`Status: ${statusBadge(order.status_label)}`);
        if (order.warehouse_status_label) {
            lines.push(`Warehouse: ${order.warehouse_status_label}`);
        }
    }

    lines.push(
        `Client: ${order.client_name || 'N/A'}${order.client_number ? ` (${order.client_number})` : ''}`,
        `Freight: ${order.freight_number || 'Not linked'}`,
        `Goods: ${order.goods_description || 'N/A'}`
    );
    if (order.freight) {
        lines.push(`Mode: ${order.freight}${order.fcl_lcl ? ` (${order.fcl_lcl})` : ''}${order.freight_speed ? ` · ${order.freight_speed}` : ''}`);
    }
    if (order.dimensions) lines.push(`Dimensions: ${order.dimensions}`);
    if (order.weight) lines.push(`Weight: ${order.weight}`);
    if (order.cartons) lines.push(`Cartons: ${order.cartons}`);
    if (order.CBM) lines.push(`CBM: ${order.CBM}`);
    if (order.date_of_collection) lines.push(`Collection date: ${order.date_of_collection}`);
    if (order.collection_from_name || order.delivery_to_name) {
        lines.push(`Route: ${order.collection_from_name || '?'} → ${order.delivery_to_name || '?'}`);
    }
    if (order.sales_rep_name) lines.push(`Sales rep: ${order.sales_rep_name}`);
    if (order.track_status && String(order.track_status).trim()) {
        lines.push(`Track: ${order.track_status}`);
    }
    return lines.join('\n');
}

function formatOrderListResponse(orders, label) {
    if (!orders.length) {
        return `No orders found for ${label}.`;
    }
    const lines = orders.slice(0, 20).map((o) => {
        const status = o.status_label || '—';
        const freight = o.freight_number ? ` · ${o.freight_number}` : '';
        const goods = o.goods_description
            ? ` · ${String(o.goods_description).slice(0, 40)}${String(o.goods_description).length > 40 ? '…' : ''}`
            : '';
        return `• ${o.order_number} · ${status}${freight}${goods}`;
    });
    const more = orders.length > 20 ? `\n…and ${orders.length - 20} more.` : '';
    return `Orders for ${label} (${orders.length} found):\n\n${lines.join('\n')}${more}`;
}

function formatWarehouseResponse(row, packagesDetail = []) {
    const pkgs = packagesDetail.length ? packagesDetail : row.packages_detail || [];
    const lines = [];
    if (row.source === 'supplier_warehouse' && row.warehouse_name) {
        lines.push(`${row.warehouse_name}:`, '');
    } else {
        lines.push(`Warehouse · ${row.client_name || `#${row.id}`}:`, '');
    }
    lines.push(`Client: ${row.client_name || '—'}`);
    if (row.refs_label) lines.push(`Refs: ${row.refs_label}`);
    if (row.date_received_label) lines.push(`Date: ${row.date_received_label}`);
    if (row.goods_label) lines.push(`Goods: ${row.goods_label}`);
    lines.push(`Days in warehouse: ${row.days_in_warehouse != null ? row.days_in_warehouse : 0}`);
    lines.push(`Origin: ${row.collection_from_name || '—'}`);
    lines.push(`Destination: ${row.destination_label || row.delivery_to_name || '—'}`);
    lines.push(`Status: ${row.status_label || '—'}`);
    lines.push(`Weight: ${row.weight != null ? row.weight : 0}`);
    lines.push(`Dimension: ${row.dimensions != null ? row.dimensions : 0}`);
    lines.push(`Packages: ${row.packages != null ? row.packages : 0}`);
    lines.push(`Batch: ${row.batch_action_label || (row.batch_assigned ? 'Batch Assigned' : 'Select Batch')}`);
    if (row.groupage || row.batch_number) lines.push(`Groupage: ${row.groupage || row.batch_number}`);
    if (row.freight_number) lines.push(`Freight number: ${row.freight_number}`);
    if (row.freight_mode) lines.push(`Freight: ${row.freight_mode}`);
    if (row.customer_ref) lines.push(`Client ref: ${row.customer_ref}`);
    if (row.box_marking) lines.push(`Box marking: ${row.box_marking}`);
    if (row.packing_type) lines.push(`Packing type: ${row.packing_type}`);
    if (row.hazardous_label) lines.push(`Hazardous: ${row.hazardous_label}`);
    if (row.courier_waybill_ref) lines.push(`Courier waybill: ${row.courier_waybill_ref}`);
    if (row.tracking_number) lines.push(`Tracking: ${row.tracking_number}`);
    if (row.supplier_company || row.supplier_person) {
        lines.push(
            `Supplier: ${[row.supplier_company, row.supplier_person].filter(Boolean).join(' / ')}`
        );
    }
    if (row.supplier_address) lines.push(`Supplier address: ${row.supplier_address}`);
    if (row.move_status_label) lines.push(`Move status: ${row.move_status_label}`);
    if (row.warehouse_name || row.warehouse_number) {
        lines.push(
            `Location: ${row.warehouse_name || ''}${row.warehouse_number ? ` (${row.warehouse_number})` : ''}`.trim()
        );
    }
    if (pkgs.length) {
        lines.push('', `Packages detail (${pkgs.length}):`);
        pkgs.slice(0, 15).forEach((p, i) => {
            const bits = [
                p.product_description || '—',
                p.date_received_label,
                p.package_type,
                p.packages != null ? `${p.packages} pkg` : null,
                p.dimension != null ? `Dim ${p.dimension}` : null,
                p.weight != null ? `Wt ${p.weight}` : null,
            ].filter(Boolean);
            lines.push(`${i + 1}. ${bits.join(' · ')}`);
        });
    }
    return lines.join('\n');
}

function formatWarehouseListResponse(rows, label) {
    if (!rows.length) return `No warehouse orders found for ${label}.`;
    const lines = rows.slice(0, 20).map((r) => {
        const bits = [
            r.client_name || `#${r.id}`,
            r.refs_label || null,
            r.date_received_label,
            r.goods_label,
            `Days ${r.days_in_warehouse != null ? r.days_in_warehouse : 0}`,
            r.collection_from_name,
            r.destination_label || r.delivery_to_name,
            r.status_label || '—',
            `Wt ${r.weight != null ? r.weight : 0}`,
            `Dim ${r.dimensions != null ? r.dimensions : 0}`,
            `Pkg ${r.packages != null ? r.packages : 0}`,
            r.batch_action_label || null,
        ].filter(Boolean);
        return `• ${bits.join(' · ')}`;
    });
    const more = rows.length > 20 ? `\n…and ${rows.length - 20} more.` : '';
    return `Warehouse orders for ${label} (${rows.length} found):\n\n${lines.join('\n')}${more}`;
}

function formatBatchResponse(batch, contents = []) {
    const lines = [
        `Batch ${batch.batch_number}:`,
        '',
        `Status: ${batch.status_label || '—'}`,
    ];
    if (batch.freight) {
        lines.push(
            `Freight: ${batch.freight}${batch.freight_option ? ` · ${batch.freight_option}` : ''}${batch.freight_speed ? ` · ${batch.freight_speed}` : ''}`
        );
    }
    lines.push(`Origin: ${batch.origin_country_name || '—'}`);
    lines.push(`Destination: ${batch.destination_country_name || '—'}`);
    lines.push(`Dim.: ${batch.dimensions != null ? batch.dimensions : 0}`);
    lines.push(`Weight: ${batch.weight != null ? batch.weight : 0}`);
    lines.push(`Packages: ${batch.packages != null ? batch.packages : 0}`);
    lines.push(`Forwarding agent: ${batch.forwarding_agent_label || '—'}`);
    lines.push(`Total freight: ${batch.total_freight != null ? batch.total_freight : 0}`);
    if (batch.vessel) lines.push(`Vessel: ${batch.vessel}`);
    if (batch.carrier) lines.push(`Carrier: ${batch.carrier}`);
    if (batch.waybill || batch.master_waybill) {
        lines.push(`Waybill: ${batch.master_waybill || batch.waybill}`);
    }
    if (batch.warehouse_name) lines.push(`Warehouse: ${batch.warehouse_name}`);
    if (contents.length) {
        const linked = contents.filter((c) => c.freight_number || c.order_number);
        if (linked.length) {
            lines.push('', `Linked items (${linked.length}):`);
            linked.slice(0, 15).forEach((c) => {
                const ref = [c.freight_number, c.order_number].filter(Boolean).join(' / ');
                lines.push(`• ${ref}${c.client_name ? ` · ${c.client_name}` : ''}`);
            });
        }
    }
    return lines.join('\n');
}

function formatBatchListResponse(batches, label) {
    if (!batches.length) return `No batches found for ${label}.`;
    const lines = batches.slice(0, 20).map((b) => {
        const route =
            b.origin_country_name || b.destination_country_name
                ? ` · ${b.origin_country_name || '?'} → ${b.destination_country_name || '?'}`
                : '';
        return `• ${b.batch_number} · ${b.status_label || '—'}${route}`;
    });
    const more = batches.length > 20 ? `\n…and ${batches.length - 20} more.` : '';
    return `Batches for ${label} (${batches.length} found):\n\n${lines.join('\n')}${more}`;
}

function formatShipmentResponse(shipment, links = [], clearances = []) {
    const lines = [
        `Shipment ${shipment.waybill || `#${shipment.id}`}:`,
        '',
        `Waybill: ${shipment.waybill || '—'}`,
        `Freight: ${shipment.freight || '—'}`,
        `Vessel: ${shipment.vessel || '—'}`,
        `Carrier: ${shipment.carrier || '—'}`,
        `Date of dispatch: ${shipment.date_of_dispatch_label || '—'}`,
        `ETD: ${shipment.etd_label || '—'}`,
        `ETA: ${shipment.eta_label || '—'}`,
        `Origin agent: ${shipment.origin_agent || '—'}`,
        `Seal number: ${shipment.seal || '—'}`,
        `Port of loading: ${shipment.port_of_loading || '—'}`,
        `Port of discharge: ${shipment.port_of_discharge || '—'}`,
        `Destination agent: ${shipment.destination_agent || '—'}`,
        `Load: ${shipment.load || shipment.waybill || '—'}`,
        `Release type: ${shipment.release_type || '—'}`,
        `Container number: ${shipment.container || '—'}`,
        `Status: ${shipment.status_label || '—'}`,
        `Destination country: ${shipment.des_country_name || '—'}`,
        `Country of origin: ${shipment.origin_country_name || '—'}`,
    ];

    const assigned = (links || []).filter((l) => l.order_id);
    if (assigned.length) {
        lines.push('', `Assigned freights/orders (${assigned.length}):`);
        assigned.slice(0, 15).forEach((l, i) => {
            const bits = [
                l.freight_order_label || [l.freight_number, l.order_number].filter(Boolean).join(' / '),
                l.client_name,
                l.hawb_tracking ? `HAWB ${l.hawb_tracking}` : null,
                l.weight_label != null ? `Wt ${l.weight_label}` : null,
                l.cbm_label != null ? `CBM ${l.cbm_label}` : null,
                l.nature_of_goods,
            ].filter(Boolean);
            lines.push(`${i + 1}. ${bits.join(' · ') || '—'}`);
        });
    }

    if (clearances?.length) {
        lines.push('', `Clearance orders (${clearances.length}):`);
        clearances.slice(0, 15).forEach((c, i) => {
            const bits = [
                c.clearance_number,
                c.client_name,
                c.clearing_status_label,
                c.weight_label != null ? `Wt ${c.weight_label}` : null,
                c.dimension_label != null ? `Dim ${c.dimension_label}` : null,
                c.nature_of_goods,
            ].filter(Boolean);
            lines.push(`${i + 1}. ${bits.join(' · ') || '—'}`);
        });
    }

    return lines.join('\n');
}

function formatShipmentListResponse(rows, label) {
    if (!rows.length) return `No shipments found for ${label}.`;
    const lines = rows.slice(0, 20).map((s) => {
        const route = s.route_label ? ` · ${s.route_label}` : '';
        return `• ${s.waybill || `#${s.id}`} · ${s.status_label || '—'}${route}`;
    });
    const more = rows.length > 20 ? `\n…and ${rows.length - 20} more.` : '';
    return `Shipments for ${label} (${rows.length} found):\n\n${lines.join('\n')}${more}`;
}

function formatClearanceResponse(row) {
    const lines = [
        `Clearance ${row.clearance_number}:`,
        '',
        `Mode of freight: ${row.mode_label || row.freight || '—'}`,
        `Client: ${row.client_name || '—'}`,
        `Are you: ${row.party_role_label || '—'}`,
        `Is this: ${row.import_export_label || '—'}`,
        `Shipment reference: ${row.customer_ref || '—'}`,
        `Sales representative: ${row.sales_name || '—'}`,
        `Port of loading country: ${row.loading_country_name || '—'}`,
        `Port of exit country: ${row.discharge_country_name || '—'}`,
        `Port of loading: ${row.port_of_loading || '—'}`,
        `Port of discharge: ${row.port_of_discharge || '—'}`,
        `Product description: ${row.goods_desc || '—'}`,
        `Nature of goods: ${row.nature_of_goods_label || '—'}`,
        `Type of packing: ${row.packing_type || '—'}`,
        `Comment on docs: ${row.comment_on_docs || '—'}`,
        `No of package: ${row.packages_label != null ? row.packages_label : '—'}`,
        `Total dimension: ${row.dimension_display || row.dimension_label || '—'}`,
        `Weight: ${row.weight_display || row.weight_label || '—'}`,
        `Clearing status: ${row.clearing_status_label || '—'}`,
        `Inquiry: ${row.inquiry_status_label || '—'}`,
        `Quotation: ${row.quotation_status_label || '—'}`,
    ];
    if (row.freight_number) lines.push(`Linked freight: ${row.freight_number}`);
    return lines.join('\n');
}

function formatClearanceListResponse(rows, label) {
    if (!rows.length) return `No clearances found for ${label}.`;
    const lines = rows.slice(0, 20).map((c) => {
        return `• ${c.clearance_number} · ${c.status_label || '—'}${c.freight_number ? ` · ${c.freight_number}` : ''}`;
    });
    const more = rows.length > 20 ? `\n…and ${rows.length - 20} more.` : '';
    return `Clearances for ${label} (${rows.length} found):\n\n${lines.join('\n')}${more}`;
}

function formatClearanceOrderResponse(row) {
    if (!row) return 'Clearance order not found.';
    const lines = [
        `Order Clearance ${row.clearance_number || `#${row.id}`}:`,
        '',
        `Client: ${row.client_name || '—'}`,
        `Clearance number: ${row.clearance_number || '—'}`,
        `Date: ${row.date_label || '—'}`,
        `Goods: ${row.goods_desc || '—'}`,
        `Origin: ${row.origin_country_name || '—'}`,
        `Destination: ${row.destination_country_name || '—'}`,
    ];
    if (row.freight_mode) lines.push(`Freight: ${row.freight_mode}`);
    lines.push(`Action: ${row.action_label || row.status_label || '—'}`);
    return lines.join('\n');
}

function formatClearanceOrderListResponse(rows, label) {
    if (!rows.length) return `No clearance orders found for ${label}.`;
    const lines = rows.slice(0, 20).map((c) => {
        const route =
            c.origin_country_name || c.destination_country_name
                ? `${c.origin_country_name || '?'} → ${c.destination_country_name || '?'}`
                : null;
        return [
            `• ${c.client_name || '—'}`,
            c.clearance_number || '—',
            c.date_label || '—',
            c.goods_desc || '—',
            route,
            c.freight_mode,
            c.action_label || c.status_label || '—',
        ]
            .filter(Boolean)
            .join(' · ');
    });
    const more = rows.length > 20 ? `\n…and ${rows.length - 20} more.` : '';
    return `Order Clearance for ${label} (${rows.length} found):\n\n${lines.join('\n')}${more}`;
}

function formatDisputeResponse(row) {
    if (!row) return 'Dispute not found.';
    const lines = [
        `Customer Query / Dispute ${row.dispute_id || `#${row.id}`}:`,
        '',
        `Dispute ID: ${row.dispute_id || '—'}`,
        `Freight / Order: ${row.freight_no || '—'}`,
        `Name: ${row.name || '—'}`,
        `Nature of heading: ${row.nature_of_heading || '—'}`,
        `Subject: ${row.subject || '—'}`,
        `Message: ${row.message || '—'}`,
        `Outcome: ${row.outcome_label || '—'}`,
    ];
    if (row.resolution) lines.push(`Resolution: ${row.resolution}`);
    if (row.date_label) lines.push(`Created: ${row.date_label}`);
    if (row.email) lines.push(`Email: ${row.email}`);
    return lines.join('\n');
}

function formatDisputeListResponse(rows, label) {
    if (!rows.length) return `No disputes found for ${label}.`;
    const lines = rows.slice(0, 20).map((d) => {
        return [
            `• ${d.freight_no || '—'}`,
            d.dispute_id || '—',
            d.name || '—',
            d.nature_of_heading || '—',
            d.subject || '—',
            d.outcome_label || '—',
        ]
            .filter(Boolean)
            .join(' · ');
    });
    const more = rows.length > 20 ? `\n…and ${rows.length - 20} more.` : '';
    return `Customer Query / Dispute for ${label} (${rows.length} found):\n\n${lines.join('\n')}${more}`;
}

function formatReleaseResponse(row) {
    if (!row) return 'Release dashboard entry not found.';
    const lines = [
        `Release Dashboard · ${row.order_number || '—'}:`,
        '',
        `Order number: ${row.order_number || '—'}`,
        `Customer name: ${row.customer_name || '—'}`,
        `Clearing status: ${row.clearing_status || '—'}`,
        `Cargo inspection: ${row.cargo_inspection || '—'}`,
        `Payment: ${row.payment_label || '—'}`,
        `Release instruction: ${row.release_instruction || '—'}`,
        `Delivery: ${row.delivery_label || '—'}`,
        `Status: ${row.status_label || '—'}`,
    ];
    if (row.freight_number) lines.push(`Freight: ${row.freight_number}`);
    if (row.sage_document_number) lines.push(`Sage invoice: ${row.sage_document_number}`);
    return lines.join('\n');
}

function formatReleaseListResponse(rows, label) {
    if (!rows.length) return `No release dashboard entries found for ${label}.`;
    const lines = rows.slice(0, 20).map((r) => {
        return [
            `• ${r.order_number || '—'}`,
            r.customer_name || '—',
            r.clearing_status,
            r.cargo_inspection,
            r.payment_label,
            r.release_instruction,
            r.delivery_label,
            r.status_label || '—',
        ]
            .filter(Boolean)
            .join(' · ');
    });
    const more = rows.length > 20 ? `\n…and ${rows.length - 20} more.` : '';
    return `Release Dashboard for ${label} (${rows.length} found):\n\n${lines.join('\n')}${more}`;
}

function formatQuoteResponse(row) {
    if (!row) return 'Quotation not found.';
    const money = (v, c) =>
        v == null || v === '' ? '—' : `${c || ''} ${Number(v).toLocaleString()}`.trim();
    const sourceLabel =
        row.quote_source === 'estimate_shipping_quote'
            ? 'Shipping estimate quote'
            : 'Quotation / Quote';
    const lines = [
        `${sourceLabel} ${row.reference_no || `#${row.id}`}:`,
        '',
        `Reference: ${row.reference_no || '—'}`,
        `Customer name: ${row.customer_name || '—'}`,
        `Freight number: ${row.freight_number || '—'}`,
        `Customer invoice number: ${row.customer_invoice_no || '—'}`,
        `Inv date: ${row.inv_date_label || '—'}`,
        `Quote date: ${row.quote_date_label || '—'}`,
        `Country: ${row.country || '—'}`,
        `Currency: ${row.currency || '—'}`,
        `Total: ${money(row.total, row.currency)}`,
        `Amount due: ${money(row.amount_due, row.currency)}`,
        `Status: ${row.status_label || '—'}`,
    ];
    if (row.chargeable != null) lines.push(`Chargeable: ${row.chargeable}`);
    if (row.payment_terms) lines.push(`Payment terms: ${row.payment_terms}`);
    if (row.quote_validity != null) lines.push(`Quote validity: ${row.quote_validity}`);

    lines.push('', 'Cargo details');
    lines.push(`Product: ${row.product_desc || '—'}`);
    lines.push(`Commodity: ${row.commodity_name || '—'}`);
    lines.push(`Hazardous: ${row.hazardous_label || '—'}`);
    lines.push(`No. of packages: ${row.packages != null ? row.packages : '—'}`);
    lines.push(`Package type: ${row.package_type || '—'}`);
    lines.push(`Gross weight (kgs): ${row.weight != null ? row.weight : '—'}`);
    lines.push(`Dimensions (M3): ${row.dimension != null ? row.dimension : '—'}`);
    lines.push(`Volumetric (kgs): ${row.volumetric_weight != null ? row.volumetric_weight : '—'}`);

    lines.push('', 'Routing details');
    lines.push(`Country of origin: ${row.origin_country || '—'}`);
    lines.push(`Place of receipt: ${row.place_of_receipt || '—'}`);
    lines.push(`Port of loading: ${row.port_of_loading || '—'}`);
    lines.push(`Port of discharge: ${row.port_of_discharge || '—'}`);
    lines.push(`Place of delivery: ${row.place_of_delivery || '—'}`);
    lines.push(`Incoterm: ${row.incoterm || '—'}`);
    lines.push(`Mode of transport: ${row.mode_of_transport || '—'}`);
    lines.push(`Load type: ${row.load_type || '—'}`);
    lines.push(`Transit priority: ${row.transit_priority || '—'}`);
    lines.push(`Insurance: ${row.insurance_label || '—'}`);

    if (row.charge_groups?.length) {
        lines.push('', 'Shipment estimate');
        row.charge_groups.forEach((g) => {
            lines.push(
                `${g.category}: ${money(g.total, row.currency)}${
                    g.vat_incl ? ` (VAT incl ${money(g.vat_incl, row.currency)})` : ''
                }`
            );
        });
    } else if (row.lines?.length) {
        lines.push('', `Charge lines: ${row.lines.length}`);
        row.lines.slice(0, 12).forEach((l, i) => {
            lines.push(
                `${i + 1}. ${l.description || '—'} · ${money(l.final_amount, l.currency || row.currency)}`
            );
        });
    }

    return lines.join('\n');
}

function formatQuoteListResponse(rows, label) {
    if (!rows.length) return `No quotations found for ${label}.`;
    const lines = rows.slice(0, 20).map((q) => {
        const total =
            q.total != null
                ? `${q.currency || ''} ${Number(q.total).toLocaleString()}`.trim()
                : '—';
        const due =
            q.amount_due != null
                ? `${q.currency || ''} ${Number(q.amount_due).toLocaleString()}`.trim()
                : '—';
        return [
            `• ${q.reference_no || '—'}`,
            q.customer_name || '—',
            q.freight_number || '—',
            q.country,
            total,
            `Due ${due}`,
            q.status_label || '—',
        ]
            .filter(Boolean)
            .join(' · ');
    });
    const more = rows.length > 20 ? `\n…and ${rows.length - 20} more.` : '';
    return `Quotations for ${label} (${rows.length} found):\n\n${lines.join('\n')}${more}`;
}

function formatFreightInvoiceResponse(row) {
    if (!row) return 'Freight invoice not found.';
    const money = (v, c) =>
        v == null || v === '' ? '—' : `${c || ''} ${Number(v).toLocaleString()}`.trim();
    const lines = [
        `Freight Invoice ${row.reference_no || `#${row.id}`}:`,
        '',
        `Reference: ${row.reference_no || '—'}`,
        `Customer name: ${row.customer_name || '—'}`,
        `Freight / Order number: ${row.freight_or_order || row.freight_number || row.order_number || '—'}`,
        `Customer ref: ${row.customer_ref || '—'}`,
        `Customer invoice number: ${row.customer_invoice_no || '—'}`,
        `Inv date: ${row.inv_date_label || '—'}`,
        `Quote date: ${row.quote_date_label || '—'}`,
        `Country: ${row.country || '—'}`,
        `Currency: ${row.currency || '—'}`,
        `Total: ${money(row.total, row.currency)}`,
        `Amount due: ${money(row.amount_due, row.currency)}`,
        `Status: ${row.status_label || '—'}`,
    ];
    if (row.chargeable != null) lines.push(`Chargeable: ${row.chargeable}`);
    if (row.payment_terms) lines.push(`Payment terms: ${row.payment_terms}`);
    if (row.quote_validity != null) lines.push(`Quote validity: ${row.quote_validity}`);

    lines.push('', 'Cargo details');
    lines.push(`Product: ${row.product_desc || '—'}`);
    lines.push(`Commodity: ${row.commodity_name || '—'}`);
    lines.push(`Hazardous: ${row.hazardous_label || '—'}`);
    lines.push(`No. of packages: ${row.packages != null ? row.packages : '—'}`);
    lines.push(`Package type: ${row.package_type || '—'}`);
    lines.push(`Gross weight (kgs): ${row.weight != null ? row.weight : '—'}`);
    lines.push(`Dimensions (M3): ${row.dimension != null ? row.dimension : '—'}`);
    lines.push(`Volumetric (kgs): ${row.volumetric_weight != null ? row.volumetric_weight : '—'}`);

    lines.push('', 'Routing details');
    lines.push(`Country of origin: ${row.origin_country || '—'}`);
    lines.push(`Place of receipt: ${row.place_of_receipt || '—'}`);
    lines.push(`Port of loading: ${row.port_of_loading || '—'}`);
    lines.push(`Port of discharge: ${row.port_of_discharge || '—'}`);
    lines.push(`Place of delivery: ${row.place_of_delivery || '—'}`);
    lines.push(`Incoterm: ${row.incoterm || '—'}`);
    lines.push(`Mode of transport: ${row.mode_of_transport || '—'}`);
    lines.push(`Load type: ${row.load_type || '—'}`);
    lines.push(`Transit priority: ${row.transit_priority || '—'}`);
    lines.push(`Insurance: ${row.insurance_label || '—'}`);

    if (row.charge_groups?.length) {
        lines.push('', 'Shipment estimate');
        row.charge_groups.forEach((g) => {
            lines.push(
                `${g.category}: ${money(g.total, row.currency)}${
                    g.vat_incl ? ` (VAT incl ${money(g.vat_incl, row.currency)})` : ''
                }`
            );
        });
    } else if (row.lines?.length) {
        lines.push('', `Charge lines: ${row.lines.length}`);
        row.lines.slice(0, 12).forEach((l, i) => {
            lines.push(
                `${i + 1}. ${l.description || '—'} · ${money(l.final_amount, l.currency || row.currency)}`
            );
        });
    }

    return lines.join('\n');
}

function formatFreightInvoiceListResponse(rows, label) {
    if (!rows.length) return `No freight invoices found for ${label}.`;
    const lines = rows.slice(0, 20).map((inv) => {
        const total =
            inv.total != null
                ? `${inv.currency || ''} ${Number(inv.total).toLocaleString()}`.trim()
                : '—';
        const due =
            inv.amount_due != null
                ? `${inv.currency || ''} ${Number(inv.amount_due).toLocaleString()}`.trim()
                : '—';
        return [
            `• ${inv.reference_no || '—'}`,
            inv.customer_name || '—',
            inv.freight_or_order || inv.freight_number || inv.order_number || '—',
            inv.country,
            total,
            `Due ${due}`,
            inv.status_label || '—',
        ]
            .filter(Boolean)
            .join(' · ');
    });
    const more = rows.length > 20 ? `\n…and ${rows.length - 20} more.` : '';
    return `Freight invoices for ${label} (${rows.length} found):\n\n${lines.join('\n')}${more}`;
}

function formatCashbookResponse(row) {
    if (!row) return 'Cashbook entry not found.';
    const money = (v) => (v == null || v === '' ? '—' : Number(v).toLocaleString());
    const lines = [
        `Cashbook ${row.bank_ref || `#${row.id}`}:`,
        '',
        `Date: ${row.date_label || '—'}`,
        `Bank ref.: ${row.bank_ref || '—'}`,
        `Description of receipt: ${row.description || '—'}`,
        `Receipt: ${money(row.receipt)}`,
        `Payment: ${money(row.payment)}`,
        `Customer: ${row.customer_name || '—'}`,
        `Shipment ref: ${row.shipment_ref || '—'}`,
        `Allocated: ${row.allocated_label || '—'}`,
        `Invoice (POP): ${row.invoice_pop_label || '—'}`,
    ];
    if (row.freight_number) lines.push(`Freight: ${row.freight_number}`);
    return lines.join('\n');
}

function formatCashbookListResponse(rows, label) {
    if (!rows.length) return `No cashbook entries found for ${label}.`;
    const lines = rows.slice(0, 20).map((r) => {
        return [
            `• ${r.date_label || '—'}`,
            r.bank_ref || '—',
            r.description || '—',
            `Receipt ${r.receipt != null ? Number(r.receipt).toLocaleString() : '—'}`,
            r.customer_name || '—',
            r.shipment_ref || '—',
            `Alloc ${r.allocated_label || '—'}`,
            `POP ${r.invoice_pop_label || '—'}`,
        ].join(' · ');
    });
    const more = rows.length > 20 ? `\n…and ${rows.length - 20} more.` : '';
    return `Cashbook for ${label} (${rows.length} found):\n\n${lines.join('\n')}${more}`;
}

function formatSupplierInvoiceResponse(row) {
    if (!row) return 'Supplier invoice not found.';
    const money = (v, c) =>
        v == null || v === '' ? '—' : `${c || ''} ${Number(v).toLocaleString()}`.trim();
    const lines = [
        `Supplier Invoice ${row.reference_no || `#${row.id}`}:`,
        '',
        `Reference: ${row.reference_no || '—'}`,
        `Supplier name: ${row.supplier_name || '—'}`,
        `Waybill: ${row.waybill || '—'}`,
        `Sup invoice number: ${row.supplier_invoice_no || '—'}`,
        `Inv date: ${row.inv_date_label || '—'}`,
        `Due date: ${row.due_date_label || '—'}`,
        `Currency: ${row.currency || '—'}`,
        `Total: ${money(row.total, row.currency)}`,
        `Amount due: ${money(row.amount_due, row.currency)}`,
        `Status: ${row.status_label || '—'}`,
    ];
    if (row.chargeable != null) lines.push(`Chargeable: ${row.chargeable}`);

    lines.push('', 'Shipment / cargo');
    lines.push(`Carrier: ${row.carrier || '—'}`);
    lines.push(`Vessel: ${row.vessel || '—'}`);
    lines.push(`ETD: ${row.etd_label || '—'}`);
    lines.push(`ATD: ${row.atd_label || '—'}`);
    lines.push(`Status: ${row.shipment_status || '—'}`);
    lines.push(`Origin agent: ${row.origin_agent || '—'}`);
    lines.push(`Destination agent: ${row.destination_agent || '—'}`);
    lines.push(`Freight mode: ${row.freight_mode || '—'}`);

    lines.push('', 'Routing details');
    lines.push(`Port of loading: ${row.port_of_loading || '—'}`);
    lines.push(`Port of discharge: ${row.port_of_discharge || '—'}`);
    lines.push(`Container: ${row.container || '—'}`);
    lines.push(`Load: ${row.load_type || '—'}`);
    lines.push(`Release type: ${row.release_type || '—'}`);
    lines.push(`Origin country: ${row.origin_country || '—'}`);
    lines.push(`Destination country: ${row.destination_country || '—'}`);

    if (row.charge_groups?.length) {
        lines.push('', 'Shipment estimate');
        row.charge_groups.forEach((g) => {
            lines.push(
                `${g.category}: ${money(g.total, row.currency)}${
                    g.vat_incl ? ` (VAT incl ${money(g.vat_incl, row.currency)})` : ''
                }`
            );
        });
    } else if (row.lines?.length) {
        lines.push('', `Charge lines: ${row.lines.length}`);
        row.lines.slice(0, 12).forEach((l, i) => {
            lines.push(
                `${i + 1}. ${l.description || '—'} · ${money(l.final_amount, l.currency || row.currency)}`
            );
        });
    }

    return lines.join('\n');
}

function formatSupplierInvoiceListResponse(rows, label) {
    if (!rows.length) return `No supplier invoices found for ${label}.`;
    const lines = rows.slice(0, 20).map((inv) => {
        const total =
            inv.total != null
                ? `${inv.currency || ''} ${Number(inv.total).toLocaleString()}`.trim()
                : '—';
        const due =
            inv.amount_due != null
                ? `${inv.currency || ''} ${Number(inv.amount_due).toLocaleString()}`.trim()
                : '—';
        return [
            `• ${inv.reference_no || '—'}`,
            inv.supplier_name || '—',
            inv.waybill || '—',
            total,
            `Due ${due}`,
            inv.status_label || '—',
        ]
            .filter(Boolean)
            .join(' · ');
    });
    const more = rows.length > 20 ? `\n…and ${rows.length - 20} more.` : '';
    return `Supplier invoices for ${label} (${rows.length} found):\n\n${lines.join('\n')}${more}`;
}

function formatCollectionDeliveryResponse(row) {
    if (!row) return 'Collection / Delivery entry not found.';
    const lines = [
        `Collection / Delivery ${row.freight_number || ''}:`,
        '',
        `Customer: ${row.customer_name || '—'}`,
        `Freight: ${row.freight_number || '—'}`,
        `Order: ${row.order_number || '—'}`,
        `Type: ${row.type_label || '—'}`,
        `Mode: ${row.mode_label || '—'}`,
        `Collection: ${row.collection_flag || '—'}`,
        `Delivery: ${row.delivery_flag || '—'}`,
        `Collection status: ${row.collection_status || '—'}`,
        `Delivery status: ${row.delivery_status || '—'}`,
        `Collection supplier: ${row.collection_supplier || '—'}`,
        `Origin: ${row.origin_country || '—'}`,
        `Destination: ${row.destination_country || '—'}`,
    ];
    lines.push('', 'Edit details');
    if (!row.has_detail) {
        lines.push('No edit form saved yet for this freight.');
        return lines.join('\n');
    }
    lines.push(`Customer ref: ${row.customer_ref || '—'}`);
    lines.push(`Date picked up: ${row.date_picked_up_label || '—'}`);
    lines.push(`Supplier name: ${row.supplier_name || '—'}`);
    lines.push(`Contact person: ${row.supplier_contact_person || '—'}`);
    lines.push(`Contact number: ${row.supplier_contact || '—'}`);
    lines.push(`Pickup address: ${row.pickup_address || '—'}`);
    lines.push(`Create new warehouse order: ${row.create_new_warehouse_order || '—'}`);
    lines.push(`Warehouse number: ${row.warehouse_number || '—'}`);
    lines.push(`Warehouse order ID: ${row.warehouse_order_id != null ? row.warehouse_order_id : '—'}`);
    lines.push(`Courier waybill ref: ${row.courier_waybill_ref || '—'}`);
    lines.push(`Box marking: ${row.box_marking || '—'}`);
    lines.push(`Package type: ${row.package_type || '—'}`);
    lines.push(`Goods description: ${row.goods_description || '—'}`);
    lines.push(`Total packages: ${row.total_packages != null ? row.total_packages : '—'}`);
    lines.push(`Total CBM: ${row.total_cbm != null ? row.total_cbm : '—'}`);
    lines.push(`Total weight (kg): ${row.total_weight != null ? row.total_weight : '—'}`);
    lines.push(`Package comments: ${row.package_comments || '—'}`);
    lines.push(`Hazardous: ${row.hazardous_label || '—'}`);
    lines.push(`Hazardous description: ${row.hazardous_description || '—'}`);
    lines.push(`Costs to collect: ${row.costs_to_collect != null ? row.costs_to_collect : '—'}`);
    lines.push(`Handling cost: ${row.handling_cost != null ? row.handling_cost : '—'}`);
    lines.push(`Warehouse cost: ${row.warehouse_cost != null ? row.warehouse_cost : '—'}`);
    lines.push(`Warehouse comment: ${row.warehouse_comment || '—'}`);
    return lines.join('\n');
}

function formatCollectionDeliveryListResponse(rows, label) {
    if (!rows.length) return `No collection/delivery entries found for ${label}.`;
    const lines = rows.slice(0, 25).map((r) => {
        return [
            `• ${r.customer_name || '—'}`,
            `${r.freight_number || '—'} | ${r.order_number || '—'}`,
            `Type ${r.type_label || '—'}`,
            `Collection ${r.collection_flag || '—'}`,
            r.origin_country,
            r.destination_country,
            `(${r.mode_label || '—'})`,
            `Status ${r.status_label || '—'}`,
        ]
            .filter(Boolean)
            .join(' · ');
    });
    const more = rows.length > 25 ? `\n…and ${rows.length - 25} more. Ask by freight (F-…) or customer name.` : '';
    return `Collection / Delivery for ${label} (${rows.length} found):\n\n${lines.join('\n')}${more}`;
}

function formatStaffProfileResponse(staff) {
    if (!staff) return 'Staff member not found.';
    const lines = [
        `Edit Staff · ${staff.full_name || staff.id}:`,
        '',
        `Email address: ${staff.email || '—'}`,
        `Full name: ${staff.full_name || '—'}`,
        `Country code: ${staff.country_code_label || staff.country_code || '—'}`,
        `Phone number: ${staff.phone_no || '—'}`,
        `Country: ${staff.country_name || '—'}`,
        `Assign roles: ${staff.assigned_roles_label || '—'}`,
        `New password: ${staff.password_label || 'Not shown (••••••••• / leave blank to keep current)'}`,
        `Select country data: ${staff.access_countries_label || '—'}`,
        `Status: ${staff.status_label || '—'}`,
        `Staff ID: ${staff.id}`,
    ];

    const menus = staff.permission_menus || [];
    if (menus.length) {
        lines.push('', `Staff permissions (${staff.permission_count || 0}):`);
        menus.slice(0, 20).forEach((menu) => {
            const routes = (menu.routes || []).slice(0, 8).join(', ');
            const extra = (menu.routes || []).length > 8 ? ` (+${menu.routes.length - 8} more)` : '';
            lines.push(`• ${menu.menu_name}: ${routes || '—'}${extra}`);
        });
        if (menus.length > 20) lines.push(`…and ${menus.length - 20} more menus.`);
    } else {
        lines.push(
            '',
            `Staff permissions: ${staff.permission_count ? `${staff.permission_count} assigned` : 'None'}`
        );
    }
    return lines.join('\n');
}

function formatStaffListResponse(rows, label) {
    if (!rows.length) return `No staff found for ${label}.`;
    const lines = rows.slice(0, 20).map((s) => {
        return [
            `• ${s.full_name || '—'}`,
            s.email,
            s.assigned_roles_label,
            s.country_name,
            `ID ${s.id}`,
        ]
            .filter(Boolean)
            .join(' · ');
    });
    const more = rows.length > 20 ? `\n…and ${rows.length - 20} more.` : '';
    return `Staff for ${label} (${rows.length} found):\n\n${lines.join('\n')}${more}`;
}

function formatTaskResponse(task) {
    if (!task) return 'Task not found.';
    const lines = [
        `Task Manager · ${task.task_type_label || task.task_type} #${task.id}:`,
        '',
        `Name: ${task.name || '—'}`,
    ];
    if (task.task_type === 'freight') lines.push(`Freight number: ${task.freight_number || '—'}`);
    else if (task.task_type === 'clearance') lines.push(`Clearance number: ${task.clearance_number || '—'}`);
    else lines.push(`Title: ${task.title || '—'}`);
    lines.push(`Due date: ${task.due_date_label || '—'}`);
    lines.push(`Notes: ${task.notes || '—'}`);
    lines.push(`Status: ${task.status_label || '—'}`);
    lines.push(`Action required: ${task.action_required_label || '—'}`);
    if (task.priority) lines.push(`Priority: ${task.priority}`);
    if (task.description && task.task_type === 'custom') lines.push(`Description: ${task.description}`);
    return lines.join('\n');
}

function formatTaskListResponse(rows, label) {
    if (!rows.length) return `No Task Manager entries found for ${label}.`;
    const lines = rows.slice(0, 25).map((t) => {
        const ref =
            t.task_type === 'freight'
                ? t.freight_number
                : t.task_type === 'clearance'
                  ? t.clearance_number
                  : t.title;
        return [
            `${t.sr_no}.`,
            t.task_type_label,
            t.name || '—',
            ref || '—',
            t.due_date_label || '—',
            t.status_label || '—',
            t.action_required || null,
        ]
            .filter(Boolean)
            .join(' · ');
    });
    const more = rows.length > 25 ? `\n…and ${rows.length - 25} more.` : '';
    return `Task Manager · ${label} (${rows.length} found):\n\n${lines.join('\n')}${more}`;
}

function formatContactEnquiryResponse(row) {
    if (!row) return 'Contact enquiry not found.';
    return [
        `Contact Us Enquiry #${row.id}:`,
        '',
        `Name: ${row.name || '—'}`,
        `Country: ${row.country || '—'}`,
        `Email: ${row.email || '—'}`,
        `Phone No: ${row.phone_no || '—'}`,
        `Subject: ${row.subject || '—'}`,
        `Nature of Enquiry: ${row.nature_of_enquiry || '—'}`,
        `Message: ${row.message || '—'}`,
        row.created_label ? `Created: ${row.created_label}` : null,
    ]
        .filter((line) => line != null)
        .join('\n');
}

function formatContactEnquiryListResponse(rows, label) {
    if (!rows.length) return `No Contact Us enquiries found for ${label}.`;
    const lines = rows.slice(0, 25).map((r) =>
        [`• #${r.id}`, r.name, r.country, r.email, r.nature_of_enquiry, r.subject]
            .filter(Boolean)
            .join(' · ')
    );
    const more = rows.length > 25 ? `\n…and ${rows.length - 25} more.` : '';
    return `Contact Us Enquiries · ${label} (${rows.length} found):\n\n${lines.join('\n')}${more}`;
}

function formatCountryOriginResponse(row) {
    if (!row) return 'Country of Origin not found.';
    return [
        `Country of Origin · ${row.country_name || 'Unknown'} (#${row.id}):`,
        '',
        `Country Name: ${row.country_name || '—'}`,
        `Cities: ${row.cities_label || '—'}`,
        `Sea Ports: ${row.sea_ports_label || '—'}`,
        `Air Ports: ${row.air_ports_label || '—'}`,
        `Land Ports: ${row.land_ports_label || '—'}`,
    ].join('\n');
}

function formatCountryOriginListResponse(rows, label) {
    if (!rows.length) return `No Country of Origin entries found for ${label}.`;
    const lines = rows.slice(0, 25).map((r) =>
        [`• #${r.id}`, r.country_name || 'Unknown', r.cities_label !== '—' ? `cities: ${r.cities_label}` : null]
            .filter(Boolean)
            .join(' · ')
    );
    const more = rows.length > 25 ? `\n…and ${rows.length - 25} more.` : '';
    return `Country of Origin · ${label} (${rows.length} found):\n\n${lines.join('\n')}${more}`;
}

function formatPartnerResponse(row) {
    if (!row) return 'Partner not found.';
    return [
        `${row.partner_type_label || 'Partner'} · ${row.full_name || '—'} (#${row.id}):`,
        '',
        `Email: ${row.email || '—'}`,
        `Full Name: ${row.full_name || '—'}`,
        `Phone Number: ${row.phone || '—'}`,
        `Country: ${row.country_name || '—'}`,
        `Address: ${row.address || '—'}`,
        row.contact_person ? `Contact person: ${row.contact_person}` : null,
        row.created_label ? `Created: ${row.created_label}` : null,
    ]
        .filter((line) => line != null)
        .join('\n');
}

function formatPartnerListResponse(rows, label) {
    if (!rows.length) return `No partners found for ${label}.`;
    const typeLabel = rows[0]?.partner_type_label || 'Partners';
    const lines = rows.slice(0, 25).map((r) =>
        [`• #${r.id}`, r.full_name, r.email, r.phone, r.country_name]
            .filter(Boolean)
            .join(' · ')
    );
    const more = rows.length > 25 ? `\n…and ${rows.length - 25} more.` : '';
    return `${typeLabel} · ${label} (${rows.length} found):\n\n${lines.join('\n')}${more}`;
}

function formatCompanyAddressResponse(row) {
    if (!row) return 'Company address not found.';
    return [
        `Company Address · ${row.company_name} (#${row.id}):`,
        '',
        `Company Name: ${row.company_name || '—'}`,
        `Email: ${row.email || '—'}`,
        `Country: ${row.country || '—'}`,
        `Telephone: ${row.telephone || '—'}`,
        `Registration No / Tax No: ${row.registration_tax_label || '—'}`,
        `Address: ${row.address || '—'}`,
    ].join('\n');
}

function formatCompanyAddressListResponse(rows, label) {
    if (!rows.length) return `No Company Addresses found for ${label}.`;
    const lines = rows.slice(0, 25).map((r) =>
        [`• #${r.id}`, r.company_name, r.country, r.email, r.telephone].filter(Boolean).join(' · ')
    );
    const more = rows.length > 25 ? `\n…and ${rows.length - 25} more.` : '';
    return `Company Addresses · ${label} (${rows.length} found):\n\n${lines.join('\n')}${more}`;
}

function formatClientKpiResponse(row) {
    if (!row) return 'Client KPI not found.';
    return [
        `Client KPI · ${row.name}:`,
        '',
        `Name: ${row.name || '—'}`,
        `Freight: ${row.freight != null ? row.freight : '—'}`,
        `Orders: ${row.orders != null ? row.orders : '—'}`,
        `Delivered orders: ${row.delivered_orders != null ? row.delivered_orders : '—'}`,
        `Total amount: ${row.total_amount_label || row.total_amount || '—'}`,
        `Client ID: ${row.client_id}`,
    ].join('\n');
}

function formatClientKpiListResponse(rows, label) {
    if (!rows.length) return `No Client KPI rows found for ${label}.`;
    const lines = rows.slice(0, 20).map((r) => {
        return [
            `${r.sr_no}.`,
            r.name || '—',
            `Freight ${r.freight}`,
            `Orders ${r.orders}`,
            `Delivered ${r.delivered_orders}`,
            `Amount ${r.total_amount_label || r.total_amount}`,
        ].join(' · ');
    });
    const more = rows.length > 20 ? `\n…and ${rows.length - 20} more.` : '';
    return `Client KPI for ${label} (${rows.length} found):\n\n${lines.join('\n')}${more}`;
}

module.exports = {
    formatFreightResponse,
    formatSupplierResponse,
    formatSupplierProfileResponse,
    formatSupplierListResponse,
    formatInvoiceResponse,
    formatSageInvoiceResponse,
    formatSageInvoiceListResponse,
    formatClientDisambiguation,
    formatClientResponse,
    formatClientListResponse,
    formatFreightListResponse,
    formatOrderResponse,
    formatOrderListResponse,
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
    formatDisputeResponse,
    formatDisputeListResponse,
    formatReleaseResponse,
    formatReleaseListResponse,
    formatQuoteResponse,
    formatQuoteListResponse,
    formatFreightInvoiceResponse,
    formatFreightInvoiceListResponse,
    formatCashbookResponse,
    formatCashbookListResponse,
    formatSupplierInvoiceResponse,
    formatSupplierInvoiceListResponse,
    formatCollectionDeliveryResponse,
    formatCollectionDeliveryListResponse,
    formatStaffProfileResponse,
    formatStaffListResponse,
    formatTaskResponse,
    formatTaskListResponse,
    formatContactEnquiryResponse,
    formatContactEnquiryListResponse,
    formatCountryOriginResponse,
    formatCountryOriginListResponse,
    formatPartnerResponse,
    formatPartnerListResponse,
    formatCompanyAddressResponse,
    formatCompanyAddressListResponse,
    formatClientKpiResponse,
    formatClientKpiListResponse,
};
