/**
 * Extract freight numbers like F-20260602006, FRG-789456, FRT123, MAT22034
 */

// Matches invoice + common typos: invocie, invoce, inovice, etc.
const INVOICE_WORD = String.raw`inv(?:oice|ocie|oce|oise|ocie|oice|ioce|oices?|oices)s?|invoices?`;

const INVALID_FREIGHT_TOKENS = new Set([
    'paid', 'pay', 'payment', 'client', 'customer', 'status', 'invoice', 'invoices',
    'quote', 'quotes', 'quotation', 'freight', 'amount', 'name', 'product', 'supplier',
    'estimate', 'above', 'this', 'that', 'same', 'desc', 'description', 'route',
]);

function normalizeMessage(message) {
    return String(message || '')
        .replace(/\b(invocie|invoce|invoic|inovice|invoise|invioce|invoics|inovoice)s?\b/gi, 'invoice')
        .replace(/\b(ahow|shwo|shoe|sho)\b/gi, 'show')
        .replace(/\b(freigt|frieght|freigth|feight|freght|fright|freightt)s?\b/gi, (m) =>
            /s$/i.test(m) ? 'freights' : 'freight'
        )
        .replace(/\b(suplier|suppliar|suppliier)\b/gi, 'supplier')
        .replace(/\b(cofirm|confrm|comfirm|confirmd|confirmedd)\b/gi, 'confirm')
        .replace(/\b(quatation|qoutation|quotaton|qotation)\b/gi, 'quotation')
        .replace(/\b(quot|qoute|quate)\b/gi, 'quote')
        .replace(/\b(estimation|estimaton|estmation|estimat)\b/gi, 'estimate')
        .replace(/\b(amout|amont|ammount|amnt)\b/gi, 'amount')
        .replace(/\b(discription|descripton|descirption)\b/gi, 'description')
        .replace(/\b(ordr|oder|ordres|ordrs)\b/gi, 'order')
        .replace(/\b(rout|rotue|ruote)\b/gi, 'route')
        .replace(/\b(warehous|warehs|ware house)\b/gi, 'warehouse')
        .replace(/\b(batche?s|bacth|bathc)\b/gi, (m) => (/s$/i.test(m) ? 'batches' : 'batch'))
        .replace(/\b(shipmnt|shipement|shipmet)s?\b/gi, (m) => (/s$/i.test(m) ? 'shipments' : 'shipment'))
        .replace(/\b(clearence|clerance|clearnce)\b/gi, 'clearance')
        .replace(/\b(way\s*bill|awb)\b/gi, 'waybill');
}

function isValidFreightNumber(value) {
    const v = String(value || '').trim();
    if (v.length < 4) return false;
    if (!/\d/.test(v)) return false;
    if (INVALID_FREIGHT_TOKENS.has(v.toLowerCase())) return false;
    // Prefer real freight-like tokens (F-..., FRG..., letters+digits)
    if (/^[A-Za-z]{1,4}-\d{4,}/.test(v)) return true;
    if (/^[A-Za-z]{2,}\d{3,}$/.test(v)) return true;
    if (/\d{6,}/.test(v)) return true;
    return false;
}

