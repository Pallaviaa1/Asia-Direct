const con = require('../config/database');

function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        con.query(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

module.exports = { query };
