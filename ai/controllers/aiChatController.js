const { processChatMessage } = require('../core/chatOrchestrator');
const { getGeminiStatus } = require('../core/llmProvider');
const { loadUserContext } = require('../../services/permissions/userContext');
const { clearSessionMemory } = require('../core/conversationStore');
const {
    getChatHistory,
    getLatestSessionId,
    createNewSession,
    HISTORY_TTL_MINUTES,
} = require('../history/chatHistoryService');

const sendMessage = async (req, res) => {
    try {
        const { message, user_id, session_id } = req.body;

        const result = await processChatMessage({
            message,
            userId: user_id,
            sessionId: session_id,
        });

        if (!result.success) {
            return res.status(400).send(result);
        }

        return res.status(200).send(result);
    } catch (error) {
        console.error('AI chat error:', error);
        return res.status(500).send({
            success: false,
            message: error.message,
        });
    }
};

/**
 * GET /api/ai-chat/history?user_id=1&session_id=optional
 * Restores the latest (or given) session for chatbot-style persistence.
 */
const getHistory = async (req, res) => {
    try {
        const userId = Number(req.query.user_id);
        if (!userId) {
            return res.status(400).send({ success: false, message: 'user_id is required.' });
        }

        let sessionId = String(req.query.session_id || '').trim() || null;
        if (!sessionId) {
            sessionId = await getLatestSessionId(userId);
        }
        if (!sessionId) {
            return res.status(200).send({
                success: true,
                sessionId: null,
                messages: [],
                ttlMinutes: HISTORY_TTL_MINUTES,
            });
        }

        const messages = await getChatHistory(userId, sessionId, { limit: 50 });
        // Expired / empty → client starts fresh (don't revive dead session id)
        return res.status(200).send({
            success: true,
            sessionId: messages.length ? sessionId : null,
            messages,
            ttlMinutes: HISTORY_TTL_MINUTES,
        });
    } catch (error) {
        return res.status(500).send({ success: false, message: error.message });
    }
};

/**
 * POST /api/ai-chat/new-session  { user_id }
 * Starts a fresh chat (like "New chat" in ChatGPT).
 */
const newSession = async (req, res) => {
    try {
        const userId = Number(req.body.user_id);
        if (!userId) {
            return res.status(400).send({ success: false, message: 'user_id is required.' });
        }
        const sessionId = await createNewSession(userId);
        clearSessionMemory(sessionId);
        return res.status(200).send({
            success: true,
            sessionId,
            ttlMinutes: HISTORY_TTL_MINUTES,
        });
    } catch (error) {
        return res.status(500).send({ success: false, message: error.message });
    }
};

const getStatus = async (req, res) => {
    const gemini = getGeminiStatus();
    return res.status(200).send({
        success: true,
        geminiConfigured: gemini.configured,
        geminiAvailable: gemini.available,
        model: gemini.model,
        fallbackModels: gemini.fallbackModels,
        cooldownSeconds: gemini.cooldownSeconds,
        cooldownReason: gemini.cooldownReason,
        mode: gemini.available ? 'ai-first' : gemini.configured ? 'rules-during-cooldown' : 'rules-only',
        tools: [
            'getFreightFullDetails',
            'findSupplier',
            'getSupplierDetails',
            'countSuppliers',
            'getStaffDetails',
            'searchStaff',
            'countStaff',
            'searchClientKpi',
            'getClientKpiDetails',
            'countClientKpi',
            'getInvoicesByClient',
            'findClientsByName',
            'getMyInvoices',
            'getFreightsByClient',
            'getOrderDetails',
            'getOrdersByClient',
            'getOrdersByFreight',
            'countFreights',
            'countOrders',
            'getWarehouseOrderDetails',
            'getWarehouseOrders',
            'countWarehouseOrders',
            'getBatchDetails',
            'listBatches',
            'countBatches',
            'getShipmentDetails',
            'getShipments',
            'countShipments',
            'getClearanceDetails',
            'getClearances',
            'countClearances',
            'getClearanceOrders',
            'countClearanceOrders',
            'getClientDetails',
            'countClients',
            'getSageInvoiceDetails',
            'searchSageInvoices',
            'countSageInvoices',
            'getCashbookDetails',
            'searchCashbook',
            'countCashbook',
            'getSupplierInvoiceDetails',
            'searchSupplierInvoices',
            'countSupplierInvoices',
            'getCollectionDeliveryDetails',
            'searchCollectionDelivery',
            'countCollectionDelivery',
            'getTaskDetails',
            'searchTasks',
            'countTasks',
            'getLeaveDetails',
            'searchLeaves',
            'countLeaves',
            'getContactEnquiryDetails',
            'searchContactEnquiries',
            'countContactEnquiries',
            'getCountryOriginDetails',
            'searchCountryOrigins',
            'countCountryOrigins',
            'getPartnerDetails',
            'searchPartners',
            'countPartners',
            'getCompanyAddressDetails',
            'searchCompanyAddresses',
            'countCompanyAddresses',
        ],
    });
};

