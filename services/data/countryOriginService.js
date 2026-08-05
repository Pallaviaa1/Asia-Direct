const { query } = require('../../helpers/dbQuery');

function clean(text) {
    if (text == null || text === '') return null;
    const s = String(text).replace(/\s+/g, ' ').trim();
    return s || null;
}

function canAccessCountryOrigin(ctx) {
    return Boolean(ctx.isAdmin || ctx.hasFullAccess || ctx.isStaff);
}

function splitIds(raw) {
    if (raw == null || raw === '') return [];
    return String(raw)
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
}

async function buildCityNameMap(ids) {
    const nums = [...new Set(ids.map((id) => Number(id)).filter((n) => Number.isFinite(n) && n > 0))];
    const nameMap = {};
    if (!nums.length) return nameMap;
    const placeholders = nums.map(() => '?').join(',');
    const rows = await query(`SELECT id, name FROM cities WHERE id IN (${placeholders})`, nums);
    rows.forEach((r) => {
        nameMap[String(r.id)] = clean(r.name);
    });
    return nameMap;
}

async function mapOriginRow(row, index = 0) {
    if (!row) return null;
    const cityIds = splitIds(row.city_id);
    const seaIds = splitIds(row.sea_port);
    const airIds = splitIds(row.air_port);
    const landIds = splitIds(row.land_port);
    const nameMap = await buildCityNameMap([...cityIds, ...seaIds, ...airIds, ...landIds]);

    const labelList = (ids) =>
        ids.map((id) => nameMap[String(id)] || null).filter(Boolean);

    const cities = labelList(cityIds);
    const sea_ports = labelList(seaIds);
    const air_ports = labelList(airIds);
    const land_ports = labelList(landIds);

    return {
        sr_no: index + 1,
        id: row.id,
        country_id: row.country_id,
        country_name: clean(row.country_name) || 'Unknown',
        cities,
        cities_label: cities.length ? cities.join(', ') : '—',
        sea_ports,
        sea_ports_label: sea_ports.length ? sea_ports.join(', ') : '—',
        air_ports,
        air_ports_label: air_ports.length ? air_ports.join(', ') : '—',
        land_ports,
        land_ports_label: land_ports.length ? land_ports.join(', ') : '—',
        display_title: clean(row.country_name) || `Country origin #${row.id}`,
    };
}

async function searchCountryOrigins(search, ctx, { limit = 25 } = {}) {
    if (!canAccessCountryOrigin(ctx)) return [];
    const conditions = ['co.is_deleted = 0'];
    const params = [];
    const term = clean(search);

    if (term) {
        if (/^\d+$/.test(term)) {
            conditions.push('(co.id = ? OR co.country_id = ?)');
            params.push(Number(term), Number(term));
        } else {
            conditions.push(
                `(c.name LIKE ?
                  OR EXISTS (
                    SELECT 1 FROM cities ci
                    WHERE FIND_IN_SET(ci.id, co.city_id)
                      AND ci.name LIKE ?
                  ))`
            );
            const like = `%${term}%`;
            params.push(like, like);
        }
    }

    const rows = await query(
        `SELECT co.id, co.country_id, co.city_id, co.sea_port, co.land_port, co.air_port,
                c.name AS country_name
         FROM country_origin co
         LEFT JOIN countries c ON c.id = co.country_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY co.id DESC
         LIMIT ?`,
        [...params, Math.min(Number(limit) || 25, 50)]
    );

    const mapped = [];
    for (let i = 0; i < rows.length; i++) {
        mapped.push(await mapOriginRow(rows[i], i));
    }
    return mapped;
}

async function getCountryOriginById(id, ctx) {
    if (!id || !canAccessCountryOrigin(ctx)) return null;
    const rows = await query(
        `SELECT co.id, co.country_id, co.city_id, co.sea_port, co.land_port, co.air_port,
                c.name AS country_name
         FROM country_origin co
         LEFT JOIN countries c ON c.id = co.country_id
         WHERE co.id = ? AND co.is_deleted = 0
         LIMIT 1`,
        [Number(id)]
    );
    if (!rows.length) return null;
    return mapOriginRow(rows[0], 0);
}

async function getCountryOriginByCountryName(name, ctx) {
    const term = clean(name);
    if (!term || !canAccessCountryOrigin(ctx)) return null;
    const rows = await query(
        `SELECT co.id, co.country_id, co.city_id, co.sea_port, co.land_port, co.air_port,
                c.name AS country_name
         FROM country_origin co
         LEFT JOIN countries c ON c.id = co.country_id
         WHERE co.is_deleted = 0 AND LOWER(TRIM(c.name)) = LOWER(TRIM(?))
         LIMIT 1`,
        [term]
    );
    if (!rows.length) {
        const likeRows = await searchCountryOrigins(term, ctx, { limit: 1 });
        return likeRows[0] || null;
    }
    return mapOriginRow(rows[0], 0);
}

async function countCountryOrigins(ctx, { search } = {}) {
    if (!canAccessCountryOrigin(ctx)) {
        return { allowed: false, total: 0, message: 'Country of Origin is not available for your account.' };
    }
    const conditions = ['co.is_deleted = 0'];
    const params = [];
    const term = clean(search);
    if (term) {
        conditions.push(
            `(c.name LIKE ?
              OR EXISTS (
                SELECT 1 FROM cities ci
                WHERE FIND_IN_SET(ci.id, co.city_id)
                  AND ci.name LIKE ?
              ))`
        );
        const like = `%${term}%`;
        params.push(like, like);
    }
    const rows = await query(
        `SELECT COUNT(*) AS total
         FROM country_origin co
         LEFT JOIN countries c ON c.id = co.country_id
         WHERE ${conditions.join(' AND ')}`,
        params
    );
    return { allowed: true, total: Number(rows[0]?.total || 0) };
}

module.exports = {
    searchCountryOrigins,
    getCountryOriginById,
    getCountryOriginByCountryName,
    countCountryOrigins,
    canAccessCountryOrigin,
    mapOriginRow,
};
