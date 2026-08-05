const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { TOOL_DEFINITIONS, executeTool } = require('./tools');
const {
    extractFreightNumber,
    extractFreightFocus,
    extractFreightListClientName,
    extractOrderNumber,
    extractOrderListClientName,
    extractOrderFocus,
    extractBatchNumber,
    extractBatchFocus,
    extractClearanceNumber,
    extractClearanceFocus,
    extractWaybill,
    extractWarehouseOrderId,
    extractClientNameForEntity,
    extractShipmentFocus,
    extractClearanceOrderSearchTerm,
    refersToPriorFreight,
    isListFreightsRequest,
    isListOrdersRequest,
    isCountFreightsRequest,
    isCountOrdersRequest,
    isInvoiceRequest,
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
    isClientLookupRequest,
    isCountClientsRequest,
    extractCustomerNumber,
    extractClientLookupName,
    extractClientId,
    extractClientFocus,
    extractSageDocumentNumber,
    extractSageInvoiceSearchTerm,
    extractSageInvoiceFocus,
    isSageInvoiceRequest,
    isCountSageInvoicesRequest,
    extractDisputeId,
    extractDisputeFocus,
    extractDisputeSearchTerm,
    isDisputeRequest,
    isCountDisputeRequest,
    extractReleaseFocus,
    extractReleaseSearchTerm,
    isReleaseDashboardRequest,
    isCountReleaseDashboardRequest,
    extractQuoteReference,
    extractQuoteFocus,
    extractQuoteSearchTerm,
    extractFreightInvoiceReference,
    extractFreightInvoiceFocus,
    extractFreightInvoiceSearchTerm,
    extractCashbookBankRef,
    extractCashbookFocus,
    extractCashbookSearchTerm,
    extractSupplierInvoiceReference,
    extractSupplierInvoiceFocus,
    extractSupplierInvoiceSearchTerm,
    extractCollectionDeliveryFocus,
    extractCollectionDeliverySearchTerm,
    extractTaskType,
    extractTaskStatus,
    extractTaskFocus,
    extractTaskSearchTerm,
    extractContactEnquiryNature,
    extractContactEnquiryFocus,
    extractContactEnquirySearchTerm,
    extractCountryOriginFocus,
    extractCountryOriginSearchTerm,
    extractPartnerType,
    extractPartnerFocus,
    extractPartnerSearchTerm,
    extractCompanyAddressFocus,
    extractCompanyAddressSearchTerm,
    extractSupplierName,
    extractSupplierFocus,
    extractStaffSearchTerm,
    extractStaffFocus,
    extractClientKpiSearchTerm,
    extractClientKpiFocus,
} = require('./messageParser');
const { getLastFreightNumber } = require('./conversationStore');

let genAI = null;

const COOLDOWN_FILE = path.join(__dirname, '../../.gemini-cooldown.json');

/** Skip Gemini calls until this timestamp after 429 / quota errors */
let geminiCooldownUntil = 0;
let geminiCooldownReason = null;

function loadCooldownFromDisk() {
    try {
        if (!fs.existsSync(COOLDOWN_FILE)) return;
        const data = JSON.parse(fs.readFileSync(COOLDOWN_FILE, 'utf8'));
        if (data?.until && Number(data.until) > Date.now()) {
            geminiCooldownUntil = Number(data.until);
            geminiCooldownReason = data.reason || 'quota';
        }
    } catch (_) {
        // ignore
    }
}

function saveCooldownToDisk() {
    try {
        fs.writeFileSync(
            COOLDOWN_FILE,
            JSON.stringify({
                until: geminiCooldownUntil,
                reason: geminiCooldownReason,
                savedAt: new Date().toISOString(),
            }),
            'utf8'
        );
    } catch (_) {
        // ignore
    }
}

function clearCooldownFile() {
    try {
        if (fs.existsSync(COOLDOWN_FILE)) fs.unlinkSync(COOLDOWN_FILE);
    } catch (_) {
        // ignore
    }
}

loadCooldownFromDisk();

function getClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    if (!genAI) genAI = new GoogleGenerativeAI(apiKey);
    return genAI;
}

function getModelCandidates() {
    // Paid Gemini API keys (often AQ.*) may 404 on gemini-2.0/2.5 aliases even when listed.
    // Prefer *-latest / Gemini 3.x IDs that support generateContent for those keys.
    const primary = process.env.GEMINI_MODEL || 'gemini-flash-latest';
    const fallbacks = String(
        process.env.GEMINI_FALLBACK_MODELS ||
            'gemini-3.6-flash,gemini-3.1-flash-lite,gemini-flash-lite-latest,gemini-pro-latest'
    )
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean);
    return [...new Set([primary, ...fallbacks])];
}

function toGeminiTools() {
    return [{
        functionDeclarations: TOOL_DEFINITIONS.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
        })),
    }];
}