function extractFreightNumber(message) {
    const text = normalizeMessage(message);
    const patterns = [
        /\b([A-Z]{1,4}-\d{4,})\b/i,
        /\b([A-Z]{2,}-\d+)\b/i,
        /\b(FRG|FRT|F)\s*-?\s*(\d{6,})\b/i,
        /\bfreight\s*(?:id|number|no\.?|#)?\s*[:=]?\s*([A-Z]{1,4}-\d{4,})\b/i,
        /\bfreight\s*(?:id|number|no\.?|#)?\s*[:=]?\s*([A-Z]{2,}\d{3,})\b/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match) continue;

        let value;
        if (match[2] && /^(FRG|FRT|F)$/i.test(match[1])) {
            value = `${match[1].replace(/-$/, '')}-${match[2]}`.replace(/F-?(\d)/i, 'F-$1');
            if (/^F\d/i.test(value)) value = value.replace(/^F/i, 'F-');
        } else {
            value = (match[1] || match[0]).trim();
        }

        if (isValidFreightNumber(value)) {
            return value.toUpperCase().replace(/^F(\d)/, 'F-$1');
        }
    }

    return null;
}

/** User is referring to the previously discussed freight / order */
function refersToPriorFreight(message) {
    const text = normalizeMessage(message).toLowerCase();
    return (
        /\b(this|that|above|same|previous|last|current)\s+(freight|shipment|order|one)\b/.test(text) ||
        /\b(this|that|above)\s+(client|customer)\b/.test(text) ||
        /\b(of|for|on)\s+(this|that|above|same)\b/.test(text) ||
        /\b(this|above)\s+one\b/.test(text)
    );
}

function extractClientId(message) {
    const text = normalizeMessage(message);
    const patterns = [
        /client\s*(?:id\s*)?[#:]?\s*(\d+)/i,
        /customer\s*(?:id\s*)?[#:]?\s*(\d+)/i,
        /\bID\s*(\d+)\b/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return Number(match[1]);
    }
    return null;
}

/** Customer / client numbers like S20832, CE21170, or bare numeric ids */
function extractCustomerNumber(message) {
    const text = normalizeMessage(message);
    const isDocToken = (token) =>
        /^(OR|F|C|D|ADQO|ADINV|ADZW|SUPINV|ADAWB|DL)\d/i.test(String(token || '').replace(/-/g, ''));

    const only = text.match(/^\s*([A-Z]{0,4}\d{4,})\s*[?.!]?\s*$/i);
    if (only && !isDocToken(only[1])) return only[1].toUpperCase().replace(/\s+/g, '');

    const labeled = text.match(
        /\b(?:customer|client)\s*(?:id|number|no\.?|#|profile|details?)?\s*[:=]?\s*([A-Z]{0,4}\d{3,})\b/i
    );
    if (labeled && !isDocToken(labeled[1])) {
        return labeled[1].toUpperCase().replace(/\s+/g, '');
    }

    const sCode = text.match(/\b([A-Z]{1,4}\d{4,})\b/i);
    if (sCode && !isDocToken(sCode[1])) {
        return sCode[1].toUpperCase();
    }
    return null;
}

function extractClientFocus(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (!/\b(client|customer|profile)\b/.test(text) && !extractCustomerNumber(message)) {
        // still allow focused questions that clearly name a profile field with "of/for" client
        if (!/\b(email|cellphone|telephone|address|contact\s+person|company\s*id|importer|tax\s+ref|province|related\s+freight)/.test(text)) {
            return null;
        }
    }
    if (/\brelated\s+freights?\b|\bfreights?\s+of\s+(?:this\s+)?(?:client|customer)\b/.test(text)) {
        return 'related_freights';
    }
    if (/\bcontact\s+person\b/.test(text)) return 'contact_person';
    if (/\bcompany\s*id\b/.test(text)) return 'company_id';
    if (/\bimporter\s*(s)?\s*ref/.test(text)) return 'importer_ref';
    if (/\btax\s+ref/.test(text)) return 'tax_ref';
    if (/\baddress\b/.test(text)) return 'address';
    if (/\bcellphone\b|\bcell\b|\bmobile\b/.test(text)) return 'phone';
    if (/\btelephone\b|\bphone\b/.test(text)) return 'phone';
    if (/\bemail\b/.test(text)) return 'email';
    if (/\bcountry\b/.test(text)) return 'country';
    if (/\bprovince\b/.test(text)) return 'province';
    if (/\bcity\b/.test(text)) return 'city';
    if (/\bcode\b|\bpostal\b|\bzip\b/.test(text)) return 'code';
    if (/\bimage\b|\bphoto\b|\bprofile\s+pic/.test(text)) return 'image';
    return null;
}

function extractClientLookupName(message) {
    if (extractClientId(message) || extractCustomerNumber(message)) return null;
    const text = normalizeMessage(message);
    const patterns = [
        /\b(?:find|show|get|search|lookup|look\s*up)\s+(?:a\s+)?(?:client|customer|user)\s+(?:named?|called)?\s*(.+)$/i,
        /\b(?:client|customer)\s+(?:details?|profile|info|information)\s+(?:of|for|about)?\s*(.+)$/i,
        /\b(?:who\s+is|details?\s+(?:of|for)|profile\s+(?:of|for))\s+(?:client|customer)?\s*(.+)$/i,
        /\b(?:client|customer)\s+(.+)$/i,
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match) continue;
        let name = match[1].trim().replace(/[?.!]+$/, '').trim();
        name = name.replace(/^(named|called|id|number|no\.?|#)\s+/i, '');
        if (/^F-?\d+/i.test(name) || /^OR0*\d+/i.test(name) || /^C-\d+/i.test(name)) return null;
        if (/^(me|my|mine|all|the|this|that|orders?|freights?|invoices?)$/i.test(name)) return null;
        if (name.length >= 2) return name;
    }
    return null;
}

function isClientLookupRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (isClientKpiRequest(message)) return false;
    // Profile-related freight table (not "show freights for client …" logistics list)
    if (/\brelated\s+freights?\b/.test(text) && (extractCustomerNumber(message) || extractClientId(message) || extractClientLookupName(message))) {
        return true;
    }
    if (isInvoiceRequest(message) || isListOrdersRequest(message) || isListFreightsRequest(message)) {
        return false;
    }
    if (isWarehouseRequest(message) || isClearanceRequest(message) || isShipmentRequest(message)) {
        return false;
    }
    if (extractCustomerNumber(message)) return true;
    if (extractClientLookupName(message)) return true;
    return (
        /\b(?:find|show|search|lookup|look\s*up|manage)\s+(?:a\s+)?(?:client|customer)s?\b/.test(text) ||
        /\b(?:client|customer)\s+(?:details?|profile|info)\b/.test(text) ||
        /\bcustomer\s+profile\b/.test(text) ||
        /\bwho\s+is\s+(?:client|customer)\b/.test(text)
    );
}

function isCountClientsRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (/\bkpi\b/.test(text)) return false;
    return (
        /\b(?:clients?|customers?)\b/.test(text) &&
        /\b(count|total|how\s*many|number\s+of)\b/.test(text) &&
        !/\b(orders?|freights?|invoices?|warehouse|batches|shipments|clearance)\b/.test(text)
    );
}

function extractSupplierName(message) {
    const text = normalizeMessage(message);

    // Don't treat freight-supplier questions as a supplier-name search
    if (isFreightSupplierQuestion(message)) return null;
    if (isSupplierInvoiceRequest(message)) return null;

    const idOnly = text.match(/^\s*(?:supplier\s*(?:id|#)?\s*)?(\d{1,6})\s*[?.!]?\s*$/i);
    if (idOnly) return idOnly[1];

    const patterns = [
        /(?:edit|manage|show|find|get|search|lookup|look\s*up)\s+supplier\s+(?:profile\s+)?(?:named?|called|for|of)?\s*(.+)$/i,
        /supplier\s+(?:profile|details?|info)\s+(?:for|of|about)?\s*(.+)$/i,
        /supplier\s+(.+?)(?:\s+in\s+our(?:\s+system)?)?\s*\??$/i,
        /have\s+(.+?)\s+as\s+(?:a\s+)?supplier/i,
        /do\s+we\s+have\s+(.+?)\s+in\s+our/i,
        /(?:company\s+name|email|phone|address|service)\s+(?:of|for)\s+supplier\s+(.+)$/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            let name = match[1].trim();
            name = name.replace(/^supplier\s+/i, '');
            name = name.replace(/\s+in\s+our\s+system\??$/i, '');
            name = name.replace(/\s+supplier\??$/i, '');
            name = name
                .replace(/\b(please|thanks|confirm|confirmed|of|for|this|that|above|freight|shipment|profile|details?|edit|manage)\b/gi, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .replace(/[?.!]+$/, '');
            if (name.length >= 2 && !INVALID_FREIGHT_TOKENS.has(name.toLowerCase())) return name;
            if (/^\d+$/.test(name)) return name;
        }
    }
    return null;
}

function extractSupplierFocus(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (!/\bsupplier\b/.test(text) && !/\bmanage\s+supplier\b/.test(text)) return null;
    if (/\btype\s+of\s+service\b|\bservice\s+type\b/.test(text)) return 'service_type';
    if (/\bcountry\s+based\b|\bbased\s+in\b|\bbased\s+country\b/.test(text)) return 'country_based';
    if (/\bcountry\s+of\s+origin\b|\borigin\s+country\b/.test(text)) return 'country_of_origin';
    if (/\bcompany\s+name\b/.test(text)) return 'company_name';
    if (/\bfull\s+name\b|\bcontact\s+name\b/.test(text)) return 'full_name';
    if (/\bcountry\s+code\b/.test(text)) return 'country_code';
    if (/\baddress\b/.test(text)) return 'address';
    if (/\bemail\b/.test(text)) return 'email';
    if (/\bphone\b|\bcellphone\b|\bmobile\b/.test(text)) return 'phone';
    if (/\bprofile\s+image\b|\bimage\b|\bphoto\b/.test(text)) return 'image';
    if (/\bpassword\b/.test(text)) return 'password';
    return null;
}

function isCountSuppliersRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    return (
        /\bsuppliers?\b/.test(text) &&
        /\b(count|total|how\s*many|number\s+of)\b/.test(text) &&
        !/\binvoices?\b/.test(text) &&
        !/\b(freight|order|warehouse|client|customer)\b/.test(text)
    );
}

function extractStaffSearchTerm(message) {
    const text = normalizeMessage(message);
    const idOnly = text.match(/^\s*(?:staff\s*(?:id|#|member)?\s*)?(\d{1,6})\s*[?.!]?\s*$/i);
    if (idOnly) return idOnly[1];

    const patterns = [
        /(?:edit|manage|show|find|get|search|lookup|look\s*up)\s+staff\s+(?:member\s+)?(?:profile\s+)?(?:named?|called|for|of)?\s*(.+)$/i,
        /staff\s+(?:member\s+)?(?:profile|details?|info|permissions?)\s+(?:for|of|about)?\s*(.+)$/i,
        /staff\s+(?:member\s+)?(.+)$/i,
        /(?:email|phone|roles?|permissions?|country)\s+(?:of|for)\s+staff\s+(?:member\s+)?(.+)$/i,
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match?.[1]) continue;
        let name = match[1]
            .replace(/\b(please|thanks|profile|details?|permissions?|member|edit|manage|list)\b/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/[?.!]+$/, '');
        if (/^(me|my|mine|all|the|this|that)$/i.test(name)) return null;
        if (name.length >= 2 || /^\d+$/.test(name)) return name;
    }
    return null;
}

function extractStaffFocus(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (!/\bstaff\b/.test(text)) return null;
    if (/\bpermissions?\b/.test(text)) return 'permissions';
    if (/\broles?\b|\bassign(?:ed)?\s+roles?\b/.test(text)) return 'roles';
    if (/\baccess\s+countr|\bcountry\s+data\b|\bselect\s+country\b/.test(text)) return 'access_countries';
    if (/\bnew\s+password\b|\bpassword\b/.test(text)) return 'password';
    if (/\bcountry\s+code\b/.test(text)) return 'country_code';
    if (/\bcountry\b/.test(text)) return 'country';
    if (/\bemail\b/.test(text)) return 'email';
    if (/\bphone\b|\bcellphone\b|\bmobile\b/.test(text)) return 'phone';
    if (/\bfull\s+name\b/.test(text)) return 'full_name';
    return null;
}

function isStaffRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (/\bstaff\s+assign|\bassign(?:ed)?\s+to\s+staff\b|\bstaff\s+kpi\b|\bstaff\s+leaves?\b/.test(text)) {
        return false;
    }
    if (isCountStaffRequest(message)) return true;
    if (/\b(edit|manage)\s+staff\b/.test(text)) return true;
    if (/\bstaff\s+(profile|details?|directory|list|permissions?|member)\b/.test(text)) return true;
    if (/\b(?:find|show|search|lookup|look\s*up)\s+staff\b/.test(text)) return true;
    if (/^staff\s+.+/i.test(text.trim())) return true;
    if (
        /\b(?:email|phone|roles?|permissions?|country(?:\s+code)?|access\s+countr)\b/.test(text) &&
        /\bstaff\b/.test(text)
    ) {
        return true;
    }
    return false;
}

function isCountStaffRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    return (
        /\bstaff\b/.test(text) &&
        /\b(count|total|how\s*many|number\s+of)\b/.test(text) &&
        !/\b(freights?|orders?|invoices?|permissions?|leaves?|leave\s+requests?)\b/.test(text)
    );
}

function extractClientKpiSearchTerm(message) {
    const text = normalizeMessage(message);
    const estimateName = extractClientEstimateAmountName(message);
    if (estimateName) return estimateName;
    const patterns = [
        /(?:client\s*)?kpi\s+(?:for|of|about|from)?\s*(.+)$/i,
        /(?:search|find|show|list)\s+(?:client\s*)?kpi\s+(?:for|of)?\s*(.+)$/i,
        /(?:client\s+kpi|kpi\s+client|clients?\s+kpi)\s+(?:for|of)?\s*(.+)$/i,
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match?.[1]) continue;
        let name = match[1]
            .replace(/\b(please|thanks|module|list|table|report|search|show|all|top)\b/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/[?.!]+$/, '');
        if (!name || /^(me|my|mine|the|this|that)$/i.test(name)) return null;
        if (name.length >= 2) return name;
    }
    return null;
}

function extractClientKpiFocus(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (
        !/\bkpi\b/.test(text) &&
        !/\bdelivered\s+orders?\b/.test(text) &&
        !isClientEstimateAmountRequest(message)
    ) {
        return null;
    }
    if (/\bdelivered\s+orders?\b|\bdelivered\b/.test(text)) return 'delivered_orders';
    if (
        /\btotal\s+amount\b|\bamount\b|\bestimate\s+amount\b|\btotal\s+estimate\b/.test(text) ||
        isClientEstimateAmountRequest(message)
    ) {
        return 'total_amount';
    }
    if (/\bfreights?\b/.test(text)) return 'freight';
    if (/\borders?\b/.test(text)) return 'orders';
    return null;
}

/** "Total estimate amount of TGOOD South Africa" → Client KPI total amount (not a single freight). */
function isClientEstimateAmountRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (extractFreightNumber(message) || extractBatchNumber(message) || extractOrderNumber(message)) {
        return false;
    }
    if (extractQuoteReference(message)) return false;
    if (/\bof\s+f-\d/i.test(text)) return false;

    const hasEstimateAmount =
        /\btotal\s+estimate\s+amount\b/.test(text) ||
        /\bestimate\s+amount\b/.test(text) ||
        /\btotal\s+estimate\b/.test(text) ||
        (/\btotal\s+amount\b/.test(text) && !/\binvoice\b|\bcashbook\b|\bsage\b/.test(text)) ||
        (/\btotal\b/.test(text) && /\bestimate\b/.test(text) && /\bamount\b/.test(text));

    if (!hasEstimateAmount) return false;

    // Needs a client/person/company target: "of X" / "for X" / "client X"
    if (/\b(?:of|for)\s+[a-z0-9]/i.test(text) || /\bclient\s+[a-z0-9]/i.test(text)) {
        return true;
    }
    return false;
}

function extractClientEstimateAmountName(message) {
    if (!isClientEstimateAmountRequest(message)) return null;
    const text = normalizeMessage(message);
    const patterns = [
        /(?:total\s+)?estimate\s+amount\s+(?:of|for)\s+(?:client\s+)?(.+)$/i,
        /total\s+estimate\s+(?:amount\s+)?(?:of|for)\s+(?:client\s+)?(.+)$/i,
        /total\s+amount\s+(?:of|for)\s+(?:client\s+)?(.+)$/i,
        /(?:estimate|amount)\s+(?:of|for)\s+(?:client\s+)?(.+)$/i,
        /(?:of|for)\s+(?:client\s+)?(.+)$/i,
    ];
    for (const re of patterns) {
        const m = text.match(re);
        if (!m?.[1]) continue;
        let name = m[1]
            .replace(/\b(please|thanks|kpi|module|client|customer)\b/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (name && name.length >= 2 && !/^F-\d/i.test(name) && !/^OR0*\d/i.test(name)) {
            return name;
        }
    }
    return null;
}

function isClientKpiRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (/\bstaff\s+kpi\b|\bkpi\s+dashboard\b|\bkpi\s+data\b/.test(text)) return false;
    if (isClientEstimateAmountRequest(message)) return true;
    if (/\bclient\s*kpi\b|\bkpi\s*client\b|\bclients?\s+kpi\b/.test(text)) return true;
    if (/\bkpi\b/.test(text) && /\b(client|customer|tgood|show|list|search|module|table|report)\b/.test(text)) {
        return true;
    }
    if (/^kpi\b/.test(text.trim()) && !/\bstaff\b/.test(text)) return true;
    return false;
}

function isCountClientKpiRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (!isClientKpiRequest(message)) return false;
    if (isClientEstimateAmountRequest(message)) return false;
    if (/\btotal\s+amount\b|\bestimate\s+amount\b/.test(text)) return false;
    return /\b(count|how\s*many|number\s+of)\b/.test(text) || /\btotal\s+(client\s*)?kpi\b/.test(text);
}

function extractInvoiceClientName(message) {
    if (extractClientId(message)) return null;

    const text = normalizeMessage(message);
    const patterns = [
        new RegExp(`(?:${INVOICE_WORD})\\s+for\\s+(.+)$`, 'i'),
        new RegExp(`show\\s+(?:${INVOICE_WORD})\\s+for\\s+(.+)$`, 'i'),
        /(?:for|named?|called)\s+(.+)$/i,
        new RegExp(`(?:show|ahow|get|list|my)\\s+(?:${INVOICE_WORD})\\s+(.+)$`, 'i'),
        new RegExp(`(?:${INVOICE_WORD})\\s+(.+)$`, 'i'),
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            let name = match[1].trim();
            name = name.replace(/^(for|client)\s+/i, '');
            const skip = ['my', 'me', 'mine', 'all', 'please'];
            if (skip.includes(name.toLowerCase())) return null;
            if (name.length >= 2) return name;
        }
    }
    return null;
}

function isInvoiceRequest(message) {
    const text = normalizeMessage(message);
    return new RegExp(INVOICE_WORD, 'i').test(text) || /invoice/i.test(text);
}

/** Freight invoice refs like ADINV10002 (Workspace quote_invoice) */
function extractFreightInvoiceReference(message) {
    const text = normalizeMessage(message);
    const m = text.match(/\bADINV\d{3,}\b/i);
    return m ? m[0].toUpperCase() : null;
}

function isFreightInvoiceRef(value) {
    return /^ADINV\d{3,}$/i.test(String(value || '').trim());
}

/** Sage document numbers e.g. ADZWINV000637 — excludes ADINV freight invoices */
function extractSageDocumentNumber(message) {
    const text = normalizeMessage(message);
    const pick = (raw) => {
        if (!raw) return null;
        const v = String(raw).toUpperCase();
        if (isFreightInvoiceRef(v)) return null;
        return v;
    };
    const only = text.match(/^\s*([A-Z]{2,}INV\d{3,})\s*[?.!]?\s*$/i);
    if (only) return pick(only[1]);
    const labeled = text.match(
        /\b(?:sage\s*)?(?:invoice|document)\s*(?:number|no\.?|#)?\s*[:=]?\s*([A-Z]{2,}INV\d{3,})\b/i
    );
    if (labeled) return pick(labeled[1]);
    const bare = text.match(/\b([A-Z]{2,}INV\d{3,})\b/i);
    if (bare) return pick(bare[1]);
    return null;
}

function extractSageInvoiceSearchTerm(message) {
    if (extractSageDocumentNumber(message)) return null;
    const text = normalizeMessage(message);
    const patterns = [
        /\b(?:find|show|get|search|lookup|look\s*up|list)\s+(?:a\s+)?sage\s+invoices?\s+(?:for|named?|called|of|about)\s+(.+)$/i,
        /\bsage\s+invoices?\s+(?:for|of|named?|called|about)\s+(.+)$/i,
        /\b(?:find|show|get|search|lookup|look\s*up)\s+(?:a\s+)?sage\s+invoice\s+(?!s\b)(.+)$/i,
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match) continue;
        let term = match[1].trim().replace(/[?.!]+$/, '').trim();
        term = term.replace(/^(for|of|named|called|customer|client|ref|number|no\.?|#)\s+/i, '');
        if (/^(me|my|mine|all|the|this|that|list|count|total|recent|invoices?)$/i.test(term)) return null;
        term = term
            .replace(/\b(total|date|upload|customer\s+ref\.?|customer\s+name|invoice\s*\(\s*ad\s*\)|invoice\s+ad)\b/gi, '')
            .trim();
        if (term.length >= 2 && !/^ADZWINV/i.test(term) && !isFreightInvoiceRef(term)) return term;
    }
    return null;
}

function extractSageInvoiceFocus(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (!extractSageDocumentNumber(message) && !/\bsage\b/.test(text)) return null;
    if (/\binvoice\s*\(\s*ad\s*\)|\binvoice\s+ad\b/.test(text)) return 'invoice_ad';
    if (/\bupload\b|\buploaded\b|\bdocument\s+file\b/.test(text)) return 'upload';
    if (/\bcustomer\s+ref/.test(text)) return 'customer_ref';
    if (/\bcustomer\s+name\b|\bclient\s+name\b/.test(text)) return 'customer_name';
    if (/\bdocument\s+number\b|\bdoc\s*(?:no|number|#)\b/.test(text)) return 'document_number';
    if (/\bdate\b/.test(text)) return 'date';
    if (/\btotal\b|\bamount\b/.test(text)) return 'total';
    return null;
}

function isSageInvoiceRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (extractSageDocumentNumber(message)) return true;
    if (/\bsage\b/.test(text) && /\binvoices?\b/.test(text)) return true;
    if (/\bsage\s+invoice\b/.test(text)) return true;
    return Boolean(extractSageInvoiceSearchTerm(message));
}

function isCountSageInvoicesRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    return (
        /\bsage\b/.test(text) &&
        /\binvoices?\b/.test(text) &&
        /\b(count|total|how\s*many|number\s+of)\b/.test(text)
    );
}

function isMyInvoiceRequest(message) {
    const text = normalizeMessage(message).toLowerCase().trim();
    if (!isInvoiceRequest(text)) return false;

    if (extractClientId(message) || extractInvoiceClientName(message)) {
        return false;
    }

    return (
        /\bmy\b/.test(text) ||
        /\bme\b/.test(text) ||
        /show\s+my\s+invoice/i.test(text) ||
        /^invoices?$/.test(text) ||
        /^show\s+invoices?$/.test(text)
    );
}

/** Asking about supplier confirmed/assigned on a freight (not a supplier directory search) */
function isFreightSupplierQuestion(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (!/\bsupplier\b/.test(text)) return false;
    return (
        /\b(confirm|confirmed|assigned|assign)\b/.test(text) ||
        /\b(this|that|above|same)\s+freight\b/.test(text) ||
        extractFreightNumber(message) !== null ||
        refersToPriorFreight(message)
    );
}

/** Specific freight field the user asked about */
function extractFreightFocus(message) {
    // Listing freights/orders or looking up an order number is not a freight-field question
    if (
        isListFreightsRequest(message) ||
        isMyFreightsRequest(message) ||
        isListOrdersRequest(message) ||
        isMyOrdersRequest(message) ||
        extractOrderNumber(message)
    ) {
        return null;
    }

    // Client-level total estimate amount → Client KPI, not a single freight field
    if (isClientEstimateAmountRequest(message) || isClientKpiRequest(message)) {
        return null;
    }

    // Batch field questions (origin/route of ADAWB…) are not freight questions
    if (extractBatchNumber(message) || /\bbatch(?:es)?\b/i.test(normalizeMessage(message))) {
        return null;
    }

    const text = normalizeMessage(message).toLowerCase();

    if (/product\s*desc|product\s*description|description of|what is the product|\bproduct\b/i.test(text)) {
        return 'product_desc';
    }

    // Payment status before general estimate amount
    if (/\bpaid\b|payment|pay(?:ment)?\s+by\s+client|client\s+paid|has\s+(?:the\s+)?client\s+paid/i.test(text)) {
        return 'paid';
    }

    if (
        /estimate|quotation|quote|quoted\s*amount|how\s*much|total\s*amount|quote\s*value|estimate\s*amount|estimated|\bamount\b/i.test(
            text
        )
    ) {
        // "amount" alone is weak — only treat as quote when quote/estimate/how much context exists
        if (
            /estimate|quotation|quote|how\s*much|quoted|estimate\s*amount|total\s*amount|quote\s*value|estimated/i.test(
                text
            ) ||
            (/\bamount\b/.test(text) && /\b(quote|quotation|estimate|order|freight)\b/.test(text))
        ) {
            return 'estimate_amount';
        }
    }

    if (isFreightSupplierQuestion(message)) {
        return 'supplier';
    }
    // Directory / Edit Supplier questions are not freight-field "supplier"
    if (
        /\bsupplier\b/.test(text) &&
        (extractFreightNumber(message) || refersToPriorFreight(message)) &&
        !isSupplierInvoiceRequest(message)
    ) {
        return 'supplier';
    }

    if (/commodity/i.test(text)) return 'commodity';
    if (/sales\s*rep|sales representative/i.test(text)) return 'sales_rep';
    if (/\bshipper\b/i.test(text)) return 'shipper';
    if (/\bconsignee\b/i.test(text)) return 'consignee';
    if (/incoterm/i.test(text)) return 'incoterm';
    if (/port\s*of\s*loading|\bpol\b/i.test(text)) return 'port_of_loading';
    if (/port\s*of\s*discharge|\bpod\b/i.test(text)) return 'port_of_discharge';
    if (/place\s*of\s*delivery|delivery\s*address|pickup\s*address|collection\s*address/i.test(text)) {
        if (/pickup|collection|shipper\s*address/i.test(text)) return 'pickup_address';
        return 'delivery_address';
    }
    if (/volumetric|vol\s*weight|chargeable\s*weight/i.test(text)) {
        if (/chargeable/i.test(text)) return 'chargeable_weight';
        return 'volumetric_weight';
    }
    if (/\bweight\b|\bpackages?\b|\bdimension|\bcbm\b|\bhazardous\b|\bpackag(?:e|ing)\b/i.test(text)) {
        if (/hazardous/i.test(text)) return 'hazardous';
        if (/packag/i.test(text) && !/packages?\b/i.test(text)) return 'package_type';
        if (/packages?\b|no\s*of\s*pack/i.test(text)) return 'packages';
        if (/dimension|\bcbm\b/i.test(text)) return 'dimension';
        if (/\bweight\b/i.test(text)) return 'weight';
    }
    if (/\broute\b|origin|destination|from.*to/i.test(text)) return 'route';
    // "Client ID 123" / "freights of client X" are not "who is the client on this freight?"
    if (
        /\b(client|customer)\b/i.test(text) &&
        !/invoice/i.test(text) &&
        !/client\s*id\b/i.test(text) &&
        !/\bshow\s+(?:all\s+)?freights?\b/i.test(text) &&
        !/\bfreights?\s+(?:of|for|from|by)\b/i.test(text) &&
        !/\b(?:of|for)\s+(?:user|client|customer)\b/i.test(text)
    ) {
        return 'client';
    }
    if (/name of (?:this|that|above|the)?\s*freight|freight\s*(?:number|name|id)|what(?:'s| is)?\s+(?:the\s+)?freight\s*(?:number|name|id)?/i.test(text)) {
        return 'freight_number';
    }
    if (/status/i.test(text)) return 'status';
    if (/waybill|tracking/i.test(text)) return 'waybill';
    return null;
}

function isFreightRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (/\btasks?\b/.test(text) && isTaskManagerRequest(message)) return false;
    return (
        extractFreightNumber(message) !== null ||
        refersToPriorFreight(message) ||
        extractFreightFocus(message) !== null ||
        isFreightSupplierQuestion(message) ||
        /\bfreight\b/i.test(text) ||
        /\bfrt\b/i.test(text) ||
        /\bshipment\b/i.test(text) ||
        /\bquotation\b/i.test(text) ||
        /\bquote\b/i.test(text) ||
        /\bestimate\b/i.test(text) ||
        /\bproduct\s*desc/i.test(text) ||
        /\bdescription\b/i.test(text)
    );
}

function isSupplierRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (isFreightSupplierQuestion(message)) return false;
    if (isSupplierInvoiceRequest(message)) return false;
    if (extractFreightNumber(message)) return false;
    if (isCountSuppliersRequest(message)) return true;
    if (/\b(edit|manage)\s+supplier\b/.test(text)) return true;
    if (/\bsupplier\s+(profile|details?|directory|list)\b/.test(text)) return true;
    if (/\b(?:find|show|search|lookup|look\s*up)\s+supplier\b/.test(text)) return true;
    if (/\bdo\s+we\s+have\b/.test(text) && /\bsupplier\b/.test(text)) return true;
    if (/\bhave\b.+\bas\s+(?:a\s+)?supplier\b/.test(text)) return true;
    // Bare "supplier SANBRO" / "supplier 32"
    if (/^supplier\s+.+/i.test(text.trim()) && !/\binvoice\b/.test(text)) return true;
    // Field questions: "email of supplier 32", "type of service of supplier SANBRO"
    if (
        /\b(?:email|phone|address|company\s+name|full\s+name|country\s+code|type\s+of\s+service|service\s+type|country\s+based|country\s+of\s+origin|profile\s+image)\b/.test(
            text
        ) &&
        /\bsupplier\b/.test(text)
    ) {
        return true;
    }
    return false;
}

function isDefaultHelpReply(reply) {
    if (!reply) return false;
    return (
        reply.startsWith('I can help you with') ||
        reply.startsWith('You can ask me anything') ||
        reply.startsWith('Please provide a client') ||
        reply.startsWith("Which client's invoices") ||
        reply.startsWith('Which supplier') ||
        reply.startsWith('Which freight is this about') ||
        reply.startsWith('Whose orders') ||
        reply.startsWith("Which client's orders") ||
        reply.startsWith('Whose warehouse orders') ||
        reply.startsWith('Which batch') ||
        reply.startsWith('Which shipment') ||
        reply.startsWith('Which clearance') ||
        reply.startsWith('Whose clearance orders') ||
        reply.startsWith('What should I show all of')
    );
}

/** Casual greetings / small talk — no data lookup needed */
function isGreetingOrSmallTalk(message) {
    const text = normalizeMessage(message)
        .toLowerCase()
        .replace(/[!?.]+$/g, '')
        .trim();
    if (!text || text.length > 80) return false;
    // If a Workspace reference is present, this is a real query
    if (
        /\b(ADQO|ADINV|ADZW|SUPINV|OR0*\d+|F-\d+|C-\d+|D-\d+|ADAWB|ADSWB|CE\d+)\b/i.test(
            message
        )
    ) {
        return false;
    }
    if (
        /^(hi+|hii+|hello|hey|helo|hlo|namaste|good\s*(morning|afternoon|evening)|gm|gn)\b/.test(
            text
        )
    ) {
        return true;
    }
    if (
        /^(how\s+are\s+you|how\s+r\s+u|hows\s+it\s+going|what'?s\s+up|sup)\b/.test(text)
    ) {
        return true;
    }
    if (
        /^(are\s+you\s+(an?\s+)?ai|who\s+are\s+you|what\s+are\s+you|what\s+can\s+you\s+do|help)\??$/.test(
            text
        )
    ) {
        return true;
    }
    if (/^(thanks|thank\s+you|thx|ok|okay|bye|goodbye)\b/.test(text)) {
        return true;
    }
    return false;
}

function greetingReply(message) {
    const text = normalizeMessage(message)
        .toLowerCase()
        .replace(/[!?.]+$/g, '')
        .trim();
    if (/^(are\s+you\s+(an?\s+)?ai|who\s+are\s+you|what\s+are\s+you)/.test(text)) {
        return 'Yes — I\'m Workspace AI. Ask about freights, orders, quotes, invoices, shipments, or clients (e.g. status of F-… or freight number of ADQO…).';
    }
    if (/^(what\s+can\s+you\s+do|help)$/.test(text)) {
        return 'I look up live Workspace data. Try: freight/order status, quote ADQO…, invoices, batches, shipments, clearances, clients, or counts.';
    }
    if (/^(how\s+are\s+you|how\s+r\s+u|hows\s+it\s+going|what'?s\s+up|sup)/.test(text)) {
        return 'I\'m good — ready to help. What freight, order, quote, or client should I look up?';
    }
    if (/^(thanks|thank\s+you|thx)/.test(text)) {
        return 'You\'re welcome. Ask anytime if you need another lookup.';
    }
    if (/^(ok|okay|bye|goodbye)/.test(text)) {
        return 'Okay. Send a freight, order, or quote number whenever you need details.';
    }
    return 'Hi — I\'m Workspace AI. Share a reference (F-…, OR…, ADQO…) or ask about freights, orders, invoices, or clients.';
}

/** List / show freights for a client or user */
function isListFreightsRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (isInvoiceRequest(message)) return false;
    if (isCountFreightsRequest(message)) return false;
    if (/\brelated\s+freights?\b/.test(text)) return false;
    if (isListOrdersRequest(message) && !/\bfreights?\b/.test(text)) return false;

    return (
        /\b(show|list|get|display)\b.*\bfreights?\b/.test(text) ||
        /\ball\b.*\bfreights?\b/.test(text) ||
        /\bfreights?\b.*\b(of|for|from|by)\b/.test(text) ||
        /\bmy\s+freights?\b/.test(text) ||
        /\bfreights?\s+of\s+(?:user|client|customer)\b/.test(text) ||
        /\b(?:user|client|customer)\s+.+\s+freights?\b/.test(text)
    );
}

function extractFreightListClientName(message) {
    if (extractClientId(message)) return null;

    const text = normalizeMessage(message);
    const patterns = [
        /\bfreights?\s+(?:of|for|from|by)\s+(?:user|client|customer)\s+(.+)$/i,
        /\b(?:show|list|get|display)\s+(?:the\s+)?(?:all\s+)?freights?\s+(?:of|for|from|by)\s+(?:user|client|customer)\s+(.+)$/i,
        /\b(?:show|list|get|display)\s+(?:the\s+)?(?:all\s+)?freights?\s+(?:of|for|from|by)\s+(.+)$/i,
        /\bfreights?\s+(?:of|for|from|by)\s+(.+)$/i,
        /\b(?:user|client|customer)\s+(.+?)\s+freights?\b/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match) continue;
        let name = match[1].trim().replace(/[?.!]+$/, '').trim();
        name = name.replace(/^(user|client|customer|named|called)\s+/i, '');
        const skip = ['me', 'my', 'mine', 'all', 'the', 'this', 'that'];
        if (!name || skip.includes(name.toLowerCase())) return null;
        if (name.length >= 2) return name;
    }
    return null;
}

function isMyFreightsRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (!isListFreightsRequest(message) && !/\bmy\s+freights?\b/.test(text)) return false;
    if (extractClientId(message) || extractFreightListClientName(message)) return false;
    return /\bmy\b/.test(text) || /\bme\b/.test(text);
}

/** Order numbers like OR000253, OR0002 */
function extractOrderNumber(message) {
    const text = normalizeMessage(message);
    const match = text.match(/\b(OR0*\d{1,10})\b/i);
    if (!match) return null;
    const digits = match[1].replace(/^OR0*/i, '');
    if (!digits) return null;
    return `OR000${digits}`;
}

/** Specific order field the user asked about */
function extractOrderFocus(message) {
    if (!extractOrderNumber(message) && !/\borders?\b/.test(normalizeMessage(message))) return null;
    if (isListOrdersRequest(message) || isMyOrdersRequest(message) || isCountOrdersRequest(message)) {
        return null;
    }

    const text = normalizeMessage(message).toLowerCase();
    if (/estimate|quotation|quote|how\s*much|\bamount\b/i.test(text)) return 'estimate_amount';
    if (/status|track(?:ing)?/i.test(text)) return 'status';
    if (/\b(client|customer)\b/i.test(text)) return 'client';
    if (/\bfreight\b/i.test(text) && !/\bamount\b|\bquote\b|\bestimate\b/.test(text)) return 'freight';
    if (/goods|product|description|cargo/i.test(text)) return 'goods';
    if (/warehouse/i.test(text)) return 'warehouse';
    if (/\broute\b|origin|destination|from.*to/i.test(text)) return 'route';
    return null;
}

function isListOrdersRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (isInvoiceRequest(message)) return false;
    if (isCountOrdersRequest(message)) return false;
    if (/\bkpi\b/.test(text)) return false;
    if (/\b(clearance|warehouse)\s+orders?\b/.test(text)) return false;
    if (/\bclearance\b/.test(text) && /\borders?\b/.test(text)) return false;

    // Single order by number is not a list request (unless explicitly listing)
    if (
        extractOrderNumber(message) &&
        !/\b(all|list|show|my)\b.*\borders?\b/.test(text) &&
        !/\borders?\s+(?:of|for)\b/.test(text)
    ) {
        if (
            !/\b(all|list)\b/.test(text) &&
            !/\borders?\s+(?:of|for)\s+(?:user|client|customer|freight)\b/.test(text)
        ) {
            return false;
        }
    }

    return (
        /\b(show|list|get|display)\b.*\borders?\b/.test(text) ||
        /\ball\b.*\borders?\b/.test(text) ||
        /\borders?\b.*\b(of|for|from|by)\b/.test(text) ||
        /\bmy\s+orders?\b/.test(text) ||
        /\borders?\s+of\s+(?:user|client|customer|freight)\b/.test(text) ||
        /\b(?:user|client|customer)\s+.+\s+orders?\b/.test(text)
    );
}

function extractOrderListClientName(message) {
    if (extractClientId(message)) return null;

    const text = normalizeMessage(message);
    const patterns = [
        /\borders?\s+(?:of|for|from|by)\s+(?:user|client|customer)\s+(.+)$/i,
        /\b(?:show|list|get|display)\s+(?:the\s+)?(?:all\s+)?orders?\s+(?:of|for|from|by)\s+(?:user|client|customer)\s+(.+)$/i,
        /\b(?:show|list|get|display)\s+(?:the\s+)?(?:all\s+)?orders?\s+(?:of|for|from|by)\s+(.+)$/i,
        /\borders?\s+(?:of|for|from|by)\s+(.+)$/i,
        /\b(?:user|client|customer)\s+(.+?)\s+orders?\b/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match) continue;
        let name = match[1].trim().replace(/[?.!]+$/, '').trim();
        name = name.replace(/^(user|client|customer|named|called|freight)\s+/i, '');
        if (/^F-?\d+/i.test(name) || /^OR0*\d+/i.test(name)) return null;
        const skip = ['me', 'my', 'mine', 'all', 'the', 'this', 'that'];
        if (!name || skip.includes(name.toLowerCase())) return null;
        if (name.length >= 2) return name;
    }
    return null;
}

function isMyOrdersRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (!isListOrdersRequest(message) && !/\bmy\s+orders?\b/.test(text)) return false;
    if (extractClientId(message) || extractOrderListClientName(message) || extractFreightNumber(message)) {
        return false;
    }
    return /\bmy\b/.test(text) || /\bme\b/.test(text);
}

function isOrderRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    return (
        extractOrderNumber(message) !== null ||
        isListOrdersRequest(message) ||
        isMyOrdersRequest(message) ||
        isCountOrdersRequest(message) ||
        /\borders?\b/.test(text)
    );
}

/** "count total freight", "how many freights", "total freights?" */
function isCountFreightsRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (!/\bfreights?\b/.test(text)) return false;
    if (isInvoiceRequest(message) || isListOrdersRequest(message)) return false;

    return (
        /\b(count|total|how\s*many|number\s+of)\b/.test(text) ||
        /\bfreights?\s+count\b/.test(text) ||
        /\bcount\b.*\bfreights?\b/.test(text)
    );
}

/** "count total orders", "how many orders" */
function isCountOrdersRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (!/\borders?\b/.test(text)) return false;
    if (isInvoiceRequest(message)) return false;
    if (/\b(clearance|warehouse)\s+orders?\b/.test(text)) return false;
    if (extractOrderNumber(message) && !/\b(count|total|how\s*many)\b/.test(text)) return false;

    return (
        /\b(count|total|how\s*many|number\s+of)\b/.test(text) ||
        /\borders?\s+count\b/.test(text) ||
        /\bcount\b.*\borders?\b/.test(text)
    );
}

