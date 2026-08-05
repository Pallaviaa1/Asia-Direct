const { query } = require('../../helpers/dbQuery');

const PARTNER_TYPES = {
    customs_agent: {
        key: 'customs_agent',
        label: 'Custom Agent',
        table: 'tbl_customs_clearing_agents',
        alias: 'p',
        phrases: ['custom agent', 'customs agent', 'customs clearing agent', 'clearing agent'],
    },
    freight_forwarder: {
        key: 'freight_forwarder',
        label: 'Freight Forwarder',
        table: 'tbl_freight_forwarders',
        alias: 'p',
        phrases: ['freight forwarder', 'forwarder'],
    },
    groupage_warehouse: {
        key: 'groupage_warehouse',
        label: 'Groupage Warehouse',
        table: 'tbl_groupage_handlers',
        alias: 'p',
        phrases: ['groupage warehouse', 'groupage handler', 'groupage'],
    },
    transporter: {
        key: 'transporter',
        label: 'Transporter',
        table: 'tbl_transporters',
        alias: 'p',
        phrases: ['transporter', 'transporters'],
    },
};

function clean(text) {
    if (text == null || text === '') return null;
    const s = String(text).replace(/\s+/g, ' ').trim();
    return s || null;
}

function formatDate(value) {
    if (!value) return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        const [y, m, day] = value.slice(0, 10).split('-');
        return `${day}/${m}/${y}`;
    }
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
}

function canAccessPartners(ctx) {
    return Boolean(ctx.isAdmin || ctx.hasFullAccess || ctx.isStaff);
}

function normalizePartnerType(raw) {
    const text = String(raw || '')
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .trim();
    if (!text) return null;
    if (/customs?\s*(clearing\s*)?agent|custom\s+agent|clearing\s+agent/.test(text)) {
        return PARTNER_TYPES.customs_agent;
    }
    if (/freight\s*forwarder|forwarder/.test(text)) return PARTNER_TYPES.freight_forwarder;
    if (/groupage/.test(text)) return PARTNER_TYPES.groupage_warehouse;
    if (/transporter/.test(text)) return PARTNER_TYPES.transporter;
    if (PARTNER_TYPES[raw]) return PARTNER_TYPES[raw];
    const key = String(raw || '').replace(/\s+/g, '_');
    return PARTNER_TYPES[key] || null;
}

function mapPartnerRow(row, typeMeta, index = 0) {
    if (!row || !typeMeta) return null;
    return {
        sr_no: index + 1,
        id: row.id,
        partner_type: typeMeta.key,
        partner_type_label: typeMeta.label,
        email: clean(row.email),
        full_name: clean(row.name),
        phone: clean(row.phone),
        country_id: row.country_id,
        country_name: clean(row.country_name) || '—',
        address: clean(row.address),
        contact_person: clean(row.contact_person) || clean(row.contact),
        created_at: row.created_at,
        created_label: formatDate(row.created_at),
        display_title: clean(row.name) || clean(row.email) || `${typeMeta.label} #${row.id}`,
    };
}

async function searchPartners(search, ctx, { partnerType, limit = 25 } = {}) {
    if (!canAccessPartners(ctx)) return [];
    const typeMeta = normalizePartnerType(partnerType);
    if (!typeMeta) return [];

    const conditions = ['p.is_deleted = 0'];
    const params = [];
    const term = clean(search);

    if (term) {
        if (/^\d+$/.test(term)) {
            conditions.push('p.id = ?');
            params.push(Number(term));
        } else {
            conditions.push(
                `(p.name LIKE ? OR p.email LIKE ? OR p.phone LIKE ? OR p.address LIKE ?
                  OR p.contact_person LIKE ? OR c.name LIKE ?)`
            );
            const like = `%${term}%`;
            params.push(like, like, like, like, like, like);
        }
    }

    const rows = await query(
        `SELECT p.id, p.name, p.email, p.phone, p.address, p.contact_person, p.country_id, p.created_at,
                c.name AS country_name
         FROM ${typeMeta.table} p
         LEFT JOIN countries c ON c.id = p.country_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY p.id DESC
         LIMIT ?`,
        [...params, Math.min(Number(limit) || 25, 50)]
    );
    return rows.map((r, i) => mapPartnerRow(r, typeMeta, i));
}

async function getPartnerById(id, ctx, partnerType) {
    if (!id || !canAccessPartners(ctx)) return null;
    const typeMeta = normalizePartnerType(partnerType);
    if (!typeMeta) return null;
    const rows = await query(
        `SELECT p.id, p.name, p.email, p.phone, p.address, p.contact_person, p.country_id, p.created_at,
                c.name AS country_name
         FROM ${typeMeta.table} p
         LEFT JOIN countries c ON c.id = p.country_id
         WHERE p.id = ? AND p.is_deleted = 0
         LIMIT 1`,
        [Number(id)]
    );
    return mapPartnerRow(rows[0], typeMeta, 0);
}

async function countPartners(ctx, { search, partnerType } = {}) {
    if (!canAccessPartners(ctx)) {
        return { allowed: false, total: 0, message: 'Partner directory is not available for your account.' };
    }
    const typeMeta = normalizePartnerType(partnerType);
    if (!typeMeta) {
        return { allowed: false, total: 0, message: 'Specify Custom Agent, Freight Forwarder, Groupage Warehouse, or Transporter.' };
    }
    const conditions = ['p.is_deleted = 0'];
    const params = [];
    const term = clean(search);
    if (term) {
        conditions.push(
            `(p.name LIKE ? OR p.email LIKE ? OR p.phone LIKE ? OR p.address LIKE ?
              OR p.contact_person LIKE ? OR c.name LIKE ?)`
        );
        const like = `%${term}%`;
        params.push(like, like, like, like, like, like);
    }
    const rows = await query(
        `SELECT COUNT(*) AS total
         FROM ${typeMeta.table} p
         LEFT JOIN countries c ON c.id = p.country_id
         WHERE ${conditions.join(' AND ')}`,
        params
    );
    return { allowed: true, total: Number(rows[0]?.total || 0), partnerType: typeMeta.key, label: typeMeta.label };
}

module.exports = {
    PARTNER_TYPES,
    normalizePartnerType,
    searchPartners,
    getPartnerById,
    countPartners,
    canAccessPartners,
    mapPartnerRow,
};
