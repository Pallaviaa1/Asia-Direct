const { query } = require('../../helpers/dbQuery');

function clean(text) {
    if (text == null || text === '') return null;
    const s = String(text).replace(/\s+/g, ' ').trim();
    return s || null;
}

function profileImageUrl(filename) {
    const name = clean(filename);
    if (!name) return null;
    if (/^https?:\/\//i.test(name)) return name;
    return `/images/${name}`;
}

/** Match Edit Supplier display e.g. "+27 ZA" */
function formatCountryCodeLabel(code, shortname) {
    const digits = String(code || '').replace(/\D/g, '');
    if (!digits) return null;
    const plus = `+${digits}`;
    const iso = clean(shortname);
    return iso ? `${plus} ${iso}` : plus;
}

/** Match form casing e.g. Roadfreight */
function formatServiceType(value) {
    const s = clean(value);
    if (!s) return null;
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function mapSupplierRow(row) {
    if (!row) return null;
    const companyName = clean(row.company_name) || clean(row.name);
    const fullName = clean(row.name);
    const serviceType = formatServiceType(row.service_type);
    const countryCodeRaw = clean(row.country_code) || (row.phonecode != null ? String(row.phonecode) : null);
    const countryCodeLabel = formatCountryCodeLabel(
        countryCodeRaw,
        row.country_based_short || row.country_of_origin_short
    );
    const hasProfile = Boolean(clean(row.profile));
    return {
        id: row.id,
        // Edit Supplier — Company Details
        company_name: companyName,
        service_type: serviceType,
        address: clean(row.address),
        country_based_id: row.country_based,
        country_based: clean(row.country_based_name),
        country_of_origin_id: row.country,
        country_of_origin: clean(row.country_of_origin_name) || clean(row.country_name),
        // Account Details
        email: clean(row.email),
        full_name: fullName,
        country_code: countryCodeRaw,
        country_code_label: countryCodeLabel,
        phone_no: clean(row.phone_no),
        profile: clean(row.profile),
        profile_url: profileImageUrl(row.profile),
        profile_label: hasProfile ? clean(row.profile) : 'No file chosen',
        // Never expose password — form field is write-only
        password_label: 'Not shown (leave blank to keep current)',
        // Compatibility aliases used by older cards / freight aggregator
        name: fullName || companyName,
        country: row.country,
        country_name: clean(row.country_of_origin_name) || clean(row.country_name) || clean(row.country_based_name),
        display_name: companyName || fullName || clean(row.email) || `Supplier ${row.id}`,
    };
}

const SUPPLIER_SELECT = `
    s.id,
    s.name,
    s.email,
    s.phone_no,
    s.country,
    s.country_code,
    s.company_name,
    s.address,
    s.country_based,
    s.service_type,
    s.profile,
    co.name AS country_of_origin_name,
    co.shortname AS country_of_origin_short,
    cb.name AS country_based_name,
    cb.shortname AS country_based_short,
    cb.phonecode AS phonecode,
    co.name AS country_name
`;

const SUPPLIER_FROM = `
    FROM tbl_suppliers s
    LEFT JOIN countries co ON co.id = s.country
    LEFT JOIN countries cb ON cb.id = s.country_based
`;

async function findSuppliersByName(name, ctx) {
    if (!name || String(name).trim().length < 2) return [];

    const term = String(name).trim();
    const search = `%${term}%`;
    const starts = `${term}%`;

    const rows = await query(
        `SELECT ${SUPPLIER_SELECT},
                CASE
                  WHEN LOWER(TRIM(IFNULL(s.company_name,''))) = LOWER(?) THEN 0
                  WHEN LOWER(TRIM(IFNULL(s.name,''))) = LOWER(?) THEN 0
                  WHEN LOWER(TRIM(IFNULL(s.email,''))) = LOWER(?) THEN 0
                  WHEN LOWER(IFNULL(s.company_name,'')) LIKE LOWER(?) THEN 1
                  WHEN LOWER(IFNULL(s.name,'')) LIKE LOWER(?) THEN 1
                  WHEN LOWER(IFNULL(s.email,'')) LIKE LOWER(?) THEN 2
                  ELSE 3
                END AS match_priority
         ${SUPPLIER_FROM}
         WHERE s.is_deleted = 0
           AND (
             s.company_name LIKE ?
             OR s.name LIKE ?
             OR s.email LIKE ?
             OR s.phone_no LIKE ?
             OR CAST(s.id AS CHAR) = ?
           )
         ORDER BY match_priority ASC, COALESCE(s.company_name, s.name) ASC
         LIMIT 15`,
        [term, term, term, starts, starts, search, search, search, search, search, term]
    );

    return rows.map(mapSupplierRow);
}

async function getSupplierById(supplierId) {
    if (!supplierId) return null;
    const rows = await query(
        `SELECT ${SUPPLIER_SELECT}
         ${SUPPLIER_FROM}
         WHERE s.id = ? AND s.is_deleted = 0
         LIMIT 1`,
        [supplierId]
    );
    return mapSupplierRow(rows[0]);
}

async function getSupplierByEmail(email) {
    const term = clean(email);
    if (!term || !term.includes('@')) return null;
    const rows = await query(
        `SELECT ${SUPPLIER_SELECT}
         ${SUPPLIER_FROM}
         WHERE s.is_deleted = 0 AND LOWER(TRIM(s.email)) = LOWER(TRIM(?))
         LIMIT 1`,
        [term]
    );
    return mapSupplierRow(rows[0]);
}

async function countSuppliers(ctx) {
    // Directory is shared; customers may still look up suppliers in chat
    const rows = await query(
        `SELECT COUNT(*) AS total FROM tbl_suppliers WHERE is_deleted = 0`
    );
    return Number(rows[0]?.total || 0);
}

module.exports = {
    findSuppliersByName,
    getSupplierById,
    getSupplierByEmail,
    countSuppliers,
    mapSupplierRow,
};
