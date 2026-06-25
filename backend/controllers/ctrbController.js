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
        const ctrbRes = await db.query('SELECT * FROM ctrb_records WHERE id = $1', [id]);
        if (ctrbRes.rows.length === 0) return res.status(404).json({ error: 'CTRB Record not found' });

        const ctrb = ctrbRes.rows[0];

        // Fetch all cycles
        const cyclesRes = await db.query('SELECT * FROM inspection_cycles WHERE ctrb_id = $1 ORDER BY started_at ASC', [id]);
        const cycles = cyclesRes.rows;

        for (let cycle of cycles) {
            // Fetch dimensional inspections for this cycle
            const dimRes = await db.query(
                `SELECT di.*, u.name as operator_name 
                 FROM dimensional_inspections di
                 LEFT JOIN users u ON di.operator_id = u.id
                 WHERE di.cycle_id = $1 ORDER BY di.inspected_at ASC`,
                [cycle.id]
            );
            cycle.dimensional_inspections = dimRes.rows;

            // Fetch visual inspections for this cycle
            const visRes = await db.query(
                `SELECT vi.*, u.name as operator_name 
                 FROM visual_inspections vi
                 LEFT JOIN users u ON vi.operator_id = u.id
                 WHERE vi.cycle_id = $1 ORDER BY vi.inspected_at ASC`,
                [cycle.id]
            );
            const visualInspections = visRes.rows;

            // Fetch photos for each visual inspection
            for (let vis of visualInspections) {
                const photoRes = await db.query('SELECT * FROM inspection_photos WHERE visual_inspection_id = $1', [vis.id]);
                vis.photos = photoRes.rows.map(p => p.s3_key);
            }
            cycle.visual_inspections = visualInspections;

            // Fetch replacements for this cycle
            const repRes = await db.query(
                `SELECT cr.*, u.name as operator_name 
                 FROM component_replacements cr
                 LEFT JOIN users u ON cr.replaced_by = u.id
                 WHERE cr.cycle_id = $1 ORDER BY cr.replaced_at ASC`,
                [cycle.id]
            );
            cycle.replacements = repRes.rows;
        }

        // Fetch assembly record if it exists
        const assemblyRes = await db.query(
            `SELECT ar.*, u.name as assembled_by_name, u2.name as qc_inspector_name 
             FROM assembly_records ar
             LEFT JOIN users u ON ar.assembled_by = u.id
             LEFT JOIN users u2 ON ar.qc_inspector_id = u2.id
             WHERE ar.ctrb_id = $1 ORDER BY ar.created_at DESC LIMIT 1`,
            [id]
        );
        const assembly = assemblyRes.rows.length > 0 ? assemblyRes.rows[0] : null;

        res.status(200).json({
            data: {
                ...ctrb,
                cycles,
                assembly
            }
        });
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

const getRecentCTRBs = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const recentQuery = `
            SELECT * FROM ctrb_records 
            ORDER BY created_at DESC 
            LIMIT $1
        `;
        const result = await db.query(recentQuery, [limit]);
        res.status(200).json({ data: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = { createCTRB, searchCTRB, getCTRBById, updateStatus, getRecentCTRBs };
