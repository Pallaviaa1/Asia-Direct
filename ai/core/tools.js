const { getFreightFullDetails } = require('../../services/data/freightAggregator');
const { listFreightsByClientId, countFreights } = require('../../services/data/freightService');
const { findClientsByName, getClientById, getClientByCustomerId, pickBestClientMatch, countClients, attachRelatedFreights } = require('../../services/data/clientService');
const { findSuppliersByName, getSupplierById, getSupplierByEmail, countSuppliers } = require('../../services/data/supplierService');
const { findStaffByName, getStaffById, getStaffByEmail, countStaff } = require('../../services/data/staffService');
const { searchClientKpi, getClientKpiByClientId, countClientKpi } = require('../../services/data/clientKpiService');
const { getInvoicesByClientId, getSageInvoiceByDocumentNumber, searchSageInvoices, countSageInvoices } = require('../../services/data/invoiceService');
const {
    getDisputeById,
    searchDisputes,
    listDisputesByFreightOrOrder,
    listDisputesByUserId,
    countDisputes,
} = require('../../services/data/disputeService');
const {
    getReleaseByOrderNumber,
    searchReleaseDashboard,
    listReleaseByClientId,
    countReleaseDashboard,
} = require('../../services/data/releaseService');
const {
    getQuoteByReference,
    getQuoteById,
    searchQuotes,
    listQuotesByFreightNumber,
    listQuotesByClientId,
    countQuotes,
} = require('../../services/data/quoteService');
const {
    getFreightInvoiceByReference,
    getFreightInvoiceById,
    searchFreightInvoices,
    listFreightInvoicesByFreightNumber,
    listFreightInvoicesByClientId,
    countFreightInvoices,
} = require('../../services/data/freightInvoiceService');
const {
    getCashbookByBankRef,
    getCashbookById,
    searchCashbook,
    listCashbookByClientId,
    countCashbook,
} = require('../../services/data/cashbookService');
const {
    getSupplierInvoiceByReference,
    getSupplierInvoiceById,
    searchSupplierInvoices,
    countSupplierInvoices,
} = require('../../services/data/supplierInvoiceService');
const {
    searchCollectionDelivery,
    getCollectionDeliveryByFreight,
    getCollectionDeliveryByOrder,
    countCollectionDelivery,
} = require('../../services/data/collectionDeliveryService');
const { searchTasks, getTaskById, countTasks } = require('../../services/data/taskManagerService');
const {
    searchContactEnquiries,
    getContactEnquiryById,
    countContactEnquiries,
} = require('../../services/data/contactEnquiryService');
const {
    searchCountryOrigins,
    getCountryOriginById,
    getCountryOriginByCountryName,
    countCountryOrigins,
} = require('../../services/data/countryOriginService');
const {
    searchPartners,
    getPartnerById,
    countPartners,
    normalizePartnerType,
} = require('../../services/data/partnerDirectoryService');
const {
    searchCompanyAddresses,
    getCompanyAddressById,
    countCompanyAddresses,
} = require('../../services/data/companyAddressService');
const {
    getOrderByNumber,
    listOrdersByClientId,
    listOrdersByFreightNumber,
    countOrders,
} = require('../../services/data/orderService');
const {
    formatFreightResponse,
    formatSupplierResponse,
    formatSupplierProfileResponse,
    formatSupplierListResponse,
    formatStaffProfileResponse,
    formatStaffListResponse,
    formatClientKpiResponse,
    formatClientKpiListResponse,
    formatInvoiceResponse,
    formatSageInvoiceResponse,
    formatSageInvoiceListResponse,
    formatClientDisambiguation,
    formatClientResponse,
    formatClientListResponse,
    formatFreightListResponse,
    formatOrderResponse,
    formatOrderListResponse,
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
} = require('./responseFormatter');
const {
    LOGISTICS_TOOL_DEFINITIONS,
    executeLogisticsTool,
    ruleBasedLogisticsRoute,
} = require('./logisticsHandlers');
const {
    getSession,
    setPendingDisambiguation,
    clearPending,
    setLastFreightNumber,
    getLastFreightNumber,
} = require('./conversationStore');
const {
    extractFreightNumber,
    extractClientId,
    extractSupplierName,
    extractSupplierFocus,
    extractStaffSearchTerm,
    extractStaffFocus,
    extractClientKpiSearchTerm,
    extractClientKpiFocus,
    extractInvoiceClientName,
    extractFreightFocus,
    extractFreightListClientName,
    extractOrderNumber,
    extractOrderListClientName,
    extractOrderFocus,
    refersToPriorFreight,
    isInvoiceRequest,
    isMyInvoiceRequest,
    isFreightRequest,
    isFreightSupplierQuestion,
    isListFreightsRequest,
    isMyFreightsRequest,
    isListOrdersRequest,
    isMyOrdersRequest,
    isCountFreightsRequest,
    isCountOrdersRequest,
    isSupplierRequest,
    isCountSuppliersRequest,
    isStaffRequest,
    isCountStaffRequest,
    isClientKpiRequest,
    isCountClientKpiRequest,
    isDefaultHelpReply,
    isGreetingOrSmallTalk,
    greetingReply,
    isWarehouseRequest,
    isBatchRequest,
    isShipmentRequest,
    isClearanceRequest,
    isClearanceOrderRequest,
    extractWaybill,
    extractClearanceNumber,
    extractBatchNumber,
    isClientLookupRequest,
    isCountClientsRequest,
    extractCustomerNumber,
    extractClientLookupName,
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
    isReleaseDashboardRequest,
    extractReleaseFocus,
    extractReleaseSearchTerm,
    isCountReleaseDashboardRequest,
    extractQuoteReference,
    extractQuoteFocus,
    extractQuoteSearchTerm,
    isQuoteListRequest,
    isCountQuoteRequest,
    extractFreightInvoiceReference,
    extractFreightInvoiceFocus,
    extractFreightInvoiceSearchTerm,
    isFreightInvoiceListRequest,
    isCountFreightInvoiceRequest,
    extractCashbookBankRef,
    extractCashbookFocus,
    extractCashbookSearchTerm,
    isCashbookRequest,
    isCountCashbookRequest,
    extractSupplierInvoiceReference,
    extractSupplierInvoiceFocus,
    extractSupplierInvoiceSearchTerm,
    isSupplierInvoiceRequest,
    isCountSupplierInvoiceRequest,
    extractCollectionDeliveryFocus,
    extractCollectionDeliverySearchTerm,
    isCollectionDeliveryRequest,
    isCountCollectionDeliveryRequest,
    extractTaskType,
    extractTaskStatus,
    extractTaskFocus,
    extractTaskSearchTerm,
    isTaskManagerRequest,
    isCountTaskRequest,
    extractContactEnquiryNature,
    extractContactEnquiryFocus,
    extractContactEnquirySearchTerm,
    isContactEnquiryRequest,
    isCountContactEnquiryRequest,
    extractCountryOriginFocus,
    extractCountryOriginSearchTerm,
    isCountryOriginModuleRequest,
    isCountCountryOriginRequest,
    extractPartnerType,
    extractPartnerFocus,
    extractPartnerSearchTerm,
    isPartnerDirectoryRequest,
    isCountPartnerRequest,
    extractCompanyAddressFocus,
    extractCompanyAddressSearchTerm,
    isCompanyAddressRequest,
    isCountCompanyAddressRequest,
} = require('./messageParser');

const TOOL_DEFINITIONS = [
    {
        name: 'getFreightFullDetails',
        description:
            'Get freight order details by freight number (e.g. F-20260722005). Covers Order Freight Detail form: shipper/consignee, addresses, cargo (weight/CBM/packages), POL/POD, incoterms, warehouse, estimate/charges. Pass focus for one field.',
        parameters: {
            type: 'object',
            properties: {
                freightNumber: { type: 'string', description: 'The freight number e.g. F-20260602006' },
                focus: {
                    type: 'string',
                    description:
                        'Optional: product_desc, estimate_amount, paid, supplier, commodity, sales_rep, client, route, status, freight_number, waybill, shipper, consignee, weight, dimension, packages, package_type, hazardous, volumetric_weight, chargeable_weight, port_of_loading, port_of_discharge, pickup_address, delivery_address, incoterm',
                },
            },
            required: ['freightNumber'],
        },
    },
    {
        name: 'findSupplier',
        description:
            'Search Manage Supplier / Edit Supplier directory by company name, contact name, email, phone, or supplier ID. Returns company + account details (never password).',
        parameters: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Supplier company/contact name, email, phone, or ID' },
                focus: {
                    type: 'string',
                    description:
                        'Optional: company_name, service_type, address, country_based, country_of_origin, email, full_name, phone, country_code, profile, password',
                },
            },
            required: ['name'],
        },
    },
    {
        name: 'getSupplierDetails',
        description:
            'Get one supplier Edit Supplier profile by supplierId or exact email. Company details + account details (no password).',
        parameters: {
            type: 'object',
            properties: {
                supplierId: { type: 'number' },
                email: { type: 'string' },
                focus: { type: 'string' },
            },
        },
    },
    {
        name: 'countSuppliers',
        description: 'Count suppliers in the directory (is_deleted = 0).',
        parameters: { type: 'object', properties: {} },
    },
    {
        name: 'getStaffDetails',
        description:
            'Get Manage Staff / Edit Staff profile by staffId or email. Includes roles, access countries, and permission summary. Never returns password.',
        parameters: {
            type: 'object',
            properties: {
                staffId: { type: 'number' },
                email: { type: 'string' },
                focus: {
                    type: 'string',
                    description:
                        'Optional: email, full_name, phone, country_code, country, roles, access_countries, password, permissions',
                },
            },
        },
    },
    {
        name: 'searchStaff',
        description:
            'Search Manage Staff directory by name, email, phone, or staff ID. Admin/full-access only for others; staff can view self.',
        parameters: {
            type: 'object',
            properties: {
                search: { type: 'string' },
                focus: { type: 'string' },
            },
            required: ['search'],
        },
    },
    {
        name: 'countStaff',
        description: 'Count active staff users (user_type=2).',
        parameters: { type: 'object', properties: {} },
    },
    {
        name: 'searchClientKpi',
        description:
            'Client KPI module list/search: Name, Freight, Orders, Delivered Order, Total Amount. Optional client name search.',
        parameters: {
            type: 'object',
            properties: {
                search: { type: 'string', description: 'Client name or client ID' },
                focus: {
                    type: 'string',
                    description: 'Optional: freight, orders, delivered_orders, total_amount',
                },
            },
        },
    },
    {
        name: 'getClientKpiDetails',
        description: 'One Client KPI row by clientId.',
        parameters: {
            type: 'object',
            properties: {
                clientId: { type: 'number' },
                focus: { type: 'string' },
            },
            required: ['clientId'],
        },
    },
    {
        name: 'countClientKpi',
        description: 'Count clients in the Client KPI module (optional name filter).',
        parameters: {
            type: 'object',
            properties: {
                search: { type: 'string' },
            },
        },
    },
    {
        name: 'getInvoicesByClient',
        description: 'Get all invoices for a client by client ID.',
        parameters: {
            type: 'object',
            properties: {
                clientId: { type: 'number', description: 'Client user ID' },
            },
            required: ['clientId'],
        },
    },
    {
        name: 'getSageInvoiceDetails',
        description:
            'Look up one Sage invoice by document number (e.g. ADZWINV000637). Columns: document number, customer name, customer ref, date, total, upload, Invoice (AD). Pass focus for one field.',
        parameters: {
            type: 'object',
            properties: {
                documentNumber: { type: 'string', description: 'Sage document number e.g. ADZWINV000637' },
                focus: {
                    type: 'string',
                    description:
                        'Optional: document_number, customer_name, customer_ref, date, total, upload, invoice_ad',
                },
            },
            required: ['documentNumber'],
        },
    },
    {
        name: 'searchSageInvoices',
        description:
            'Search or list Sage Invoice rows by customer name, customer ref, or document number. Empty search returns recent invoices (skips blank Excel header rows).',
        parameters: {
            type: 'object',
            properties: {
                search: {
                    type: 'string',
                    description: 'Customer name, ref, document number, or empty for recent list',
                },
            },
        },
    },
    {
        name: 'countSageInvoices',
        description: 'Count Sage invoices. Use for "how many sage invoices", "count sage invoices".',
        parameters: { type: 'object', properties: {} },
    },
    {
        name: 'getDisputeDetails',
        description:
            'Get Customer Query / Dispute by Dispute ID (e.g. D-202638). Fields: freight/order, name, nature of heading, message, subject, outcome. Pass focus for one field.',
        parameters: {
            type: 'object',
            properties: {
                disputeId: { type: 'string', description: 'Dispute ID e.g. D-202638' },
                focus: {
                    type: 'string',
                    description: 'Optional: outcome, subject, nature, message, name, freight_no',
                },
            },
            required: ['disputeId'],
        },
    },
    {
        name: 'searchDisputes',
        description:
            'Search Customer Query / Dispute list by name, subject, message, Dispute ID, or freight/order ref (same search as Customer Query/Dispute screen). Optional outcome filter Pending/Resolved.',
        parameters: {
            type: 'object',
            properties: {
                search: { type: 'string', description: 'Name, subject, freight/order, or dispute id fragment' },
                outcome: { type: 'string', description: 'Optional: Pending or Resolved' },
            },
        },
    },
    {
        name: 'countDisputes',
        description: 'Count disputes / customer queries. Optional search or outcome (Pending/Resolved).',
        parameters: {
            type: 'object',
            properties: {
                search: { type: 'string' },
                outcome: { type: 'string' },
            },
        },
    },
    {
        name: 'getReleaseDashboardDetails',
        description:
            'Get Release Dashboard row by order number (OR000893). Fields: customer, clearing status, cargo inspection, payment, release instruction, delivery, status (Open/Close). Pass focus for one field.',
        parameters: {
            type: 'object',
            properties: {
                orderNumber: { type: 'string', description: 'Order number e.g. OR000893' },
                focus: {
                    type: 'string',
                    description:
                        'Optional: clearing_status, cargo_inspection, payment, release_instruction, delivery, status, customer_name',
                },
            },
            required: ['orderNumber'],
        },
    },
    {
        name: 'searchReleaseDashboard',
        description:
            'Search Release / Released Dashboard by customer name, order number, freight, or status Open/Close.',
        parameters: {
            type: 'object',
            properties: {
                search: { type: 'string' },
                status: { type: 'string', description: 'Optional Open or Close' },
            },
        },
    },
    {
        name: 'countReleaseDashboard',
        description: 'Count Release Dashboard entries. Optional search or status Open/Close.',
        parameters: {
            type: 'object',
            properties: {
                search: { type: 'string' },
                status: { type: 'string' },
            },
        },
    },
    {
        name: 'getQuoteDetails',
        description:
            'Get Quotation / Freight Quote Estimate or Shipping Estimate quote by reference (ADQO10299 / ADQO10300) or id. Searches freight_quote_estimate and estimate_shipping_quote. Pass focus for one field (e.g. freight_number).',
        parameters: {
            type: 'object',
            properties: {
                referenceNo: { type: 'string', description: 'Quote reference e.g. ADQO10299' },
                quoteId: { type: 'number' },
                focus: {
                    type: 'string',
                    description:
                        'Optional: total, amount_due, status, currency, country, customer_name, freight_number, chargeable, cargo, routing, incoterm',
                },
            },
        },
    },
    {
        name: 'searchQuotes',
        description:
            'Search Quotation / Quote list by customer name, freight number, reference, invoice no, or status unpaid/paid.',
        parameters: {
            type: 'object',
            properties: {
                search: { type: 'string' },
                status: { type: 'string', description: 'Optional unpaid or paid' },
            },
        },
    },
    {
        name: 'countQuotes',
        description: 'Count freight quotations / quotes. Optional search or status.',
        parameters: {
            type: 'object',
            properties: {
                search: { type: 'string' },
                status: { type: 'string' },
            },
        },
    },
    {
        name: 'getFreightInvoiceDetails',
        description:
            'Get Freight Invoice (ADINV10002) by reference or id — list fields, cargo, routing, charge groups. Pass focus for one field.',
        parameters: {
            type: 'object',
            properties: {
                referenceNo: { type: 'string', description: 'Invoice reference e.g. ADINV10002' },
                invoiceId: { type: 'number' },
                focus: {
                    type: 'string',
                    description:
                        'Optional: total, amount_due, status, currency, country, customer_name, freight_number, chargeable, cargo, routing, incoterm',
                },
            },
        },
    },
    {
        name: 'searchFreightInvoices',
        description:
            'Search Freight Invoice list (quote_invoice / ADINV) by customer, freight, order, reference, or status unpaid/paid.',
        parameters: {
            type: 'object',
            properties: {
                search: { type: 'string' },
                status: { type: 'string', description: 'Optional unpaid or paid' },
                freightNumber: { type: 'string' },
            },
        },
    },
    {
        name: 'countFreightInvoices',
        description: 'Count freight invoices (ADINV). Optional search or status.',
        parameters: {
            type: 'object',
            properties: {
                search: { type: 'string' },
                status: { type: 'string' },
            },
        },
    },
    {
        name: 'getCashbookDetails',
        description:
            'Get Cashbook entry by bank ref (20260729003) or id. Columns: date, bank ref, description, receipt, payment, customer, shipment ref, allocated, Invoice (POP).',
        parameters: {
            type: 'object',
            properties: {
                bankRef: { type: 'string', description: 'Bank reference e.g. 20260729003' },
                cashbookId: { type: 'number' },
                focus: {
                    type: 'string',
                    description:
                        'Optional: date, bank_ref, description, receipt, payment, customer, shipment_ref, allocated, invoice_pop',
                },
            },
        },
    },
    {
        name: 'searchCashbook',
        description:
            'Search Cashbook list by customer name, bank ref, description, order (OR000…), freight, or allocated Yes/No. Empty search returns recent entries.',
        parameters: {
            type: 'object',
            properties: {
                search: { type: 'string' },
                allocated: { type: 'string', description: 'Optional Yes or No' },
            },
        },
    },
    {
        name: 'countCashbook',
        description: 'Count cashbook entries. Optional search or allocated Yes/No.',
        parameters: {
            type: 'object',
            properties: {
                search: { type: 'string' },
                allocated: { type: 'string' },
            },
        },
    },
    {
        name: 'getSupplierInvoiceDetails',
        description:
            'Get Supplier Shipment Invoice by reference (SUPINV10015) or id — list fields, waybill/carrier/vessel, routing, charge groups.',
        parameters: {
            type: 'object',
            properties: {
                referenceNo: { type: 'string', description: 'e.g. SUPINV10015' },
                invoiceId: { type: 'number' },
                focus: {
                    type: 'string',
                    description:
                        'Optional: total, amount_due, status, currency, due_date, inv_date, waybill, supplier_name, cargo, routing, chargeable',
                },
            },
        },
    },
    {
        name: 'searchSupplierInvoices',
        description:
            'Search Supplier Invoice list by supplier name, waybill, reference, or status unpaid/paid. Empty search returns recent.',
        parameters: {
            type: 'object',
            properties: {
                search: { type: 'string' },
                status: { type: 'string' },
            },
        },
    },
    {
        name: 'countSupplierInvoices',
        description: 'Count supplier invoices (SUPINV). Optional search or status.',
        parameters: {
            type: 'object',
            properties: {
                search: { type: 'string' },
                status: { type: 'string' },
            },
        },
    },
    {
        name: 'getCollectionDeliveryDetails',
        description:
            'Get Collection and Delivery module details by freight (F-…) or order (OR000…). List card fields + edit form (pickup, packages, costs).',
        parameters: {
            type: 'object',
            properties: {
                freightNumber: { type: 'string' },
                orderNumber: { type: 'string' },
                focus: {
                    type: 'string',
                    description:
                        'Optional: status, type, mode, supplier, customer_ref, date_picked_up, pickup_address, contact, packages, hazardous, costs, warehouse_order',
                },
            },
        },
    },
    {
        name: 'searchCollectionDelivery',
        description:
            'Search Collection and Delivery list (collection or delivery tab) by customer, freight, order, country, type, or pending status.',
        parameters: {
            type: 'object',
            properties: {
                search: { type: 'string' },
                kind: { type: 'string', description: 'collection, delivery, or all' },
                status: { type: 'string', description: 'e.g. Pending' },
            },
        },
    },
    {
        name: 'countCollectionDelivery',
        description: 'Count Collection and Delivery entries. Optional kind collection/delivery and status.',
        parameters: {
            type: 'object',
            properties: {
                search: { type: 'string' },
                kind: { type: 'string' },
                status: { type: 'string' },
            },
        },
    },
    {
        name: 'getTaskDetails',
        description:
            'Get one Task Manager row by task id. Types: freight (Name, Freight Number, Due Date, Notes, Status, Action Required), clearance (Clearance Number…), custom (Title…).',
        parameters: {
            type: 'object',
            properties: {
                taskId: { type: 'number', description: 'Task id' },
                focus: {
                    type: 'string',
                    description:
                        'Optional: name, freight_number, clearance_number, title, due_date, notes, status, action_required',
                },
            },
            required: ['taskId'],
        },
    },
    {
        name: 'searchTasks',
        description:
            'Search Task Manager lists: freight tasks, clearance tasks, or custom tasks. Filter by staff name, F-…, C-…, title, status pending/in_progress/completed.',
        parameters: {
            type: 'object',
            properties: {
                search: { type: 'string' },
                taskType: {
                    type: 'string',
                    description: 'freight, clearance, custom, or all',
                },
                status: { type: 'string', description: 'pending, in_progress, or completed' },
            },
        },
    },
    {
        name: 'countTasks',
        description: 'Count Task Manager entries. Optional taskType freight/clearance/custom and status.',
        parameters: {
            type: 'object',
            properties: {
                search: { type: 'string' },
                taskType: { type: 'string' },
                status: { type: 'string' },
            },
        },
    },
    {
        name: 'getContactEnquiryDetails',
        description:
            'Get one Contact Us Enquiry by id. Fields: Name, Country, Email, Phone No, Subject, Nature of Enquiry, Message.',
        parameters: {
            type: 'object',
            properties: {
                enquiryId: { type: 'number', description: 'Contact enquiry id' },
                focus: {
                    type: 'string',
                    description: 'Optional: name, country, email, phone_no, subject, nature_of_enquiry, message',
                },
            },
            required: ['enquiryId'],
        },
    },
    {
        name: 'searchContactEnquiries',
        description:
            'Search Contact Us Enquiries by name, email, phone, subject, country, nature (e.g. Sales), or message text.',
        parameters: {
            type: 'object',
            properties: {
                search: { type: 'string' },
                nature: { type: 'string', description: 'e.g. Sales' },
            },
        },
    },
    {
        name: 'countContactEnquiries',
        description: 'Count Contact Us Enquiries. Optional search or nature filter.',
        parameters: {
            type: 'object',
            properties: {
                search: { type: 'string' },
                nature: { type: 'string' },
            },
        },
    },
    {
        name: 'getCountryOriginDetails',
        description:
            'Get one Country of Origin row by id or country name. Fields: Country Name, Cities, Sea Ports, Air Ports, Land Ports.',
        parameters: {
            type: 'object',
            properties: {
                originId: { type: 'number', description: 'country_origin id' },
                countryName: { type: 'string', description: 'e.g. Austria, Zimbabwe' },
                focus: {
                    type: 'string',
                    description: 'Optional: country_name, cities, sea_ports, air_ports, land_ports',
                },
            },
        },
    },
    {
        name: 'searchCountryOrigins',
        description: 'Search Country of Origin module by country name or city name.',
        parameters: {
            type: 'object',
            properties: {
                search: { type: 'string' },
            },
        },
    },
    {
        name: 'countCountryOrigins',
        description: 'Count Country of Origin entries. Optional country/city search.',
        parameters: {
            type: 'object',
            properties: {
                search: { type: 'string' },
            },
        },
    },
    {
        name: 'getPartnerDetails',
        description:
            'Get one partner directory profile: Custom Agent, Freight Forwarder, Groupage Warehouse, or Transporter. Fields: Email, Full Name, Phone Number, Country, Address.',
        parameters: {
            type: 'object',
            properties: {
                partnerId: { type: 'number' },
                partnerType: {
                    type: 'string',
                    description: 'customs_agent | freight_forwarder | groupage_warehouse | transporter',
                },
                focus: {
                    type: 'string',
                    description: 'Optional: email, full_name, phone, country, address',
                },
            },
            required: ['partnerId', 'partnerType'],
        },
    },
    {
        name: 'searchPartners',
        description:
            'Search Add Custom Agent / Freight Forwarder / Groupage Warehouse / Transporter directories by name, email, phone, country, or address.',
        parameters: {
            type: 'object',
            properties: {
                search: { type: 'string' },
                partnerType: {
                    type: 'string',
                    description: 'customs_agent | freight_forwarder | groupage_warehouse | transporter',
                },
            },
            required: ['partnerType'],
        },
    },
    {
        name: 'countPartners',
        description: 'Count Custom Agents, Freight Forwarders, Groupage Warehouses, or Transporters.',
        parameters: {
            type: 'object',
            properties: {
                search: { type: 'string' },
                partnerType: { type: 'string' },
            },
            required: ['partnerType'],
        },
    },
    {
        name: 'getCompanyAddressDetails',
        description:
            'Get one Company Address by id. Fields: Company Name, Email, Country, Telephone, Registration No / Tax No, Address.',
        parameters: {
            type: 'object',
            properties: {
                addressId: { type: 'number' },
                focus: {
                    type: 'string',
                    description: 'Optional: company_name, email, country, telephone, registration_tax, address',
                },
            },
            required: ['addressId'],
        },
    },
    {
        name: 'searchCompanyAddresses',
        description:
            'Search Company Addresses by company name, email, country, telephone, registration/tax no, or address.',
        parameters: {
            type: 'object',
            properties: {
                search: { type: 'string' },
            },
        },
    },
    {
        name: 'countCompanyAddresses',
        description: 'Count Company Addresses. Optional search filter.',
        parameters: {
            type: 'object',
            properties: {
                search: { type: 'string' },
            },
        },
    },
    {
        name: 'findClientsByName',
        description:
            'Find clients by name, email, or customer number. Set intent to "client" for profile details, or freights/invoices/orders/warehouse_orders/etc. for related lists.',
        parameters: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Client name, email, or customer number (e.g. S20832)' },
                intent: {
                    type: 'string',
                    description:
                        'What to show: client, freights, invoices, orders, warehouse_orders, batches, shipments, clearances, clearance_orders, or count_* variants',
                },
            },
            required: ['name'],
        },
    },
    {
        name: 'getClientDetails',
        description:
            'Get Customer Profile Details by clientId (numeric user id) or customerNumber (e.g. CE21170, S20832). Includes address, contact person, company/tax/importer refs, and related freights.',
        parameters: {
            type: 'object',
            properties: {
                clientId: { type: 'number' },
                customerNumber: { type: 'string' },
                focus: {
                    type: 'string',
                    description:
                        'Optional: email, phone, address, contact_person, country, company_id, importer_ref, tax_ref, province, related_freights',
                },
            },
        },
    },
    {
        name: 'countClients',
        description: 'Count active clients visible in the system. Use for "how many clients", "count customers".',
        parameters: { type: 'object', properties: {} },
    },
    {
        name: 'getMyInvoices',
        description: 'Get invoices for the currently logged-in customer user only (not for staff/admin).',
        parameters: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'getFreightsByClient',
        description:
            'List freights for a client by client ID. Use after findClientsByName when intent is freights, or when Client ID is known.',
        parameters: {
            type: 'object',
            properties: {
                clientId: { type: 'number', description: 'Client user ID' },
            },
            required: ['clientId'],
        },
    },
    {
        name: 'getOrderDetails',
        description:
            'Get a single order by order number (e.g. OR000253, OR0002). Use for status, goods, client, linked freight. Pass focus="status" when the user only asks for status.',
        parameters: {
            type: 'object',
            properties: {
                orderNumber: { type: 'string', description: 'Order number e.g. OR000253' },
                focus: {
                    type: 'string',
                    description: 'Optional specific field: status, client, freight, goods, warehouse, route',
                },
            },
            required: ['orderNumber'],
        },
    },
    {
        name: 'getOrdersByClient',
        description:
            'List orders for a client by client ID. Use after findClientsByName when intent is orders, or when Client ID is known.',
        parameters: {
            type: 'object',
            properties: {
                clientId: { type: 'number', description: 'Client user ID' },
            },
            required: ['clientId'],
        },
    },
    {
        name: 'getOrdersByFreight',
        description: 'List orders linked to a freight number (e.g. F-20260602006).',
        parameters: {
            type: 'object',
            properties: {
                freightNumber: { type: 'string', description: 'Freight number e.g. F-20260602006' },
            },
            required: ['freightNumber'],
        },
    },
    {
        name: 'countFreights',
        description:
            'Count freights the current user can see (permission-scoped). Use for "how many freights", "count total freight", "total freights". Optional clientId to count one client only.',
        parameters: {
            type: 'object',
            properties: {
                clientId: { type: 'number', description: 'Optional client user ID to count only their freights' },
            },
        },
    },
    {
        name: 'countOrders',
        description:
            'Count orders the current user can see (permission-scoped). Use for "how many orders", "count total orders". Optional clientId to count one client only.',
        parameters: {
            type: 'object',
            properties: {
                clientId: { type: 'number', description: 'Optional client user ID to count only their orders' },
            },
        },
    },
    ...LOGISTICS_TOOL_DEFINITIONS,
];