/** Clearance numbers like C-202607001 */
function extractClearanceNumber(message) {
    const text = normalizeMessage(message);
    const match = text.match(/\b(C-\d{6,})\b/i);
    return match ? match[1].toUpperCase() : null;
}

/** Specific clearance field (Update Custom Clearance form) */
function extractClearanceFocus(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (!extractClearanceNumber(message) && !/\bclearances?\b/.test(text)) return null;

    if (/\bmode\s+of\s+freight\b|\bfreight\s*(?:mode|type|option)\b/.test(text)) return 'mode';
    if (/\b(?:are\s+you|shipper|consignee|party)\b/.test(text) && !/\bclient\b/.test(text)) {
        if (/\bshipper\b|\bconsignee\b|\bare\s+you\b/.test(text)) return 'party';
    }
    if (/\bimport\b|\bexport\b|\bis\s+this\b/.test(text)) return 'import_export';
    if (/\bshipment\s+ref/.test(text) || /\bcustomer\s+ref/.test(text)) return 'shipment_ref';
    if (/\bsales\s*rep/.test(text)) return 'sales_rep';
    if (/\bport\s+of\s+loading\s+country\b|\bloading\s+country\b/.test(text)) return 'loading_country';
    if (/\bport\s+of\s+exit\s+country\b|\bexit\s+country\b|\bdischarge\s+country\b/.test(text)) {
        return 'exit_country';
    }
    if (/\bport\s+of\s+loading\b|\bpol\b/.test(text)) return 'port_of_loading';
    if (/\bport\s+of\s+discharge\b|\bpod\b|\bport\s+of\s+exit\b/.test(text)) return 'port_of_discharge';
    if (/\bproduct\s+desc|\bgoods\s+desc|\bcargo\b/.test(text)) return 'product_desc';
    if (/\bnature\s+of\s+goods\b/.test(text)) return 'nature_of_goods';
    if (/\btype\s+of\s+pack|\bpacking\b|\bpackage\s+type\b/.test(text)) return 'packing';
    if (/\bcomment\s+on\s+docs?\b|\bdocs?\s+comment\b/.test(text)) return 'comment_docs';
    if (/\bcomment\s+on\s+goods\b|\bgoods\s+comment\b/.test(text)) return 'comment_goods';
    if (/\bno\s+of\s+pack|\bpackages?\b|\bboxes?\b|\btotal\s+box\b/.test(text)) return 'packages';
    if (/\btotal\s+dim|\bdimension|\bcbm\b/.test(text)) return 'dimensions';
    if (/\bweight\b/.test(text)) return 'weight';
    if (/\bclient\b|\bcustomer\b/.test(text) && !/\bclient\s+id\b/.test(text)) return 'client';
    if (/\bclearing\s+status\b|\bstatus\b/.test(text)) return 'status';
    return null;
}

/** Batch numbers — e.g. ADAWB2405032 (with or without the word "batch") */
function extractBatchNumber(message) {
    const text = normalizeMessage(message);
    const labeled = text.match(/\bbatch(?:\s*(?:number|no\.?|#|id))?\s*[:=]?\s*([A-Za-z0-9][A-Za-z0-9_-]{3,})\b/i);
    if (labeled) {
        const v = labeled[1];
        if (!/^(batch|number|status|of|for|the|origin|route|destination)$/i.test(v)) {
            return v.toUpperCase();
        }
    }

    const fieldAsk =
        /\b(origin|destination|route|status|waybill|mode|vessel|carrier|etd)\b/i.test(text) ||
        /\bbatch(?:es)?\b/i.test(text);

    // Letter+digit tokens (not freight/order/clearance/invoice)
    const tokens = text.match(/\b([A-Za-z]{2,}[0-9][A-Za-z0-9_-]{2,})\b/g) || [];
    for (const t of tokens) {
        if (/^F-?\d/i.test(t) || /^OR0/i.test(t) || /^C-\d/i.test(t)) continue;
        if (/INV\d/i.test(t)) continue; // Sage / quote invoice document numbers
        if (/^[A-Z]{2}\d{2}[A-Z]\d{5,}$/i.test(t)) continue; // sea waybill / load e.g. DL26S0000776
        if (/freight|order|invoice|client|status|batch/i.test(t)) continue;
        // Prefer longer batch-like codes; always allow when "batch" is present
        if (fieldAsk || t.length >= 8) {
            return t.toUpperCase();
        }
    }
    return null;
}

/** Specific batch field the user asked about */
function extractBatchFocus(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (!extractBatchNumber(message) && !/\bbatch(?:es)?\b/.test(text)) return null;

    if (/\borigin\b/.test(text)) return 'origin';
    if (/\bdestination\b|\bdischarge\b/.test(text)) return 'destination';
    if (/\broute\b|from.*to/.test(text)) return 'route';
    if (/\bdim(?:ension)?s?\b|\bcbm\b/.test(text)) return 'dimensions';
    if (/\bweight\b/.test(text)) return 'weight';
    if (/\bpackages?\b|\bboxes?\b|\bcartons?\b/.test(text)) return 'packages';
    if (/\bforwarding\s*agent\b|\bagent\b/.test(text)) return 'forwarding_agent';
    if (/\btotal\s*freight\b|\bhow\s*many\s*freight/.test(text)) return 'total_freight';
    if (/\bwaybill\b|\bawb\b/.test(text)) return 'waybill';
    if (/\b(?:what\s+is\s+)?(?:the\s+)?mode\b|\bfreight\s*option\b|\bfreight\s*type\b/.test(text)) {
        return 'mode';
    }
    if (/\bvessel\b/.test(text)) return 'vessel';
    if (/\bcarrier\b/.test(text)) return 'carrier';
    if (/\betd\b|departure/.test(text)) return 'etd';
    if (/\bstatus\b/.test(text)) return 'status';
    if (/\blinked|contents|items\b/.test(text)) return 'contents';
    return null;
}

/** Waybill — labeled, AWB 999-94052044, or sea load style DL26S0000776 */
function extractWaybill(message) {
    const text = normalizeMessage(message);
    const labeled = text.match(
        /\b(?:waybill|awb|tracking(?:\s*number)?|shipment)\s*(?:number|no\.?|#)?\s*[:=]?\s*([A-Za-z0-9][A-Za-z0-9_/-]{4,})\b/i
    );
    if (labeled) {
        const v = labeled[1];
        if (!/^(number|status|of|for|the|details?|vessel|carrier)$/i.test(v)) return v.toUpperCase();
    }
    const awb = text.match(/\b(\d{3}-\d{6,})\b/);
    if (awb) return awb[1];
    // Sea / load style e.g. DL26S0000776
    const sea = text.match(/\b([A-Z]{2}\d{2}[A-Z]\d{5,})\b/i);
    if (sea) return sea[1].toUpperCase();
    // Bare token when message is only a waybill-like code
    const only = text.match(/^\s*([A-Z0-9][A-Z0-9_/-]{6,})\s*[?.!]?\s*$/i);
    if (only) {
        const v = only[1];
        if (
            !/^F-?\d/i.test(v) &&
            !/^OR0/i.test(v) &&
            !/^C-\d/i.test(v) &&
            !/INV\d/i.test(v) &&
            !/^ADA?WB/i.test(v) &&
            !/^S\d{4,}$/i.test(v)
        ) {
            return v.toUpperCase();
        }
    }
    return null;
}

/** Specific shipment field the user asked about (Shipment Details form) */
function extractShipmentFocus(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (!extractWaybill(message) && !/\bshipments?\b/.test(text) && !/\bwaybill\b/.test(text)) {
        return null;
    }
    if (/\bdate\s+of\s+dispatch\b|\bdispatch\s+date\b/.test(text)) return 'date_of_dispatch';
    if (/\borigin\s+agent\b/.test(text)) return 'origin_agent';
    if (/\bdestination\s+agent\b/.test(text)) return 'destination_agent';
    if (/\bport\s+of\s+loading\b|\bpol\b/.test(text)) return 'port_of_loading';
    if (/\bport\s+of\s+discharge\b|\bpod\b/.test(text)) return 'port_of_discharge';
    if (/\bdestination\s+country\b/.test(text)) return 'destination_country';
    if (/\bcountry\s+of\s+origin\b|\borigin\s+country\b/.test(text)) return 'origin_country';
    if (/\brelease\s+type\b/.test(text)) return 'release_type';
    if (/\bcontainer\b/.test(text)) return 'container';
    if (/\bseal\b/.test(text)) return 'seal';
    if (/\bload\s*(?:number|no\.?|#)?\b/.test(text) && !/\bdownload\b/.test(text)) return 'load';
    if (/\beta\b|\barrival\b|\batd\b/.test(text)) return 'eta';
    if (/\betd\b|\bdeparture\b/.test(text)) return 'etd';
    if (/\bvessel\b/.test(text)) return 'vessel';
    if (/\bcarrier\b/.test(text)) return 'carrier';
    if (
        (/\b(?:freight\s+)?mode\b|\bfreight\s*type\b/.test(text) ||
            (/\b(sea|air)\b/.test(text) && /\b(shipment|waybill)\b/.test(text))) &&
        !/\bfreight\s+F-/i.test(text)
    ) {
        return 'mode';
    }
    if (/\bstatus\b/.test(text)) return 'status';
    if (/\bassign(?:ed)?\b|\blinked\b|\bcontents\b|\borders?\b/.test(text) && /\bshipments?\b/.test(text)) {
        return 'assigned';
    }
    if (/\bclearance\b/.test(text) && /\bshipments?\b/.test(text)) return 'clearances';
    if (/\bwaybill\b|\bawb\b/.test(text) && !extractWaybill(message)) return 'waybill';
    return null;
}

function extractWarehouseOrderId(message) {
    const text = normalizeMessage(message);
    const match = text.match(/\bwarehouse\s*(?:order)?\s*(?:id|#|number|no\.?)?\s*[:=]?\s*(\d{1,8})\b/i);
    return match ? Number(match[1]) : null;
}

function extractClientNameForEntity(message, entityHint) {
    if (extractClientId(message)) return null;
    const text = normalizeMessage(message);
    const esc = String(entityHint || '')
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\s+/g, '\\s+');
    // Allow "warehouse orders for …" when hint is just "warehouse"
    const optionalOrders = /\border\b/i.test(entityHint) ? '' : '(?:\\s+orders?)?';
    const patterns = [
        new RegExp(
            `\\b(?:${esc}|${esc}s?)${optionalOrders}\\s+(?:of|for|from|by)\\s+(?:user|client|customer)\\s+(.+)$`,
            'i'
        ),
        new RegExp(
            `\\b(?:show|list|get|display|count)\\s+(?:all\\s+)?(?:${esc}|${esc}s?)${optionalOrders}\\s+(?:of|for|from|by)\\s+(.+)$`,
            'i'
        ),
        new RegExp(`\\b(?:${esc}|${esc}s?)${optionalOrders}\\s+(?:of|for|from|by)\\s+(.+)$`, 'i'),
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match) continue;
        let name = match[1].trim().replace(/[?.!]+$/, '').trim();
        name = name.replace(/^(user|client|customer|named|called|freight|order|batch)\s+/i, '');
        if (/^F-?\d+/i.test(name) || /^OR0*\d+/i.test(name) || /^C-\d+/i.test(name)) return null;
        const skip = ['me', 'my', 'mine', 'all', 'the', 'this', 'that'];
        if (!name || skip.includes(name.toLowerCase())) return null;
        if (name.length >= 2) return name;
    }
    return null;
}

function isWarehouseRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (/\bgroupage\s+warehouse\b/.test(text) || isPartnerDirectoryRequest(message)) return false;
    return (
        /\bwarehouse\b/.test(text) ||
        /\bsupplier\s+warehouse\b/.test(text) ||
        extractWarehouseOrderId(message) != null
    );
}

function isBatchRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    return /\bbatch(?:es)?\b/.test(text) || extractBatchNumber(message) != null;
}

function isShipmentRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    return (
        /\bshipments?\b/.test(text) ||
        /\bwaybill\b/.test(text) ||
        /\bawb\b/.test(text) ||
        extractWaybill(message) != null
    );
}

function isClearanceRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (isTaskManagerRequest(message) && /\btasks?\b/.test(text)) return false;
    if (/\b(?:customs?\s*)?(?:clearing\s*)?agents?\b|\bcustom\s+agents?\b/.test(text)) return false;
    return /\bclearances?\b/.test(text) || extractClearanceNumber(message) != null;
}

function isClearanceOrderRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    return (
        /\bclearance\s+orders?\b/.test(text) ||
        /\border\s+clearances?\b/.test(text) ||
        /\bcleared\s+orders?\b/.test(text) ||
        /\border\s+clearance\b/.test(text)
    );
}

function extractClearanceOrderSearchTerm(message) {
    if (extractClearanceNumber(message) || extractClientId(message)) return null;
    const text = normalizeMessage(message);
    const patterns = [
        /\b(?:find|search|lookup|look\s*up)\s+(?:an?\s+)?(?:clearance\s+order|order\s+clearance)s?\s+(?:for|named?|called|of|about)?\s*(.+)$/i,
        /\b(?:clearance\s+order|order\s+clearance)s?\s+(?:for|of|named?|called|about)?\s*(.+)$/i,
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match) continue;
        let term = match[1].trim().replace(/[?.!]+$/, '').trim();
        term = term.replace(/^(for|of|named|called|client|customer|user)\s+/i, '');
        if (/^(me|my|mine|all|the|this|that|list|count|total|status)$/i.test(term)) return null;
        if (term.length >= 2) return term;
    }
    return null;
}

function isCountWarehouseRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    return /\bwarehouse\b/.test(text) && /\b(count|total|how\s*many|number\s+of)\b/.test(text);
}

function isCountBatchRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    return /\bbatch(?:es)?\b/.test(text) && /\b(count|total|how\s*many|number\s+of)\b/.test(text);
}

function isCountShipmentRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    return /\bshipments?\b/.test(text) && /\b(count|total|how\s*many|number\s+of)\b/.test(text);
}

function isCountClearanceRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (isCountClearanceOrderRequest(message)) return false;
    return /\bclearances?\b/.test(text) && /\b(count|total|how\s*many|number\s+of)\b/.test(text);
}

function isCountClearanceOrderRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    return /\bclearance\s+orders?\b/.test(text) && /\b(count|total|how\s*many|number\s+of)\b/.test(text);
}

/** Dispute IDs like D-202638, D-202635 */
function extractDisputeId(message) {
    const text = normalizeMessage(message);
    const matches = text.match(/\bD-\d{4,}\b/gi);
    if (!matches?.length) return null;
    // Prefer the longest match (D-202638 over D-20263)
    return matches.sort((a, b) => b.length - a.length)[0].toUpperCase();
}

function extractDisputeFocus(message) {
    if (!extractDisputeId(message) && !isDisputeRequest(message)) return null;
    const text = normalizeMessage(message).toLowerCase();
    if (/\boutcome\b|\bstatus\b|\bpending\b|\bresolved\b|\baction\b/i.test(text)) return 'outcome';
    if (/\bsubject\b/i.test(text)) return 'subject';
    if (/\bnature\b|\bheading\b/i.test(text)) return 'nature';
    if (/\bmessage\b|\bdetail\b|\bdescription\b/i.test(text)) return 'message';
    if (/\bname\b|\braised\s*by\b|\bwho\b/i.test(text)) return 'name';
    if (/\bfreight\b|\border\b/i.test(text) && !/\bdispute\b/.test(text)) return 'freight_no';
    return null;
}

