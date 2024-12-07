const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
const mysql = require('mysql');
const con = mysql.createConnection(
    {
        host: DB_HOST,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,

       /*  host: '139.177.187.60', // Remote server IP
        user: 'forge',
        password: '3RpmB1HjDiLIVNF7AaI6',
        database: 'suppr',
        port: 3306,
        connectTimeout: 20000, */
    } 
)

con.connect((err) => {
    if (err) throw err;
    else {
        console.log("database connected successfully");
    }
})

module.exports = con; 