function mapFindClientsIntent(rawIntent) {
    const intent = String(rawIntent || 'invoices').toLowerCase().replace(/\s+/g, '_');
    if (intent === 'client' || intent === 'customer' || intent === 'profile' || intent === 'details') {
        return 'client';
    }
    if (intent === 'freight' || intent === 'freights') return 'freights';
    if (intent === 'order' || intent === 'orders') return 'orders';
    if (intent === 'invoice' || intent === 'invoices') return 'invoices';
    if (intent === 'warehouse' || intent === 'warehouse_order' || intent === 'warehouse_orders') {
        return 'warehouse_orders';
    }
    if (intent === 'batch' || intent === 'batches') return 'batches';
    if (intent === 'shipment' || intent === 'shipments') return 'shipments';
    if (intent === 'clearance' || intent === 'clearances') return 'clearances';
    if (intent === 'clearance_order' || intent === 'clearance_orders') return 'clearance_orders';
    if (intent.startsWith('count_')) return intent;
    return 'invoices';
}

function pendingToolForIntent(intent) {
    switch (intent) {
        case 'client':
            return 'getClientDetails';
        case 'freights':
            return 'getFreightsByClient';
        case 'orders':
            return 'getOrdersByClient';
        case 'warehouse_orders':
            return 'getWarehouseOrders';
        case 'batches':
            return 'listBatches';
        case 'shipments':
            return 'getShipments';
        case 'clearances':
            return 'getClearances';
        case 'clearance_orders':
            return 'getClearanceOrders';
        case 'count_freights':
            return 'countFreights';
        case 'count_orders':
            return 'countOrders';
        case 'count_warehouse_orders':
            return 'countWarehouseOrders';
        case 'count_batches':
            return 'countBatches';
        case 'count_shipments':
            return 'countShipments';
        case 'count_clearances':
            return 'countClearances';
        case 'count_clearance_orders':
            return 'countClearanceOrders';
        default:
            return 'getInvoicesByClient';
    }
}

function actionLabelForIntent(intent) {
    const labels = {
        client: 'show client details',
        freights: 'show freights',
        orders: 'show orders',
        invoices: 'show invoices',
        warehouse_orders: 'show warehouse orders',
        batches: 'show batches',
        shipments: 'show shipments',
        clearances: 'show clearances',
        clearance_orders: 'show clearance orders',
        count_freights: 'count freights',
        count_orders: 'count orders',
        count_warehouse_orders: 'count warehouse orders',
        count_batches: 'count batches',
        count_shipments: 'count shipments',
        count_clearances: 'count clearances',
        count_clearance_orders: 'count clearance orders',
    };
    return labels[intent] || 'show invoices';
}

function replyStaffProfile(staff, focus) {
    if (!staff) return { reply: 'Staff member not found.', data: null };
    const ref = staff.full_name || staff.email || staff.id;
    const straight = (label, value) => ({
        reply: `${label} for ${ref}: ${value == null || value === '' ? 'Not available' : value}.`,
        data: {
            focusedAnswer: {
                freightNumber: String(staff.id),
                label,
                value: value == null || value === '' ? 'Not available' : String(value),
                detail: null,
            },
            staff,
        },
    });
    if (focus === 'email') return straight('Email address', staff.email);
    if (focus === 'full_name') return straight('Full name', staff.full_name);
    if (focus === 'phone') return straight('Phone number', staff.phone_no);
    if (focus === 'country_code') {
        return straight('Country code', staff.country_code_label || staff.country_code);
    }
    if (focus === 'country') return straight('Country', staff.country_name);
    if (focus === 'roles') return straight('Assign roles', staff.assigned_roles_label);
    if (focus === 'access_countries') {
        return straight('Select country data', staff.access_countries_label);
    }
    if (focus === 'password') {
        return straight(
            'New password',
            staff.password_label || 'Not shown (••••••••• / leave blank to keep current)'
        );
    }
    if (focus === 'permissions') {
        return {
            reply: formatStaffProfileResponse(staff),
            data: { staff },
        };
    }
    return {
        reply: formatStaffProfileResponse(staff),
        data: { staff },
    };
}

function replySupplierProfile(supplier, focus) {
    if (!supplier) {
        return { reply: 'Supplier not found.', data: null };
    }
    const ref = supplier.company_name || supplier.name || supplier.id;
    const straight = (label, value) => ({
        reply: `${label} for ${ref}: ${value == null || value === '' ? 'Not available' : value}.`,
        data: {
            focusedAnswer: {
                freightNumber: String(supplier.id),
                label,
                value: value == null || value === '' ? 'Not available' : String(value),
                detail: null,
            },
            supplier,
            suppliers: [supplier],
        },
    });
    if (focus === 'company_name') return straight('Company name', supplier.company_name);
    if (focus === 'service_type') return straight('Type of service', supplier.service_type);
    if (focus === 'address') return straight('Address', supplier.address);
    if (focus === 'country_based') return straight('Country based', supplier.country_based);
    if (focus === 'country_of_origin') return straight('Country of origin', supplier.country_of_origin);
    if (focus === 'email') return straight('Email', supplier.email);
    if (focus === 'full_name') return straight('Full name', supplier.full_name);
    if (focus === 'phone') return straight('Phone number', supplier.phone_no);
    if (focus === 'country_code') {
        return straight('Country code', supplier.country_code_label || supplier.country_code);
    }
    if (focus === 'profile' || focus === 'image' || focus === 'profile_image') {
        return straight('Profile image', supplier.profile_label || supplier.profile || 'No file chosen');
    }
    if (focus === 'password') {
        return straight('Password', supplier.password_label || 'Not shown (leave blank to keep current)');
    }
    return {
        reply: formatSupplierProfileResponse(supplier),
        data: { supplier, suppliers: [supplier] },
    };
}

