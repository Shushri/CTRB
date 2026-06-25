const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function migrate() {
    const isReset = process.argv.includes('--reset');

    console.log('Starting database migration...');

    if (isReset) {
        console.log('Reset flag detected. Dropping existing tables and enums...');
        const dropTablesQuery = `
            DROP TABLE IF EXISTS audit_log CASCADE;
            DROP TABLE IF EXISTS assembly_signoffs CASCADE;
            DROP TABLE IF EXISTS assembly_records CASCADE;
            DROP TABLE IF EXISTS component_replacements CASCADE;
            DROP TABLE IF EXISTS inspection_photos CASCADE;
            DROP TABLE IF EXISTS visual_inspections CASCADE;
            DROP TABLE IF EXISTS dimensional_inspections CASCADE;
            DROP TABLE IF EXISTS inspection_cycles CASCADE;
            DROP TABLE IF EXISTS ctrb_records CASCADE;
            DROP TABLE IF EXISTS tolerance_limits CASCADE;
            DROP TABLE IF EXISTS users CASCADE;

            DROP TYPE IF EXISTS user_role CASCADE;
            DROP TYPE IF EXISTS ctrb_make CASCADE;
            DROP TYPE IF EXISTS receipt_source CASCADE;
            DROP TYPE IF EXISTS current_status CASCADE;
            DROP TYPE IF EXISTS component_type CASCADE;
            DROP TYPE IF EXISTS inspection_result CASCADE;
            DROP TYPE IF EXISTS lateral_device_type CASCADE;
        `;
        try {
            await db.query(dropTablesQuery);
            console.log('Successfully dropped all existing tables and enums.');
        } catch (err) {
            console.error('Error dropping tables/enums:', err.message);
            process.exit(1);
        }
    }

    try {
        console.log('Reading init.sql schema...');
        const initSqlPath = path.join(__dirname, 'init.sql');
        const sql = fs.readFileSync(initSqlPath, 'utf8');

        console.log('Executing init.sql schema...');
        await db.query(sql);
        console.log('Database migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
        if (err.message && err.message.includes('already exists') && !isReset) {
            console.log('Hint: Try running with --reset flag to reset and overwrite existing database state.');
        }
        process.exit(1);
    } finally {
        await db.pool.end();
        console.log('Database pool connection closed.');
    }
}

migrate();