function extractDisputeSearchTerm(message) {
    if (extractDisputeId(message)) return null;
    const text = normalizeMessage(message);

    const freight = extractFreightNumber(message);
    if (freight) return freight;
    const order = extractOrderNumber(message);
    if (order) return order;

    const patterns = [
        /(?:dispute|disputes|quer(?:y|ies)|customer\s+quer(?:y|ies))\s+(?:for|of|from|by|about)\s+([A-Za-z][A-Za-z0-9 .'-]{1,60})/i,
        /(?:search|find|show|list)\s+(?:dispute|disputes|quer(?:y|ies))\s+(?:for|of|named?)?\s*([A-Za-z][A-Za-z0-9 .'-]{1,60})/i,
        /(?:pending|resolved)\s+disputes?\s+(?:for|of|from)?\s*([A-Za-z][A-Za-z0-9 .'-]{1,40})?/i,
    ];
    for (const re of patterns) {
        const m = text.match(re);
        if (m?.[1]) {
            const name = m[1].replace(/\b(please|thanks|dispute|disputes|query|queries)\b/gi, '').trim();
            if (name && name.length >= 2) return name;
        }
    }
    return null;
}

function isDisputeRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (/\bcontact\s+us\b|\bcontact\s+enquir|\bnature\s+of\s+enquir|\bwebsite\s+enquir/.test(text)) {
        return false;
    }
    if (/\benquir(?:y|ies)\b/.test(text) && !/\bdisputes?\b/.test(text) && !/\bcustomer\s+quer/.test(text)) {
        return false;
    }
    if (extractDisputeId(message)) return true;
    if (/\bcustomer\s+quer(?:y|ies)\b/.test(text)) return true;
    if (/\bdisputes?\b/.test(text)) return true;
    if (/\bquer(?:y|ies)\b/.test(text) && /\b(customer|support|service)\b/.test(text)) return true;
    return false;
}

function isCountDisputeRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (/\bcontact\s+us\b|\bcontact\s+enquir|\benquir(?:y|ies)\b/.test(text) && !/\bdisputes?\b/.test(text)) {
        return false;
    }
    return (
        /\b(disputes?|customer\s+quer(?:y|ies))\b/.test(text) &&
        /\b(count|total|how\s*many|number\s+of)\b/.test(text)
    );
}

function isReleaseDashboardRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (/\brelease\s+type\b/.test(text)) return false;
    if (/\brelease\s+dashboard\b|\breleased\s+dashboard\b/.test(text)) return true;
    if (/\bcargo\s+inspection\b/.test(text)) return true;
    if (/\brelease\s+instruction\b/.test(text)) return true;
    if (/\brelease\s+(?:status|detail|details)\b/.test(text)) return true;
    if (/\brelease\b/.test(text) && extractOrderNumber(message)) return true;
    if (
        extractOrderNumber(message) &&
        /\b(delivery|payment|cargo\s*inspection|clearing\s+status|release\s+instruction)\b/.test(text) &&
        !/\bfreight\b/.test(text)
    ) {
        return true;
    }
    if (/\breleases?\b/.test(text) && /\b(open|close|closed|pending|for|of|search|show|list|find)\b/.test(text)) {
        return true;
    }
    return false;
}

function extractReleaseFocus(message) {
    if (!isReleaseDashboardRequest(message) && !extractOrderNumber(message)) return null;
    const text = normalizeMessage(message).toLowerCase();
    if (/\bclearing\b/.test(text)) return 'clearing_status';
    if (/\bcargo\s*inspection\b|\binspection\b/.test(text)) return 'cargo_inspection';
    if (/\bpayment\b|\bpaid\b/.test(text)) return 'payment';
    if (/\brelease\s+instruction\b|\binstruction\b/.test(text)) return 'release_instruction';
    if (/\bdelivery\b|\btrack\s*status\b/.test(text)) return 'delivery';
    if (/\bstatus\b|\bopen\b|\bclose\b/.test(text) && !/\bpayment\b/.test(text)) return 'status';
    if (/\bcustomer\b|\bclient\s*name\b/.test(text)) return 'customer_name';
    return null;
}

function extractReleaseSearchTerm(message) {
    const order = extractOrderNumber(message);
    if (order) return order;
    const freight = extractFreightNumber(message);
    if (freight) return freight;

    const text = normalizeMessage(message);
    const patterns = [
        /(?:release\s+dashboard|released\s+dashboard|releases?)\s+(?:for|of|from|by|about)\s+([A-Za-z][A-Za-z0-9 .'-]{1,60})/i,
        /(?:search|find|show|list)\s+(?:release\s+dashboard|released\s+dashboard|releases?)\s+(?:for|of)?\s*([A-Za-z][A-Za-z0-9 .'-]{1,60})/i,
    ];
    for (const re of patterns) {
        const m = text.match(re);
        if (m?.[1]) {
            const name = m[1]
                .replace(/\b(please|thanks|release|dashboard|open|close|closed)\b/gi, '')
                .trim();
            if (name && name.length >= 2) return name;
        }
    }
    return null;
}

function isCountReleaseDashboardRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (/\brelease\s+type\b/.test(text)) return false;
    return (
        /\b(release\s+dashboard|released\s+dashboard|releases?)\b/.test(text) &&
        /\b(count|total|how\s*many|number\s+of)\b/.test(text)
    );
}

/** Quote refs like ADQO10299, ADQO10284 */
function extractQuoteReference(message) {
    const text = normalizeMessage(message);
    const m = text.match(/\bADQO\d{3,}\b/i);
    return m ? m[0].toUpperCase() : null;
}

function extractQuoteFocus(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (!extractQuoteReference(message) && !isQuoteListRequest(message) && !/\bquot/.test(text)) {
        return null;
    }
    if (/\bamount\s*due\b|\bdue\b/.test(text)) return 'amount_due';
    if (/\btotal\b|\bamount\b|\bestimate\b/.test(text) && !/\bfreight\b/.test(text)) return 'total';
    if (/\bstatus\b|\bpaid\b|\bunpaid\b/.test(text)) return 'status';
    if (/\bcurrency\b/.test(text)) return 'currency';
    if (/\bcountry\b/.test(text)) return 'country';
    if (/\bcustomer\b|\bclient\b/.test(text)) return 'customer_name';
    // English + common Hinglish: "freight number", "iska freight", "freight number kya hai"
    if (/\bfreight\b|\bfreight\s*number\b|\bfright\b/.test(text)) return 'freight_number';
    if (/\bchargeable\b/.test(text)) return 'chargeable';
    if (/\bincoterm\b/.test(text)) return 'incoterm';
    if (/\bcargo\b|\bcommodity\b|\bweight\b|\bpackages?\b/.test(text)) return 'cargo';
    if (/\brouting\b|\bport\b|\borigin\b|\bdestination\b/.test(text)) return 'routing';
    return null;
}

function extractQuoteSearchTerm(message) {
    if (extractQuoteReference(message)) return null;
    const freight = extractFreightNumber(message);
    if (freight) return freight;

    const text = normalizeMessage(message);
    const patterns = [
        /(?:quotation|quote|quotes|estimates?)\s+(?:for|of|from|by|about)\s+([A-Za-z][A-Za-z0-9 .'-]{1,60})/i,
        /(?:search|find|show|list)\s+(?:quotation|quote|quotes|freight\s+quotes?)\s+(?:for|of)?\s*([A-Za-z][A-Za-z0-9 .'-]{1,60})/i,
    ];
    for (const re of patterns) {
        const m = text.match(re);
        if (m?.[1]) {
            const name = m[1]
                .replace(/\b(please|thanks|quote|quotes|quotation|estimate|unpaid|paid)\b/gi, '')
                .trim();
            if (name && name.length >= 2 && !/^F-\d/i.test(name)) return name;
        }
    }
    return null;
}

function isQuoteListRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (extractQuoteReference(message)) return true;
    if (/\bfreight\s+quotes?\b|\bquote\s+estimates?\b/.test(text)) return true;
    if (/\bquotations?\b/.test(text)) return true;
    if (
        /\bquotes?\b/.test(text) &&
        /\b(for|of|list|show|search|find|unpaid|paid|customer|client)\b/.test(text)
    ) {
        return true;
    }
    // "quote ADQO…" already handled; "status of quote …"
    if (/\bquote\b/.test(text) && /\b(status|total|amount\s*due|reference)\b/.test(text)) return true;
    return false;
}

function isCountQuoteRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    return (
        /\b(quotes?|quotations?|freight\s+quotes?)\b/.test(text) &&
        /\b(count|total|how\s*many|number\s+of)\b/.test(text)
    );
}

function extractFreightInvoiceFocus(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (
        !extractFreightInvoiceReference(message) &&
        !isFreightInvoiceListRequest(message) &&
        !/\bfreight\s+invoice\b/.test(text)
    ) {
        return null;
    }
    if (/\bamount\s*due\b/.test(text)) return 'amount_due';
    if (/\btotal\b/.test(text)) return 'total';
    if (/\bstatus\b/.test(text)) return 'status';
    if (/\bcurrency\b/.test(text)) return 'currency';
    if (/\bcountry\b/.test(text)) return 'country';
    if (/\bcustomer\s+name\b|\bclient\s+name\b/.test(text)) return 'customer_name';
    if (/\bfreight\s*(?:\/\s*)?order\b|\bfreight\s+number\b|\border\s+number\b/.test(text)) {
        return 'freight_number';
    }
    if (/\bchargeable\b/.test(text)) return 'chargeable';
    if (/\bincoterm\b/.test(text)) return 'incoterm';
    if (/\bcargo\b|\bcommodity\b|\bweight\b|\bpackages?\b/.test(text)) return 'cargo';
    if (/\brouting\b|\bport\s+of\b|\bcountry\s+of\s+origin\b/.test(text)) return 'routing';
    return null;
}

function extractFreightInvoiceSearchTerm(message) {
    if (extractFreightInvoiceReference(message)) return null;
    const freight = extractFreightNumber(message);
    if (freight) return freight;
    const order = extractOrderNumber(message);
    if (order) return order;

    const text = normalizeMessage(message);
    const patterns = [
        /(?:freight\s+invoice|quote\s+invoice|invoices?)\s+(?:for|of|from|by|about)\s+([A-Za-z][A-Za-z0-9 .'-]{1,60})/i,
        /(?:search|find|show|list)\s+(?:freight\s+invoice|quote\s+invoice|freight\s+invoices?)\s+(?:for|of)?\s*([A-Za-z][A-Za-z0-9 .'-]{1,60})/i,
    ];
    for (const re of patterns) {
        const m = text.match(re);
        if (m?.[1]) {
            const name = m[1]
                .replace(/\b(please|thanks|invoice|invoices|freight|quote|unpaid|paid|sage)\b/gi, '')
                .trim();
            if (name && name.length >= 2 && !/^F-\d/i.test(name) && !/^OR0/i.test(name)) return name;
        }
    }
    return null;
}

function isFreightInvoiceListRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (extractFreightInvoiceReference(message)) return true;
    if (/\bfreight\s+invoices?\b|\bquote\s+invoices?\b/.test(text)) return true;
    if (/\badinv\b/.test(text)) return true;
    // "freight invoice status / unpaid freight invoices"
    if (/\binvoices?\b/.test(text) && /\bfreight\b/.test(text) && !/\bsage\b/.test(text)) return true;
    return false;
}

function isCountFreightInvoiceRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    return (
        (/\bfreight\s+invoices?\b|\bquote\s+invoices?\b|\badinv\b/.test(text) ||
            (/\binvoices?\b/.test(text) && /\bfreight\b/.test(text))) &&
        /\b(count|total|how\s*many|number\s+of)\b/.test(text) &&
        !/\bsage\b/.test(text)
    );
}

/** Cashbook bank refs e.g. 20260729003 — not digits inside F-2026… freight numbers */
function extractCashbookBankRef(message) {
    const text = normalizeMessage(message);
    const labeled = text.match(/\bbank\s*ref\.?\s*[:=]?\s*(20\d{8,11})\b/i);
    if (labeled) return labeled[1];
    const withCashbook = text.match(/\bcashbook\b[^0-9]{0,24}\b(20\d{8,11})\b/i);
    if (withCashbook) return withCashbook[1];
    const only = text.match(/^\s*(20\d{8,11})\s*[?.!]?\s*$/);
    if (only) return only[1];
    const matches = text.match(/\b(20\d{8,11})\b/g) || [];
    for (const raw of matches) {
        const idx = text.indexOf(raw);
        const before = text.slice(Math.max(0, idx - 3), idx).toUpperCase();
        // Skip F-2026… / AD2026… style prefixes
        if (/F-$/.test(before) || /[A-Z]-$/.test(before) || /[A-Z]$/.test(before)) continue;
        return raw;
    }
    return null;
}

function extractCashbookFocus(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (!extractCashbookBankRef(message) && !/\bcashbook\b/.test(text) && !/\bbank\s*ref/.test(text)) {
        return null;
    }
    if (/\binvoice\s*\(\s*pop\s*\)|\binvoice\s+pop\b|\bpop\b/.test(text)) return 'invoice_pop';
    if (/\ballocated\b|\ballocation\b/.test(text)) return 'allocated';
    if (/\bshipment\s*ref/.test(text)) return 'shipment_ref';
    if (/\bcustomer\s+name\b|\bcustomer\b|\bclient\b/.test(text)) return 'customer';
    if (/\bdescription\b/.test(text)) return 'description';
    if (/\breceipt\b/.test(text)) return 'receipt';
    if (/\bpayment\b/.test(text)) return 'payment';
    if (/\bdate\b/.test(text)) return 'date';
    return null;
}

function extractCashbookSearchTerm(message) {
    if (extractCashbookBankRef(message)) return null;
    const freight = extractFreightNumber(message);
    if (freight && /\bcashbook\b/i.test(message)) return freight;
    const order = extractOrderNumber(message);
    if (order && (/\bcashbook\b/i.test(message) || /\bbank\s*ref/i.test(message))) return order;

    const text = normalizeMessage(message);
    const patterns = [
        /(?:cashbook|bank\s*ref\.?)\s+(?:for|of|from|by|about)\s+([A-Za-z0-9][A-Za-z0-9 .'-]{1,60})/i,
        /(?:search|find|show|list)\s+cashbook\s+(?:for|of)?\s*([A-Za-z0-9][A-Za-z0-9 .'-]{1,60})/i,
    ];
    for (const re of patterns) {
        const m = text.match(re);
        if (m?.[1]) {
            let name = m[1]
                .replace(/\b(please|thanks|cashbook|bank|ref|allocated|unallocated|receipt|payment)\b/gi, '')
                .trim()
                .replace(/[?.!]+$/, '');
            if (/^OR0*\d+/i.test(name)) return name.toUpperCase().replace(/^OR0*/i, (x) => x); // keep OR form
            if (/^F-\d+/i.test(name)) return name.toUpperCase();
            if (name && name.length >= 2) return name;
        }
    }
    // "cashbook OR0001283" / "cashbook F-…"
    if (/\bcashbook\b/i.test(text)) {
        if (order) return order;
        if (freight) return freight;
    }
    return null;
}

function isCashbookRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (/\bcashbook\b/.test(text)) return true;
    if (/\bbank\s*ref/.test(text)) return true;
    if (extractCashbookBankRef(message)) return true;
    return false;
}

function isCountCashbookRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    return (
        /\bcashbook\b/.test(text) &&
        /\b(count|total|how\s*many|number\s+of)\b/.test(text)
    );
}

/** Supplier shipment invoice refs like SUPINV10015 */
function extractSupplierInvoiceReference(message) {
    const text = normalizeMessage(message);
    const m = text.match(/\bSUPINV\d{3,}\b/i);
    return m ? m[0].toUpperCase() : null;
}

function extractSupplierInvoiceFocus(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (
        !extractSupplierInvoiceReference(message) &&
        !/\bsupplier\s+invoice\b/.test(text) &&
        !/\bsupinv\b/.test(text)
    ) {
        return null;
    }
    if (/\bamount\s*due\b/.test(text)) return 'amount_due';
    if (/\btotal\b/.test(text)) return 'total';
    if (/\bstatus\b/.test(text)) return 'status';
    if (/\bcurrency\b/.test(text)) return 'currency';
    if (/\bdue\s*date\b/.test(text)) return 'due_date';
    if (/\binv(?:oice)?\s*date\b/.test(text)) return 'inv_date';
    if (/\bwaybill\b/.test(text)) return 'waybill';
    if (/\bsup(?:plier)?\s+invoice\s*(?:no|number|#)\b/.test(text)) return 'supplier_invoice_no';
    if (/\bsupplier\s+name\b/.test(text)) return 'supplier_name';
    if (/\bcarrier\b|\bvessel\b|\betd\b|\batd\b|\bcargo\b/.test(text)) return 'cargo';
    if (/\brouting\b|\bport\s+of\b|\bcontainer\b/.test(text)) return 'routing';
    if (/\bchargeable\b/.test(text)) return 'chargeable';
    return null;
}

function extractSupplierInvoiceSearchTerm(message) {
    if (extractSupplierInvoiceReference(message)) return null;
    const text = normalizeMessage(message);
    const patterns = [
        /(?:supplier\s+invoices?)\s+(?:for|of|from|by|about)\s+([A-Za-z0-9][A-Za-z0-9 .'-]{1,80})/i,
        /(?:search|find|show|list)\s+supplier\s+invoices?\s+(?:for|of)?\s*([A-Za-z0-9][A-Za-z0-9 .'-]{1,80})/i,
    ];
    for (const re of patterns) {
        const m = text.match(re);
        if (m?.[1]) {
            const name = m[1]
                .replace(/\b(please|thanks|supplier|invoice|invoices|unpaid|paid)\b/gi, '')
                .trim()
                .replace(/[?.!]+$/, '');
            if (name && name.length >= 2) return name;
        }
    }
    // waybill-like token with supplier invoice context
    if (/\bsupplier\s+invoice\b/i.test(text)) {
        const wb = text.match(/\b([A-Z]{2,}\d{5,}|\d{7,}[A-Z0-9-]*)\b/i);
        if (wb && !/^SUPINV/i.test(wb[1]) && !/^20\d{8}/.test(wb[1])) return wb[1];
    }
    return null;
}

function isSupplierInvoiceRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (extractSupplierInvoiceReference(message)) return true;
    if (/\bsupplier\s+invoices?\b/.test(text)) return true;
    if (/\bsupinv\b/.test(text)) return true;
    return false;
}

function isCountSupplierInvoiceRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    return (
        (/\bsupplier\s+invoices?\b/.test(text) || /\bsupinv\b/.test(text)) &&
        /\b(count|total|how\s*many|number\s+of)\b/.test(text)
    );
}

function extractCollectionDeliveryFocus(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (
        !/\bcollection\b/.test(text) &&
        !/\bdelivery\b/.test(text) &&
        !/\bpicked\s*up\b/.test(text) &&
        !/\bpickup\b/.test(text)
    ) {
        return null;
    }
    if (/\bdate\s*picked\s*up\b|\bpicked\s*up\b/.test(text)) return 'date_picked_up';
    if (/\bcustomer\s+ref\b/.test(text)) return 'customer_ref';
    if (/\bpickup\s+address\b/.test(text)) return 'pickup_address';
    if (/\bcontact\s+(person|number|no)\b/.test(text)) return 'contact';
    if (/\bsupplier\b/.test(text)) return 'supplier';
    if (/\bwarehouse\s+order\b/.test(text)) return 'warehouse_order';
    if (/\bcourier\s+waybill\b|\bwaybill\s+ref\b/.test(text)) return 'courier_waybill_ref';
    if (/\bpackages?\b|\bcbm\b|\bweight\b|\bgoods\b|\bbox\s+marking\b/.test(text)) return 'packages';
    if (/\bhazardous\b/.test(text)) return 'hazardous';
    if (/\bcosts?\s+to\s+collect\b|\bhandling\s+cost\b|\bwarehouse\s+cost\b/.test(text)) return 'costs';
    if (/\bstatus\b/.test(text)) return 'status';
    if (/\btype\b|\bexpress\b|\bnormal\b/.test(text)) return 'type';
    if (/\bmode\b|\broad\b|\bair\b|\bsea\b/.test(text)) return 'mode';
    return null;
}

function extractCollectionDeliverySearchTerm(message) {
    const freight = extractFreightNumber(message);
    if (freight) return freight;
    const order = extractOrderNumber(message);
    if (order) return order;

    const text = normalizeMessage(message);
    const lower = text.toLowerCase();
    if (
        /^(show|list|search|find|open)?\s*collection\s+and\s+delivery\s*(module|tab|list)?\s*[?.!]*$/i.test(
            text.trim()
        ) ||
        /^(show|list|search|find)?\s*(pending\s+)?(collections?|deliveries)\s*[?.!]*$/i.test(text.trim())
    ) {
        return null;
    }

    const patterns = [
        /(?:collection|delivery|collections?|deliveries?)\s+(?:for|of|from|by|about)\s+([A-Za-z][A-Za-z0-9 .'-]{1,60})/i,
        /(?:search|find|show|list)\s+(?:collection|delivery|collections?)\s+(?:and\s+delivery\s+)?(?:for|of)\s+([A-Za-z][A-Za-z0-9 .'-]{1,60})/i,
    ];
    for (const re of patterns) {
        const m = text.match(re);
        if (m?.[1]) {
            const name = m[1]
                .replace(
                    /\b(please|thanks|collection|delivery|pending|express|normal|air|sea|road|module|tab|list|and)\b/gi,
                    ''
                )
                .trim()
                .replace(/[?.!]+$/, '');
            if (name && name.length >= 2 && !/^F-\d/i.test(name) && !/^OR0/i.test(name)) return name;
        }
    }
    // Avoid treating "and" from "collection and delivery" as a search term
    if (/\bcollection\s+and\s+delivery\b/.test(lower)) return null;
    return null;
}

function isCollectionDeliveryRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (/\bcollection\s+from\b|\bcollection\s+address\b|\bplace\s+of\s+(collection|receipt)\b/.test(text)) {
        return false;
    }
    if (/\bdelivery\s+address\b|\bplace\s+of\s+delivery\b|\bdelivery\s+to\b/.test(text)) {
        return false;
    }
    if (/\bcollection\s+and\s+delivery\b/.test(text)) return true;
    if (/\bready\s+for\s+collection\b/.test(text)) return true;
    if (
        /\bcollections?\b/.test(text) &&
        /\b(module|list|show|search|find|pending|status|for|of|tab|details?|count|total|how\s*many|number)\b/.test(
            text
        )
    ) {
        return true;
    }
    if (/\bdeliveries\b/.test(text)) return true;
    if (/\bdelivery\b/.test(text) && /\b(module|tab|list|pending|status|for|of|details?|count|total)\b/.test(text)) {
        return true;
    }
    return false;
}

function isCountCollectionDeliveryRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (!/\b(count|total|how\s*many|number\s+of)\b/.test(text)) return false;
    if (/\bcollection\s+and\s+delivery\b/.test(text)) return true;
    if (/\bcollections?\b/.test(text)) return true;
    if (/\bdeliveries\b/.test(text)) return true;
    return isCollectionDeliveryRequest(message);
}

/** Task Manager — freight / clearance / custom tasks */
function extractTaskType(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (/\bfreight\s+tasks?\b|\btasks?\s+(?:for|of|on)\s+freight\b|\bfreight\s+task\s+manager\b/.test(text)) {
        return 'freight';
    }
    if (
        /\bclearance\s+tasks?\b|\btasks?\s+(?:for|of|on)\s+clearance\b|\bclearance\s+task\s+manager\b/.test(
            text
        )
    ) {
        return 'clearance';
    }
    if (
        /\bcustom\s+tasks?\b|\btasks?\s+(?:for|of)\s+custom\b|\bcustom\s+task\s+manager\b|\bgeneral\s+tasks?\b/.test(
            text
        )
    ) {
        return 'custom';
    }
    return null;
}

function extractTaskStatus(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (/\bin[_\s-]?progress\b/.test(text)) return 'in_progress';
    if (/\bpending\b/.test(text)) return 'pending';
    if (/\bcompleted?\b|\bdone\b|\bclosed\b/.test(text)) return 'completed';
    return null;
}

function extractTaskFocus(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (!isTaskManagerRequest(message) && !/\btasks?\b/.test(text)) return null;
    if (/\bdue\s+date\b|\bdue\b/.test(text)) return 'due_date';
    if (/\bnotes?\b/.test(text)) return 'notes';
    if (/\bstatus\b/.test(text)) return 'status';
    if (/\baction\s+required\b|\baction\b/.test(text)) return 'action_required';
    if (/\btitle\b/.test(text)) return 'title';
    if (/\bname\b|\bstaff\b|\bassigned\b/.test(text)) return 'name';
    if (/\bfreight\s+number\b/.test(text)) return 'freight_number';
    if (/\bclearance\s+number\b/.test(text)) return 'clearance_number';
    return null;
}

function extractTaskSearchTerm(message) {
    const text = normalizeMessage(message);
    const freight = extractFreightNumber(message);
    if (freight) return freight;
    const clearance = extractClearanceNumber(message);
    if (clearance) return clearance;

    const idMatch = text.match(/\btask\s*(?:id|#)?\s*(\d{1,8})\b/i);
    if (idMatch) return idMatch[1];

    const patterns = [
        /(?:task\s+manager|tasks?|freight\s+tasks?|clearance\s+tasks?|custom\s+tasks?)\s+(?:for|of|from|by|about)\s+(.+)$/i,
        /(?:search|find|show|list)\s+(?:task\s+manager|tasks?|freight\s+tasks?|clearance\s+tasks?|custom\s+tasks?)\s+(?:for|of)?\s*(.+)$/i,
    ];
    for (const re of patterns) {
        const m = text.match(re);
        if (m?.[1]) {
            const name = m[1]
                .replace(
                    /\b(please|thanks|task|tasks|manager|freight|clearance|custom|pending|completed|in\s*progress|status|all)\b/gi,
                    ''
                )
                .trim();
            if (name && name.length >= 2 && !/^F-\d/i.test(name) && !/^C-\d/i.test(name)) return name;
        }
    }
    return null;
}

function isTaskManagerRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (isCountTaskRequest(message)) return true;
    if (/\btask\s+manager\b/.test(text)) return true;
    if (/\bfreight\s+tasks?\b|\bclearance\s+tasks?\b|\bcustom\s+tasks?\b/.test(text)) return true;
    if (/\b(?:show|list|find|search|get)\s+tasks?\b/.test(text)) return true;
    if (/\b(?:pending|completed?|in[_\s-]?progress)\s+tasks?\b/.test(text)) return true;
    if (/\btasks?\s+(?:for|of|from|by|about|pending|completed|in\s*progress)\b/.test(text)) return true;
    if (/^tasks?\b/.test(text.trim())) return true;
    if (/\btask\s*(?:id|#)?\s*\d+/i.test(text)) return true;
    return false;
}

function isCountTaskRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    return (
        /\b(count|total|how\s*many|number\s+of)\b/.test(text) &&
        (/\btasks?\b/.test(text) || /\btask\s+manager\b/.test(text))
    );
}

/** Leave Calendar / staff leave requests (tbl_leaves) */
function isLeaveRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (/\bleave\s+blank\b|\bleave\s+empty\b|\bleave\s+as\s+is\b/.test(text)) return false;
    if (isCountLeaveRequest(message)) return true;
    if (/\bleave\s+calendar\b|\bleave\s+requests?\b|\bstaff\s+leaves?\b/.test(text)) return true;
    if (/\b(?:my|pending|approved|rejected)\s+leaves?\b/.test(text)) return true;
    if (/\bleaves?\s+(?:for|of|from|by|about|pending|approved|rejected|calendar|request)\b/.test(text)) {
        return true;
    }
    if (/\b(?:show|list|find|search|get)\s+(?:all\s+)?(?:staff\s+)?leaves?\b/.test(text)) return true;
    if (/\bleave\s*(?:id|#)?\s*\d+/i.test(text)) return true;
    if (/^leaves?\b/.test(text.trim())) return true;
    return false;
}

function isCountLeaveRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (/\bleave\s+blank\b/.test(text)) return false;
    return (
        /\b(count|total|how\s*many|number\s+of)\b/.test(text) &&
        (/\bleaves?\b/.test(text) || /\bleave\s+(?:request|calendar)\b/.test(text))
    );
}

function extractLeaveStatus(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (/\bpending\b/.test(text)) return 'pending';
    if (/\bapproved\b|\bapprove[d]?\b/.test(text) && isLeaveRequest(message)) return 'approved';
    if (/\brejected\b|\breject(?:ed)?\b/.test(text) && isLeaveRequest(message)) return 'rejected';
    return null;
}

function extractLeaveMonthYear(message) {
    const text = normalizeMessage(message).toLowerCase();
    const months = {
        january: 1,
        jan: 1,
        february: 2,
        feb: 2,
        march: 3,
        mar: 3,
        april: 4,
        apr: 4,
        may: 5,
        june: 6,
        jun: 6,
        july: 7,
        jul: 7,
        august: 8,
        aug: 8,
        september: 9,
        sep: 9,
        sept: 9,
        october: 10,
        oct: 10,
        november: 11,
        nov: 11,
        december: 12,
        dec: 12,
    };
    const named = text.match(
        /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\s+(\d{4})\b/i
    );
    if (named) {
        return { month: months[named[1].toLowerCase()], year: Number(named[2]) };
    }
    const numbered = text.match(/\b(?:month\s*)?(\d{1,2})[\/\-](\d{4})\b/);
    if (numbered) {
        const m = Number(numbered[1]);
        const y = Number(numbered[2]);
        if (m >= 1 && m <= 12) return { month: m, year: y };
    }
    const yearOnly = text.match(/\b(20\d{2})\b/);
    const monthOnly = text.match(
        /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\b/i
    );
    if (monthOnly && yearOnly) {
        return { month: months[monthOnly[1].toLowerCase()], year: Number(yearOnly[1]) };
    }
    if (monthOnly && isLeaveRequest(message)) {
        const now = new Date();
        return { month: months[monthOnly[1].toLowerCase()], year: now.getFullYear() };
    }
    return null;
}

function extractLeaveSearchTerm(message) {
    const text = normalizeMessage(message);
    const idMatch = text.match(/\bleave\s*(?:id|#|request)?\s*(\d{1,8})\b/i);
    if (idMatch) return idMatch[1];
    const patterns = [
        /(?:leave\s+calendar|leave\s+requests?|staff\s+leaves?|leaves?)\s+(?:for|of|from|by|about)\s+(.+)$/i,
        /(?:search|find|show|list)\s+(?:leave\s+calendar|leave\s+requests?|staff\s+leaves?|leaves?)\s+(?:for|of)?\s*(.+)$/i,
        /(?:leave\s+calendar|leave\s+requests?|leaves?)\s+(.+)$/i,
    ];
    for (const re of patterns) {
        const m = text.match(re);
        if (m && m[1]) {
            let name = m[1]
                .replace(
                    /\b(please|thanks|pending|approved|rejected|all|show|list|find|search|calendar|request|requests|leave|leaves|staff|august|january|february|march|april|may|june|july|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|\d{4})\b/gi,
                    ' '
                )
                .replace(/\s+/g, ' ')
                .trim();
            if (name && name.length >= 2) return name;
        }
    }
    return null;
}

/** Contact Us Enquiries (tbl_contact_us) — not Customer Query / Dispute */
function extractContactEnquiryNature(message) {
    const text = normalizeMessage(message).toLowerCase();
    const m = text.match(/\bnature\s+(?:of\s+)?enquir(?:y|ies)?\s*[:=]?\s*([a-z][a-z\s-]{1,40})/i);
    if (m) {
        return m[1]
            .replace(/\b(please|thanks|enquiry|enquiries|contact|us|show|list|find|search|count)\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
    if (/\bsales\b/.test(text) && isContactEnquiryRequest(message)) return 'Sales';
    if (/\bsupport\b/.test(text) && isContactEnquiryRequest(message) && !/\bcustomer\s+quer/.test(text)) {
        return 'Support';
    }
    return null;
}

function extractContactEnquiryFocus(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (!isContactEnquiryRequest(message) && !/\benquir/.test(text) && !/\bcontact\s+us\b/.test(text)) {
        return null;
    }
    if (/\bnature\s+of\s+enquir/.test(text)) return 'nature_of_enquiry';
    if (/\bphone\b|\bcellphone\b|\bmobile\b/.test(text)) return 'phone_no';
    if (/\bemail\b/.test(text)) return 'email';
    if (/\bsubject\b/.test(text)) return 'subject';
    if (/\bmessage\b|\bmsg\b/.test(text)) return 'message';
    if (/\bcountry\b/.test(text) && !/\bcountry\s+of\s+origin\b/.test(text)) return 'country';
    if (/\bname\b/.test(text)) return 'name';
    return null;
}

function extractContactEnquirySearchTerm(message) {
    const text = normalizeMessage(message);
    const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (email) return email[0];
    const idMatch = text.match(/\b(?:enquiry|enquir(?:y|ies)|contact)\s*(?:id|#)?\s*(\d{1,8})\b/i);
    if (idMatch) return idMatch[1];
    const patterns = [
        /(?:contact\s+us\s+enquir(?:y|ies)|contact\s+enquir(?:y|ies)|enquir(?:y|ies)|contact\s+us)\s+(?:for|of|from|by|about)\s+(.+)$/i,
        /(?:search|find|show|list)\s+(?:contact\s+us\s+enquir(?:y|ies)|contact\s+enquir(?:y|ies)|enquir(?:y|ies)|contact\s+us)\s+(?:for|of)?\s*(.+)$/i,
        /(?:contact\s+us|enquiry|enquiries)\s+(.+)$/i,
    ];
    for (const re of patterns) {
        const m = text.match(re);
        if (m && m[1]) {
            const name = m[1]
                .replace(
                    /\b(please|thanks|enquiry|enquiries|contact|us|nature|sales|support|all|pending)\b/gi,
                    ''
                )
                .replace(/\s+/g, ' ')
                .trim()
                .replace(/[?.!]+$/, '');
            if (name.length >= 2) return name;
        }
    }
    return null;
}

function isContactEnquiryRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (isCountContactEnquiryRequest(message)) return true;
    if (/\bcontact\s+us\s+enquir/.test(text)) return true;
    if (/\bcontact\s+enquir/.test(text)) return true;
    if (/\bcontact\s+us\b/.test(text)) return true;
    if (/\bnature\s+of\s+enquir/.test(text)) return true;
    if (/\bwebsite\s+enquir/.test(text)) return true;
    if (/\benquir(?:y|ies)\b/.test(text) && !/\bdisputes?\b/.test(text) && !/\bcustomer\s+quer/.test(text)) {
        return true;
    }
    return false;
}

function isCountContactEnquiryRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    return (
        /\b(count|total|how\s*many|number\s+of)\b/.test(text) &&
        (/\bcontact\s+us\b/.test(text) ||
            /\bcontact\s+enquir/.test(text) ||
            (/\benquir(?:y|ies)\b/.test(text) && !/\bdisputes?\b/.test(text) && !/\bcustomer\s+quer/.test(text)))
    );
}

/** Country of Origin module (country_origin) — not freight/supplier origin field */
function extractCountryOriginFocus(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (!isCountryOriginModuleRequest(message) && !/\bcountr(?:y|ies)\s+of\s+origin\b/.test(text)) {
        return null;
    }
    if (/\bcities\b|\bcity\b/.test(text)) return 'cities';
    if (/\bsea\s+ports?\b/.test(text)) return 'sea_ports';
    if (/\bair\s+ports?\b/.test(text)) return 'air_ports';
    if (/\bland\s+ports?\b/.test(text)) return 'land_ports';
    if (/\bcountry\s+name\b/.test(text)) return 'country_name';
    return null;
}

function extractCountryOriginSearchTerm(message) {
    const text = normalizeMessage(message);
    if (/\b(count|total|how\s*many|number\s+of)\b/i.test(text) && !/\b(for|of|from|about)\s+[a-z]/i.test(text)) {
        // pure count questions — no country filter
        if (/^(?:count|total|how\s*many|number\s+of)\s+(?:countr(?:y|ies)\s+of\s+origin|country\s+origin|origin\s+countr(?:y|ies))\s*$/i.test(
            text.trim()
        )) {
            return null;
        }
    }
    const idMatch = text.match(/\b(?:country\s+origin|origin)\s*(?:id|#)?\s*(\d{1,8})\b/i);
    if (idMatch) return idMatch[1];
    const patterns = [
        /(?:countr(?:y|ies)\s+of\s+origin|country\s+origin|origin\s+countr(?:y|ies))\s+(?:for|of|from|about)?\s*(.+)$/i,
        /(?:search|find|show|list)\s+(?:countr(?:y|ies)\s+of\s+origin|country\s+origin)\s+(?:for|of)?\s*(.+)$/i,
        /(?:cities|sea\s+ports?|air\s+ports?|land\s+ports?)\s+(?:of|for|in)\s+(.+)$/i,
        /^(.+?)\s+(?:countr(?:y|ies)\s+of\s+origin|country\s+origin)$/i,
    ];
    for (const re of patterns) {
        const m = text.match(re);
        if (m && m[1]) {
            const name = m[1]
                .replace(
                    /\b(please|thanks|country|countries|origin|cities|city|sea|air|land|ports?|name|all|show|list|find|search|of|for|in|count|total|how\s*many|number)\b/gi,
                    ''
                )
                .replace(/\s+/g, ' ')
                .trim()
                .replace(/[?.!]+$/, '');
            if (name.length >= 2) return name;
        }
    }
    return null;
}

function isCountryOriginModuleRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (isCountCountryOriginRequest(message)) return true;
    if (/\bsupplier\b/.test(text)) return false;
    if (extractFreightNumber(message)) return false;
    if (/\bcountr(?:y|ies)\s+of\s+origin\b/.test(text)) return true;
    if (/\bcountry\s+origin\b/.test(text)) return true;
    if (/\borigin\s+countr(?:y|ies)\b/.test(text)) return true;
    if (
        /\b(cities|sea\s+ports?|air\s+ports?|land\s+ports?)\b/.test(text) &&
        (/\borigin\b/.test(text) || /\bcountr(?:y|ies)\b/.test(text))
    ) {
        return true;
    }
    if (
        /\b(cities|sea\s+ports?|air\s+ports?|land\s+ports?)\s+(?:of|for|in)\s+[a-z]/i.test(text) &&
        !/\bfreight\b|\border\b|\bshipment\b|\bclearance\b/.test(text)
    ) {
        return true;
    }
    if (/\bsearch\s+countr(?:y|ies)\b/.test(text) && /\borigin\b/.test(text)) return true;
    return false;
}

function isCountCountryOriginRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (/\bsupplier\b/.test(text) || extractFreightNumber(message)) return false;
    return (
        /\b(count|total|how\s*many|number\s+of)\b/.test(text) &&
        (/\bcountr(?:y|ies)\s+of\s+origin\b/.test(text) ||
            /\bcountry\s+origin\b/.test(text) ||
            (/\borigin\b/.test(text) && /\bcountr(?:y|ies)\b/.test(text)))
    );
}

/** Custom Agent / Freight Forwarder / Groupage Warehouse / Transporter */
function extractPartnerType(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (/\bcustoms?\s*(?:clearing\s*)?agents?\b|\bcustom\s+agents?\b|\bclearing\s+agents?\b/.test(text)) {
        return 'customs_agent';
    }
    if (/\bfreight\s+forwarders?\b|\bforwarders?\b/.test(text)) return 'freight_forwarder';
    if (/\bgroupage\s+(?:warehouse|handler|warehouses|handlers)\b|\bgroupage\b/.test(text)) {
        return 'groupage_warehouse';
    }
    if (/\btransporters?\b/.test(text)) return 'transporter';
    return null;
}

function extractPartnerFocus(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (!extractPartnerType(message) && !isPartnerDirectoryRequest(message)) return null;
    if (/\bfull\s+name\b|\bname\b/.test(text) && !/\bcountry\b/.test(text)) return 'full_name';
    if (/\bemail\b/.test(text)) return 'email';
    if (/\bphone\b|\bcellphone\b|\bmobile\b/.test(text)) return 'phone';
    if (/\bcountry\b/.test(text)) return 'country';
    if (/\baddress\b/.test(text)) return 'address';
    return null;
}

function extractPartnerSearchTerm(message) {
    const text = normalizeMessage(message);
    const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (email) return email[0];
    const idMatch = text.match(
        /\b(?:custom\s+agent|customs?\s*(?:clearing\s*)?agent|freight\s+forwarder|forwarder|groupage(?:\s+warehouse|\s+handler)?|transporter)\s*(?:id|#)?\s*(\d{1,8})\b/i
    );
    if (idMatch) return idMatch[1];
    const patterns = [
        /(?:custom\s+agents?|customs?\s*(?:clearing\s*)?agents?|freight\s+forwarders?|forwarders?|groupage(?:\s+warehouses?|\s+handlers?)?|transporters?)\s+(?:for|of|from|by|about|named?)?\s*(.+)$/i,
        /(?:search|find|show|list|get)\s+(?:custom\s+agents?|customs?\s*(?:clearing\s*)?agents?|freight\s+forwarders?|forwarders?|groupage(?:\s+warehouses?|\s+handlers?)?|transporters?)\s+(?:for|of)?\s*(.+)$/i,
    ];
    for (const re of patterns) {
        const m = text.match(re);
        if (m && m[1]) {
            const name = m[1]
                .replace(
                    /\b(please|thanks|custom|customs|clearing|agent|agents|freight|forwarder|forwarders|groupage|warehouse|warehouses|handler|handlers|transporter|transporters|all|show|list|find|search|add)\b/gi,
                    ''
                )
                .replace(/\s+/g, ' ')
                .trim()
                .replace(/[?.!]+$/, '');
            if (name.length >= 2) return name;
        }
    }
    return null;
}

function isPartnerDirectoryRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (isCountPartnerRequest(message)) return true;
    if (extractPartnerType(message)) return true;
    if (/\badd\s+(?:custom\s+agent|freight\s+forwarder|groupage\s+warehouse|transporter)\b/.test(text)) {
        return true;
    }
    return false;
}

function isCountPartnerRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    return (
        /\b(count|total|how\s*many|number\s+of)\b/.test(text) && Boolean(extractPartnerType(message))
    );
}

/** Company Addresses (company_addresses) */
function extractCompanyAddressFocus(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (!isCompanyAddressRequest(message)) return null;
    if (/\bcompany\s+name\b/.test(text)) return 'company_name';
    if (/\bemail\b/.test(text)) return 'email';
    if (/\btelephone\b|\bphone\b|\btel\b/.test(text)) return 'telephone';
    if (/\bcountry\b/.test(text) && !/\bcompany\s+address/.test(text)) return 'country';
    if (/\bcountry\s+of\b|\bwhich\s+country\b|\bcountry\s+(?:for|of)\b/.test(text)) return 'country';
    if (/\bregistration\b|\breg\s*no\b|\btax\b|\bvat\b/.test(text)) return 'registration_tax';
    // Don't treat module phrase "company address" as an address-field focus
    if (/\b(?:full\s+)?address\b/.test(text) && !/\bcompany\s+address(?:es)?\b/.test(text)) {
        return 'address';
    }
    if (/\baddress\s+of\b|\bwhat(?:'s| is)\s+(?:the\s+)?address\b/.test(text)) return 'address';
    return null;
}

function extractCompanyAddressSearchTerm(message) {
    const text = normalizeMessage(message);
    const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (email) return email[0];
    const idMatch = text.match(/\b(?:company\s+address(?:es)?|company)\s*(?:id|#)?\s*(\d{1,8})\b/i);
    if (idMatch) return idMatch[1];
    const patterns = [
        /(?:company\s+address(?:es)?)\s+(?:for|of|from|by|about|in|named?)?\s*(.+)$/i,
        /(?:search|find|show|list|get)\s+(?:company\s+address(?:es)?)\s+(?:for|of|in)?\s*(.+)$/i,
    ];
    for (const re of patterns) {
        const m = text.match(re);
        if (m && m[1]) {
            const name = m[1]
                .replace(
                    /\b(please|thanks|company|address(?:es)?|all|show|list|find|search|get)\b/gi,
                    ''
                )
                .replace(/\s+/g, ' ')
                .trim()
                .replace(/[?.!]+$/, '');
            if (name.length >= 2) return name;
        }
    }
    return null;
}

function isCompanyAddressRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    if (isCountCompanyAddressRequest(message)) return true;
    if (/\bcompany\s+address(?:es)?\b/.test(text)) return true;
    return false;
}

function isCountCompanyAddressRequest(message) {
    const text = normalizeMessage(message).toLowerCase();
    return (
        /\b(count|total|how\s*many|number\s+of)\b/.test(text) &&
        /\bcompany\s+address(?:es)?\b/.test(text)
    );
}

module.exports = {
    normalizeMessage,
    extractFreightNumber,
    isValidFreightNumber,
    refersToPriorFreight,
    extractClientId,
    extractCustomerNumber,
    extractClientLookupName,
    extractClientFocus,
    extractSupplierName,
    extractSupplierFocus,
    isCountSuppliersRequest,
    extractStaffSearchTerm,
    extractStaffFocus,
    isStaffRequest,
    isCountStaffRequest,
    extractClientKpiSearchTerm,
    extractClientKpiFocus,
    isClientKpiRequest,
    isCountClientKpiRequest,
    isClientEstimateAmountRequest,
    extractClientEstimateAmountName,
    extractInvoiceClientName,
    extractFreightFocus,
    extractFreightListClientName,
    extractOrderNumber,
    extractOrderListClientName,
    extractOrderFocus,
    extractClearanceNumber,
    extractClearanceFocus,
    extractBatchNumber,
    extractBatchFocus,
    extractWaybill,
    extractWarehouseOrderId,
    extractClientNameForEntity,
    extractShipmentFocus,
    isInvoiceRequest,
    isMyInvoiceRequest,
    isFreightRequest,
    isFreightSupplierQuestion,
    isListFreightsRequest,
    isMyFreightsRequest,
    isListOrdersRequest,
    isMyOrdersRequest,
    isOrderRequest,
    isCountFreightsRequest,
    isCountOrdersRequest,
    isWarehouseRequest,
    isBatchRequest,
    isShipmentRequest,
    isClearanceRequest,
    isClearanceOrderRequest,
    extractClearanceOrderSearchTerm,
    isCountWarehouseRequest,
    isCountBatchRequest,
    isCountShipmentRequest,
    isCountClearanceRequest,
    isCountClearanceOrderRequest,
    isSupplierRequest,
    isDefaultHelpReply,
    isGreetingOrSmallTalk,
    greetingReply,
    isClientLookupRequest,
    isCountClientsRequest,
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
    isLeaveRequest,
    isCountLeaveRequest,
    extractLeaveStatus,
    extractLeaveMonthYear,
    extractLeaveSearchTerm,
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
};
