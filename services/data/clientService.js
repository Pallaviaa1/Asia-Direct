const { query } = require('../../helpers/dbQuery');
const { canAccessClient, canAccessFreight } = require('../permissions/authorizeTool');

function clean(text) {
    if (text == null || text === '') return null;
    const s = String(text).replace(/\s+/g, ' ').trim();
    return s || null;
}

function formatRegDate(value) {
    if (!value) return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        const [y, m, d] = value.slice(0, 10).split('-');
        return `${d}/${m}/${y}`;
    }
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    // Use UTC so MySQL DATE/DATETIME calendar days are not shifted by local TZ
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

function profileImageUrl(filename) {
    const name = clean(filename);
    if (!name) return null;
    if (/^https?:\/\//i.test(name)) return name;
    return `/images/${name}`;
}

function mapClientRow(row) {
    if (!row) return null;
    const active = Number(row.status) === 1;
    const customerId = clean(row.client_number) || String(row.id);
    const countryName = clean(row.country_name) || null;
    return {
        id: row.id,
        full_name: clean(row.full_name) || '',
        email: clean(row.email),
        client_number: clean(row.client_number),
        cellphone: clean(row.cellphone),
        telephone: clean(row.telephone),
        status: row.status,
        created_at: row.created_at,
        country: row.country,
        country_name: countryName,
        address_1: clean(row.address_1),
        address_2: clean(row.address_2),
        city: clean(row.city),
        province: clean(row.province),
        code: clean(row.code),
        client_ref: clean(row.client_ref),
        contact_person: clean(row.contact_person),
        company_id: clean(row.company_id),
        importers_ref: clean(row.importers_ref),
        tax_ref: clean(row.tax_ref),
        profile: clean(row.profile),
        profile_url: profileImageUrl(row.profile),
        customer_id: customerId,
        date_of_reg: formatRegDate(row.created_at),
        status_label: active ? 'Active' : 'Inactive',
        display_name: clean(row.full_name) || clean(row.email) || customerId,
        related_freights: Array.isArray(row.related_freights) ? row.related_freights : undefined,
    };
}

function mapRelatedFreight(row, index) {
    return {
        sr_no: index + 1,
        freight_id: row.freight_id || row.id,
        freight_number: clean(row.freight_number),
        client_name: clean(row.client_name),
        client_reference: clean(row.client_ref) || clean(row.client_ref_name) || null,
        country: clean(row.country_name) || clean(row.collection_from_name) || clean(row.delivery_to_name),
        dimension: row.dimension != null && row.dimension !== '' ? row.dimension : null,
        freight: clean(row.freight),
        incoterm: clean(row.incoterm),
        province: clean(row.client_province) || clean(row.province),
        status_label: clean(row.status_label),
    };
}

function rankClientMatch(row, term) {
    const name = String(row.full_name || '').toLowerCase();
    const number = String(row.client_number || '').toLowerCase().replace(/\s+/g, '');
    const email = String(row.email || '').toLowerCase();
    const t = term.toLowerCase().replace(/\s+/g, '');
    const tRaw = term.toLowerCase();

    if (String(row.id) === term || number === t || number === `s${t}`) return 0;
    if (name === tRaw || email === tRaw) return 0;
    if (name.startsWith(tRaw) || number.startsWith(t) || email.startsWith(tRaw)) return 1;
    if (name.split(/\s+/)[0] === tRaw) return 1;
    if (name.includes(tRaw) || number.includes(t) || email.includes(tRaw)) return 2;
    return 3;
}

const CLIENT_SELECT = `
    u.id, u.full_name, u.email, u.client_number, u.cellphone, u.telephone,
    u.status, u.created_at, u.country, u.address_1, u.address_2, u.city, u.province,
    u.client_ref, u.contact_person, u.code, u.company_id, u.importers_ref, u.tax_ref, u.profile,
    c.name AS country_name
`;

const CLIENT_FROM = `
    FROM tbl_users u
    LEFT JOIN countries c ON c.id = u.country
`;

async function listRelatedFreightsForClient(clientId, ctx, { limit = 25 } = {}) {
    if (!clientId || !canAccessClient(ctx, clientId)) return [];

    const rows = await query(
        `SELECT f.id AS freight_id, f.freight_number, f.dimension, f.freight, f.incoterm,
                f.client_ref_name, f.client_id, f.collection_from, f.delivery_to,
                f.user_id, f.sales_representative, f.status, f.order_status, f.isConfirmed,
                u.full_name AS client_name,
                u.client_ref,
                u.province AS client_province,
                co.name AS collection_from_name,
                cd.name AS delivery_to_name,
                COALESCE(co.name, cd.name) AS country_name
         FROM tbl_freight f
         LEFT JOIN tbl_users u ON u.id = f.client_id
         LEFT JOIN countries co ON co.id = f.collection_from
         LEFT JOIN countries cd ON cd.id = f.delivery_to
         WHERE f.client_id = ? AND f.is_deleted = 0 AND f.added_by IN (1, 2)
         ORDER BY f.id DESC
         LIMIT ?`,
        [clientId, Math.min(Number(limit) || 25, 50)]
    );

    return rows
        .filter((row) =>
            canAccessFreight(ctx, {
                client_id: row.client_id,
                collection_from: row.collection_from,
                delivery_to: row.delivery_to,
                user_id: row.user_id,
                sales_representative: row.sales_representative,
            })
        )
        .map((row, index) => mapRelatedFreight(row, index));
}

async function attachRelatedFreights(client, ctx, { limit = 25 } = {}) {
    if (!client) return null;
    const related = await listRelatedFreightsForClient(client.id, ctx, { limit });
    return { ...client, related_freights: related };
}

async function findClientsByName(name, ctx) {
    if (!name || String(name).trim().length < 2) return [];

    const term = String(name).trim();
    const search = `%${term}%`;
    const starts = `${term}%`;
    const termCompact = term.replace(/\s+/g, '');

    if (ctx.isCustomer) {
        const selfRows = await query(
            `SELECT ${CLIENT_SELECT}
             ${CLIENT_FROM}
             WHERE u.id = ? AND u.user_type = 3 AND u.is_deleted = 0`,
            [ctx.userId]
        );
        if (!selfRows.length) return [];

        const self = mapClientRow(selfRows[0]);
        const nameLower = term.toLowerCase();
        const selfNameLower = (self.full_name || '').toLowerCase();
        const selfNumberLower = (self.client_number || '').toLowerCase().replace(/\s+/g, '');
        const selfEmail = (self.email || '').toLowerCase();

        const matchesSelf =
            selfNameLower === nameLower ||
            selfNameLower.includes(nameLower) ||
            selfNumberLower === nameLower.replace(/\s+/g, '') ||
            selfNumberLower.includes(nameLower.replace(/\s+/g, '')) ||
            selfEmail === nameLower ||
            selfEmail.includes(nameLower) ||
            String(self.id) === term;

        if (matchesSelf && canAccessClient(ctx, self.id)) {
            return [self];
        }
        return [];
    }

    let rows = await query(
        `SELECT ${CLIENT_SELECT}
         ${CLIENT_FROM}
         WHERE u.user_type = 3 AND u.is_deleted = 0
           AND (
             u.full_name LIKE ?
             OR REPLACE(IFNULL(u.client_number,''), ' ', '') LIKE ?
             OR REPLACE(IFNULL(u.client_number,''), ' ', '') LIKE ?
             OR u.email LIKE ?
             OR CAST(u.id AS CHAR) = ?
           )
         ORDER BY
           CASE
             WHEN CAST(u.id AS CHAR) = ? THEN 0
             WHEN LOWER(REPLACE(IFNULL(u.client_number,''), ' ', '')) = LOWER(?) THEN 0
             WHEN LOWER(u.full_name) = LOWER(?) THEN 0
             WHEN LOWER(u.full_name) LIKE LOWER(?) THEN 1
             WHEN LOWER(REPLACE(IFNULL(u.client_number,''), ' ', '')) LIKE LOWER(?) THEN 2
             ELSE 3
           END,
           u.full_name ASC
         LIMIT 15`,
        [
            search,
            `%${termCompact}%`,
            `%${termCompact.replace(/^s/i, '')}%`,
            search,
            term,
            term,
            termCompact,
            term,
            starts,
            `${termCompact}%`,
        ]
    );

    if (!rows.length && term.includes('@')) {
        rows = await query(
            `SELECT ${CLIENT_SELECT}
             ${CLIENT_FROM}
             WHERE u.user_type = 3 AND u.is_deleted = 0 AND u.email LIKE ?
             ORDER BY u.full_name ASC
             LIMIT 10`,
            [search]
        );
    }

    const filtered = rows.map(mapClientRow).filter((row) => canAccessClient(ctx, row.id));
    filtered.sort((a, b) => rankClientMatch(a, term) - rankClientMatch(b, term));
    return filtered;
}

function pickBestClientMatch(clients, searchName) {
    if (!clients?.length) return null;
    if (clients.length === 1) return clients[0];

    const term = String(searchName || '').trim().toLowerCase();
    if (!term) return null;

    const strong = clients.filter((c) => rankClientMatch(c, term) <= 1);
    if (strong.length === 1) return strong[0];

    return null;
}

async function getClientById(clientId, ctx, { includeFreights = false } = {}) {
    if (!canAccessClient(ctx, clientId)) return null;

    const rows = await query(
        `SELECT ${CLIENT_SELECT}
         ${CLIENT_FROM}
         WHERE u.id = ? AND u.user_type = 3 AND u.is_deleted = 0`,
        [clientId]
    );
    const client = mapClientRow(rows[0]);
    if (!client) return null;
    if (includeFreights) return attachRelatedFreights(client, ctx);
    return client;
}

/** Lookup by numeric user id or client_number (e.g. 20135, S20832) */
async function getClientByCustomerId(customerId, ctx, { includeFreights = false } = {}) {
    const raw = String(customerId || '').trim();
    if (!raw) return null;

    const compact = raw.replace(/\s+/g, '');
    const digits = compact.replace(/^s/i, '').replace(/\D/g, '');

    // Prefer exact client_number match (with/without S / spaces)
    const rows = await query(
        `SELECT ${CLIENT_SELECT}
         ${CLIENT_FROM}
         WHERE u.user_type = 3 AND u.is_deleted = 0
           AND (
             CAST(u.id AS CHAR) = ?
             OR REPLACE(IFNULL(u.client_number,''), ' ', '') = ?
             OR REPLACE(IFNULL(u.client_number,''), ' ', '') = ?
             OR REPLACE(IFNULL(u.client_number,''), ' ', '') = ?
           )
         LIMIT 5`,
        [compact, compact, compact.toUpperCase(), digits ? `S${digits}` : compact]
    );

    const mapped = rows.map(mapClientRow).filter((r) => canAccessClient(ctx, r.id));
    let client = null;
    if (mapped.length === 1) client = mapped[0];
    else if (mapped.length > 1 && digits) {
        client = mapped.find((r) => String(r.id) === digits) || mapped[0];
    } else {
        client = mapped[0] || null;
    }
    if (!client) return null;
    if (includeFreights) return attachRelatedFreights(client, ctx);
    return client;
}

async function countClients(ctx) {
    if (ctx.isCustomer) return 1;
    const rows = await query(
        `SELECT COUNT(*) AS total FROM tbl_users
         WHERE user_type = 3 AND is_deleted = 0 AND status = 1`
    );
    return Number(rows[0]?.total || 0);
}

module.exports = {
    findClientsByName,
    getClientById,
    getClientByCustomerId,
    pickBestClientMatch,
    countClients,
    mapClientRow,
    listRelatedFreightsForClient,
    attachRelatedFreights,
};
