const { query } = require('../../helpers/dbQuery');

function clean(text) {
    if (text == null || text === '') return null;
    const s = String(text).replace(/\s+/g, ' ').trim();
    return s || null;
}

function canAccessCompanyAddresses(ctx) {
    return Boolean(ctx.isAdmin || ctx.hasFullAccess || ctx.isStaff);
}

function buildFullAddress(row) {
    const parts = [
        clean(row.address_line),
        clean(row.city),
        clean(row.state_region),
        clean(row.country),
        clean(row.postal_code),
    ].filter(Boolean);
    return parts.length ? parts.join(', ') : null;
}

function mapCompanyAddressRow(row, index = 0) {
    if (!row) return null;
    const reg = clean(row.company_registration_no);
    const tax = clean(row.tax_vat_no);
    const regTaxParts = [];
    if (reg) regTaxParts.push(`Reg: ${reg}`);
    if (tax) regTaxParts.push(`Tax: ${tax}`);
    return {
        sr_no: index + 1,
        id: row.id,
        company_name: clean(row.company_name) || '—',
        email: clean(row.email),
        country: clean(row.country) || '—',
        telephone: clean(row.telephone),
        company_registration_no: reg,
        tax_vat_no: tax,
        registration_tax_label: regTaxParts.length ? regTaxParts.join('\n') : '—',
        address_line: clean(row.address_line),
        city: clean(row.city),
        state_region: clean(row.state_region),
        postal_code: clean(row.postal_code),
        address: buildFullAddress(row) || '—',
        bank_id: row.bank_id,
        display_title: clean(row.company_name) || `Company address #${row.id}`,
    };
}

async function searchCompanyAddresses(search, ctx, { limit = 25 } = {}) {
    if (!canAccessCompanyAddresses(ctx)) return [];
    const conditions = ['(ca.is_deleted = 0 OR ca.is_deleted IS NULL)'];
    const params = [];
    const term = clean(search);

    if (term) {
        if (/^\d+$/.test(term)) {
            conditions.push('ca.id = ?');
            params.push(Number(term));
        } else {
            conditions.push(
                `(ca.company_name LIKE ? OR ca.email LIKE ? OR ca.country LIKE ?
                  OR ca.telephone LIKE ? OR ca.address_line LIKE ? OR ca.city LIKE ?
                  OR ca.company_registration_no LIKE ? OR ca.tax_vat_no LIKE ?)`
            );
            const like = `%${term}%`;
            params.push(like, like, like, like, like, like, like, like);
        }
    }

    const rows = await query(
        `SELECT ca.*
         FROM company_addresses ca
         WHERE ${conditions.join(' AND ')}
         ORDER BY ca.id ASC
         LIMIT ?`,
        [...params, Math.min(Number(limit) || 25, 50)]
    );
    return rows.map((r, i) => mapCompanyAddressRow(r, i));
}

async function getCompanyAddressById(id, ctx) {
    if (!id || !canAccessCompanyAddresses(ctx)) return null;
    const rows = await query(
        `SELECT * FROM company_addresses
         WHERE id = ? AND (is_deleted = 0 OR is_deleted IS NULL)
         LIMIT 1`,
        [Number(id)]
    );
    return mapCompanyAddressRow(rows[0], 0);
}

async function countCompanyAddresses(ctx, { search } = {}) {
    if (!canAccessCompanyAddresses(ctx)) {
        return { allowed: false, total: 0, message: 'Company Addresses are not available for your account.' };
    }
    const conditions = ['(ca.is_deleted = 0 OR ca.is_deleted IS NULL)'];
    const params = [];
    const term = clean(search);
    if (term) {
        conditions.push(
            `(ca.company_name LIKE ? OR ca.email LIKE ? OR ca.country LIKE ?
              OR ca.telephone LIKE ? OR ca.address_line LIKE ? OR ca.city LIKE ?
              OR ca.company_registration_no LIKE ? OR ca.tax_vat_no LIKE ?)`
        );
        const like = `%${term}%`;
        params.push(like, like, like, like, like, like, like, like);
    }
    const rows = await query(
        `SELECT COUNT(*) AS total FROM company_addresses ca WHERE ${conditions.join(' AND ')}`,
        params
    );
    return { allowed: true, total: Number(rows[0]?.total || 0) };
}

module.exports = {
    searchCompanyAddresses,
    getCompanyAddressById,
    countCompanyAddresses,
    canAccessCompanyAddresses,
    mapCompanyAddressRow,
};