function buildSystemInstruction(ctx) {
    const role = ctx.isAdmin || ctx.hasFullAccess
        ? 'admin'
        : ctx.isStaff
            ? 'staff'
            : ctx.isCustomer
                ? 'customer'
                : 'user';

    return `You are Workspace AI for a shipping/logistics company. Always use tools for live data — never invent freights, orders, invoices, warehouse, batches, shipments, clearances, disputes, releases, or clients.

Current user role: ${role} (user id ${ctx.userId}).
Respect permissions: customers only see their own data; staff see scoped freights/orders.

Style:
- Be concise (1–3 short sentences for chat; use tool summaries for data).
- For greetings ("hi", "hello", "how are you", "are you AI?"): reply briefly. Do NOT paste a long module menu.
- Example greeting: "Hi — I'm Workspace AI. Share a freight/order/quote number or ask what you need."
- Example "are you AI?": "Yes — I'm Workspace AI for Workspace lookups. What should I look up?"
- Only list capabilities when the user asks "what can you do" / "help" — keep that list short.

Tools:
- getFreightFullDetails — Order Freight Detail by number (F-20260722005). Pass focus for: product_desc, estimate_amount, paid, supplier, client, route, status, sales_rep, commodity, waybill, freight_number, shipper, consignee, weight, dimension, packages, package_type, hazardous, volumetric_weight, chargeable_weight, port_of_loading, port_of_discharge, pickup_address, delivery_address, incoterm.
- getOrderDetails — one order by number (OR000253). Pass focus="status" for status-only questions.
- findClientsByName — resolve a person/company name. Set intent to client, freights, invoices, orders, warehouse_orders, batches, shipments, clearances, clearance_orders, or count_* variants.
- getClientDetails / countClients — Customer Profile Details by Customer ID (CE21170 / S20832), Client ID, name, or email: address, phones, contact person, company/importer/tax refs, country, related freights.
- getSageInvoiceDetails / searchSageInvoices / countSageInvoices — Sage Invoice list (ADZWINV…: document number, customer name, customer ref, date, total, upload, Invoice AD).
- getDisputeDetails / searchDisputes / countDisputes — Customer Query / Dispute (D-202638, name search, Pending/Resolved).
- getReleaseDashboardDetails / searchReleaseDashboard / countReleaseDashboard — Release Dashboard (OR000893: clearing, cargo inspection, payment, release instruction, delivery, Open/Close).
- getQuoteDetails / searchQuotes / countQuotes — Quotation / Freight Quote Estimate AND shipping estimate quotes (ADQO… in freight_quote_estimate or estimate_shipping_quote: customer, freight number, total, amount due, unpaid/paid, cargo, routing).
- getFreightInvoiceDetails / searchFreightInvoices / countFreightInvoices — Freight Invoice (ADINV10002: customer, freight/order, total, amount due, unpaid/paid, cargo, routing, charge groups).
- getCashbookDetails / searchCashbook / countCashbook — Cashbook (bank ref 20260729003: date, description, receipt, payment, customer, shipment ref, allocated, Invoice POP).
- getSupplierInvoiceDetails / searchSupplierInvoices / countSupplierInvoices — Supplier Shipment Invoice (SUPINV10015: supplier, waybill, total, amount due, unpaid/paid, carrier/vessel, routing, charge groups).
- getCollectionDeliveryDetails / searchCollectionDelivery / countCollectionDelivery — Collection and Delivery module (F-… / OR000…: type, collection/delivery flags, supplier, countries, mode, Pending status, pickup/packages/costs form).
- getTaskDetails / searchTasks / countTasks — Task Manager (freight tasks: Name, Freight Number, Due Date, Notes, Status, Action Required; clearance tasks: Clearance Number; custom tasks: Title).
- getContactEnquiryDetails / searchContactEnquiries / countContactEnquiries — Contact Us Enquiries (Name, Country, Email, Phone No, Subject, Nature of Enquiry, Message). Not the same as Customer Query / Dispute.
- getCountryOriginDetails / searchCountryOrigins / countCountryOrigins — Country of Origin module (Country Name, Cities, Sea Ports, Air Ports, Land Ports). Not freight/supplier "country of origin" field unless a freight/supplier is named.
- getPartnerDetails / searchPartners / countPartners — Custom Agent, Freight Forwarder, Groupage Warehouse, Transporter (Email, Full Name, Phone Number, Country, Address). Pass partnerType.
- getCompanyAddressDetails / searchCompanyAddresses / countCompanyAddresses — Company Addresses (Company Name, Email, Country, Telephone, Registration No / Tax No, Address).
- getFreightsByClient / getOrdersByClient / getOrdersByFreight — list freights or orders.
- countFreights / countOrders — totals (optional clientId).
- getWarehouseOrderDetails / getWarehouseOrders / countWarehouseOrders — warehouse assign orders (by id, client, freight, or OR000…).
- getBatchDetails / listBatches / countBatches — batches by batch_number (e.g. ADAWB2405032).
- getShipmentDetails / getShipments / countShipments — shipment form by waybill/load (DL26S…): vessel, carrier, ETD, ETA, agents, ports, container, seal, assigned orders/clearances.
- getClearanceDetails / getClearances / countClearances — Update Custom Clearance by C-… (mode, client, shipper/consignee, import/export, ports, cargo, packing, weight).
- getClearanceOrders / countClearanceOrders — Order Clearance list (client, C-…, date, goods, origin/destination, action).
- getInvoicesByClient / getMyInvoices / findSupplier / getSupplierDetails / countSuppliers — invoices and Manage Supplier (Edit Supplier profile: company, service type, address, countries, email, phone; never password).
- getStaffDetails / searchStaff / countStaff — Manage Staff / Edit Staff (email, full name, phone, country, roles, access countries, permission menus; never password). Admin/full-access for others; staff can view self.
- searchClientKpi / getClientKpiDetails / countClientKpi — Client KPI module (Name, Freight, Orders, Delivered Order, Total Amount).

Examples:
- "what is status of OR0001282?" → getOrderDetails(orderNumber="OR0001282", focus="status")
- "warehouse orders for John" → findClientsByName(name="John", intent="warehouse_orders")
- "warehouse of OR0001227" / "warehouse status of F-…" → getWarehouseOrders
- "status of batch ADAWB2405032" → getBatchDetails(batchNumber="ADAWB2405032", focus="status")
- "origin of ADAWB2405032" / "route of batch ADAWB…" → getBatchDetails(..., focus="origin"|"route")
- "shipment waybill DL26S0000776" / "vessel of DL26S0000776" → getShipmentDetails
- "status of C-202607001" / "product description of C-…" / "port of loading of C-…" → getClearanceDetails
- "clearance order C-202607081" / "order clearance for Dominic" → getClearanceOrders
- "count clearance orders" → countClearanceOrders()
- "count warehouse orders" / "count batches" / "count shipments" / "count clearances" → matching count* tools
- "find client Simon" / "customer CE21170" / "client 20135" / "customer profile central agriculture" → getClientDetails or findClientsByName(intent="client")
- "contact person of customer CE21170" / "related freights for CE21170" → getClientDetails with focus
- "count clients" → countClients()
- "sage invoice ADZWINV000637" → getSageInvoiceDetails
- "total of ADZWINV000637" / "customer ref of ADZWINV000637" → getSageInvoiceDetails with focus
- "find sage invoice Quantrix" / "sage invoices for Cash Client" → searchSageInvoices
- "show sage invoices" → searchSageInvoices (recent list)
- "count sage invoices" → countSageInvoices()
- "dispute D-202638" / "outcome of D-202635" → getDisputeDetails
- "disputes for Vusani" / "pending disputes" → searchDisputes
- "count disputes" → countDisputes()
- "release dashboard OR000893" / "payment of release OR000893" → getReleaseDashboardDetails
- "open releases" / "release dashboard for HC Water" → searchReleaseDashboard
- "count release dashboard" → countReleaseDashboard()
- "quote ADQO10284" / "total of ADQO10284" → getQuoteDetails
- "quotes for Barry" / "unpaid quotes" / "quote of F-20260722005" → searchQuotes
- "count quotes" → countQuotes()
- "freight invoice ADINV10002" / "total of ADINV10002" → getFreightInvoiceDetails
- "freight invoices for Neha" / "unpaid freight invoices" → searchFreightInvoices
- "count freight invoices" → countFreightInvoices()
- "cashbook 20260729001" / "receipt of 20260729001" → getCashbookDetails
- "cashbook for Wahied" / "allocated cashbook" / "show cashbook" → searchCashbook
- "count cashbook" → countCashbook()
- "supplier invoice SUPINV10015" / "total of SUPINV10015" → getSupplierInvoiceDetails
- "supplier invoices for Nimbus" / "unpaid supplier invoices" → searchSupplierInvoices
- "count supplier invoices" → countSupplierInvoices()
- "collection of F-20260723003" / "status of collection F-20260727009" → getCollectionDeliveryDetails
- "collections for Wahied" / "pending collections" / "show collection and delivery" → searchCollectionDelivery
- "count collections" → countCollectionDelivery()
- "freight tasks" / "clearance tasks" / "custom tasks" / "pending tasks" → searchTasks
- "tasks for Santosh" / "task manager F-20260721004" → searchTasks
- "count tasks" → countTasks()
- "contact us enquiries" / "enquiry ttttt2@gmail.com" / "nature of enquiry Sales" → searchContactEnquiries
- "count contact enquiries" → countContactEnquiries()
- "country of origin Austria" / "cities of Austria origin" / "sea ports of Zimbabwe" → getCountryOriginDetails / searchCountryOrigins
- "count countries of origin" → countCountryOrigins()
- "custom agents" / "freight forwarders" / "groupage warehouses" / "transporters" → searchPartners
- "custom agent Brett Lee" / "transporter Micky" → searchPartners
- "count transporters" → countPartners(partnerType="transporter")
- "company addresses" / "company address South Africa" / "company address Asia Direct" → searchCompanyAddresses
- "count company addresses" → countCompanyAddresses()
- "count clients" → countClients()
- "count total freight" → countFreights()
- "show all freights of client Sarah" → findClientsByName(name="Sarah", intent="freights")
- "show orders for John" → findClientsByName(name="John", intent="orders")
- "do we have supplier Acme?" / "supplier SANBRO" / "edit supplier Asher" → findSupplier / getSupplierDetails
- "email of supplier 32" / "type of service of supplier SANBRO" → findSupplier with focus
- "count suppliers" → countSuppliers()
- "staff Tshegofatso" / "edit staff support.imports1@asiadirect.africa" → searchStaff / getStaffDetails
- "permissions of staff Tshegofatso" / "roles of staff …" → searchStaff with focus
- "count staff" → countStaff()
- "client KPI" / "show client KPI" / "client KPI for TGOOD" → searchClientKpi
- "total amount of client KPI for TGOOD" / "delivered orders of client KPI …" → searchClientKpi with focus
- "count client KPI" → countClientKpi()
- "what is estimation amount of F-20260730008?" → getFreightFullDetails(..., focus="estimate_amount")

Be concise. Prefer the tool summary. If a tool already returns a clear answer, you may keep that wording.`;
}