/**
 * Returns role-based chat suggestions.
 * Shortcuts only — users can still type any question.
 */
const getContext = async (req, res) => {
    try {
        const userId = Number(req.query.user_id || req.body?.user_id);
        if (!userId) {
            return res.status(400).send({ success: false, message: 'user_id is required' });
        }

        const ctx = await loadUserContext(userId);
        if (!ctx) {
            return res.status(404).send({ success: false, message: 'User not found or inactive' });
        }

        const common = [
            { id: 'freight', title: 'Freight status', desc: 'Track any freight by number', needsInput: true, prompt: 'Type your freight number (format: F-2026xxxxxx)' },
            { id: 'order', title: 'Order lookup', desc: 'Find an order by number', needsInput: true, prompt: 'Type your order number (format: OR000xxx)' },
            { id: 'warehouse', title: 'Warehouse order', desc: 'By warehouse id, freight, or order', needsInput: true, prompt: 'Type warehouse id, freight (F-2026xxxxxx), or order (OR000xxx)' },
            { id: 'batch', title: 'Batch status', desc: 'Look up a batch number', needsInput: true, prompt: 'Type your batch number (format: ADAWBxxxxxxx)' },
            { id: 'shipment', title: 'Shipment / waybill', desc: 'Shipment details by waybill or load', needsInput: true, prompt: 'Type your waybill/load (format: 999-xxxxxxxx or DLxxxxxxxxx)' },
            { id: 'clearance', title: 'Clearance', desc: 'Custom clearance / Update Clearance form', needsInput: true, prompt: 'Type your clearance number (format: C-2026xxxxx)' },
            { id: 'supplier', title: 'Find supplier', desc: 'Edit Supplier profile by company, name, email, or ID', needsInput: true, prompt: 'Type company name (e.g. SANBRO), email, or supplier ID' },
            { id: 'staff', title: 'Find staff', desc: 'Edit Staff profile by name, email, or ID', needsInput: true, prompt: 'Type staff name, email, or ID (e.g. Tshegofatso)' },
            { id: 'client_kpi', title: 'Client KPI', desc: 'Freight, orders, delivered, total amount', needsInput: true, prompt: 'Type client name (e.g. TGOOD) or All' },
            { id: 'sage_invoice', title: 'Sage invoice', desc: 'By document number or customer', needsInput: true, prompt: 'Type document number (ADZWINV…) or customer name/ref' },
            { id: 'freight_invoice', title: 'Freight invoice', desc: 'By ADINV reference, freight, or customer', needsInput: true, prompt: 'Type invoice ref (ADINV…), freight (F-…), or customer name' },
            { id: 'cashbook', title: 'Cashbook', desc: 'By bank ref, customer, or order', needsInput: true, prompt: 'Type bank ref (20260729001), customer name, or order (OR000…)' },
            { id: 'supplier_invoice', title: 'Supplier invoice', desc: 'By SUPINV reference, supplier, or waybill', needsInput: true, prompt: 'Type SUPINV…, supplier name, or waybill' },
            { id: 'collection_delivery', title: 'Collection / Delivery', desc: 'By freight, order, customer, or pending', needsInput: true, prompt: 'Type freight (F-…), order (OR000…), customer name, or Pending' },
            { id: 'task_manager', title: 'Task Manager', desc: 'Freight, clearance, or custom tasks', needsInput: true, prompt: 'Type Freight tasks, Clearance tasks, Custom tasks, Pending, or a name' },
            { id: 'leave_calendar', title: 'Leave Calendar', desc: 'Staff leave requests by name, status, or month', needsInput: true, prompt: 'Type Leave calendar, Pending, August 2026, or a staff name' },
            { id: 'contact_enquiries', title: 'Contact Us Enquiries', desc: 'By name, email, country, or nature', needsInput: true, prompt: 'Type email, name, country, Sales, or All' },
            { id: 'country_origin', title: 'Country of Origin', desc: 'Cities and sea/air/land ports', needsInput: true, prompt: 'Type country name (e.g. Austria) or All' },
            { id: 'customs_agent', title: 'Custom Agent', desc: 'Email, name, phone, country, address', needsInput: true, prompt: 'Type name, email, or All' },
            { id: 'freight_forwarder', title: 'Freight Forwarder', desc: 'Email, name, phone, country, address', needsInput: true, prompt: 'Type name, email, or All' },
            { id: 'groupage_warehouse', title: 'Groupage Warehouse', desc: 'Email, name, phone, country, address', needsInput: true, prompt: 'Type name, email, or All' },
            { id: 'transporter', title: 'Transporter', desc: 'Email, name, phone, country, address', needsInput: true, prompt: 'Type name, email, or All' },
            { id: 'company_addresses', title: 'Company Addresses', desc: 'Company name, email, country, telephone, reg/tax, address', needsInput: true, prompt: 'Type company name, country, or All' },
            { id: 'quotation', title: 'Quotation / quote', desc: 'By ADQO reference, freight, or customer', needsInput: true, prompt: 'Type quote ref (ADQO…), freight (F-…), or customer name' },
        ];

        let topics;
        if (ctx.isCustomer) {
            topics = [
                ...common.slice(0, 2),
                { id: 'orders', title: 'My orders', desc: 'Orders on your account', needsInput: false, message: 'Show my orders' },
                { id: 'warehouse_mine', title: 'My warehouse', desc: 'Your warehouse orders', needsInput: false, message: 'Show my warehouse orders' },
                { id: 'clearance_orders_mine', title: 'My clearance orders', desc: 'Clearance orders on your account', needsInput: false, message: 'Show my clearance orders' },
                { id: 'invoices', title: 'My invoices', desc: 'Invoices on your account only', needsInput: false, message: 'Show my invoices' },
                ...common.slice(2),
            ];
        } else {
            // Admin / staff — look up other people's data, not "my invoices"
            topics = [
                ...common.slice(0, 2),
                { id: 'orders_client', title: 'Client orders', desc: 'Look up by client name or ID', needsInput: true, prompt: 'Type a client name (e.g. John) or Client ID' },
                { id: 'warehouse_client', title: 'Client warehouse', desc: 'Warehouse orders by client', needsInput: true, prompt: 'Type a client name (e.g. John)' },
                { id: 'clearance_orders_client', title: 'Order Clearance', desc: 'By client name, C-…, or goods', needsInput: true, prompt: 'Type client name, clearance number (C-…), or goods keyword' },
                { id: 'invoices_client', title: 'Client invoices', desc: 'Look up by client name or ID', needsInput: true, prompt: 'Type a client name (e.g. John) or Client ID (e.g. 21988)' },
                { id: 'disputes', title: 'Customer Query / Dispute', desc: 'By Dispute ID or name', needsInput: true, prompt: 'Type Dispute ID (format: D-xxxxxx) or a name' },
                { id: 'release_dashboard', title: 'Release Dashboard', desc: 'By order number or customer', needsInput: true, prompt: 'Type order number (format: OR000xxx) or customer name' },
                ...common.slice(2),
                { id: 'client_search', title: 'Find client', desc: 'Customer profile by name, email, or Customer ID', needsInput: true, prompt: 'Type a name, email, or Customer ID (e.g. CE21170)' },
            ];
        }

        return res.status(200).send({
            success: true,
            user: {
                id: ctx.userId,
                name: ctx.fullName,
                userType: ctx.userType,
                isAdmin: ctx.isAdmin,
                isStaff: ctx.isStaff,
                isCustomer: ctx.isCustomer,
                roleLabel: ctx.isAdmin ? 'Admin' : ctx.isStaff ? 'Staff' : 'Customer',
            },
            topics,
            tip: 'Shortcuts are optional. You can type any question in your own words.',
        });
    } catch (error) {
        return res.status(500).send({ success: false, message: error.message });
    }
};

module.exports = { sendMessage, getStatus, getContext, getHistory, newSession };
