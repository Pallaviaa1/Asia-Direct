const { query } = require('../../helpers/dbQuery');

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

function canAccessEnquiries(ctx) {
    return Boolean(ctx.isAdmin || ctx.hasFullAccess || ctx.isStaff);
}

function mapEnquiryRow(row, index = 0) {
    if (!row) return null;
    return {
        sr_no: index + 1,
        id: row.id,
        name: clean(row.name) || '—',
        country: clean(row.country) || '—',
        email: clean(row.email),
        phone_no: clean(row.phone_no),
        subject: clean(row.subject),
        nature_of_enquiry: clean(row.nature_of_enq) || clean(row.nature_of_enquiry),
        message: clean(row.message),
        created_at: row.created_at,
        created_label: formatDate(row.created_at),
        display_title: clean(row.subject) || clean(row.name) || `Enquiry #${row.id}`,
    };
}

async function searchContactEnquiries(search, ctx, { limit = 25, nature } = {}) {
    if (!canAccessEnquiries(ctx)) return [];
    const conditions = ['1=1'];
    const params = [];
    const term = clean(search);
    const natureTerm = clean(nature);

    if (natureTerm) {
        conditions.push('LOWER(TRIM(cu.nature_of_enq)) = LOWER(TRIM(?))');
        params.push(natureTerm);
    }
    if (term) {
        if (/^\d+$/.test(term)) {
            conditions.push('cu.id = ?');
            params.push(Number(term));
        } else {
            conditions.push(
                `(cu.name LIKE ? OR cu.email LIKE ? OR cu.phone_no LIKE ? OR cu.subject LIKE ?
                  OR cu.nature_of_enq LIKE ? OR cu.country LIKE ? OR cu.message LIKE ?)`
            );
            const like = `%${term}%`;
            params.push(like, like, like, like, like, like, like);
        }
    }

    const rows = await query(
        `SELECT cu.*
         FROM tbl_contact_us cu
         WHERE ${conditions.join(' AND ')}
         ORDER BY cu.id DESC
         LIMIT ?`,
        [...params, Math.min(Number(limit) || 25, 50)]
    );
    return rows.map((r, i) => mapEnquiryRow(r, i));
}

async function getContactEnquiryById(id, ctx) {
    if (!id || !canAccessEnquiries(ctx)) return null;
    const rows = await query(`SELECT * FROM tbl_contact_us WHERE id = ? LIMIT 1`, [Number(id)]);
    return mapEnquiryRow(rows[0], 0);
}

async function countContactEnquiries(ctx, { search, nature } = {}) {
    if (!canAccessEnquiries(ctx)) {
        return { allowed: false, total: 0, message: 'Contact Us Enquiries are not available for your account.' };
    }
    const conditions = ['1=1'];
    const params = [];
    const term = clean(search);
    const natureTerm = clean(nature);
    if (natureTerm) {
        conditions.push('LOWER(TRIM(cu.nature_of_enq)) = LOWER(TRIM(?))');
        params.push(natureTerm);
    }
    if (term) {
        conditions.push(
            `(cu.name LIKE ? OR cu.email LIKE ? OR cu.phone_no LIKE ? OR cu.subject LIKE ?
              OR cu.nature_of_enq LIKE ? OR cu.country LIKE ? OR cu.message LIKE ?)`
        );
        const like = `%${term}%`;
        params.push(like, like, like, like, like, like, like);
    }
    const rows = await query(
        `SELECT COUNT(*) AS total FROM tbl_contact_us cu WHERE ${conditions.join(' AND ')}`,
        params
    );
    return { allowed: true, total: Number(rows[0]?.total || 0) };
}

module.exports = {
    searchContactEnquiries,
    getContactEnquiryById,
    countContactEnquiries,
    canAccessEnquiries,
    mapEnquiryRow,
};