function enrichToolArgs(callName, args, message, sessionId) {
    const next = { ...(args || {}) };

    if (callName === 'getFreightFullDetails' || callName === 'get_freight_full_details') {
        if (!next.freightNumber) {
            next.freightNumber = extractFreightNumber(message) || getLastFreightNumber(sessionId);
        }
        if (!next.focus) {
            next.focus = extractFreightFocus(message) || undefined;
        }
    }

    if (callName === 'getOrderDetails' || callName === 'get_order_details') {
        if (!next.orderNumber) {
            next.orderNumber = extractOrderNumber(message) || undefined;
        }
        if (!next.focus) {
            next.focus = extractOrderFocus(message) || undefined;
        }
    }

    if (callName === 'getOrdersByFreight' || callName === 'get_orders_by_freight') {
        if (!next.freightNumber) {
            next.freightNumber = extractFreightNumber(message) || getLastFreightNumber(sessionId);
        }
    }

    if (callName === 'getWarehouseOrderDetails' || callName === 'get_warehouse_order_details') {
        if (!next.warehouseOrderId) {
            next.warehouseOrderId = extractWarehouseOrderId(message) || undefined;
        }
    }

    if (callName === 'getWarehouseOrders' || callName === 'get_warehouse_orders') {
        if (!next.freightNumber) {
            next.freightNumber =
                extractFreightNumber(message) ||
                (refersToPriorFreight(message) ? getLastFreightNumber(sessionId) : null) ||
                undefined;
        }
        if (!next.orderNumber) next.orderNumber = extractOrderNumber(message) || undefined;
    }

    if (callName === 'getBatchDetails' || callName === 'get_batch_details') {
        if (!next.batchNumber) next.batchNumber = extractBatchNumber(message) || undefined;
        if (!next.focus) next.focus = extractBatchFocus(message) || undefined;
    }

    if (callName === 'getShipmentDetails' || callName === 'get_shipment_details') {
        if (!next.waybill) next.waybill = extractWaybill(message) || undefined;
        if (!next.focus) next.focus = extractShipmentFocus(message) || undefined;
    }

    if (callName === 'getShipments' || callName === 'get_shipments') {
        if (!next.freightNumber) {
            next.freightNumber =
                extractFreightNumber(message) ||
                (refersToPriorFreight(message) ? getLastFreightNumber(sessionId) : null) ||
                undefined;
        }
    }

    if (callName === 'getClearanceDetails' || callName === 'get_clearance_details') {
        if (!next.clearanceNumber) next.clearanceNumber = extractClearanceNumber(message) || undefined;
        if (!next.focus) next.focus = extractClearanceFocus(message) || undefined;
    }

    if (callName === 'getClearances' || callName === 'get_clearances') {
        if (!next.freightNumber) {
            next.freightNumber =
                extractFreightNumber(message) ||
                (refersToPriorFreight(message) ? getLastFreightNumber(sessionId) : null) ||
                undefined;
        }
    }

    if (callName === 'getClearanceOrders' || callName === 'get_clearance_orders') {
        if (!next.clearanceNumber) next.clearanceNumber = extractClearanceNumber(message) || undefined;
        if (!next.search && !next.clearanceNumber && !next.clientId) {
            next.search =
                extractClearanceOrderSearchTerm(message) ||
                extractClientNameForEntity(message, 'clearance order') ||
                extractClientNameForEntity(message, 'order clearance') ||
                undefined;
        }
    }

    if (callName === 'getSageInvoiceDetails' || callName === 'get_sage_invoice_details') {
        if (!next.documentNumber) {
            next.documentNumber = extractSageDocumentNumber(message) || undefined;
        }
        if (!next.focus) {
            next.focus = extractSageInvoiceFocus(message) || undefined;
        }
    }

    if (callName === 'searchSageInvoices' || callName === 'search_sage_invoices') {
        if (!next.search) {
            next.search =
                extractSageInvoiceSearchTerm(message) ||
                extractSageDocumentNumber(message) ||
                undefined;
        }
    }

    if (callName === 'getDisputeDetails' || callName === 'get_dispute_details') {
        if (!next.disputeId) {
            next.disputeId = extractDisputeId(message) || undefined;
        }
        if (!next.focus) {
            next.focus = extractDisputeFocus(message) || undefined;
        }
    }

    if (callName === 'searchDisputes' || callName === 'search_disputes') {
        if (!next.search) {
            next.search =
                extractDisputeSearchTerm(message) ||
                extractDisputeId(message) ||
                extractFreightNumber(message) ||
                extractOrderNumber(message) ||
                undefined;
        }
        if (!next.outcome) {
            const text = String(message || '').toLowerCase();
            if (/\bpending\b/.test(text)) next.outcome = 'Pending';
            else if (/\bresolved\b/.test(text)) next.outcome = 'Resolved';
        }
    }

    if (callName === 'countDisputes' || callName === 'count_disputes') {
        if (!next.search) {
            next.search = extractDisputeSearchTerm(message) || undefined;
        }
        if (!next.outcome) {
            const text = String(message || '').toLowerCase();
            if (/\bpending\b/.test(text)) next.outcome = 'Pending';
            else if (/\bresolved\b/.test(text)) next.outcome = 'Resolved';
        }
    }

    if (callName === 'getReleaseDashboardDetails' || callName === 'get_release_dashboard_details') {
        if (!next.orderNumber) {
            next.orderNumber = extractOrderNumber(message) || undefined;
        }
        if (!next.focus) {
            next.focus = extractReleaseFocus(message) || undefined;
        }
    }

    if (callName === 'searchReleaseDashboard' || callName === 'search_release_dashboard') {
        if (!next.search) {
            next.search = extractReleaseSearchTerm(message) || undefined;
        }
        if (!next.status) {
            const text = String(message || '').toLowerCase();
            if (/\bopen\b/.test(text)) next.status = 'Open';
            else if (/\bclose/.test(text)) next.status = 'Close';
        }
    }

    if (callName === 'countReleaseDashboard' || callName === 'count_release_dashboard') {
        if (!next.search) {
            next.search = extractReleaseSearchTerm(message) || undefined;
        }
        if (!next.status) {
            const text = String(message || '').toLowerCase();
            if (/\bopen\b/.test(text)) next.status = 'Open';
            else if (/\bclose/.test(text)) next.status = 'Close';
        }
    }

    if (callName === 'getQuoteDetails' || callName === 'get_quote_details') {
        if (!next.referenceNo && !next.quoteId) {
            next.referenceNo = extractQuoteReference(message) || undefined;
        }
        if (!next.focus) {
            next.focus = extractQuoteFocus(message) || undefined;
        }
    }

    if (callName === 'searchQuotes' || callName === 'search_quotes') {
        if (!next.freightNumber) {
            next.freightNumber = extractFreightNumber(message) || undefined;
        }
        if (!next.search) {
            next.search = extractQuoteSearchTerm(message) || undefined;
        }
        if (!next.status) {
            const text = String(message || '').toLowerCase();
            if (/\bunpaid\b/.test(text)) next.status = 'unpaid';
            else if (/\bpaid\b/.test(text)) next.status = 'paid';
        }
    }

    if (callName === 'countQuotes' || callName === 'count_quotes') {
        if (!next.search) {
            next.search = extractQuoteSearchTerm(message) || undefined;
        }
        if (!next.status) {
            const text = String(message || '').toLowerCase();
            if (/\bunpaid\b/.test(text)) next.status = 'unpaid';
            else if (/\bpaid\b/.test(text)) next.status = 'paid';
        }
    }

    if (callName === 'getFreightInvoiceDetails' || callName === 'get_freight_invoice_details') {
        if (!next.referenceNo && !next.invoiceId) {
            next.referenceNo = extractFreightInvoiceReference(message) || undefined;
        }
        if (!next.focus) {
            next.focus = extractFreightInvoiceFocus(message) || undefined;
        }
    }

    if (callName === 'searchFreightInvoices' || callName === 'search_freight_invoices') {
        if (!next.freightNumber) {
            next.freightNumber = extractFreightNumber(message) || undefined;
        }
        if (!next.search) {
            next.search = extractFreightInvoiceSearchTerm(message) || undefined;
        }
        if (!next.status) {
            const text = String(message || '').toLowerCase();
            if (/\bunpaid\b/.test(text)) next.status = 'unpaid';
            else if (/\bpaid\b/.test(text)) next.status = 'paid';
        }
    }

    if (callName === 'countFreightInvoices' || callName === 'count_freight_invoices') {
        if (!next.search) {
            next.search = extractFreightInvoiceSearchTerm(message) || undefined;
        }
        if (!next.status) {
            const text = String(message || '').toLowerCase();
            if (/\bunpaid\b/.test(text)) next.status = 'unpaid';
            else if (/\bpaid\b/.test(text)) next.status = 'paid';
        }
    }

    if (callName === 'getCashbookDetails' || callName === 'get_cashbook_details') {
        if (!next.bankRef && !next.cashbookId) {
            next.bankRef = extractCashbookBankRef(message) || undefined;
        }
        if (!next.focus) {
            next.focus = extractCashbookFocus(message) || undefined;
        }
    }

    if (callName === 'searchCashbook' || callName === 'search_cashbook') {
        if (!next.search) {
            next.search = extractCashbookSearchTerm(message) || undefined;
        }
        if (!next.allocated) {
            const text = String(message || '').toLowerCase();
            if (/\bunallocated\b/.test(text)) next.allocated = 'No';
            else if (/\ballocated\b/.test(text)) next.allocated = 'Yes';
        }
    }

    if (callName === 'countCashbook' || callName === 'count_cashbook') {
        if (!next.search) {
            next.search = extractCashbookSearchTerm(message) || undefined;
        }
        if (!next.allocated) {
            const text = String(message || '').toLowerCase();
            if (/\bunallocated\b/.test(text)) next.allocated = 'No';
            else if (/\ballocated\b/.test(text)) next.allocated = 'Yes';
        }
    }

    if (callName === 'getSupplierInvoiceDetails' || callName === 'get_supplier_invoice_details') {
        if (!next.referenceNo && !next.invoiceId) {
            next.referenceNo = extractSupplierInvoiceReference(message) || undefined;
        }
        if (!next.focus) {
            next.focus = extractSupplierInvoiceFocus(message) || undefined;
        }
    }

    if (callName === 'searchSupplierInvoices' || callName === 'search_supplier_invoices') {
        if (!next.search) {
            next.search = extractSupplierInvoiceSearchTerm(message) || undefined;
        }
        if (!next.status) {
            const text = String(message || '').toLowerCase();
            if (/\bunpaid\b/.test(text)) next.status = 'unpaid';
            else if (/\bpaid\b/.test(text)) next.status = 'paid';
        }
    }

    if (callName === 'countSupplierInvoices' || callName === 'count_supplier_invoices') {
        if (!next.search) {
            next.search = extractSupplierInvoiceSearchTerm(message) || undefined;
        }
        if (!next.status) {
            const text = String(message || '').toLowerCase();
            if (/\bunpaid\b/.test(text)) next.status = 'unpaid';
            else if (/\bpaid\b/.test(text)) next.status = 'paid';
        }
    }

    if (callName === 'getCollectionDeliveryDetails' || callName === 'get_collection_delivery_details') {
        if (!next.freightNumber) {
            next.freightNumber = extractFreightNumber(message) || getLastFreightNumber(sessionId);
        }
        if (!next.orderNumber) {
            next.orderNumber = extractOrderNumber(message) || undefined;
        }
        if (!next.focus) {
            next.focus = extractCollectionDeliveryFocus(message) || undefined;
        }
        if (!next.kind) {
            const text = String(message || '').toLowerCase();
            if (/\bdeliver/.test(text) && !/\bcollection\b/.test(text)) next.kind = 'delivery';
            else next.kind = 'collection';
        }
    }

    if (callName === 'searchCollectionDelivery' || callName === 'search_collection_delivery') {
        if (!next.search) {
            next.search = extractCollectionDeliverySearchTerm(message) || undefined;
        }
        if (!next.kind) {
            const text = String(message || '').toLowerCase();
            if (/\bdeliver/.test(text) && !/\bcollection\b/.test(text)) next.kind = 'delivery';
            else next.kind = 'collection';
        }
        if (!next.status) {
            const text = String(message || '').toLowerCase();
            if (/\bpending\b/.test(text)) next.status = 'Pending';
        }
    }

    if (callName === 'countCollectionDelivery' || callName === 'count_collection_delivery') {
        if (!next.search) {
            next.search = extractCollectionDeliverySearchTerm(message) || undefined;
        }
        if (!next.kind) {
            const text = String(message || '').toLowerCase();
            if (/\bdeliver/.test(text) && !/\bcollection\b/.test(text)) next.kind = 'delivery';
            else next.kind = 'collection';
        }
        if (!next.status) {
            const text = String(message || '').toLowerCase();
            if (/\bpending\b/.test(text)) next.status = 'Pending';
        }
    }

    if (callName === 'getTaskDetails' || callName === 'get_task_details') {
        if (!next.taskId && !next.task_id) {
            const m = String(message || '').match(/\btask\s*(?:id|#)?\s*(\d{1,8})\b/i);
            if (m) next.taskId = Number(m[1]);
        }
        if (!next.focus) next.focus = extractTaskFocus(message) || undefined;
    }

    if (callName === 'searchTasks' || callName === 'search_tasks') {
        if (!next.search) next.search = extractTaskSearchTerm(message) || undefined;
        if (!next.taskType) next.taskType = extractTaskType(message) || undefined;
        if (!next.status) next.status = extractTaskStatus(message) || undefined;
    }

    if (callName === 'countTasks' || callName === 'count_tasks') {
        if (!next.search) next.search = extractTaskSearchTerm(message) || undefined;
        if (!next.taskType) next.taskType = extractTaskType(message) || undefined;
        if (!next.status) next.status = extractTaskStatus(message) || undefined;
    }

    if (callName === 'getContactEnquiryDetails' || callName === 'get_contact_enquiry_details') {
        if (!next.enquiryId && !next.enquiry_id) {
            const m = String(message || '').match(/\b(?:enquiry|enquir(?:y|ies)|contact)\s*(?:id|#)?\s*(\d{1,8})\b/i);
            if (m) next.enquiryId = Number(m[1]);
        }
        if (!next.focus) next.focus = extractContactEnquiryFocus(message) || undefined;
    }

    if (callName === 'searchContactEnquiries' || callName === 'search_contact_enquiries') {
        if (!next.search) next.search = extractContactEnquirySearchTerm(message) || undefined;
        if (!next.nature) next.nature = extractContactEnquiryNature(message) || undefined;
    }

    if (callName === 'countContactEnquiries' || callName === 'count_contact_enquiries') {
        if (!next.search) next.search = extractContactEnquirySearchTerm(message) || undefined;
        if (!next.nature) next.nature = extractContactEnquiryNature(message) || undefined;
    }

    if (callName === 'getCountryOriginDetails' || callName === 'get_country_origin_details') {
        if (!next.originId && !next.origin_id && !next.countryName && !next.country_name) {
            const idMatch = String(message || '').match(/\b(?:country\s+origin|origin)\s*(?:id|#)?\s*(\d{1,8})\b/i);
            if (idMatch) next.originId = Number(idMatch[1]);
            else {
                const search = extractCountryOriginSearchTerm(message);
                if (search) next.countryName = search;
            }
        }
        if (!next.focus) next.focus = extractCountryOriginFocus(message) || undefined;
    }

    if (callName === 'searchCountryOrigins' || callName === 'search_country_origins') {
        if (!next.search) next.search = extractCountryOriginSearchTerm(message) || undefined;
    }

    if (callName === 'countCountryOrigins' || callName === 'count_country_origins') {
        if (!next.search) next.search = extractCountryOriginSearchTerm(message) || undefined;
    }

    if (callName === 'getPartnerDetails' || callName === 'get_partner_details') {
        if (!next.partnerType) next.partnerType = extractPartnerType(message) || undefined;
        if (!next.partnerId && !next.partner_id) {
            const m = String(message || '').match(
                /\b(?:custom\s+agent|customs?\s*(?:clearing\s*)?agent|freight\s+forwarder|forwarder|groupage(?:\s+warehouse|\s+handler)?|transporter)\s*(?:id|#)?\s*(\d{1,8})\b/i
            );
            if (m) next.partnerId = Number(m[1]);
        }
        if (!next.focus) next.focus = extractPartnerFocus(message) || undefined;
    }

    if (callName === 'searchPartners' || callName === 'search_partners') {
        if (!next.partnerType) next.partnerType = extractPartnerType(message) || undefined;
        if (!next.search) next.search = extractPartnerSearchTerm(message) || undefined;
    }

    if (callName === 'countPartners' || callName === 'count_partners') {
        if (!next.partnerType) next.partnerType = extractPartnerType(message) || undefined;
        if (!next.search) next.search = extractPartnerSearchTerm(message) || undefined;
    }

    if (callName === 'getCompanyAddressDetails' || callName === 'get_company_address_details') {
        if (!next.addressId && !next.address_id) {
            const m = String(message || '').match(
                /\b(?:company\s+address(?:es)?|company)\s*(?:id|#)?\s*(\d{1,8})\b/i
            );
            if (m) next.addressId = Number(m[1]);
        }
        if (!next.focus) next.focus = extractCompanyAddressFocus(message) || undefined;
    }

    if (callName === 'searchCompanyAddresses' || callName === 'search_company_addresses') {
        if (!next.search) next.search = extractCompanyAddressSearchTerm(message) || undefined;
    }

    if (callName === 'countCompanyAddresses' || callName === 'count_company_addresses') {
        if (!next.search) next.search = extractCompanyAddressSearchTerm(message) || undefined;
    }

    if (callName === 'getClientDetails' || callName === 'get_client_details') {
        if (!next.clientId && !next.customerNumber) {
            const cid = extractClientId(message);
            const cust = extractCustomerNumber(message);
            if (cid) next.clientId = cid;
            else if (cust) next.customerNumber = cust;
            else {
                const name = extractClientLookupName(message);
                if (name) next.customerNumber = name;
            }
        }
        if (!next.focus) {
            next.focus = extractClientFocus(message) || undefined;
        }
    }

    if (
        callName === 'findSupplier' ||
        callName === 'find_supplier' ||
        callName === 'getSupplierDetails' ||
        callName === 'get_supplier_details'
    ) {
        if (!next.name && !next.supplierId && !next.email) {
            const name = extractSupplierName(message);
            if (name) {
                if (/^\d+$/.test(name)) next.supplierId = Number(name);
                else if (name.includes('@')) next.email = name;
                else next.name = name;
            }
        }
        if (!next.focus) {
            next.focus = extractSupplierFocus(message) || undefined;
        }
    }

    if (
        callName === 'searchStaff' ||
        callName === 'search_staff' ||
        callName === 'getStaffDetails' ||
        callName === 'get_staff_details'
    ) {
        if (!next.search && !next.staffId && !next.email && !next.name) {
            const term = extractStaffSearchTerm(message);
            if (term) {
                if (/^\d+$/.test(term)) next.staffId = Number(term);
                else if (term.includes('@')) next.email = term;
                else next.search = term;
            }
        }
        if (!next.focus) {
            next.focus = extractStaffFocus(message) || undefined;
        }
    }

    if (
        callName === 'searchClientKpi' ||
        callName === 'search_client_kpi' ||
        callName === 'getClientKpiDetails' ||
        callName === 'get_client_kpi_details' ||
        callName === 'countClientKpi' ||
        callName === 'count_client_kpi'
    ) {
        if (!next.search && !next.clientId) {
            const term = extractClientKpiSearchTerm(message);
            if (term) {
                if (/^\d+$/.test(term)) next.clientId = Number(term);
                else next.search = term;
            }
        }
        if (!next.focus) {
            next.focus = extractClientKpiFocus(message) || undefined;
        }
    }

    if (callName === 'findClientsByName' || callName === 'find_clients_by_name') {
        if (!next.intent) {
            if (isCountClearanceOrderRequest(message)) next.intent = 'count_clearance_orders';
            else if (isCountClearanceRequest(message)) next.intent = 'count_clearances';
            else if (isCountWarehouseRequest(message)) next.intent = 'count_warehouse_orders';
            else if (isCountBatchRequest(message)) next.intent = 'count_batches';
            else if (isCountShipmentRequest(message)) next.intent = 'count_shipments';
            else if (isClearanceOrderRequest(message)) next.intent = 'clearance_orders';
            else if (isClearanceRequest(message)) next.intent = 'clearances';
            else if (isWarehouseRequest(message)) next.intent = 'warehouse_orders';
            else if (isBatchRequest(message)) next.intent = 'batches';
            else if (isShipmentRequest(message)) next.intent = 'shipments';
            else if (isListOrdersRequest(message)) next.intent = 'orders';
            else if (isListFreightsRequest(message)) next.intent = 'freights';
            else if (isInvoiceRequest(message)) next.intent = 'invoices';
            else if (isClientLookupRequest(message)) next.intent = 'client';
        }
        if (!next.name) {
            next.name =
                extractClientLookupName(message) ||
                extractClientNameForEntity(message, 'clearance order') ||
                extractClientNameForEntity(message, 'warehouse') ||
                extractClientNameForEntity(message, 'clearance') ||
                extractClientNameForEntity(message, 'shipment') ||
                extractClientNameForEntity(message, 'batch') ||
                extractOrderListClientName(message) ||
                extractFreightListClientName(message) ||
                undefined;
        }
    }

    return next;
}

function isQuotaError(err) {
    const msg = String(err?.message || err || '');
    return (
        err?.status === 429 ||
        /429|Too Many Requests|quota|rate.?limit|Resource exhausted/i.test(msg)
    );
}

function isNotFoundModelError(err) {
    const msg = String(err?.message || err || '');
    return /404|not found for API version|is not supported for generateContent/i.test(msg);
}

function parseRetrySeconds(err) {
    const msg = String(err?.message || err || '');

    // Daily free-tier exhausted (limit: 0 on day metric) → long cooldown
    if (/GenerateRequestsPerDay|free_tier_requests.*limit:\s*0|PerDay/i.test(msg)) {
        return 15 * 60; // 15 minutes (avoid hammering; daily reset is longer)
    }

    const match = msg.match(/retry in\s+([\d.]+)\s*s/i);
    if (match) {
        return Math.min(Math.ceil(Number(match[1]) + 5), 3600);
    }
    return 90;
}

function startCooldown(err, reason = 'quota') {
    const seconds = reason === 'quota' ? parseRetrySeconds(err) : 60;
    geminiCooldownUntil = Date.now() + seconds * 1000;
    geminiCooldownReason = reason;
    saveCooldownToDisk();
    console.warn(`Gemini cooling down for ${seconds}s (${reason}) — using rules`);
    return seconds;
}

function getGeminiStatus() {
    if (geminiCooldownUntil && Date.now() >= geminiCooldownUntil) {
        geminiCooldownUntil = 0;
        geminiCooldownReason = null;
        clearCooldownFile();
    }

    const configured = Boolean(process.env.GEMINI_API_KEY);
    const remainingMs = Math.max(0, geminiCooldownUntil - Date.now());
    return {
        configured,
        available: configured && remainingMs === 0,
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
        fallbackModels: getModelCandidates().slice(1),
        cooldownSeconds: Math.ceil(remainingMs / 1000),
        cooldownReason: remainingMs > 0 ? geminiCooldownReason : null,
    };
}

function isGeminiAvailable() {
    if (!process.env.GEMINI_API_KEY) return false;
    if (Date.now() < geminiCooldownUntil) return false;
    if (geminiCooldownUntil && Date.now() >= geminiCooldownUntil) {
        geminiCooldownUntil = 0;
        geminiCooldownReason = null;
        clearCooldownFile();
    }
    return true;
}

async function runChatWithModel(client, modelName, message, history, ctx, sessionId) {
    const model = client.getGenerativeModel({
        model: modelName,
        tools: toGeminiTools(),
        systemInstruction: buildSystemInstruction(ctx),
    });

    const lastFreight = getLastFreightNumber(sessionId);
    const contextHint = lastFreight
        ? `\n(Session context: last discussed freight is ${lastFreight}. Use it for "this/above freight" follow-ups.)`
        : '';

    // Gemini requires history to start with role "user" and alternate user/model.
    // Drop the current user turn (already sent via sendMessage) and sanitize.
    const prior = Array.isArray(history) ? history.slice() : [];
    if (
        prior.length &&
        prior[prior.length - 1].role === 'user' &&
        String(prior[prior.length - 1].content || '').trim() === String(message || '').trim()
    ) {
        prior.pop();
    }

    const chatHistory = [];
    for (const h of prior.slice(-12)) {
        if (h.role !== 'user' && h.role !== 'assistant') continue;
        const text = String(h.content || '').trim();
        if (!text) continue;
        const role = h.role === 'assistant' ? 'model' : 'user';
        const last = chatHistory[chatHistory.length - 1];
        if (last && last.role === role) {
            // Merge consecutive same-role turns (Gemini rejects bad alternation)
            last.parts[0].text = `${last.parts[0].text}\n${text}`;
        } else {
            chatHistory.push({ role, parts: [{ text }] });
        }
    }
    while (chatHistory.length && chatHistory[0].role !== 'user') {
        chatHistory.shift();
    }
    // Keep at most ~5 exchanges
    const trimmedHistory = chatHistory.length > 10 ? chatHistory.slice(-10) : chatHistory;
    if (trimmedHistory.length && trimmedHistory[0].role !== 'user') {
        trimmedHistory.shift();
    }

    const chat = model.startChat({ history: trimmedHistory });

    let result = await chat.sendMessage(`${message}${contextHint}`);
    let response = result.response;
    let lastToolResult = null;

    for (let i = 0; i < 4; i++) {
        const fnCalls = response.functionCalls();
        if (!fnCalls || !fnCalls.length) break;

        const functionResponses = [];
        const summaryLines = [];

        for (const call of fnCalls) {
            const args = enrichToolArgs(call.name, call.args || {}, message, sessionId);
            const toolResult = await executeTool(call.name, args, ctx, sessionId);
            lastToolResult = toolResult;
            const payload = {
                name: call.name,
                response: { result: toolResult.data, summary: toolResult.reply },
            };
            if (call.id) payload.id = call.id;
            functionResponses.push({ functionResponse: payload });
            summaryLines.push(`- ${call.name}: ${toolResult.reply}`);
        }

        try {
            // Standard Gemini tool round-trip (role: function under the hood)
            result = await chat.sendMessage(functionResponses);
            response = result.response;
        } catch (sendErr) {
            const detail = String(sendErr?.message || sendErr || '');
            // Newer models (flash-latest / Gemini 3) often reject SDK function responses
            // ("Role 'function' is not supported" / missing thought_signature).
            // Fall back to a plain user message, then keep the tool result if that also fails.
            if (!/Role 'function'|thought_signature|functionResponse|function call/i.test(detail)) {
                throw sendErr;
            }
            try {
                result = await chat.sendMessage(
                    `Tool results (use only this live data; do not invent numbers):\n${summaryLines.join('\n')}\n\nAnswer the user briefly from these results.`
                );
                response = result.response;
            } catch (_) {
                break;
            }
        }
    }

    if (lastToolResult) {
        const focus = extractFreightFocus(message) || extractOrderFocus(message);
        const freightNumber = extractFreightNumber(message) || getLastFreightNumber(sessionId);
        const needsFocus =
            focus &&
            freightNumber &&
            !lastToolResult.data?.focusedAnswer &&
            (lastToolResult.data?.freight || lastToolResult.data?.orders || lastToolResult.data?.order);

        if (needsFocus) {
            const focusForFreight =
                focus === 'estimate_amount' || focus === 'route' || focus === 'client' ||
                focus === 'product_desc' || focus === 'paid' || focus === 'status' ||
                focus === 'supplier' || focus === 'commodity' || focus === 'sales_rep' ||
                focus === 'waybill' || focus === 'freight_number'
                    ? focus
                    : null;
            if (focusForFreight) {
                const toolResult = await executeTool(
                    'getFreightFullDetails',
                    { freightNumber, focus: focusForFreight },
                    ctx,
                    sessionId
                );
                return { ...toolResult, provider: 'gemini-tool-recover', model: modelName };
            }
        }

        return {
            reply: lastToolResult.reply,
            data: lastToolResult.data,
            provider: 'gemini',
            model: modelName,
        };
    }

    const freightNumber = extractFreightNumber(message) || getLastFreightNumber(sessionId);
    const focus = extractFreightFocus(message) || extractOrderFocus(message);
    if (freightNumber && (focus || extractFreightNumber(message) || refersToPriorFreight(message))) {
        const focusForFreight =
            !focus || focus === 'estimate_amount' || focus === 'route' || focus === 'client' ||
            focus === 'product_desc' || focus === 'paid' || focus === 'status' ||
            focus === 'supplier' || focus === 'commodity' || focus === 'sales_rep' ||
            focus === 'waybill' || focus === 'freight_number'
                ? focus || undefined
                : undefined;
        const toolResult = await executeTool(
            'getFreightFullDetails',
            { freightNumber, focus: focusForFreight },
            ctx,
            sessionId
        );
        return { ...toolResult, provider: 'gemini-tool-recover', model: modelName };
    }

    if (isCountFreightsRequest(message)) {
        const toolResult = await executeTool('countFreights', {}, ctx, sessionId);
        return { ...toolResult, provider: 'gemini-tool-recover', model: modelName };
    }

    if (isCountOrdersRequest(message)) {
        const toolResult = await executeTool('countOrders', {}, ctx, sessionId);
        return { ...toolResult, provider: 'gemini-tool-recover', model: modelName };
    }

    if (isCountClientsRequest(message)) {
        const toolResult = await executeTool('countClients', {}, ctx, sessionId);
        return { ...toolResult, provider: 'gemini-tool-recover', model: modelName };
    }

    if (isCountSageInvoicesRequest(message)) {
        const toolResult = await executeTool('countSageInvoices', {}, ctx, sessionId);
        return { ...toolResult, provider: 'gemini-tool-recover', model: modelName };
    }

    if (isSageInvoiceRequest(message)) {
        const documentNumber = extractSageDocumentNumber(message);
        if (documentNumber) {
            const toolResult = await executeTool('getSageInvoiceDetails', { documentNumber }, ctx, sessionId);
            return { ...toolResult, provider: 'gemini-tool-recover', model: modelName };
        }
        const search = extractSageInvoiceSearchTerm(message);
        if (search) {
            const toolResult = await executeTool('searchSageInvoices', { search }, ctx, sessionId);
            return { ...toolResult, provider: 'gemini-tool-recover', model: modelName };
        }
    }

    if (isClientLookupRequest(message)) {
        const customerNumber = extractCustomerNumber(message);
        if (customerNumber) {
            const toolResult = await executeTool('getClientDetails', { customerNumber }, ctx, sessionId);
            return { ...toolResult, provider: 'gemini-tool-recover', model: modelName };
        }
        const clientId = extractClientId(message);
        if (clientId) {
            const toolResult = await executeTool('getClientDetails', { clientId }, ctx, sessionId);
            return { ...toolResult, provider: 'gemini-tool-recover', model: modelName };
        }
        const name = extractClientLookupName(message);
        if (name) {
            const toolResult = await executeTool(
                'findClientsByName',
                { name, intent: 'client' },
                ctx,
                sessionId
            );
            return { ...toolResult, provider: 'gemini-tool-recover', model: modelName };
        }
    }

    if (isListFreightsRequest(message)) {
        const name = extractFreightListClientName(message);
        if (name) {
            const toolResult = await executeTool(
                'findClientsByName',
                { name, intent: 'freights' },
                ctx,
                sessionId
            );
            return { ...toolResult, provider: 'gemini-tool-recover', model: modelName };
        }
    }

    let text = '';
    try {
        text = response.text() || '';
    } catch (_) {
        text = '';
    }

    return {
        reply: text || 'I could not generate a response.',
        data: null,
        provider: 'gemini',
        model: modelName,
    };
}

/**
 * Returns Gemini result, or null to signal orchestrator to use rules.
 * Does not throw on quota — starts cooldown instead.
 */
async function chatWithGemini(message, history, ctx, sessionId) {
    const client = getClient();
    if (!client) return null;

    if (Date.now() < geminiCooldownUntil) {
        return null;
    }

    const models = getModelCandidates();
    let sawQuota = false;
    let lastError = null;

    for (const modelName of models) {
        try {
            return await runChatWithModel(client, modelName, message, history, ctx, sessionId);
        } catch (err) {
            lastError = err;
            if (isQuotaError(err)) {
                sawQuota = true;
                // Same API key shares quota across models — don't wait on 3–4 failing calls
                console.warn(`Gemini ${modelName}: quota exceeded — skipping other models`);
                break;
            }
            if (isNotFoundModelError(err)) {
                console.warn(`Gemini ${modelName}: not available, trying next…`);
                continue;
            }
            const detail = String(err.message || err);
            console.warn(`Gemini ${modelName} failed: ${detail.slice(0, 300)}`);
            // Same bad history / request shape will fail on every model — don't burn paid calls
            if (/First content should be with role|role 'user'|invalid argument|INVALID_ARGUMENT/i.test(detail)) {
                break;
            }
            if (/API[_ ]?key|invalid|PERMISSION_DENIED|401|403/i.test(detail)) {
                console.warn(
                    'Hint: check GEMINI_API_KEY in .env (Google AI Studio keys usually start with AIza…).'
                );
                break;
            }
        }
    }

    if (sawQuota) {
        startCooldown(lastError, 'quota');
    } else if (lastError) {
        const detail = String(lastError.message || lastError);
        if (/API[_ ]?key|invalid|PERMISSION_DENIED|401|403/i.test(detail)) {
            geminiCooldownUntil = Date.now() + 5 * 60 * 1000;
            geminiCooldownReason = 'auth';
            saveCooldownToDisk();
            console.warn('Gemini cooling down for 300s (auth) — fix GEMINI_API_KEY, then retry');
        } else if (/First content should be with role|role 'user'|INVALID_ARGUMENT/i.test(detail)) {
            // History bug — fall back to rules this turn; do not start a long cooldown
            console.warn('Gemini history invalid — using rules (no cooldown)');
        } else {
            startCooldown(lastError, 'error');
        }
    }

    // Quiet fallback — orchestrator uses rules without dumping full API dump
    return null;
}

module.exports = {
    chatWithGemini,
    isGeminiAvailable,
    getGeminiStatus,
};
