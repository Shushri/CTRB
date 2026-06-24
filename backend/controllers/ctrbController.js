const db = require('../config/db');

const createCTRB = async (req, res) => {
    try {
        const { ctrb_number, make, date_received, source, operator_id, initial_status } = req.body;

        // Uniqueness check
        const existsQuery = await db.query('SELECT id FROM ctrb_records WHERE ctrb_number = $1', [ctrb_number]);
        if (existsQuery.rows.length > 0) {
            return res.status(400).json({ error: 'CTRB Number already exists', code: 'DUPLICATE_CTRB' });
        }

        // Job ID generation: JOB-YYYYMMDD-XXXX
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomId = Math.floor(1000 + Math.random() * 9000);
        const job_id = `JOB-${dateStr}-${randomId}`;

        const insertQuery = `
            INSERT INTO ctrb_records (ctrb_number, job_id, make, date_received, source, status, operator_id) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
        `;
        const result = await db.query(insertQuery, [ctrb_number, job_id, make, date_received, source, initial_status || 'received', operator_id]);

        res.status(201).json({ data: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error', code: 'SERVER_ERROR' });
    }
};

const searchCTRB = async (req, res) => {
    try {
        const { q } = req.query;
        const searchQuery = `
            SELECT * FROM ctrb_records 
            WHERE ctrb_number ILIKE $1 OR job_id ILIKE $1
            LIMIT 50
        `;
        const result = await db.query(searchQuery, [`%${q}%`]);
        res.status(200).json({ data: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

const getCTRBById = async (req, res) => {
    try {
        const { id } = req.params;
        const r = await db.query('SELECT * FROM ctrb_records WHERE id = $1', [id]);
        if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });

        // Would also join cycles, components, etc per TRD S-10. Keeping simple for scaffolding
        res.status(200).json({ data: r.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

const updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const r = await db.query('UPDATE ctrb_records SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [status, id]);
        res.status(200).json({ data: r.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = { createCTRB, searchCTRB, getCTRBById, updateStatus };