async function executeTool(toolName, args = {}, ctx, sessionId) {
    // Fallback: if only clientId was passed (e.g. disambiguation race), load invoices
    if (!toolName && (args.clientId || args.client_id)) {
        toolName = 'getInvoicesByClient';
    }

    const name = String(toolName || '')
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/-/g, '_')
        .toLowerCase();

    const normalized =
        name === 'get_invoices_by_client' || name === 'getinvoicesbyclient' || name === 'invoices_by_client'
            ? 'getInvoicesByClient'
            : name === 'get_my_invoices' || name === 'getmyinvoices' || name === 'my_invoices'
                ? 'getMyInvoices'
                : name === 'find_clients_by_name' || name === 'findclientsbyname' || name === 'find_client'
                    ? 'findClientsByName'
                    : name === 'find_supplier' || name === 'findsupplier'
                        ? 'findSupplier'
                        : name === 'get_supplier_details' || name === 'getsupplierdetails' || name === 'get_supplier'
                            ? 'getSupplierDetails'
                            : name === 'count_suppliers' || name === 'countsuppliers'
                                ? 'countSuppliers'
                                : name === 'get_staff_details' || name === 'getstaffdetails' || name === 'get_staff'
                                    ? 'getStaffDetails'
                                    : name === 'search_staff' || name === 'searchstaff' || name === 'find_staff'
                                        ? 'searchStaff'
                                        : name === 'count_staff' || name === 'countstaff'
                                            ? 'countStaff'
                                            : name === 'search_client_kpi' || name === 'searchclientkpi' || name === 'client_kpi'
                                                ? 'searchClientKpi'
                                                : name === 'get_client_kpi_details' || name === 'getclientkpidetails'
                                                    ? 'getClientKpiDetails'
                                                    : name === 'count_client_kpi' || name === 'countclientkpi'
                                                        ? 'countClientKpi'
                        : name === 'get_freight_full_details' || name === 'getfreightfulldetails' || name === 'get_freight_status'
                            ? 'getFreightFullDetails'
                            : name === 'get_freights_by_client' || name === 'getfreightsbyclient' || name === 'list_freights' || name === 'listfreights'
                                ? 'getFreightsByClient'
                                : name === 'get_order_details' || name === 'getorderdetails' || name === 'get_order'
                                    ? 'getOrderDetails'
                                    : name === 'get_orders_by_client' || name === 'getordersbyclient' || name === 'list_orders'
                                        ? 'getOrdersByClient'
                                        : name === 'get_orders_by_freight' || name === 'getordersbyfreight'
                                            ? 'getOrdersByFreight'
                                            : name === 'count_freights' || name === 'countfreights' || name === 'get_freight_count'
                                                ? 'countFreights'
                                                : name === 'count_orders' || name === 'countorders' || name === 'get_order_count'
                                                    ? 'countOrders'
                                                    : name === 'get_client_details' || name === 'getclientdetails' || name === 'get_client'
                                                        ? 'getClientDetails'
                                                        : name === 'count_clients' || name === 'countclients' || name === 'count_customers'
                                                            ? 'countClients'
                                                            : name === 'get_sage_invoice_details' || name === 'getsageinvoicedetails' || name === 'get_sage_invoice'
                                                                ? 'getSageInvoiceDetails'
                                                                : name === 'search_sage_invoices' || name === 'searchsageinvoices' || name === 'find_sage_invoice'
                                                                    ? 'searchSageInvoices'
                                                                    : name === 'count_sage_invoices' || name === 'countsageinvoices'
                                                                        ? 'countSageInvoices'
                                                                        : name === 'get_dispute_details' || name === 'getdisputedetails' || name === 'get_dispute'
                                                                            ? 'getDisputeDetails'
                                                                            : name === 'search_disputes' || name === 'searchdisputes' || name === 'find_dispute' || name === 'list_disputes'
                                                                                ? 'searchDisputes'
                                                                                : name === 'count_disputes' || name === 'countdisputes' || name === 'count_queries'
                                                                                    ? 'countDisputes'
                                                                                    : name === 'get_release_dashboard_details' || name === 'getreleasedashboarddetails' || name === 'get_release_dashboard'
                                                                                        ? 'getReleaseDashboardDetails'
                                                                                        : name === 'search_release_dashboard' || name === 'searchreleasedashboard' || name === 'list_release_dashboard'
                                                                                            ? 'searchReleaseDashboard'
                                                                                            : name === 'count_release_dashboard' || name === 'countreleasedashboard' || name === 'count_releases'
                                                                                                ? 'countReleaseDashboard'
                                                                                                : name === 'get_quote_details' || name === 'getquotedetails' || name === 'get_quote' || name === 'get_quotation'
                                                                                                    ? 'getQuoteDetails'
                                                                                                    : name === 'search_quotes' || name === 'searchquotes' || name === 'list_quotes' || name === 'search_quotations'
                                                                                                        ? 'searchQuotes'
                                                                                                        : name === 'count_quotes' || name === 'countquotes' || name === 'count_quotations'
                                                                                                            ? 'countQuotes'
                                                                                                            : name === 'get_freight_invoice_details' || name === 'getfreightinvoicedetails' || name === 'get_freight_invoice' || name === 'get_adinv'
                                                                                                                ? 'getFreightInvoiceDetails'
                                                                                                                : name === 'search_freight_invoices' || name === 'searchfreightinvoices' || name === 'list_freight_invoices'
                                                                                                                    ? 'searchFreightInvoices'
                                                                                                                    : name === 'count_freight_invoices' || name === 'countfreightinvoices' || name === 'count_adinv'
                                                                                                                        ? 'countFreightInvoices'
                                                                                                                        : name === 'get_cashbook_details' || name === 'getcashbookdetails' || name === 'get_cashbook'
                                                                                                                            ? 'getCashbookDetails'
                                                                                                                            : name === 'search_cashbook' || name === 'searchcashbook' || name === 'list_cashbook'
                                                                                                                                ? 'searchCashbook'
                                                                                                                                : name === 'count_cashbook' || name === 'countcashbook'
                                                                                                                                    ? 'countCashbook'
                                                                                                                                    : name === 'get_supplier_invoice_details' || name === 'getsupplierinvoicedetails' || name === 'get_supplier_invoice'
                                                                                                                                        ? 'getSupplierInvoiceDetails'
                                                                                                                                        : name === 'search_supplier_invoices' || name === 'searchsupplierinvoices' || name === 'list_supplier_invoices'
                                                                                                                                            ? 'searchSupplierInvoices'
                                                                                                                                            : name === 'count_supplier_invoices' || name === 'countsupplierinvoices'
                                                                                                                                                ? 'countSupplierInvoices'
                                                                                                                                                : name === 'get_collection_delivery_details' || name === 'getcollectiondeliverydetails' || name === 'get_collection_delivery'
                                                                                                                                                    ? 'getCollectionDeliveryDetails'
                                                                                                                                                    : name === 'search_collection_delivery' || name === 'searchcollectiondelivery' || name === 'list_collection_delivery'
                                                                                                                                                        ? 'searchCollectionDelivery'
                                                                                                                                                        : name === 'count_collection_delivery' || name === 'countcollectiondelivery'
                                                                                                                                                            ? 'countCollectionDelivery'
                                                                                                                                                            : name === 'get_task_details' || name === 'gettaskdetails' || name === 'get_task'
                                                                                                                                                                ? 'getTaskDetails'
                                                                                                                                                                : name === 'search_tasks' || name === 'searchtasks' || name === 'list_tasks' || name === 'search_task_manager'
                                                                                                                                                                    ? 'searchTasks'
                                                                                                                                                                    : name === 'count_tasks' || name === 'counttasks' || name === 'count_task_manager'
                                                                                                                                                                        ? 'countTasks'
                                                                                                                                                                        : name === 'get_contact_enquiry_details' || name === 'getcontactenquirydetails' || name === 'get_contact_enquiry' || name === 'get_enquiry'
                                                                                                                                                                            ? 'getContactEnquiryDetails'
                                                                                                                                                                            : name === 'search_contact_enquiries' || name === 'searchcontactenquiries' || name === 'list_contact_enquiries' || name === 'search_enquiries'
                                                                                                                                                                                ? 'searchContactEnquiries'
                                                                                                                                                                                : name === 'count_contact_enquiries' || name === 'countcontactenquiries' || name === 'count_enquiries'
                                                                                                                                                                                    ? 'countContactEnquiries'
                                                                                                                                                                                    : name === 'get_country_origin_details' || name === 'getcountryorigindetails' || name === 'get_country_origin'
                                                                                                                                                                                        ? 'getCountryOriginDetails'
                                                                                                                                                                                        : name === 'search_country_origins' || name === 'searchcountryorigins' || name === 'list_country_origins' || name === 'search_country_of_origin'
                                                                                                                                                                                            ? 'searchCountryOrigins'
                                                                                                                                                                                            : name === 'count_country_origins' || name === 'countcountryorigins' || name === 'count_countries_of_origin'
                                                                                                                                                                                                ? 'countCountryOrigins'
                                                                                                                                                                                                : name === 'get_partner_details' || name === 'getpartnerdetails' || name === 'get_customs_agent' || name === 'get_freight_forwarder' || name === 'get_transporter' || name === 'get_groupage_warehouse'
                                                                                                                                                                                                    ? 'getPartnerDetails'
                                                                                                                                                                                                    : name === 'search_partners' || name === 'searchpartners' || name === 'search_customs_agents' || name === 'search_freight_forwarders' || name === 'search_transporters' || name === 'search_groupage_warehouses' || name === 'list_partners'
                                                                                                                                                                                                        ? 'searchPartners'
                                                                                                                                                                                                        : name === 'count_partners' || name === 'countpartners' || name === 'count_customs_agents' || name === 'count_freight_forwarders' || name === 'count_transporters' || name === 'count_groupage_warehouses'
                                                                                                                                                                                                            ? 'countPartners'
                                                                                                                                                                                                            : name === 'get_company_address_details' || name === 'getcompanyaddressdetails' || name === 'get_company_address'
                                                                                                                                                                                                                ? 'getCompanyAddressDetails'
                                                                                                                                                                                                                : name === 'search_company_addresses' || name === 'searchcompanyaddresses' || name === 'list_company_addresses'
                                                                                                                                                                                                                    ? 'searchCompanyAddresses'
                                                                                                                                                                                                                    : name === 'count_company_addresses' || name === 'countcompanyaddresses'
                                                                                                                                                                                                                        ? 'countCompanyAddresses'
                                                                                                                                                                                                                        : toolName;

    switch (normalized) {
        case 'getFreightFullDetails': {
            const freightNumber = args.freightNumber || args.freight_number;
            const data = await getFreightFullDetails(freightNumber, ctx);
            if (!data) {
                return {
                    reply: `I could not find freight ${freightNumber}, or you may not have access to view it.`,
                    data: null,
                };
            }

            if (sessionId && data.freight?.freight_number) {
                setLastFreightNumber(sessionId, data.freight.freight_number);
            }

            const focus = args.focus || null;
            const f = data.freight;
            const estimate = data.estimateSummary;

            // Specific field asked → straight answer only (no full freight dump)
            const straight = (label, value, detail) => ({
                reply: detail
                    ? `${label} for ${f.freight_number}: ${value} (${detail}).`
                    : `${label} for ${f.freight_number}: ${value}.`,
                data: {
                    focusedAnswer: {
                        freightNumber: f.freight_number,
                        label,
                        value: value == null || value === '' ? 'Not available' : String(value),
                        detail: detail || null,
                    },
                },
            });

            if (focus === 'product_desc') {
                return straight('Product description', f.product_desc || 'Not available');
            }
            if (focus === 'estimate_amount') {
                if (!estimate || estimate.amount == null) {
                    return straight('Estimation amount', 'Not available yet');
                }
                const amountText = `${estimate.currency || ''} ${Number(estimate.amount).toLocaleString()}`.trim();
                return straight(
                    'Estimation amount',
                    amountText,
                    estimate.reference ? `Ref: ${estimate.reference}` : null
                );
            }
            if (focus === 'paid') {
                const estStatus = estimate?.status
                    ? String(estimate.status)
                    : null;
                const invoices = data.invoices || [];
                const isPaidStatus = (s) => {
                    const t = String(s || '').toLowerCase();
                    if (!t) return null;
                    if (/\bunpaid\b|\bpending\b|\boutstanding\b|\bdue\b/.test(t)) return false;
                    if (/\bpaid\b|\bcomplete\b|\bsettled\b/.test(t)) return true;
                    return null;
                };
                const paidInvoice = invoices.find((inv) =>
                    isPaidStatus(inv.invoice_status || inv.status) === true
                );
                if (estStatus) {
                    const paid = isPaidStatus(estStatus);
                    return straight(
                        'Estimate payment',
                        paid === true ? 'Paid by client' : 'Not paid yet',
                        [
                            estimate.reference ? `Ref: ${estimate.reference}` : null,
                            `Status: ${estStatus}`,
                            estimate.amount != null
                                ? `${estimate.currency || ''} ${Number(estimate.amount).toLocaleString()}`.trim()
                                : null,
                        ].filter(Boolean).join(' · ')
                    );
                }
                if (paidInvoice) {
                    return straight(
                        'Estimate payment',
                        'Paid by client',
                        paidInvoice.reference_no || paidInvoice.document_number || null
                    );
                }
                if (invoices.length) {
                    return straight(
                        'Estimate payment',
                        'Not paid yet',
                        `Latest invoice status: ${invoices[0].invoice_status || invoices[0].status || 'unknown'}`
                    );
                }
                return straight('Estimate payment', 'No payment / invoice record found yet');
            }
            if (focus === 'supplier') {
                const supplierName =
                    data.supplier?.name ||
                    f.assigned_supplier_name ||
                    null;
                if (!supplierName) {
                    return straight('Confirmed supplier', 'Not assigned / not confirmed yet');
                }
                return straight(
                    'Confirmed supplier',
                    supplierName,
                    data.supplier?.id ? `Supplier ID: ${data.supplier.id}` : null
                );
            }
            if (focus === 'commodity') {
                return straight('Commodity', f.commodity_name || 'Not available');
            }
            if (focus === 'sales_rep') {
                return straight('Sales rep', f.sales_rep_name || 'Not assigned');
            }
            if (focus === 'client') {
                return straight('Client', data.client?.full_name || f.client_name || 'N/A');
            }
            if (focus === 'route') {
                return straight(
                    'Route',
                    `${f.collection_from_name || '?'} → ${f.delivery_to_name || '?'}`
                );
            }
            if (focus === 'status') {
                return straight('Status', f.status_label || f.status);
            }
            if (focus === 'freight_number') {
                return straight('Freight number', f.freight_number);
            }
            if (focus === 'waybill') {
                const shipment = (data.shipments || [])[0];
                return straight(
                    'Waybill',
                    shipment?.waybill || 'Not available yet',
                    shipment?.vessel ? `Vessel: ${shipment.vessel}` : null
                );
            }
            if (focus === 'shipper') {
                return straight('Shipper', f.shipper_label || f.shipper_name || 'Not available', f.pickup_address_label || null);
            }
            if (focus === 'consignee') {
                return straight(
                    'Consignee',
                    f.consignee_label || data.client?.full_name || 'Not available',
                    [f.consignee_email, f.consignee_cell].filter(Boolean).join(' · ') || null
                );
            }
            if (focus === 'weight') {
                return straight('Weight (KGS)', f.weight_label != null ? f.weight_label : 'Not available');
            }
            if (focus === 'dimension') {
                return straight('Dimensions (CBM)', f.dimension_label != null ? f.dimension_label : 'Not available');
            }
            if (focus === 'packages') {
                return straight('No of packages', f.packages_label != null ? f.packages_label : 'Not available');
            }
            if (focus === 'package_type') {
                return straight('Packaging', f.packing_label || 'Not available');
            }
            if (focus === 'hazardous') {
                return straight('Hazardous', f.hazardous_label || 'Not available');
            }
            if (focus === 'volumetric_weight') {
                return straight(
                    'Vol weight (kgs)',
                    f.volumetric_weight_label != null ? f.volumetric_weight_label : 'Not available'
                );
            }
            if (focus === 'chargeable_weight') {
                return straight(
                    'Chargeable weight',
                    estimate?.chargeable != null ? estimate.chargeable : 'Not available'
                );
            }
            if (focus === 'port_of_loading') {
                return straight('Port of loading', f.port_of_loading_label || 'Not available');
            }
            if (focus === 'port_of_discharge') {
                return straight('Port of discharge', f.port_of_discharge_label || 'Not available');
            }
            if (focus === 'pickup_address') {
                return straight('Pickup address', f.pickup_address_label || 'Not available');
            }
            if (focus === 'delivery_address') {
                return straight(
                    'Delivery address',
                    f.delivery_address_label || f.place_of_delivery_label || 'Not available'
                );
            }
            if (focus === 'incoterm') {
                return straight('Incoterms', f.incoterm_label || 'Not available');
            }

            return {
                reply: formatFreightResponse(data),
                data,
            };
        }

        case 'findSupplier': {
            const search = String(args.name || args.search || '').trim();
            if (!search) {
                return { reply: 'Please provide a supplier company name, contact name, email, or ID.', data: null };
            }
            if (/^\d+$/.test(search)) {
                const one = await getSupplierById(Number(search));
                if (!one) {
                    return { reply: `No supplier found with ID ${search}.`, data: null };
                }
                return replySupplierProfile(one, args.focus);
            }
            if (search.includes('@')) {
                const byEmail = await getSupplierByEmail(search);
                if (byEmail) return replySupplierProfile(byEmail, args.focus);
            }
            const suppliers = await findSuppliersByName(search, ctx);
            if (suppliers.length === 1) {
                return replySupplierProfile(suppliers[0], args.focus);
            }
            return {
                reply: formatSupplierResponse(suppliers, search),
                data: { suppliers },
            };
        }

        case 'getSupplierDetails': {
            let supplier = null;
            const supplierId = args.supplierId || args.supplier_id ? Number(args.supplierId || args.supplier_id) : null;
            const email = args.email || null;
            if (supplierId) supplier = await getSupplierById(supplierId);
            else if (email) supplier = await getSupplierByEmail(email);
            if (!supplier) {
                return {
                    reply: 'Supplier not found. Try a company name, email, or supplier ID.',
                    data: null,
                };
            }
            return replySupplierProfile(supplier, args.focus);
        }

        case 'countSuppliers': {
            const total = await countSuppliers(ctx);
            return {
                reply: `Total suppliers: ${total.toLocaleString()}.`,
                data: {
                    count: {
                        entity: 'suppliers',
                        total,
                        scope: 'the system',
                    },
                },
            };
        }

        case 'getStaffDetails': {
            let staff = null;
            const staffId = args.staffId || args.staff_id ? Number(args.staffId || args.staff_id) : null;
            const email = args.email || null;
            if (staffId) staff = await getStaffById(staffId, ctx);
            else if (email) staff = await getStaffByEmail(email, ctx);
            if (!staff) {
                return {
                    reply: ctx.isCustomer
                        ? 'Staff directory is not available for customer accounts.'
                        : 'Staff member not found or access denied. Try a name, email, or staff ID.',
                    data: null,
                };
            }
            return replyStaffProfile(staff, args.focus);
        }

        case 'searchStaff': {
            const search = String(args.search || args.name || '').trim();
            if (!search) {
                return { reply: 'Please provide a staff name, email, phone, or ID.', data: null };
            }
            if (ctx.isCustomer) {
                return {
                    reply: 'Staff directory is not available for customer accounts.',
                    data: null,
                };
            }
            if (/^\d+$/.test(search)) {
                const one = await getStaffById(Number(search), ctx);
                if (!one) {
                    return { reply: `No staff found with ID ${search}, or access denied.`, data: null };
                }
                return replyStaffProfile(one, args.focus);
            }
            if (search.includes('@')) {
                const byEmail = await getStaffByEmail(search, ctx);
                if (byEmail) return replyStaffProfile(byEmail, args.focus);
            }
            const rows = await findStaffByName(search, ctx);
            if (!rows.length) {
                return { reply: `No staff matching "${search}" were found.`, data: { staffList: [] } };
            }
            if (rows.length === 1) return replyStaffProfile(rows[0], args.focus);
            return {
                reply: formatStaffListResponse(rows, search),
                data: { staffList: rows, search },
            };
        }

        case 'countStaff': {
            const result = await countStaff(ctx);
            if (!result.allowed) return { reply: result.message, data: null };
            return {
                reply: `Total staff: ${result.total.toLocaleString()}.`,
                data: {
                    count: {
                        entity: 'staff',
                        total: result.total,
                        scope: ctx.isAdmin || ctx.hasFullAccess ? 'the system' : 'your account',
                    },
                },
            };
        }

        case 'searchClientKpi': {
            const search = String(args.search || args.name || '').trim();
            const focus = args.focus || null;
            const rows = await searchClientKpi(search, ctx, { limit: 25 });
            if (!rows.length) {
                return {
                    reply: search
                        ? `No Client KPI rows found for "${search}".`
                        : 'No Client KPI rows found.',
                    data: { clientKpis: [] },
                };
            }

            let chosen = rows.length === 1 ? rows[0] : null;
            if (!chosen && search && rows.length > 1) {
                const term = search.toLowerCase();
                const exact = rows.filter((r) => String(r.name || '').toLowerCase() === term);
                const starts = rows.filter((r) => String(r.name || '').toLowerCase().startsWith(term));
                if (exact.length === 1) chosen = exact[0];
                else if (starts.length === 1) chosen = starts[0];
                // Focused questions: prefer top KPI match among prefix hits (list is amount-sorted)
                else if (focus && starts.length > 1) chosen = starts[0];
                else if (focus && exact.length === 0 && starts.length === 0 && rows.length >= 1) {
                    const includes = rows.filter((r) => String(r.name || '').toLowerCase().includes(term));
                    if (includes.length === 1 || (focus && includes.length > 1)) chosen = includes[0];
                }
            }

            if (chosen) {
                const row = chosen;
                if (focus === 'freight') {
                    return {
                        reply: `Freight for ${row.name}: ${row.freight}.`,
                        data: {
                            focusedAnswer: {
                                freightNumber: String(row.client_id),
                                label: 'Freight',
                                value: String(row.freight),
                                detail: null,
                            },
                            clientKpi: row,
                        },
                    };
                }
                if (focus === 'orders') {
                    return {
                        reply: `Orders for ${row.name}: ${row.orders}.`,
                        data: {
                            focusedAnswer: {
                                freightNumber: String(row.client_id),
                                label: 'Orders',
                                value: String(row.orders),
                                detail: null,
                            },
                            clientKpi: row,
                        },
                    };
                }
                if (focus === 'delivered_orders') {
                    return {
                        reply: `Delivered orders for ${row.name}: ${row.delivered_orders}.`,
                        data: {
                            focusedAnswer: {
                                freightNumber: String(row.client_id),
                                label: 'Delivered orders',
                                value: String(row.delivered_orders),
                                detail: null,
                            },
                            clientKpi: row,
                        },
                    };
                }
                if (focus === 'total_amount') {
                    return {
                        reply: `Total amount for ${row.name}: ${row.total_amount_label}.`,
                        data: {
                            focusedAnswer: {
                                freightNumber: String(row.client_id),
                                label: 'Total amount',
                                value: String(row.total_amount_label),
                                detail: null,
                            },
                            clientKpi: row,
                        },
                    };
                }
                return {
                    reply: formatClientKpiResponse(row),
                    data: { clientKpi: row },
                };
            }

            return {
                reply: formatClientKpiListResponse(rows, search || 'all clients'),
                data: { clientKpis: rows, search: search || undefined },
            };
        }

        case 'getClientKpiDetails': {
            const clientId = Number(args.clientId || args.client_id);
            const row = await getClientKpiByClientId(clientId, ctx);
            if (!row) {
                return { reply: `No Client KPI found for client ID ${clientId}.`, data: null };
            }
            return {
                reply: formatClientKpiResponse(row),
                data: { clientKpi: row },
            };
        }

        case 'countClientKpi': {
            const search = args.search || null;
            const result = await countClientKpi(ctx, { search });
            if (!result.allowed) return { reply: result.message, data: null };
            return {
                reply: `Total Client KPI clients${search ? ` matching "${search}"` : ''}: ${result.total.toLocaleString()}.`,
                data: {
                    count: {
                        entity: 'client_kpi',
                        total: result.total,
                        scope: search || 'the system',
                    },
                },
            };
        }

        case 'getInvoicesByClient':
        case 'getMyInvoices': {
            // Staff/admin do not have personal invoices — ask for a client
            if (normalized === 'getMyInvoices' && !ctx.isCustomer) {
                return {
                    reply: 'Staff and admin accounts do not have personal invoices. Please tell me a client name or Client ID (e.g. "Show invoices for John" or "Show invoices for Client ID 21988").',
                    data: null,
                };
            }

            const clientId = normalized === 'getMyInvoices'
                ? ctx.userId
                : Number(args.clientId || args.client_id);

            if (!clientId) {
                return {
                    reply: 'Please provide a client name or Client ID.',
                    data: null,
                };
            }

            const client = await getClientById(clientId, ctx);
            if (!client) {
                return {
                    reply: ctx.isCustomer
                        ? 'Could not load your client profile. Please check your user ID.'
                        : 'Client not found or access denied.',
                    data: null,
                };
            }
            const result = await getInvoicesByClientId(clientId, ctx);
            if (!result.allowed) {
                return { reply: result.message, data: null };
            }
            return {
                reply: formatInvoiceResponse(result.invoices, client.full_name),
                data: { client, invoices: result.invoices },
            };
        }

        case 'getFreightsByClient': {
            const clientId = Number(args.clientId || args.client_id);
            if (!clientId) {
                return {
                    reply: 'Please provide a client name or Client ID to list freights.',
                    data: null,
                };
            }

            const client = await getClientById(clientId, ctx);
            if (!client) {
                return {
                    reply: ctx.isCustomer
                        ? 'Could not load your client profile.'
                        : 'Client not found or access denied.',
                    data: null,
                };
            }

            const freights = await listFreightsByClientId(clientId, ctx);
            if (freights[0]?.freight_number && sessionId) {
                setLastFreightNumber(sessionId, freights[0].freight_number);
            }

            return {
                reply: formatFreightListResponse(freights, client.full_name),
                data: { client, freights },
            };
        }

        case 'getOrderDetails': {
            const orderNumber = args.orderNumber || args.order_number;
            const order = await getOrderByNumber(orderNumber, ctx);
            if (!order) {
                return {
                    reply: `I could not find order ${orderNumber}, or you may not have access to view it.`,
                    data: null,
                };
            }
            if (order.freight_number && sessionId) {
                setLastFreightNumber(sessionId, order.freight_number);
            }

            const focus = args.focus || null;
            const straight = (label, value, detail) => ({
                reply: detail
                    ? `${label} for ${order.order_number}: ${value} (${detail}).`
                    : `${label} for ${order.order_number}: ${value}.`,
                data: {
                    focusedAnswer: {
                        freightNumber: order.order_number,
                        label,
                        value: value == null || value === '' ? 'Not available' : String(value),
                        detail: detail || null,
                    },
                    order,
                },
            });

            if (focus === 'status') {
                if (order.tracking_started === false) {
                    return straight(
                        'Tracking status',
                        'Not started yet',
                        order.warehouse_status_label
                            ? `${order.warehouse_status_label}${order.freight_number ? ` · Freight ${order.freight_number}` : ''}`
                            : (order.freight_number ? `Freight ${order.freight_number}` : null)
                    );
                }
                return straight(
                    'Status',
                    order.status_label || 'Not available',
                    order.freight_number ? `Freight ${order.freight_number}` : null
                );
            }
            if (focus === 'client') {
                return straight('Client', order.client_name || 'Not available');
            }
            if (focus === 'estimate_amount') {
                if (order.freight_number) {
                    return executeTool(
                        'getFreightFullDetails',
                        { freightNumber: order.freight_number, focus: 'estimate_amount' },
                        ctx,
                        sessionId
                    );
                }
                return straight('Quote / estimate amount', 'Not available (no linked freight)');
            }
            if (focus === 'freight') {
                return straight('Linked freight', order.freight_number || 'Not linked');
            }
            if (focus === 'goods') {
                return straight('Goods', order.goods_description || 'Not available');
            }
            if (focus === 'warehouse') {
                return straight('Warehouse', order.warehouse_status_label || 'Not available');
            }
            if (focus === 'route') {
                const route =
                    order.collection_from_name || order.delivery_to_name
                        ? `${order.collection_from_name || '?'} → ${order.delivery_to_name || '?'}`
                        : 'Not available';
                return straight('Route', route);
            }

            return {
                reply: formatOrderResponse(order),
                data: { order },
            };
        }

        case 'getOrdersByClient': {
            const clientId = Number(args.clientId || args.client_id);
            if (!clientId) {
                return {
                    reply: 'Please provide a client name or Client ID to list orders.',
                    data: null,
                };
            }

            const client = await getClientById(clientId, ctx);
            if (!client) {
                return {
                    reply: ctx.isCustomer
                        ? 'Could not load your client profile.'
                        : 'Client not found or access denied.',
                    data: null,
                };
            }

            const orders = await listOrdersByClientId(clientId, ctx);
            if (orders[0]?.freight_number && sessionId) {
                setLastFreightNumber(sessionId, orders[0].freight_number);
            }

            return {
                reply: formatOrderListResponse(orders, client.full_name),
                data: { client, orders },
            };
        }

        case 'getOrdersByFreight': {
            const freightNumber = args.freightNumber || args.freight_number;
            if (!freightNumber) {
                return {
                    reply: 'Please provide a freight number to list its orders.',
                    data: null,
                };
            }

            const orders = await listOrdersByFreightNumber(freightNumber, ctx);
            if (sessionId) {
                setLastFreightNumber(sessionId, freightNumber);
            }

            return {
                reply: formatOrderListResponse(orders, freightNumber),
                data: { freightNumber, orders },
            };
        }

        case 'countFreights': {
            const clientId = args.clientId || args.client_id ? Number(args.clientId || args.client_id) : null;
            let scopeLabel = ctx.isCustomer
                ? 'your account'
                : ctx.isAdmin || ctx.hasFullAccess
                    ? 'the system'
                    : 'your accessible records';

            if (clientId) {
                const client = await getClientById(clientId, ctx);
                if (!client) {
                    return {
                        reply: 'Client not found or access denied.',
                        data: null,
                    };
                }
                scopeLabel = client.full_name;
            }

            const total = await countFreights(ctx, { clientId: clientId || undefined });
            const noun = total === 1 ? 'freight' : 'freights';
            return {
                reply: `Total ${noun} for ${scopeLabel}: ${total.toLocaleString()}.`,
                data: {
                    count: {
                        entity: 'freights',
                        total,
                        scope: scopeLabel,
                        clientId: clientId || null,
                    },
                },
            };
        }

        case 'countOrders': {
            const clientId = args.clientId || args.client_id ? Number(args.clientId || args.client_id) : null;
            let scopeLabel = ctx.isCustomer
                ? 'your account'
                : ctx.isAdmin || ctx.hasFullAccess
                    ? 'the system'
                    : 'your accessible records';

            if (clientId) {
                const client = await getClientById(clientId, ctx);
                if (!client) {
                    return {
                        reply: 'Client not found or access denied.',
                        data: null,
                    };
                }
                scopeLabel = client.full_name;
            }

            const total = await countOrders(ctx, { clientId: clientId || undefined });
            const noun = total === 1 ? 'order' : 'orders';
            return {
                reply: `Total ${noun} for ${scopeLabel}: ${total.toLocaleString()}.`,
                data: {
                    count: {
                        entity: 'orders',
                        total,
                        scope: scopeLabel,
                        clientId: clientId || null,
                    },
                },
            };
        }

        case 'countClients': {
            if (ctx.isCustomer) {
                return {
                    reply: 'As a customer you can only view your own profile.',
                    data: { count: { entity: 'clients', total: 1, scope: 'your account' } },
                };
            }
            const total = await countClients(ctx);
            return {
                reply: `Total active clients: ${total.toLocaleString()}.`,
                data: { count: { entity: 'clients', total, scope: 'the system' } },
            };
        }

        case 'getSageInvoiceDetails': {
            const documentNumber = args.documentNumber || args.document_number || args.search;
            const result = await getSageInvoiceByDocumentNumber(documentNumber, ctx);
            if (!result.allowed) return { reply: result.message, data: null };
            if (!result.invoice) {
                return {
                    reply: `I could not find Sage invoice ${documentNumber || ''}. Try the full document number (e.g. ADZWINV000637) or search by customer name/ref.`,
                    data: null,
                };
            }
            const inv = result.invoice;
            const focus = args.focus || null;
            const straight = (label, value) => ({
                reply: `${label} for ${inv.document_number || documentNumber}: ${value == null || value === '' ? 'Not available' : value}.`,
                data: {
                    focusedAnswer: {
                        freightNumber: inv.document_number,
                        label,
                        value: value == null || value === '' ? 'Not available' : String(value),
                        detail: null,
                    },
                    sageInvoice: inv,
                },
            });
            if (focus === 'document_number') return straight('Document number', inv.document_number);
            if (focus === 'customer_name') return straight('Customer name', inv.customer_name);
            if (focus === 'customer_ref') return straight('Customer ref.', inv.customer_ref);
            if (focus === 'date') return straight('Date', inv.date_label);
            if (focus === 'total') return straight('Total', inv.total_label);
            if (focus === 'upload') return straight('Upload', inv.upload_label);
            if (focus === 'invoice_ad') return straight('Invoice (AD)', inv.invoice_ad_label);
            return {
                reply: formatSageInvoiceResponse(inv),
                data: { sageInvoice: inv },
            };
        }

        case 'searchSageInvoices': {
            const search = args.search || args.name || args.documentNumber || args.document_number || '';
            const result = await searchSageInvoices(search, ctx);
            if (!result.allowed) return { reply: result.message, data: null };
            if (!result.invoices.length) {
                return {
                    reply: search
                        ? `No Sage invoices matched "${search}". Try document number, customer name, or customer ref.`
                        : 'No Sage invoices found.',
                    data: { sageInvoices: [] },
                };
            }
            if (result.invoices.length === 1) {
                return {
                    reply: formatSageInvoiceResponse(result.invoices[0]),
                    data: { sageInvoice: result.invoices[0] },
                };
            }
            return {
                reply: formatSageInvoiceListResponse(result.invoices, search || 'recent'),
                data: { sageInvoices: result.invoices, search: search || 'recent' },
            };
        }

        case 'countSageInvoices': {
            const result = await countSageInvoices(ctx);
            if (!result.allowed) return { reply: result.message, data: null };
            return {
                reply: `Total Sage invoices: ${result.total.toLocaleString()}.`,
                data: { count: { entity: 'sage invoices', total: result.total, scope: ctx.isCustomer ? 'your account' : 'the system' } },
            };
        }

        case 'getDisputeDetails': {
            const disputeId = args.disputeId || args.dispute_id || args.id;
            const row = await getDisputeById(disputeId, ctx);
            if (!row) {
                return {
                    reply: `I could not find dispute ${disputeId || ''}, or access is denied.`,
                    data: null,
                };
            }
            const focus = args.focus || null;
            const straight = (label, value) => ({
                reply: `${label} for ${row.dispute_id}: ${value == null || value === '' ? 'Not available' : value}.`,
                data: {
                    focusedAnswer: {
                        freightNumber: row.dispute_id,
                        label,
                        value: value == null || value === '' ? 'Not available' : String(value),
                        detail: null,
                    },
                    dispute: row,
                },
            });
            if (focus === 'outcome') return straight('Outcome', row.outcome_label);
            if (focus === 'subject') return straight('Subject', row.subject);
            if (focus === 'nature') return straight('Nature of heading', row.nature_of_heading);
            if (focus === 'message') return straight('Message', row.message);
            if (focus === 'name') return straight('Name', row.name);
            if (focus === 'freight_no') return straight('Freight / Order', row.freight_no);
            return {
                reply: formatDisputeResponse(row),
                data: { dispute: row },
            };
        }

        case 'searchDisputes': {
            const search = args.search || args.name || args.freightNumber || args.freight_no || args.orderNumber;
            const outcome = args.outcome || null;
            let rows = [];
            if (search && (/^F-\d+/i.test(String(search)) || /^OR0*\d+/i.test(String(search)))) {
                rows = await listDisputesByFreightOrOrder(search, ctx);
            } else {
                rows = await searchDisputes(search || '', ctx, { outcome: outcome || undefined });
            }
            if (!rows.length) {
                return {
                    reply: search
                        ? `No disputes found for ${search}.`
                        : 'No disputes found.',
                    data: { disputes: [] },
                };
            }
            if (rows.length === 1) {
                return {
                    reply: formatDisputeResponse(rows[0]),
                    data: { dispute: rows[0] },
                };
            }
            const label = [search, outcome].filter(Boolean).join(' · ') || 'disputes';
            return {
                reply: formatDisputeListResponse(rows, label),
                data: { disputes: rows, search: search || null, outcome: outcome || null },
            };
        }

        case 'countDisputes': {
            const search = args.search || null;
            const outcome = args.outcome || null;
            const total = await countDisputes(ctx, { search, outcome });
            const scopeBits = [outcome, search].filter(Boolean);
            const scope = scopeBits.length ? scopeBits.join(' · ') : ctx.isCustomer ? 'your account' : 'the system';
            return {
                reply: `Total disputes${scopeBits.length ? ` (${scopeBits.join(', ')})` : ''}: ${total.toLocaleString()}.`,
                data: { count: { entity: 'disputes', total, scope } },
            };
        }

        case 'getReleaseDashboardDetails': {
            const orderNumber = args.orderNumber || args.order_number;
            const row = await getReleaseByOrderNumber(orderNumber, ctx);
            if (!row) {
                return {
                    reply: `I could not find release dashboard details for ${orderNumber || 'that order'}, or access is denied.`,
                    data: null,
                };
            }
            const focus = args.focus || null;
            const straight = (label, value) => ({
                reply: `${label} for ${row.order_number}: ${value == null || value === '' ? 'Not available' : value}.`,
                data: {
                    focusedAnswer: {
                        freightNumber: row.order_number,
                        label,
                        value: value == null || value === '' ? 'Not available' : String(value),
                        detail: null,
                    },
                    release: row,
                },
            });
            if (focus === 'clearing_status') return straight('Clearing status', row.clearing_status);
            if (focus === 'cargo_inspection') return straight('Cargo inspection', row.cargo_inspection);
            if (focus === 'payment') return straight('Payment', row.payment_label);
            if (focus === 'release_instruction') return straight('Release instruction', row.release_instruction);
            if (focus === 'delivery') return straight('Delivery', row.delivery_label);
            if (focus === 'status') return straight('Status', row.status_label);
            if (focus === 'customer_name') return straight('Customer name', row.customer_name);
            return {
                reply: formatReleaseResponse(row),
                data: { release: row },
            };
        }

        case 'searchReleaseDashboard': {
            const search = args.search || args.name || args.orderNumber || args.order_number;
            const status = args.status || null;
            const rows = await searchReleaseDashboard(search || '', ctx, { status: status || undefined });
            if (!rows.length) {
                return {
                    reply: search || status
                        ? `No release dashboard entries found for ${[search, status].filter(Boolean).join(' · ')}.`
                        : 'No release dashboard entries found.',
                    data: { releases: [] },
                };
            }
            if (rows.length === 1) {
                return {
                    reply: formatReleaseResponse(rows[0]),
                    data: { release: rows[0] },
                };
            }
            const label = [search, status].filter(Boolean).join(' · ') || 'release dashboard';
            return {
                reply: formatReleaseListResponse(rows, label),
                data: { releases: rows, search: search || null, status: status || null },
            };
        }

        case 'countReleaseDashboard': {
            const search = args.search || null;
            const status = args.status || null;
            const total = await countReleaseDashboard(ctx, { search, status });
            const scopeBits = [status, search].filter(Boolean);
            const scope = scopeBits.length ? scopeBits.join(' · ') : ctx.isCustomer ? 'your account' : 'the system';
            return {
                reply: `Total release dashboard entries${scopeBits.length ? ` (${scopeBits.join(', ')})` : ''}: ${total.toLocaleString()}.`,
                data: { count: { entity: 'releases', total, scope } },
            };
        }

        case 'getQuoteDetails': {
            const referenceNo = args.referenceNo || args.reference_no || args.reference;
            const quoteId = args.quoteId || args.quote_id ? Number(args.quoteId || args.quote_id) : null;
            let row = null;
            if (referenceNo) row = await getQuoteByReference(referenceNo, ctx);
            else if (quoteId) row = await getQuoteById(quoteId, ctx);
            if (!row) {
                return {
                    reply: `I could not find quotation ${referenceNo || quoteId || ''}, or access is denied.`.replace(
                        /\s+,/,
                        ''
                    ),
                    data: null,
                };
            }
            const focus = args.focus || null;
            const money = (v) =>
                v == null || v === ''
                    ? 'Not available'
                    : `${row.currency || ''} ${Number(v).toLocaleString()}`.trim();
            const straight = (label, value) => ({
                reply: `${label} for ${row.reference_no}: ${value == null || value === '' ? 'Not available' : value}.`,
                data: {
                    focusedAnswer: {
                        freightNumber: row.reference_no,
                        label,
                        value: value == null || value === '' ? 'Not available' : String(value),
                        detail: null,
                    },
                    quote: row,
                },
            });
            if (focus === 'total') return straight('Total', money(row.total));
            if (focus === 'amount_due') return straight('Amount due', money(row.amount_due));
            if (focus === 'status') return straight('Status', row.status_label);
            if (focus === 'currency') return straight('Currency', row.currency);
            if (focus === 'country') return straight('Country', row.country);
            if (focus === 'customer_name') return straight('Customer name', row.customer_name);
            if (focus === 'freight_number') return straight('Freight number', row.freight_number);
            if (focus === 'chargeable') return straight('Chargeable', row.chargeable);
            if (focus === 'incoterm') return straight('Incoterm', row.incoterm);
            if (focus === 'cargo') {
                return {
                    reply: [
                        `Cargo for ${row.reference_no}:`,
                        `Product: ${row.product_desc || '—'}`,
                        `Commodity: ${row.commodity_name || '—'}`,
                        `Hazardous: ${row.hazardous_label || '—'}`,
                        `Packages: ${row.packages != null ? row.packages : '—'} ${row.package_type || ''}`.trim(),
                        `Weight: ${row.weight != null ? row.weight : '—'} kgs`,
                        `CBM: ${row.dimension != null ? row.dimension : '—'}`,
                        `Volumetric: ${row.volumetric_weight != null ? row.volumetric_weight : '—'}`,
                        `Chargeable: ${row.chargeable != null ? row.chargeable : '—'}`,
                    ].join('\n'),
                    data: { quote: row },
                };
            }
            if (focus === 'routing') {
                return {
                    reply: [
                        `Routing for ${row.reference_no}:`,
                        `Origin: ${row.origin_country || '—'}`,
                        `Receipt: ${row.place_of_receipt || '—'}`,
                        `POL: ${row.port_of_loading || '—'}`,
                        `POD: ${row.port_of_discharge || '—'}`,
                        `Delivery: ${row.place_of_delivery || '—'}`,
                        `Incoterm: ${row.incoterm || '—'}`,
                        `Mode: ${row.mode_of_transport || '—'}`,
                        `Load: ${row.load_type || '—'}`,
                        `Insurance: ${row.insurance_label || '—'}`,
                    ].join('\n'),
                    data: { quote: row },
                };
            }
            return {
                reply: formatQuoteResponse(row),
                data: { quote: row },
            };
        }

        case 'searchQuotes': {
            const search = args.search || args.name || args.referenceNo || args.reference_no;
            const status = args.status || null;
            const freightNumber = args.freightNumber || args.freight_number;
            let rows;
            if (freightNumber) {
                rows = await listQuotesByFreightNumber(freightNumber, ctx);
            } else {
                rows = await searchQuotes(search || '', ctx, { status: status || undefined });
            }
            if (!rows.length) {
                return {
                    reply: search || status || freightNumber
                        ? `No quotations found for ${[freightNumber, search, status].filter(Boolean).join(' · ')}.`
                        : 'No quotations found.',
                    data: { quotes: [] },
                };
            }
            if (rows.length === 1) {
                const full = await getQuoteById(rows[0].id, ctx);
                return {
                    reply: formatQuoteResponse(full || rows[0]),
                    data: { quote: full || rows[0] },
                };
            }
            const label = [freightNumber, search, status].filter(Boolean).join(' · ') || 'quotations';
            return {
                reply: formatQuoteListResponse(rows, label),
                data: { quotes: rows, search: search || freightNumber || null, status: status || null },
            };
        }

        case 'countQuotes': {
            const search = args.search || null;
            const status = args.status || null;
            const total = await countQuotes(ctx, { search, status });
            const scopeBits = [status, search].filter(Boolean);
            const scope = scopeBits.length ? scopeBits.join(' · ') : ctx.isCustomer ? 'your account' : 'the system';
            return {
                reply: `Total quotations${scopeBits.length ? ` (${scopeBits.join(', ')})` : ''}: ${total.toLocaleString()}.`,
                data: { count: { entity: 'quotes', total, scope } },
            };
        }

        case 'getFreightInvoiceDetails': {
            const referenceNo = args.referenceNo || args.reference_no || args.reference;
            const invoiceId = args.invoiceId || args.invoice_id ? Number(args.invoiceId || args.invoice_id) : null;
            let row = null;
            if (referenceNo) row = await getFreightInvoiceByReference(referenceNo, ctx);
            else if (invoiceId) row = await getFreightInvoiceById(invoiceId, ctx);
            if (!row) {
                return {
                    reply: `I could not find freight invoice ${referenceNo || invoiceId || ''}, or access is denied.`.replace(
                        /\s+,/,
                        ''
                    ),
                    data: null,
                };
            }
            const focus = args.focus || null;
            const money = (v) =>
                v == null || v === ''
                    ? 'Not available'
                    : `${row.currency || ''} ${Number(v).toLocaleString()}`.trim();
            const straight = (label, value) => ({
                reply: `${label} for ${row.reference_no}: ${value == null || value === '' ? 'Not available' : value}.`,
                data: {
                    focusedAnswer: {
                        freightNumber: row.reference_no,
                        label,
                        value: value == null || value === '' ? 'Not available' : String(value),
                        detail: null,
                    },
                    freightInvoice: row,
                },
            });
            if (focus === 'total') return straight('Total', money(row.total));
            if (focus === 'amount_due') return straight('Amount due', money(row.amount_due));
            if (focus === 'status') return straight('Status', row.status_label);
            if (focus === 'currency') return straight('Currency', row.currency);
            if (focus === 'country') return straight('Country', row.country);
            if (focus === 'customer_name') return straight('Customer name', row.customer_name);
            if (focus === 'freight_number') {
                return straight(
                    'Freight / Order number',
                    row.freight_or_order || row.freight_number || row.order_number
                );
            }
            if (focus === 'chargeable') return straight('Chargeable', row.chargeable);
            if (focus === 'incoterm') return straight('Incoterm', row.incoterm);
            if (focus === 'cargo') {
                return {
                    reply: [
                        `Cargo for ${row.reference_no}:`,
                        `Product: ${row.product_desc || '—'}`,
                        `Commodity: ${row.commodity_name || '—'}`,
                        `Hazardous: ${row.hazardous_label || '—'}`,
                        `Packages: ${row.packages != null ? row.packages : '—'} ${row.package_type || ''}`.trim(),
                        `Weight: ${row.weight != null ? row.weight : '—'} kgs`,
                        `CBM: ${row.dimension != null ? row.dimension : '—'}`,
                        `Volumetric: ${row.volumetric_weight != null ? row.volumetric_weight : '—'}`,
                        `Chargeable: ${row.chargeable != null ? row.chargeable : '—'}`,
                    ].join('\n'),
                    data: { freightInvoice: row },
                };
            }
            if (focus === 'routing') {
                return {
                    reply: [
                        `Routing for ${row.reference_no}:`,
                        `Origin: ${row.origin_country || '—'}`,
                        `Receipt: ${row.place_of_receipt || '—'}`,
                        `POL: ${row.port_of_loading || '—'}`,
                        `POD: ${row.port_of_discharge || '—'}`,
                        `Delivery: ${row.place_of_delivery || '—'}`,
                        `Incoterm: ${row.incoterm || '—'}`,
                        `Mode: ${row.mode_of_transport || '—'}`,
                        `Load: ${row.load_type || '—'}`,
                        `Insurance: ${row.insurance_label || '—'}`,
                    ].join('\n'),
                    data: { freightInvoice: row },
                };
            }
            return {
                reply: formatFreightInvoiceResponse(row),
                data: { freightInvoice: row },
            };
        }

        case 'searchFreightInvoices': {
            const search = args.search || args.name || args.referenceNo || args.reference_no;
            const status = args.status || null;
            const freightNumber = args.freightNumber || args.freight_number;
            let rows;
            if (freightNumber) {
                rows = await listFreightInvoicesByFreightNumber(freightNumber, ctx);
            } else {
                rows = await searchFreightInvoices(search || '', ctx, { status: status || undefined });
            }
            if (!rows.length) {
                return {
                    reply: search || status || freightNumber
                        ? `No freight invoices found for ${[freightNumber, search, status].filter(Boolean).join(' · ')}.`
                        : 'No freight invoices found.',
                    data: { freightInvoices: [] },
                };
            }
            if (rows.length === 1) {
                const full = await getFreightInvoiceById(rows[0].id, ctx);
                return {
                    reply: formatFreightInvoiceResponse(full || rows[0]),
                    data: { freightInvoice: full || rows[0] },
                };
            }
            const label = [freightNumber, search, status].filter(Boolean).join(' · ') || 'freight invoices';
            return {
                reply: formatFreightInvoiceListResponse(rows, label),
                data: {
                    freightInvoices: rows,
                    search: search || freightNumber || null,
                    status: status || null,
                },
            };
        }

        case 'countFreightInvoices': {
            const search = args.search || null;
            const status = args.status || null;
            const total = await countFreightInvoices(ctx, { search, status });
            const scopeBits = [status, search].filter(Boolean);
            const scope = scopeBits.length ? scopeBits.join(' · ') : ctx.isCustomer ? 'your account' : 'the system';
            return {
                reply: `Total freight invoices${scopeBits.length ? ` (${scopeBits.join(', ')})` : ''}: ${total.toLocaleString()}.`,
                data: { count: { entity: 'freight_invoices', total, scope } },
            };
        }

        case 'getCashbookDetails': {
            const bankRef = args.bankRef || args.bank_ref || args.reference;
            const cashbookId = args.cashbookId || args.cashbook_id ? Number(args.cashbookId || args.cashbook_id) : null;
            let result;
            if (bankRef) result = await getCashbookByBankRef(bankRef, ctx);
            else if (cashbookId) result = await getCashbookById(cashbookId, ctx);
            else result = { allowed: true, entry: null };
            if (!result.allowed) return { reply: result.message, data: null };
            const row = result.entry;
            if (!row) {
                return {
                    reply: `I could not find cashbook ${bankRef || cashbookId || ''}, or access is denied.`.replace(/\s+,/, ''),
                    data: null,
                };
            }
            const focus = args.focus || null;
            const money = (v) => (v == null || v === '' ? 'Not available' : Number(v).toLocaleString());
            const straight = (label, value) => ({
                reply: `${label} for ${row.bank_ref}: ${value == null || value === '' ? 'Not available' : value}.`,
                data: {
                    focusedAnswer: {
                        freightNumber: row.bank_ref,
                        label,
                        value: value == null || value === '' ? 'Not available' : String(value),
                        detail: null,
                    },
                    cashbook: row,
                },
            });
            if (focus === 'date') return straight('Date', row.date_label);
            if (focus === 'bank_ref') return straight('Bank ref.', row.bank_ref);
            if (focus === 'description') return straight('Description of receipt', row.description);
            if (focus === 'receipt') return straight('Receipt', money(row.receipt));
            if (focus === 'payment') return straight('Payment', money(row.payment));
            if (focus === 'customer') return straight('Customer', row.customer_name);
            if (focus === 'shipment_ref') return straight('Shipment ref', row.shipment_ref);
            if (focus === 'allocated') return straight('Allocated', row.allocated_label);
            if (focus === 'invoice_pop') return straight('Invoice (POP)', row.invoice_pop_label);
            return {
                reply: formatCashbookResponse(row),
                data: { cashbook: row },
            };
        }

        case 'searchCashbook': {
            const search = args.search || args.name || args.bankRef || args.bank_ref || '';
            const allocated = args.allocated || null;
            const result = await searchCashbook(search, ctx, { allocated: allocated || undefined });
            if (!result.allowed) return { reply: result.message, data: null };
            if (!result.entries.length) {
                return {
                    reply: search || allocated
                        ? `No cashbook entries found for ${[search, allocated].filter(Boolean).join(' · ')}.`
                        : 'No cashbook entries found.',
                    data: { cashbookEntries: [] },
                };
            }
            if (result.entries.length === 1) {
                return {
                    reply: formatCashbookResponse(result.entries[0]),
                    data: { cashbook: result.entries[0] },
                };
            }
            const label = [search, allocated].filter(Boolean).join(' · ') || 'recent';
            return {
                reply: formatCashbookListResponse(result.entries, label),
                data: { cashbookEntries: result.entries, search: search || 'recent', allocated },
            };
        }

        case 'countCashbook': {
            const search = args.search || null;
            const allocated = args.allocated || null;
            const result = await countCashbook(ctx, { search, allocated });
            if (!result.allowed) return { reply: result.message, data: null };
            const scopeBits = [allocated, search].filter(Boolean);
            return {
                reply: `Total cashbook entries${scopeBits.length ? ` (${scopeBits.join(', ')})` : ''}: ${result.total.toLocaleString()}.`,
                data: {
                    count: {
                        entity: 'cashbook',
                        total: result.total,
                        scope: scopeBits.length ? scopeBits.join(' · ') : ctx.isCustomer ? 'your account' : 'the system',
                    },
                },
            };
        }

        case 'getSupplierInvoiceDetails': {
            const referenceNo = args.referenceNo || args.reference_no || args.reference;
            const invoiceId = args.invoiceId || args.invoice_id ? Number(args.invoiceId || args.invoice_id) : null;
            let result;
            if (referenceNo) result = await getSupplierInvoiceByReference(referenceNo, ctx);
            else if (invoiceId) result = await getSupplierInvoiceById(invoiceId, ctx);
            else result = { allowed: true, invoice: null };
            if (!result.allowed) return { reply: result.message, data: null };
            const row = result.invoice;
            if (!row) {
                return {
                    reply: `I could not find supplier invoice ${referenceNo || invoiceId || ''}, or access is denied.`.replace(
                        /\s+,/,
                        ''
                    ),
                    data: null,
                };
            }
            const focus = args.focus || null;
            const money = (v) =>
                v == null || v === ''
                    ? 'Not available'
                    : `${row.currency || ''} ${Number(v).toLocaleString()}`.trim();
            const straight = (label, value) => ({
                reply: `${label} for ${row.reference_no}: ${value == null || value === '' ? 'Not available' : value}.`,
                data: {
                    focusedAnswer: {
                        freightNumber: row.reference_no,
                        label,
                        value: value == null || value === '' ? 'Not available' : String(value),
                        detail: null,
                    },
                    supplierInvoice: row,
                },
            });
            if (focus === 'total') return straight('Total', money(row.total));
            if (focus === 'amount_due') return straight('Amount due', money(row.amount_due));
            if (focus === 'status') return straight('Status', row.status_label);
            if (focus === 'currency') return straight('Currency', row.currency);
            if (focus === 'due_date') return straight('Due date', row.due_date_label);
            if (focus === 'inv_date') return straight('Inv date', row.inv_date_label);
            if (focus === 'waybill') return straight('Waybill', row.waybill);
            if (focus === 'supplier_name') return straight('Supplier name', row.supplier_name);
            if (focus === 'supplier_invoice_no') return straight('Sup invoice number', row.supplier_invoice_no);
            if (focus === 'chargeable') return straight('Chargeable', row.chargeable);
            if (focus === 'cargo') {
                return {
                    reply: [
                        `Shipment / cargo for ${row.reference_no}:`,
                        `Waybill: ${row.waybill || '—'}`,
                        `Carrier: ${row.carrier || '—'}`,
                        `Vessel: ${row.vessel || '—'}`,
                        `ETD: ${row.etd_label || '—'}`,
                        `ATD: ${row.atd_label || '—'}`,
                        `Chargeable: ${row.chargeable != null ? row.chargeable : '—'}`,
                        `Status: ${row.shipment_status || '—'}`,
                        `Origin agent: ${row.origin_agent || '—'}`,
                        `Freight mode: ${row.freight_mode || '—'}`,
                    ].join('\n'),
                    data: { supplierInvoice: row },
                };
            }
            if (focus === 'routing') {
                return {
                    reply: [
                        `Routing for ${row.reference_no}:`,
                        `POL: ${row.port_of_loading || '—'}`,
                        `POD: ${row.port_of_discharge || '—'}`,
                        `Destination agent: ${row.destination_agent || '—'}`,
                        `Container: ${row.container || '—'}`,
                        `Load: ${row.load_type || '—'}`,
                        `Release type: ${row.release_type || '—'}`,
                        `Origin: ${row.origin_country || '—'}`,
                        `Destination: ${row.destination_country || '—'}`,
                    ].join('\n'),
                    data: { supplierInvoice: row },
                };
            }
            return {
                reply: formatSupplierInvoiceResponse(row),
                data: { supplierInvoice: row },
            };
        }

        case 'searchSupplierInvoices': {
            const search = args.search || args.name || args.referenceNo || args.reference_no || '';
            const status = args.status || null;
            const result = await searchSupplierInvoices(search, ctx, { status: status || undefined });
            if (!result.allowed) return { reply: result.message, data: null };
            if (!result.invoices.length) {
                return {
                    reply: search || status
                        ? `No supplier invoices found for ${[search, status].filter(Boolean).join(' · ')}.`
                        : 'No supplier invoices found.',
                    data: { supplierInvoices: [] },
                };
            }
            if (result.invoices.length === 1) {
                const full = await getSupplierInvoiceById(result.invoices[0].id, ctx);
                const row = full.invoice || result.invoices[0];
                return {
                    reply: formatSupplierInvoiceResponse(row),
                    data: { supplierInvoice: row },
                };
            }
            const label = [search, status].filter(Boolean).join(' · ') || 'recent';
            return {
                reply: formatSupplierInvoiceListResponse(result.invoices, label),
                data: { supplierInvoices: result.invoices, search: search || 'recent', status },
            };
        }

        case 'countSupplierInvoices': {
            const search = args.search || null;
            const status = args.status || null;
            const result = await countSupplierInvoices(ctx, { search, status });
            if (!result.allowed) return { reply: result.message, data: null };
            const scopeBits = [status, search].filter(Boolean);
            return {
                reply: `Total supplier invoices${scopeBits.length ? ` (${scopeBits.join(', ')})` : ''}: ${result.total.toLocaleString()}.`,
                data: {
                    count: {
                        entity: 'supplier_invoices',
                        total: result.total,
                        scope: scopeBits.length ? scopeBits.join(' · ') : 'the system',
                    },
                },
            };
        }

        case 'getCollectionDeliveryDetails': {
            const freightNumber = args.freightNumber || args.freight_number;
            const orderNumber = args.orderNumber || args.order_number;
            let row = null;
            if (freightNumber) row = await getCollectionDeliveryByFreight(freightNumber, ctx);
            else if (orderNumber) row = await getCollectionDeliveryByOrder(orderNumber, ctx);
            if (!row) {
                return {
                    reply: `I could not find collection/delivery for ${freightNumber || orderNumber || 'that reference'}, or access is denied.`,
                    data: null,
                };
            }
            const focus = args.focus || null;
            const ref = row.freight_number || row.order_number;
            const straight = (label, value) => ({
                reply: `${label} for ${ref}: ${value == null || value === '' ? 'Not available' : value}.`,
                data: {
                    focusedAnswer: {
                        freightNumber: ref,
                        label,
                        value: value == null || value === '' ? 'Not available' : String(value),
                        detail: null,
                    },
                    collectionDelivery: row,
                },
            });
            if (focus === 'status') return straight('Status', row.status_label);
            if (focus === 'type') return straight('Type', row.type_label);
            if (focus === 'mode') return straight('Mode', row.mode_label);
            if (focus === 'supplier') {
                return straight('Supplier', row.supplier_name || row.collection_supplier);
            }
            if (focus === 'customer_ref') return straight('Customer ref', row.customer_ref);
            if (focus === 'date_picked_up') return straight('Date picked up', row.date_picked_up_label);
            if (focus === 'pickup_address') return straight('Pickup address', row.pickup_address);
            if (focus === 'contact') {
                return {
                    reply: [
                        `Contact for ${ref}:`,
                        `Person: ${row.supplier_contact_person || '—'}`,
                        `Number: ${row.supplier_contact || '—'}`,
                    ].join('\n'),
                    data: { collectionDelivery: row },
                };
            }
            if (focus === 'warehouse_order') {
                return straight(
                    'Warehouse order',
                    row.warehouse_order_id != null
                        ? String(row.warehouse_order_id)
                        : row.create_new_warehouse_order || '—'
                );
            }
            if (focus === 'courier_waybill_ref') return straight('Courier waybill ref', row.courier_waybill_ref);
            if (focus === 'packages') {
                return {
                    reply: [
                        `Packages for ${ref}:`,
                        `Box marking: ${row.box_marking || '—'}`,
                        `Package type: ${row.package_type || '—'}`,
                        `Goods: ${row.goods_description || '—'}`,
                        `Total packages: ${row.total_packages != null ? row.total_packages : '—'}`,
                        `Total CBM: ${row.total_cbm != null ? row.total_cbm : '—'}`,
                        `Total weight: ${row.total_weight != null ? row.total_weight : '—'}`,
                        `Comments: ${row.package_comments || '—'}`,
                    ].join('\n'),
                    data: { collectionDelivery: row },
                };
            }
            if (focus === 'hazardous') {
                return straight(
                    'Hazardous',
                    row.hazardous_description
                        ? `${row.hazardous_label || '—'} (${row.hazardous_description})`
                        : row.hazardous_label
                );
            }
            if (focus === 'costs') {
                return {
                    reply: [
                        `Costs for ${ref}:`,
                        `Costs to collect: ${row.costs_to_collect != null ? row.costs_to_collect : '—'}`,
                        `Handling cost: ${row.handling_cost != null ? row.handling_cost : '—'}`,
                        `Warehouse cost: ${row.warehouse_cost != null ? row.warehouse_cost : '—'}`,
                        `Warehouse comment: ${row.warehouse_comment || '—'}`,
                    ].join('\n'),
                    data: { collectionDelivery: row },
                };
            }
            return {
                reply: formatCollectionDeliveryResponse(row),
                data: { collectionDelivery: row },
            };
        }

        case 'searchCollectionDelivery': {
            const search = args.search || args.name || args.freightNumber || '';
            const kind = args.kind || 'collection';
            const status = args.status || null;
            const rows = await searchCollectionDelivery(search, ctx, {
                kind,
                status: status || undefined,
            });
            if (!rows.length) {
                return {
                    reply: search || status
                        ? `No collection/delivery entries found for ${[kind, search, status].filter(Boolean).join(' · ')}.`
                        : `No ${kind} entries found.`,
                    data: { collectionDeliveries: [] },
                };
            }
            if (rows.length === 1) {
                const full = await getCollectionDeliveryByFreight(rows[0].freight_number, ctx);
                return {
                    reply: formatCollectionDeliveryResponse(full || rows[0]),
                    data: { collectionDelivery: full || rows[0] },
                };
            }
            const label = [kind, search, status].filter(Boolean).join(' · ') || kind;
            return {
                reply: formatCollectionDeliveryListResponse(rows, label),
                data: { collectionDeliveries: rows, search: search || undefined, kind, status },
            };
        }

        case 'countCollectionDelivery': {
            const search = args.search || null;
            const kind = args.kind || 'collection';
            const status = args.status || null;
            const total = await countCollectionDelivery(ctx, { search, kind, status });
            const scopeBits = [kind, status, search].filter(Boolean);
            return {
                reply: `Total collection/delivery entries${scopeBits.length ? ` (${scopeBits.join(', ')})` : ''}: ${total.toLocaleString()}.`,
                data: {
                    count: {
                        entity: 'collection_delivery',
                        total,
                        scope: scopeBits.length ? scopeBits.join(' · ') : ctx.isCustomer ? 'your account' : 'the system',
                    },
                },
            };
        }

        case 'getTaskDetails': {
            const taskId = args.taskId || args.task_id ? Number(args.taskId || args.task_id) : null;
            const row = await getTaskById(taskId, ctx);
            if (!row) {
                return {
                    reply: `I could not find task ${taskId || ''}, or access is denied.`.replace(/\s+,/, ''),
                    data: null,
                };
            }
            const focus = args.focus || null;
            const straight = (label, value) => ({
                reply: `${label} for task #${row.id}: ${value == null || value === '' ? 'Not available' : value}.`,
                data: {
                    focusedAnswer: {
                        freightNumber: String(row.id),
                        label,
                        value: value == null || value === '' ? 'Not available' : String(value),
                        detail: null,
                    },
                    task: row,
                },
            });
            if (focus === 'name') return straight('Name', row.name);
            if (focus === 'freight_number') return straight('Freight number', row.freight_number);
            if (focus === 'clearance_number') return straight('Clearance number', row.clearance_number);
            if (focus === 'title') return straight('Title', row.title);
            if (focus === 'due_date') return straight('Due date', row.due_date_label);
            if (focus === 'notes') return straight('Notes', row.notes);
            if (focus === 'status') return straight('Status', row.status_label);
            if (focus === 'action_required') return straight('Action required', row.action_required);
            return {
                reply: formatTaskResponse(row),
                data: { task: row },
            };
        }

        case 'searchTasks': {
            const search = args.search || args.name || null;
            const taskType = args.taskType || args.task_type || null;
            const status = args.status || null;
            const rows = await searchTasks(search || '', ctx, {
                taskType: taskType || undefined,
                status: status || undefined,
            });
            if (!rows.length) {
                return {
                    reply: `No Task Manager entries found${search || taskType || status ? ` for ${[taskType, status, search].filter(Boolean).join(' · ')}` : ''}.`,
                    data: { tasks: [] },
                };
            }
            if (rows.length === 1) {
                const full = await getTaskById(rows[0].id, ctx);
                return {
                    reply: formatTaskResponse(full || rows[0]),
                    data: { task: full || rows[0] },
                };
            }
            const label = [taskType, status, search].filter(Boolean).join(' · ') || 'all tasks';
            return {
                reply: formatTaskListResponse(rows, label),
                data: { tasks: rows, search: search || undefined, taskType, status },
            };
        }

        case 'countTasks': {
            const search = args.search || null;
            const taskType = args.taskType || args.task_type || null;
            const status = args.status || null;
            const result = await countTasks(ctx, {
                search: search || undefined,
                taskType: taskType || undefined,
                status: status || undefined,
            });
            if (!result.allowed) {
                return { reply: result.message || 'Task Manager is not available.', data: null };
            }
            const scopeBits = [taskType, status, search].filter(Boolean);
            return {
                reply: `Total Task Manager entries${scopeBits.length ? ` (${scopeBits.join(', ')})` : ''}: ${result.total.toLocaleString()}.`,
                data: {
                    count: {
                        entity: 'tasks',
                        total: result.total,
                        scope: scopeBits.length ? scopeBits.join(' · ') : 'the system',
                    },
                },
            };
        }

        case 'getContactEnquiryDetails': {
            const enquiryId = args.enquiryId || args.enquiry_id || args.id ? Number(args.enquiryId || args.enquiry_id || args.id) : null;
            const row = await getContactEnquiryById(enquiryId, ctx);
            if (!row) {
                return {
                    reply: `I could not find contact enquiry ${enquiryId || ''}, or access is denied.`.replace(/\s+,/, ''),
                    data: null,
                };
            }
            const focus = args.focus || null;
            const straight = (label, value) => ({
                reply: `${label} for enquiry #${row.id}: ${value == null || value === '' ? 'Not available' : value}.`,
                data: {
                    focusedAnswer: {
                        freightNumber: String(row.id),
                        label,
                        value: value == null || value === '' ? 'Not available' : String(value),
                        detail: null,
                    },
                    contactEnquiry: row,
                },
            });
            if (focus === 'name') return straight('Name', row.name);
            if (focus === 'country') return straight('Country', row.country);
            if (focus === 'email') return straight('Email', row.email);
            if (focus === 'phone_no') return straight('Phone No', row.phone_no);
            if (focus === 'subject') return straight('Subject', row.subject);
            if (focus === 'nature_of_enquiry') return straight('Nature of Enquiry', row.nature_of_enquiry);
            if (focus === 'message') return straight('Message', row.message);
            return {
                reply: formatContactEnquiryResponse(row),
                data: { contactEnquiry: row },
            };
        }

        case 'searchContactEnquiries': {
            const search = args.search || args.name || args.email || null;
            const nature = args.nature || args.nature_of_enquiry || null;
            const rows = await searchContactEnquiries(search || '', ctx, {
                nature: nature || undefined,
            });
            if (!rows.length) {
                return {
                    reply: `No Contact Us enquiries found${search || nature ? ` for ${[nature, search].filter(Boolean).join(' · ')}` : ''}.`,
                    data: { contactEnquiries: [] },
                };
            }
            if (rows.length === 1) {
                const full = await getContactEnquiryById(rows[0].id, ctx);
                return {
                    reply: formatContactEnquiryResponse(full || rows[0]),
                    data: { contactEnquiry: full || rows[0] },
                };
            }
            const label = [nature, search].filter(Boolean).join(' · ') || 'all enquiries';
            return {
                reply: formatContactEnquiryListResponse(rows, label),
                data: { contactEnquiries: rows, search: search || undefined, nature },
            };
        }

        case 'countContactEnquiries': {
            const search = args.search || null;
            const nature = args.nature || args.nature_of_enquiry || null;
            const result = await countContactEnquiries(ctx, {
                search: search || undefined,
                nature: nature || undefined,
            });
            if (!result.allowed) {
                return { reply: result.message || 'Contact Us Enquiries are not available.', data: null };
            }
            const scopeBits = [nature, search].filter(Boolean);
            return {
                reply: `Total Contact Us enquiries${scopeBits.length ? ` (${scopeBits.join(', ')})` : ''}: ${result.total.toLocaleString()}.`,
                data: {
                    count: {
                        entity: 'contact_enquiries',
                        total: result.total,
                        scope: scopeBits.length ? scopeBits.join(' · ') : 'the system',
                    },
                },
            };
        }

        case 'getCountryOriginDetails': {
            const originId = args.originId || args.origin_id || args.id ? Number(args.originId || args.origin_id || args.id) : null;
            const countryName = args.countryName || args.country_name || args.search || null;
            let row = null;
            if (originId) row = await getCountryOriginById(originId, ctx);
            else if (countryName) row = await getCountryOriginByCountryName(countryName, ctx);
            if (!row) {
                return {
                    reply: `I could not find Country of Origin${originId || countryName ? ` for ${originId || countryName}` : ''}, or access is denied.`.replace(/\s+,/, ''),
                    data: null,
                };
            }
            const focus = args.focus || null;
            const straight = (label, value) => ({
                reply: `${label} for ${row.country_name}: ${value == null || value === '' ? 'Not available' : value}.`,
                data: {
                    focusedAnswer: {
                        freightNumber: String(row.id),
                        label,
                        value: value == null || value === '' ? 'Not available' : String(value),
                        detail: null,
                    },
                    countryOrigin: row,
                },
            });
            if (focus === 'country_name') return straight('Country Name', row.country_name);
            if (focus === 'cities') return straight('Cities', row.cities_label);
            if (focus === 'sea_ports') return straight('Sea Ports', row.sea_ports_label);
            if (focus === 'air_ports') return straight('Air Ports', row.air_ports_label);
            if (focus === 'land_ports') return straight('Land Ports', row.land_ports_label);
            return {
                reply: formatCountryOriginResponse(row),
                data: { countryOrigin: row },
            };
        }

        case 'searchCountryOrigins': {
            const search = args.search || args.countryName || args.country_name || null;
            const rows = await searchCountryOrigins(search || '', ctx);
            if (!rows.length) {
                return {
                    reply: `No Country of Origin entries found${search ? ` for ${search}` : ''}.`,
                    data: { countryOrigins: [] },
                };
            }
            if (rows.length === 1) {
                return {
                    reply: formatCountryOriginResponse(rows[0]),
                    data: { countryOrigin: rows[0] },
                };
            }
            return {
                reply: formatCountryOriginListResponse(rows, search || 'all'),
                data: { countryOrigins: rows, search: search || undefined },
            };
        }

        case 'countCountryOrigins': {
            const search = args.search || null;
            const result = await countCountryOrigins(ctx, { search: search || undefined });
            if (!result.allowed) {
                return { reply: result.message || 'Country of Origin is not available.', data: null };
            }
            return {
                reply: `Total Country of Origin entries${search ? ` (${search})` : ''}: ${result.total.toLocaleString()}.`,
                data: {
                    count: {
                        entity: 'country_origins',
                        total: result.total,
                        scope: search || 'the system',
                    },
                },
            };
        }

        case 'getPartnerDetails': {
            const partnerId = args.partnerId || args.partner_id || args.id
                ? Number(args.partnerId || args.partner_id || args.id)
                : null;
            const partnerType = args.partnerType || args.partner_type || args.type;
            const typeMeta = normalizePartnerType(partnerType);
            const row = await getPartnerById(partnerId, ctx, partnerType);
            if (!row) {
                return {
                    reply: `I could not find ${typeMeta?.label || 'partner'} ${partnerId || ''}, or access is denied.`.replace(
                        /\s+,/,
                        ''
                    ),
                    data: null,
                };
            }
            const focus = args.focus || null;
            const straight = (label, value) => ({
                reply: `${label} for ${row.full_name || `#${row.id}`}: ${value == null || value === '' ? 'Not available' : value}.`,
                data: {
                    focusedAnswer: {
                        freightNumber: String(row.id),
                        label,
                        value: value == null || value === '' ? 'Not available' : String(value),
                        detail: null,
                    },
                    partner: row,
                },
            });
            if (focus === 'email') return straight('Email', row.email);
            if (focus === 'full_name' || focus === 'name') return straight('Full Name', row.full_name);
            if (focus === 'phone') return straight('Phone Number', row.phone);
            if (focus === 'country') return straight('Country', row.country_name);
            if (focus === 'address') return straight('Address', row.address);
            return {
                reply: formatPartnerResponse(row),
                data: { partner: row },
            };
        }

        case 'searchPartners': {
            const search = args.search || args.name || args.email || null;
            const partnerType = args.partnerType || args.partner_type || args.type;
            const typeMeta = normalizePartnerType(partnerType);
            if (!typeMeta) {
                return {
                    reply: 'Which directory?\n\nExamples:\n- Custom agents\n- Freight forwarders\n- Groupage warehouses\n- Transporters',
                    data: null,
                };
            }
            const rows = await searchPartners(search || '', ctx, { partnerType: typeMeta.key });
            if (!rows.length) {
                return {
                    reply: `No ${typeMeta.label} entries found${search ? ` for ${search}` : ''}.`,
                    data: { partners: [] },
                };
            }
            if (rows.length === 1) {
                const full = await getPartnerById(rows[0].id, ctx, typeMeta.key);
                return {
                    reply: formatPartnerResponse(full || rows[0]),
                    data: { partner: full || rows[0] },
                };
            }
            const label = search || `all ${typeMeta.label}`;
            return {
                reply: formatPartnerListResponse(rows, label),
                data: { partners: rows, search: search || undefined, partnerType: typeMeta.key },
            };
        }

        case 'countPartners': {
            const search = args.search || null;
            const partnerType = args.partnerType || args.partner_type || args.type;
            const result = await countPartners(ctx, {
                search: search || undefined,
                partnerType,
            });
            if (!result.allowed) {
                return { reply: result.message || 'Partner directory is not available.', data: null };
            }
            return {
                reply: `Total ${result.label}${search ? ` (${search})` : ''}: ${result.total.toLocaleString()}.`,
                data: {
                    count: {
                        entity: result.partnerType || 'partners',
                        total: result.total,
                        scope: search || result.label || 'the system',
                    },
                },
            };
        }

        case 'getCompanyAddressDetails': {
            const addressId = args.addressId || args.address_id || args.id
                ? Number(args.addressId || args.address_id || args.id)
                : null;
            const row = await getCompanyAddressById(addressId, ctx);
            if (!row) {
                return {
                    reply: `I could not find company address ${addressId || ''}, or access is denied.`.replace(/\s+,/, ''),
                    data: null,
                };
            }
            const focus = args.focus || null;
            const straight = (label, value) => ({
                reply: `${label} for ${row.company_name}: ${value == null || value === '' ? 'Not available' : value}.`,
                data: {
                    focusedAnswer: {
                        freightNumber: String(row.id),
                        label,
                        value: value == null || value === '' ? 'Not available' : String(value),
                        detail: null,
                    },
                    companyAddress: row,
                },
            });
            if (focus === 'company_name') return straight('Company Name', row.company_name);
            if (focus === 'email') return straight('Email', row.email);
            if (focus === 'country') return straight('Country', row.country);
            if (focus === 'telephone') return straight('Telephone', row.telephone);
            if (focus === 'registration_tax') return straight('Registration No / Tax No', row.registration_tax_label);
            if (focus === 'address') return straight('Address', row.address);
            return {
                reply: formatCompanyAddressResponse(row),
                data: { companyAddress: row },
            };
        }

        case 'searchCompanyAddresses': {
            const search = args.search || args.name || args.country || null;
            const rows = await searchCompanyAddresses(search || '', ctx);
            if (!rows.length) {
                return {
                    reply: `No Company Addresses found${search ? ` for ${search}` : ''}.`,
                    data: { companyAddresses: [] },
                };
            }
            if (rows.length === 1) {
                return {
                    reply: formatCompanyAddressResponse(rows[0]),
                    data: { companyAddress: rows[0] },
                };
            }
            return {
                reply: formatCompanyAddressListResponse(rows, search || 'all'),
                data: { companyAddresses: rows, search: search || undefined },
            };
        }

        case 'countCompanyAddresses': {
            const search = args.search || null;
            const result = await countCompanyAddresses(ctx, { search: search || undefined });
            if (!result.allowed) {
                return { reply: result.message || 'Company Addresses are not available.', data: null };
            }
            return {
                reply: `Total Company Addresses${search ? ` (${search})` : ''}: ${result.total.toLocaleString()}.`,
                data: {
                    count: {
                        entity: 'company_addresses',
                        total: result.total,
                        scope: search || 'the system',
                    },
                },
            };
        }

        case 'getClientDetails': {
            let client = null;
            const clientId = args.clientId || args.client_id ? Number(args.clientId || args.client_id) : null;
            const customerNumber = args.customerNumber || args.customer_number || args.name;
            const focus = args.focus || null;
            if (clientId) {
                client = await getClientById(clientId, ctx, { includeFreights: true });
            } else if (customerNumber) {
                client = await getClientByCustomerId(customerNumber, ctx, { includeFreights: true });
                if (!client) {
                    const found = await findClientsByName(String(customerNumber), ctx);
                    const best = pickBestClientMatch(found, customerNumber) || (found.length === 1 ? found[0] : null);
                    if (best) client = await attachRelatedFreights(best, ctx);
                    else if (found.length > 1) {
                        setPendingDisambiguation(sessionId, 'getClientDetails', found);
                        return {
                            reply: formatClientDisambiguation(found, 'show client details'),
                            data: { candidates: found, pendingIntent: 'client' },
                            needsDisambiguation: true,
                        };
                    }
                }
            }
            if (!client) {
                return {
                    reply: 'Client not found or access denied. Try a name, email, Customer ID (e.g. CE21170 / S20832), or Client ID.',
                    data: null,
                };
            }

            const ref = client.customer_id || client.id;
            const straight = (label, value) => ({
                reply: `${label} for ${ref}: ${value == null || value === '' ? 'Not available' : value}.`,
                data: {
                    focusedAnswer: {
                        freightNumber: String(ref),
                        label,
                        value: value == null || value === '' ? 'Not available' : String(value),
                        detail: null,
                    },
                    client,
                },
            });
            if (focus === 'email') return straight('Email', client.email);
            if (focus === 'phone') {
                return {
                    reply: [
                        `Phone for ${ref}:`,
                        `Cellphone: ${client.cellphone || '—'}`,
                        `Telephone: ${client.telephone || '—'}`,
                    ].join('\n'),
                    data: { client },
                };
            }
            if (focus === 'address') {
                return {
                    reply: [
                        `Address for ${ref}:`,
                        `Address 1: ${client.address_1 || '—'}`,
                        `Address 2: ${client.address_2 || '—'}`,
                        `City: ${client.city || '—'}`,
                        `Province: ${client.province || '—'}`,
                        `Code: ${client.code || '—'}`,
                        `Country: ${client.country_name || '—'}`,
                    ].join('\n'),
                    data: { client },
                };
            }
            if (focus === 'contact_person') return straight('Contact person', client.contact_person);
            if (focus === 'company_id') return straight('Company ID', client.company_id);
            if (focus === 'importer_ref') return straight('Importer reference', client.importers_ref);
            if (focus === 'tax_ref') return straight('Tax reference', client.tax_ref);
            if (focus === 'country') return straight('Country', client.country_name);
            if (focus === 'province') return straight('Province', client.province);
            if (focus === 'city') return straight('City', client.city);
            if (focus === 'code') return straight('Code', client.code);
            if (focus === 'image') return straight('Customer image', client.profile || client.profile_url);
            if (focus === 'related_freights') {
                const freights = client.related_freights || [];
                if (!freights.length) {
                    return { reply: `No related freights for ${ref}.`, data: { client } };
                }
                return {
                    reply: formatClientResponse({ ...client, related_freights: freights }),
                    data: { client },
                };
            }

            return {
                reply: formatClientResponse(client),
                data: { client },
            };
        }

        case 'findClientsByName': {
            const intent = mapFindClientsIntent(args.intent);
            const clients = await findClientsByName(args.name, ctx);
            if (!clients.length) {
                if (ctx.isCustomer) {
                    return {
                        reply: `I could not find "${args.name}" linked to your account. As a client, you can only view your own data.`,
                        data: null,
                    };
                }
                return {
                    reply: `No clients named "${args.name}" were found. Check the spelling, or try a Customer ID (e.g. CE21170).`,
                    data: null,
                };
            }

            const best = pickBestClientMatch(clients, args.name);
            const chosen = best || (clients.length === 1 ? clients[0] : null);

            if (chosen) {
                const tool = pendingToolForIntent(intent);
                if (tool === 'getClientDetails') {
                    const profile = await attachRelatedFreights(chosen, ctx);
                    return {
                        reply: formatClientResponse(profile),
                        data: { client: profile },
                    };
                }
                if (tool === 'getInvoicesByClient') {
                    const result = await getInvoicesByClientId(chosen.id, ctx);
                    if (!result.allowed) {
                        return { reply: result.message, data: null };
                    }
                    return {
                        reply: formatInvoiceResponse(result.invoices, chosen.full_name || chosen.display_name),
                        data: { client: chosen, invoices: result.invoices },
                    };
                }
                return executeTool(tool, { clientId: chosen.id }, ctx, sessionId);
            }

            const pending = pendingToolForIntent(intent);
            setPendingDisambiguation(sessionId, pending, clients);
            return {
                reply: formatClientDisambiguation(clients, actionLabelForIntent(intent)),
                data: { candidates: clients, pendingIntent: intent },
                needsDisambiguation: true,
            };
        }

        default: {
            const logistics = await executeLogisticsTool(toolName, args, ctx, sessionId);
            if (logistics) return logistics;
            console.error('Unknown AI tool:', toolName, args);
            return {
                reply: 'I could not complete that action. Please try again, or choose an option from the menu.',
                data: null,
            };
        }
    }
}

