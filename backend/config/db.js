const { Pool } = require('pg');
require('dotenv').config();

let pool;

if (process.env.DATABASE_URL) {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });
} else {
    pool = new Pool({
        user: process.env.DB_USER || 'ctrb_admin',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'ctrb_tims',
        password: process.env.DB_PASSWORD || 'ctrb_password',
        port: process.env.DB_PORT || 5432,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });
}

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