async function resolveDisambiguation(message, ctx, sessionId) {
    const session = getSession(sessionId);
    if (!session.pendingAction || !session.candidates.length) return null;

    const trimmed = message.trim();
    let selected = null;

    // "1", "1.", "option 1", "1. John Smith"
    const numMatch = trimmed.match(/^(?:option\s*)?(\d+)\b/i);
    if (numMatch) {
        const idx = Number(numMatch[1]) - 1;
        selected = session.candidates[idx];
    }

    // Direct client ID — including "Show freights/invoices for Client ID 123"
    if (!selected) {
        const idMatch =
            trimmed.match(/client\s*id\s*[#:]?\s*(\d+)/i) ||
            trimmed.match(/(?:^|\s)#?:?\s*(\d{2,})\s*$/i) ||
            trimmed.match(/^(\d{3,})$/);
        if (idMatch) {
            const id = Number(idMatch[1]);
            selected = session.candidates.find((c) => Number(c.id) === id);
        }
    }

    if (!selected) {
        const lower = trimmed.toLowerCase();
        selected = session.candidates.find((c) => {
            const name = String(c.display_name || c.full_name || c.email || '').toLowerCase();
            if (!name) return false;
            return name === lower || name.includes(lower) || lower.includes(name);
        });
    }

    if (!selected) return null;

    const action = session.pendingAction;
    const clientId = selected.id;
    clearPending(sessionId);
    return executeTool(action, { clientId }, ctx, sessionId);
}

async function ruleBasedRoute(message, ctx, sessionId) {
    const lower = message.toLowerCase().trim();

    const disambiguationResult = await resolveDisambiguation(message, ctx, sessionId);
    if (disambiguationResult) return disambiguationResult;

    if (isGreetingOrSmallTalk(message)) {
        return { reply: greetingReply(message), data: null };
    }

    // Company Addresses
    if (isCountCompanyAddressRequest(message)) {
        return executeTool(
            'countCompanyAddresses',
            { search: extractCompanyAddressSearchTerm(message) || undefined },
            ctx,
            sessionId
        );
    }
    if (isCompanyAddressRequest(message)) {
        const idMatch = message.match(/\b(?:company\s+address(?:es)?|company)\s*(?:id|#)?\s*(\d{1,8})\b/i);
        const focus = extractCompanyAddressFocus(message);
        if (idMatch) {
            return executeTool(
                'getCompanyAddressDetails',
                { addressId: Number(idMatch[1]), focus: focus || undefined },
                ctx,
                sessionId
            );
        }
        const search = extractCompanyAddressSearchTerm(message);
        if (search || /\b(show|list|all|company\s+address(?:es)?)\b/i.test(message)) {
            return executeTool(
                'searchCompanyAddresses',
                { search: search || undefined },
                ctx,
                sessionId
            );
        }
        return {
            reply: 'Which Company Address?\n\nExamples:\n- Company addresses\n- Company address South Africa\n- Company address Asia Direct\n- Count company addresses',
            data: null,
        };
    }

    // Partner directory: Custom Agent / Freight Forwarder / Groupage Warehouse / Transporter
    if (isCountPartnerRequest(message)) {
        return executeTool(
            'countPartners',
            {
                search: extractPartnerSearchTerm(message) || undefined,
                partnerType: extractPartnerType(message) || undefined,
            },
            ctx,
            sessionId
        );
    }
    if (isPartnerDirectoryRequest(message)) {
        const partnerType = extractPartnerType(message);
        const focus = extractPartnerFocus(message);
        const idMatch = message.match(
            /\b(?:custom\s+agent|customs?\s*(?:clearing\s*)?agent|freight\s+forwarder|forwarder|groupage(?:\s+warehouse|\s+handler)?|transporter)\s*(?:id|#)?\s*(\d{1,8})\b/i
        );
        if (idMatch && partnerType) {
            return executeTool(
                'getPartnerDetails',
                { partnerId: Number(idMatch[1]), partnerType, focus: focus || undefined },
                ctx,
                sessionId
            );
        }
        const search = extractPartnerSearchTerm(message);
        if (partnerType) {
            return executeTool(
                'searchPartners',
                {
                    search: search || undefined,
                    partnerType,
                },
                ctx,
                sessionId
            );
        }
        return {
            reply: 'Which directory?\n\nExamples:\n- Custom agents\n- Freight forwarders\n- Groupage warehouses\n- Transporters\n- Custom agent Brett Lee\n- Count transporters',
            data: null,
        };
    }

    // Contact Us Enquiries — before disputes (enquiry vs customer query)
    if (isCountContactEnquiryRequest(message)) {
        return executeTool(
            'countContactEnquiries',
            {
                search: extractContactEnquirySearchTerm(message) || undefined,
                nature: extractContactEnquiryNature(message) || undefined,
            },
            ctx,
            sessionId
        );
    }
    if (isContactEnquiryRequest(message)) {
        const idMatch = message.match(/\b(?:enquiry|enquir(?:y|ies)|contact)\s*(?:id|#)?\s*(\d{1,8})\b/i);
        const focus = extractContactEnquiryFocus(message);
        if (idMatch) {
            return executeTool(
                'getContactEnquiryDetails',
                { enquiryId: Number(idMatch[1]), focus: focus || undefined },
                ctx,
                sessionId
            );
        }
        const search = extractContactEnquirySearchTerm(message);
        const nature = extractContactEnquiryNature(message);
        if (search || nature || /\b(show|list|all|enquir|contact)\b/i.test(message)) {
            return executeTool(
                'searchContactEnquiries',
                {
                    search: search || undefined,
                    nature: nature || undefined,
                },
                ctx,
                sessionId
            );
        }
        return {
            reply: 'Which Contact Us enquiry?\n\nExamples:\n- Contact us enquiries\n- Enquiry ttttt2@gmail.com\n- Nature of enquiry Sales\n- Contact us South Africa\n- Count contact enquiries',
            data: null,
        };
    }

    // Country of Origin module — before freight/supplier origin field questions
    if (isCountCountryOriginRequest(message)) {
        return executeTool(
            'countCountryOrigins',
            { search: extractCountryOriginSearchTerm(message) || undefined },
            ctx,
            sessionId
        );
    }
    if (isCountryOriginModuleRequest(message)) {
        const focus = extractCountryOriginFocus(message);
        const search = extractCountryOriginSearchTerm(message);
        const idMatch = message.match(/\b(?:country\s+origin|origin)\s*(?:id|#)?\s*(\d{1,8})\b/i);
        if (idMatch) {
            return executeTool(
                'getCountryOriginDetails',
                { originId: Number(idMatch[1]), focus: focus || undefined },
                ctx,
                sessionId
            );
        }
        if (search && focus) {
            return executeTool(
                'getCountryOriginDetails',
                { countryName: search, focus },
                ctx,
                sessionId
            );
        }
        if (search || /\b(show|list|all|countr|origin)\b/i.test(message)) {
            return executeTool(
                'searchCountryOrigins',
                { search: search || undefined },
                ctx,
                sessionId
            );
        }
        return {
            reply: 'Which Country of Origin?\n\nExamples:\n- Country of origin Austria\n- Cities of Austria origin\n- Sea ports of Zimbabwe\n- Show country of origin\n- Count countries of origin',
            data: null,
        };
    }

    // Task Manager (freight / clearance / custom) — before freight/clearance modules
    if (isCountTaskRequest(message)) {
        return executeTool(
            'countTasks',
            {
                search: extractTaskSearchTerm(message) || undefined,
                taskType: extractTaskType(message) || undefined,
                status: extractTaskStatus(message) || undefined,
            },
            ctx,
            sessionId
        );
    }
    if (isTaskManagerRequest(message)) {
        const taskIdMatch = message.match(/\btask\s*(?:id|#)?\s*(\d{1,8})\b/i);
        const focus = extractTaskFocus(message);
        if (taskIdMatch) {
            return executeTool(
                'getTaskDetails',
                { taskId: Number(taskIdMatch[1]), focus: focus || undefined },
                ctx,
                sessionId
            );
        }
        const search = extractTaskSearchTerm(message);
        const taskType = extractTaskType(message);
        const status = extractTaskStatus(message);
        if (search || taskType || status || /\b(show|list|all|tasks?|task\s+manager)\b/i.test(message)) {
            return executeTool(
                'searchTasks',
                {
                    search: search || undefined,
                    taskType: taskType || undefined,
                    status: status || undefined,
                },
                ctx,
                sessionId
            );
        }
        return {
            reply: 'Which Task Manager list?\n\nExamples:\n- Freight tasks\n- Clearance tasks\n- Custom tasks\n- Pending tasks\n- Tasks for Santosh\n- Task manager F-2026xxxxxx\n- Count tasks',
            data: null,
        };
    }

    // Client KPI module (before orders/client/staff — "orders of client KPI" must not hit order list)
    if (isCountClientKpiRequest(message)) {
        const search = extractClientKpiSearchTerm(message);
        return executeTool('countClientKpi', { search: search || undefined }, ctx, sessionId);
    }
    if (isClientKpiRequest(message)) {
        const search = extractClientKpiSearchTerm(message) || '';
        const focus = extractClientKpiFocus(message) || undefined;
        return executeTool('searchClientKpi', { search, focus }, ctx, sessionId);
    }

    // Field follow-ups for "this order/freight" — prefer focused freight answer
    {
        const freightFocus = extractFreightFocus(message);
        const orderFocus = extractOrderFocus(message);
        const fieldFocus =
            freightFocus ||
            (orderFocus === 'estimate_amount' || orderFocus === 'route' || orderFocus === 'client'
                ? orderFocus
                : null);
        const priorFreight =
            extractFreightNumber(message) ||
            (refersToPriorFreight(message) || fieldFocus ? getLastFreightNumber(sessionId) : null);

        if (
            fieldFocus &&
            priorFreight &&
            !extractOrderNumber(message) &&
            !isWarehouseRequest(message) &&
            !isBatchRequest(message) &&
            !isClearanceOrderRequest(message) &&
            !extractClearanceNumber(message) &&
            !extractWaybill(message) &&
            !extractBatchNumber(message) &&
            !extractQuoteReference(message) &&
            !isQuoteListRequest(message) &&
            !extractFreightInvoiceReference(message) &&
            !isFreightInvoiceListRequest(message) &&
            !isCashbookRequest(message) &&
            !isSupplierInvoiceRequest(message) &&
            !isCollectionDeliveryRequest(message) &&
            !isClientKpiRequest(message)
        ) {
            return executeTool(
                'getFreightFullDetails',
                { freightNumber: priorFreight, focus: fieldFocus },
                ctx,
                sessionId
            );
        }
    }

    // Quotation / Freight Quote Estimate (ADQO… — before freight "quotation" estimate fallback)
    if (isCountQuoteRequest(message)) {
        const text = message.toLowerCase();
        const status = /\bunpaid\b/.test(text) ? 'unpaid' : /\bpaid\b/.test(text) ? 'paid' : null;
        const search = extractQuoteSearchTerm(message);
        return executeTool(
            'countQuotes',
            { search: search || undefined, status: status || undefined },
            ctx,
            sessionId
        );
    }
    if (isQuoteListRequest(message) || extractQuoteReference(message)) {
        const referenceNo = extractQuoteReference(message);
        const focus = extractQuoteFocus(message);
        if (referenceNo) {
            return executeTool(
                'getQuoteDetails',
                { referenceNo, focus: focus || undefined },
                ctx,
                sessionId
            );
        }
        const freightForQuote = extractFreightNumber(message);
        if (freightForQuote) {
            const rows = await listQuotesByFreightNumber(freightForQuote, ctx);
            if (rows.length === 1) {
                return executeTool(
                    'getQuoteDetails',
                    { quoteId: rows[0].id, focus: focus || undefined },
                    ctx,
                    sessionId
                );
            }
            if (rows.length > 1) {
                return {
                    reply: formatQuoteListResponse(rows, freightForQuote),
                    data: { quotes: rows, search: freightForQuote },
                };
            }
            // No ADQO quote for this freight — fall back to freight estimate summary
            return executeTool(
                'getFreightFullDetails',
                { freightNumber: freightForQuote, focus: focus === 'total' ? 'estimate_amount' : focus || 'estimate_amount' },
                ctx,
                sessionId
            );
        }
        const text = message.toLowerCase();
        const status = /\bunpaid\b/.test(text) ? 'unpaid' : /\bpaid\b/.test(text) ? 'paid' : null;
        const search = extractQuoteSearchTerm(message);
        if (search || status) {
            return executeTool(
                'searchQuotes',
                { search: search || undefined, status: status || undefined },
                ctx,
                sessionId
            );
        }
        if (ctx.isCustomer) {
            const rows = await listQuotesByClientId(ctx.userId, ctx);
            if (rows.length === 1) {
                return executeTool('getQuoteDetails', { quoteId: rows[0].id }, ctx, sessionId);
            }
            return {
                reply: formatQuoteListResponse(rows, 'your account'),
                data: { quotes: rows },
            };
        }
        return {
            reply: 'Which quotation?\n\nExamples:\n- Quote ADQOxxxxx\n- Quotes for Barry\n- Unpaid quotes\n- Quote of F-2026xxxxxx\n- Total of ADQOxxxxx\n- Count quotes',
            data: null,
        };
    }

    // Freight Invoice (ADINV… — before Sage ADZWINV / client invoice merge)
    if (isCountFreightInvoiceRequest(message)) {
        const text = message.toLowerCase();
        const status = /\bunpaid\b/.test(text) ? 'unpaid' : /\bpaid\b/.test(text) ? 'paid' : null;
        const search = extractFreightInvoiceSearchTerm(message);
        return executeTool(
            'countFreightInvoices',
            { search: search || undefined, status: status || undefined },
            ctx,
            sessionId
        );
    }
    if (isFreightInvoiceListRequest(message) || extractFreightInvoiceReference(message)) {
        const referenceNo = extractFreightInvoiceReference(message);
        const focus = extractFreightInvoiceFocus(message);
        if (referenceNo) {
            return executeTool(
                'getFreightInvoiceDetails',
                { referenceNo, focus: focus || undefined },
                ctx,
                sessionId
            );
        }
        const freightForInv = extractFreightNumber(message);
        if (freightForInv) {
            const rows = await listFreightInvoicesByFreightNumber(freightForInv, ctx);
            if (rows.length === 1) {
                return executeTool(
                    'getFreightInvoiceDetails',
                    { invoiceId: rows[0].id, focus: focus || undefined },
                    ctx,
                    sessionId
                );
            }
            if (rows.length > 1) {
                return {
                    reply: formatFreightInvoiceListResponse(rows, freightForInv),
                    data: { freightInvoices: rows, search: freightForInv },
                };
            }
            return {
                reply: `No freight invoice found for ${freightForInv}.`,
                data: { freightInvoices: [] },
            };
        }
        const text = message.toLowerCase();
        const status = /\bunpaid\b/.test(text) ? 'unpaid' : /\bpaid\b/.test(text) ? 'paid' : null;
        const search = extractFreightInvoiceSearchTerm(message);
        if (search || status) {
            return executeTool(
                'searchFreightInvoices',
                { search: search || undefined, status: status || undefined },
                ctx,
                sessionId
            );
        }
        if (ctx.isCustomer) {
            const rows = await listFreightInvoicesByClientId(ctx.userId, ctx);
            if (rows.length === 1) {
                return executeTool('getFreightInvoiceDetails', { invoiceId: rows[0].id }, ctx, sessionId);
            }
            return {
                reply: formatFreightInvoiceListResponse(rows, 'your account'),
                data: { freightInvoices: rows },
            };
        }
        return {
            reply: 'Which freight invoice?\n\nExamples:\n- Freight invoice ADINVxxxxx\n- Freight invoices for Neha\n- Unpaid freight invoices\n- Freight invoice of F-2026xxxxxx\n- Total of ADINVxxxxx\n- Count freight invoices',
            data: null,
        };
    }

    // Cashbook (bank ref 20260729003 — before Sage / generic invoices)
    if (isCountCashbookRequest(message)) {
        const text = message.toLowerCase();
        const allocated = /\bunallocated\b/.test(text)
            ? 'No'
            : /\ballocated\b/.test(text)
              ? 'Yes'
              : null;
        const search = extractCashbookSearchTerm(message);
        return executeTool(
            'countCashbook',
            { search: search || undefined, allocated: allocated || undefined },
            ctx,
            sessionId
        );
    }
    if (isCashbookRequest(message)) {
        const bankRef = extractCashbookBankRef(message);
        const focus = extractCashbookFocus(message);
        if (bankRef) {
            return executeTool(
                'getCashbookDetails',
                { bankRef, focus: focus || undefined },
                ctx,
                sessionId
            );
        }
        const text = message.toLowerCase();
        const allocated = /\bunallocated\b/.test(text)
            ? 'No'
            : /\ballocated\b/.test(text) && !/\bunallocated\b/.test(text)
              ? 'Yes'
              : null;
        const search = extractCashbookSearchTerm(message);
        if (search || allocated || /\b(list|show|all|recent|search)\b/i.test(message) || /^cashbook\s*[?.!]*$/i.test(message.trim())) {
            return executeTool(
                'searchCashbook',
                { search: search || '', allocated: allocated || undefined },
                ctx,
                sessionId
            );
        }
        if (ctx.isCustomer) {
            const result = await listCashbookByClientId(ctx.userId, ctx);
            if (!result.allowed) return { reply: result.message, data: null };
            if (result.entries.length === 1) {
                return { reply: formatCashbookResponse(result.entries[0]), data: { cashbook: result.entries[0] } };
            }
            return {
                reply: formatCashbookListResponse(result.entries, 'your account'),
                data: { cashbookEntries: result.entries },
            };
        }
        return {
            reply: 'Which cashbook entry?\n\nExamples:\n- Cashbook 2026xxxxxxx\n- Cashbook for Wahied\n- Allocated cashbook\n- Cashbook of OR000xxx\n- Receipt of 2026xxxxxxx\n- Show cashbook\n- Count cashbook',
            data: null,
        };
    }

    // Supplier Shipment Invoice (SUPINV… — before supplier directory lookup)
    if (isCountSupplierInvoiceRequest(message)) {
        const text = message.toLowerCase();
        const status = /\bunpaid\b/.test(text) ? 'unpaid' : /\bpaid\b/.test(text) ? 'paid' : null;
        const search = extractSupplierInvoiceSearchTerm(message);
        return executeTool(
            'countSupplierInvoices',
            { search: search || undefined, status: status || undefined },
            ctx,
            sessionId
        );
    }
    if (isSupplierInvoiceRequest(message)) {
        const referenceNo = extractSupplierInvoiceReference(message);
        const focus = extractSupplierInvoiceFocus(message);
        if (referenceNo) {
            return executeTool(
                'getSupplierInvoiceDetails',
                { referenceNo, focus: focus || undefined },
                ctx,
                sessionId
            );
        }
        const text = message.toLowerCase();
        const status = /\bunpaid\b/.test(text) ? 'unpaid' : /\bpaid\b/.test(text) ? 'paid' : null;
        const search = extractSupplierInvoiceSearchTerm(message);
        if (
            search ||
            status ||
            /\b(list|show|all|recent|search)\b/i.test(message) ||
            /^supplier\s+invoices?\s*[?.!]*$/i.test(message.trim())
        ) {
            return executeTool(
                'searchSupplierInvoices',
                { search: search || '', status: status || undefined },
                ctx,
                sessionId
            );
        }
        return {
            reply: 'Which supplier invoice?\n\nExamples:\n- Supplier invoice SUPINV10015\n- Supplier invoices for Nimbus\n- Unpaid supplier invoices\n- Waybill of SUPINV10015\n- Show supplier invoices\n- Count supplier invoices',
            data: null,
        };
    }

    // Collection and Delivery module
    if (isCountCollectionDeliveryRequest(message)) {
        const text = message.toLowerCase();
        const kind = /\bdeliver/.test(text) && !/\bcollection\b/.test(text) ? 'delivery' : 'collection';
        const status = /\bpending\b/.test(text)
            ? 'Pending'
            : /\bcomplete|completed|assigned\b/.test(text)
              ? text.match(/\b(complete|completed|assigned)\b/i)?.[1]
              : null;
        const search = extractCollectionDeliverySearchTerm(message);
        return executeTool(
            'countCollectionDelivery',
            { search: search || undefined, kind, status: status || undefined },
            ctx,
            sessionId
        );
    }
    if (isCollectionDeliveryRequest(message)) {
        const text = message.toLowerCase();
        const kind = /\bdeliver/.test(text) && !/\bcollection\b/.test(text) ? 'delivery' : 'collection';
        const focus = extractCollectionDeliveryFocus(message);
        const freightNumber = extractFreightNumber(message);
        const orderNumber = extractOrderNumber(message);
        if (freightNumber) {
            return executeTool(
                'getCollectionDeliveryDetails',
                { freightNumber, focus: focus || undefined },
                ctx,
                sessionId
            );
        }
        if (orderNumber) {
            return executeTool(
                'getCollectionDeliveryDetails',
                { orderNumber, focus: focus || undefined },
                ctx,
                sessionId
            );
        }
        const status = /\bpending\b/.test(text) ? 'Pending' : null;
        const search = extractCollectionDeliverySearchTerm(message);
        if (
            search ||
            status ||
            /\b(list|show|all|recent|search|module|tab)\b/i.test(message) ||
            /^(collection|delivery|collections|deliveries|collection\s+and\s+delivery)\s*[?.!]*$/i.test(
                message.trim()
            )
        ) {
            return executeTool(
                'searchCollectionDelivery',
                { search: search || '', kind, status: status || undefined },
                ctx,
                sessionId
            );
        }
        return {
            reply: 'Which collection/delivery entry?\n\nExamples:\n- Collection of F-2026xxxxxx\n- Collection for Wahied\n- Pending collections\n- Delivery list\n- Status of collection F-2026xxxxxx\n- Show collection and delivery\n- Count collections',
            data: null,
        };
    }

    // Customer Query / Dispute (before logistics — D-… must not collide with other refs)
    if (isCountDisputeRequest(message)) {
        const text = message.toLowerCase();
        const outcome = /\bpending\b/.test(text) ? 'Pending' : /\bresolved\b/.test(text) ? 'Resolved' : null;
        const search = extractDisputeSearchTerm(message);
        return executeTool('countDisputes', { search: search || undefined, outcome: outcome || undefined }, ctx, sessionId);
    }
    if (isDisputeRequest(message)) {
        const disputeId = extractDisputeId(message);
        const focus = extractDisputeFocus(message);
        if (disputeId) {
            return executeTool('getDisputeDetails', { disputeId, focus: focus || undefined }, ctx, sessionId);
        }
        const text = message.toLowerCase();
        const outcome = /\bpending\b/.test(text) ? 'Pending' : /\bresolved\b/.test(text) ? 'Resolved' : null;
        const search = extractDisputeSearchTerm(message);
        if (search || outcome) {
            return executeTool(
                'searchDisputes',
                { search: search || undefined, outcome: outcome || undefined },
                ctx,
                sessionId
            );
        }
        if (ctx.isCustomer) {
            const rows = await listDisputesByUserId(ctx.userId, ctx);
            if (rows.length === 1) {
                return { reply: formatDisputeResponse(rows[0]), data: { dispute: rows[0] } };
            }
            return {
                reply: formatDisputeListResponse(rows, 'your account'),
                data: { disputes: rows },
            };
        }
        return {
            reply: 'Which dispute?\n\nExamples:\n- Dispute D-xxxxxx\n- Disputes for Vusani\n- Pending disputes\n- Disputes of F-2026xxxxxx\n- Outcome of D-xxxxxx\n- Count disputes',
            data: null,
        };
    }

    // Release / Released Dashboard
    if (isCountReleaseDashboardRequest(message)) {
        const text = message.toLowerCase();
        const status = /\bopen\b/.test(text) ? 'Open' : /\bclose/.test(text) ? 'Close' : null;
        const search = extractReleaseSearchTerm(message);
        return executeTool(
            'countReleaseDashboard',
            { search: search || undefined, status: status || undefined },
            ctx,
            sessionId
        );
    }
    if (isReleaseDashboardRequest(message)) {
        const orderNumber = extractOrderNumber(message);
        const focus = extractReleaseFocus(message);
        if (orderNumber) {
            return executeTool(
                'getReleaseDashboardDetails',
                { orderNumber, focus: focus || undefined },
                ctx,
                sessionId
            );
        }
        const text = message.toLowerCase();
        const status = /\bopen\b/.test(text) ? 'Open' : /\bclose/.test(text) ? 'Close' : null;
        const search = extractReleaseSearchTerm(message);
        if (search || status) {
            return executeTool(
                'searchReleaseDashboard',
                { search: search || undefined, status: status || undefined },
                ctx,
                sessionId
            );
        }
        return {
            reply: 'Which release dashboard entry?\n\nExamples:\n- Release dashboard OR000xxx\n- Release status of OR000xxx\n- Open releases\n- Release dashboard for HC Water\n- Payment of release OR000xxx\n- Count release dashboard',
            data: null,
        };
    }

    // Sage Invoice list (before logistics — ADZWINV… must not be treated as batch)
    if (isCountSageInvoicesRequest(message)) {
        return executeTool('countSageInvoices', {}, ctx, sessionId);
    }
    if (isSageInvoiceRequest(message)) {
        const documentNumber = extractSageDocumentNumber(message);
        const focus = extractSageInvoiceFocus(message);
        if (documentNumber) {
            return executeTool(
                'getSageInvoiceDetails',
                { documentNumber, focus: focus || undefined },
                ctx,
                sessionId
            );
        }
        const search = extractSageInvoiceSearchTerm(message);
        if (search) {
            return executeTool('searchSageInvoices', { search }, ctx, sessionId);
        }
        // "Show sage invoices" / "List sage invoices" / bare sage invoice topic
        if (/\b(list|show|all|recent|search)\b/i.test(message) || /^sage\s+invoices?\s*[?.!]*$/i.test(message.trim())) {
            return executeTool('searchSageInvoices', { search: '' }, ctx, sessionId);
        }
        return {
            reply: 'Which Sage invoice?\n\nExamples:\n- Sage invoice ADZWINV000637\n- Find sage invoice Quantrix\n- Sage invoices for Cash Client\n- Total of ADZWINV000637\n- Show sage invoices\n- Count sage invoices',
            data: null,
        };
    }

    // Warehouse / batch / shipment / clearance (before generic order/freight handlers)
    const logisticsResult = await ruleBasedLogisticsRoute(message, ctx, sessionId);
    if (logisticsResult) return logisticsResult;

    // Client / customer profile lookup
    if (isCountClientsRequest(message)) {
        return executeTool('countClients', {}, ctx, sessionId);
    }
    if (isClientLookupRequest(message)) {
        const focus = extractClientFocus(message) || undefined;
        const customerNumber = extractCustomerNumber(message);
        if (customerNumber) {
            return executeTool('getClientDetails', { customerNumber, focus }, ctx, sessionId);
        }
        const clientId = extractClientId(message);
        if (clientId) {
            return executeTool('getClientDetails', { clientId, focus }, ctx, sessionId);
        }
        const name = extractClientLookupName(message);
        if (name) {
            return executeTool('findClientsByName', { name, intent: 'client' }, ctx, sessionId);
        }
        return {
            reply: 'Which client?\n\nExamples:\n- Find client central agriculture\n- Customer CE21170\n- Client profile for central.agriculture1@gmail.com\n- Contact person of customer CE21170\n- Related freights for CE21170\n- Count clients',
            data: null,
        };
    }

    // Count freights / orders (before list handlers)
    if (isCountFreightsRequest(message)) {
        const clientId = extractClientId(message);
        if (clientId) {
            return executeTool('countFreights', { clientId }, ctx, sessionId);
        }
        const clientName = extractFreightListClientName(message) || extractOrderListClientName(message);
        // "how many freights for John" — reuse freight list name patterns if present
        if (clientName && /\b(of|for|from|by)\b/i.test(message)) {
            // Prefer counting after resolving client — temporary: find then count via client id path
            const clients = await findClientsByName(clientName, ctx);
            const best = pickBestClientMatch(clients, clientName) || (clients.length === 1 ? clients[0] : null);
            if (best) {
                return executeTool('countFreights', { clientId: best.id }, ctx, sessionId);
            }
            if (clients.length > 1) {
                setPendingDisambiguation(sessionId, 'countFreights', clients);
                return {
                    reply: formatClientDisambiguation(clients, 'count freights'),
                    data: { candidates: clients, pendingIntent: 'count_freights' },
                    needsDisambiguation: true,
                };
            }
        }
        return executeTool('countFreights', {}, ctx, sessionId);
    }

    if (isCountOrdersRequest(message)) {
        const clientId = extractClientId(message);
        if (clientId) {
            return executeTool('countOrders', { clientId }, ctx, sessionId);
        }
        const clientName = extractOrderListClientName(message);
        if (clientName) {
            const clients = await findClientsByName(clientName, ctx);
            const best = pickBestClientMatch(clients, clientName) || (clients.length === 1 ? clients[0] : null);
            if (best) {
                return executeTool('countOrders', { clientId: best.id }, ctx, sessionId);
            }
            if (clients.length > 1) {
                setPendingDisambiguation(sessionId, 'countOrders', clients);
                return {
                    reply: formatClientDisambiguation(clients, 'count orders'),
                    data: { candidates: clients, pendingIntent: 'count_orders' },
                    needsDisambiguation: true,
                };
            }
        }
        return executeTool('countOrders', {}, ctx, sessionId);
    }

    // Single order by number
    const orderNumber = extractOrderNumber(message);
    if (orderNumber && !isListOrdersRequest(message) && !isCountOrdersRequest(message)) {
        const orderFocus = extractOrderFocus(message);
        return executeTool('getOrderDetails', { orderNumber, focus: orderFocus || undefined }, ctx, sessionId);
    }

    // List orders (by client, freight, or my orders)
    if (isListOrdersRequest(message) || isMyOrdersRequest(message)) {
        const freightForOrders =
            extractFreightNumber(message) ||
            (refersToPriorFreight(message) ? getLastFreightNumber(sessionId) : null);

        if (freightForOrders && !extractOrderListClientName(message) && !extractClientId(message)) {
            return executeTool('getOrdersByFreight', { freightNumber: freightForOrders }, ctx, sessionId);
        }

        if (isMyOrdersRequest(message) || (ctx.isCustomer && !extractOrderListClientName(message) && !extractClientId(message))) {
            return executeTool('getOrdersByClient', { clientId: ctx.userId }, ctx, sessionId);
        }

        const listClientId = extractClientId(message);
        if (listClientId) {
            return executeTool('getOrdersByClient', { clientId: listClientId }, ctx, sessionId);
        }

        const clientName = extractOrderListClientName(message);
        if (clientName) {
            return executeTool('findClientsByName', { name: clientName, intent: 'orders' }, ctx, sessionId);
        }

        if (ctx.isCustomer) {
            return executeTool('getOrdersByClient', { clientId: ctx.userId }, ctx, sessionId);
        }

        return {
            reply: 'Whose orders should I show?\n\nExamples:\n- Show all orders of user Sarah\n- Orders for John\n- Show orders for Client ID 22034\n- Orders of freight F-2026xxxxxx',
            data: null,
        };
    }

    // List freights first — don't confuse with "client" field questions
    if (isListFreightsRequest(message) || isMyFreightsRequest(message)) {
        if (isMyFreightsRequest(message) || (ctx.isCustomer && !extractFreightListClientName(message) && !extractClientId(message))) {
            return executeTool('getFreightsByClient', { clientId: ctx.userId }, ctx, sessionId);
        }

        const listClientId = extractClientId(message);
        if (listClientId) {
            return executeTool('getFreightsByClient', { clientId: listClientId }, ctx, sessionId);
        }

        const clientName = extractFreightListClientName(message);
        if (clientName) {
            return executeTool('findClientsByName', { name: clientName, intent: 'freights' }, ctx, sessionId);
        }

        if (ctx.isCustomer) {
            return executeTool('getFreightsByClient', { clientId: ctx.userId }, ctx, sessionId);
        }

        return {
            reply: 'Whose freights should I show?\n\nExamples:\n- Show all freights of user Sarah\n- Freights for John\n- Show freights for Client ID 22034',
            data: null,
        };
    }

    // Bare "show all" — ask what they want
    if (/^show\s+all\s*[?.!]*$/i.test(lower) || /^all\s*[?.!]*$/i.test(lower)) {
        return {
            reply: 'What should I show all of?\n\nExamples:\n- Show all freights of client Sarah\n- Show orders for John\n- Show invoices for John\n- Show my freights',
            data: null,
        };
    }

    let freightNumber = extractFreightNumber(message);
    const focus = extractFreightFocus(message);
    const lastFreight = getLastFreightNumber(sessionId);

    // Use last discussed freight for "this/above freight", field follow-ups, etc.
    if (!freightNumber && lastFreight && (refersToPriorFreight(message) || focus || isFreightSupplierQuestion(message))) {
        freightNumber = lastFreight;
    }

    if (freightNumber && (isFreightRequest(message) || focus || refersToPriorFreight(message) || isFreightSupplierQuestion(message))) {
        return executeTool(
            'getFreightFullDetails',
            { freightNumber, focus },
            ctx,
            sessionId
        );
    }

    // Follow-up field question with context freight but weak wording
    if (!freightNumber && lastFreight && focus) {
        return executeTool(
            'getFreightFullDetails',
            { freightNumber: lastFreight, focus },
            ctx,
            sessionId
        );
    }

    if (isInvoiceRequest(message)) {
        const clientId = extractClientId(message);
        if (clientId) {
            return executeTool('getInvoicesByClient', { clientId }, ctx, sessionId);
        }

        const clientName = extractInvoiceClientName(message);
        if (clientName) {
            return executeTool('findClientsByName', { name: clientName }, ctx, sessionId);
        }

        if (ctx.isCustomer) {
            return executeTool('getMyInvoices', {}, ctx, sessionId);
        }

        return {
            reply: 'Which client\'s invoices do you need?\n\nExamples:\n- Show invoices for John\n- Show invoices for Client ID 21988\n\nYou can also type any other question about freights, orders, suppliers, or quotations.',
            data: null,
        };
    }

    if (isCountSuppliersRequest(message)) {
        return executeTool('countSuppliers', {}, ctx, sessionId);
    }
    if (isSupplierRequest(message)) {
        const name = extractSupplierName(message);
        const focus = extractSupplierFocus(message) || undefined;
        if (name) {
            return executeTool('findSupplier', { name, focus }, ctx, sessionId);
        }
        return {
            reply: 'Which supplier?\n\nExamples:\n- Supplier SANBRO\n- Edit supplier Asher\n- Do we have supplier SANBRO?\n- Email of supplier 32\n- Count suppliers',
            data: null,
        };
    }

    if (isCountStaffRequest(message)) {
        return executeTool('countStaff', {}, ctx, sessionId);
    }
    if (isStaffRequest(message)) {
        const search = extractStaffSearchTerm(message);
        const focus = extractStaffFocus(message) || undefined;
        if (search) {
            return executeTool('searchStaff', { search, focus }, ctx, sessionId);
        }
        return {
            reply: 'Which staff member?\n\nExamples:\n- Staff Tshegofatso\n- Edit staff support.imports1@asiadirect.africa\n- Permissions of staff Tshegofatso\n- Count staff',
            data: null,
        };
    }

    // Legacy: bare "quote/quotation" with freight context → freight estimate amount
    // (ADQO / quote-list intents are handled earlier)
    if (lower.includes('quotation') || lower.includes('quote')) {
        if (freightNumber || lastFreight) {
            return executeTool(
                'getFreightFullDetails',
                { freightNumber: freightNumber || lastFreight, focus: focus || 'estimate_amount' },
                ctx,
                sessionId
            );
        }
        return {
            reply: 'Which quotation?\n\nExamples:\n- Quote ADQOxxxxx\n- Quotes for Barry\n- What is the quotation of F-2026xxxxxx?',
            data: null,
        };
    }

    // Ask for freight number when field is clear but no context yet
    if (focus && !freightNumber && !lastFreight && !extractBatchNumber(message)) {
        return {
            reply: `Which freight or batch is this about? Examples:\n- "What is the ${focus.replace(/_/g, ' ')} of F-2026xxxxxx?"\n- "Origin of batch ADAWBxxxxxxx"`,
            data: null,
        };
    }

    if (ctx.isCustomer) {
        return {
            reply: `You can ask me anything about your Workspace data, for example:\n- Count total freight\n- What is the status of F-2026xxxxxx?\n- Show my freights\n- Show my orders\n- Warehouse orders for my account\n- Show my clearance orders\n- Show my invoices\n- What is OR000xxx?\n\nUse your real freight/order number from Workspace. Suggestions below are shortcuts only.`,
            data: null,
        };
    }

    return {
        reply: `You can ask me anything about Workspace data, for example:\n- Count total freight\n- Show warehouse orders for John\n- Status of batch ADAWBxxxxxxx\n- Shipment waybill 999-xxxxxxxx\n- Status of C-2026xxxxx\n- Dispute D-xxxxxx\n- Release dashboard OR000xxx\n- Clearance orders for John\n- Show orders for John\n- What is OR000xxx?\n- What is the status of F-2026xxxxxx?\n\nNumbers like F-2026xxxxxx / OR000xxx are format examples — type your real reference. Suggestions below are shortcuts only.`,
        data: null,
    };
}

module.exports = {
    TOOL_DEFINITIONS,
    executeTool,
    ruleBasedRoute,
    isDefaultHelpReply,
};
