const db = require('../config/db');

const addReplacement = async (req, res) => {
    try {
        const { ctrb_id, cycle_id, component, original_inspection_id, rejection_cause, replacement_part_number } = req.body;
        const replaced_by = req.user.sub;

        const insertQuery = `
            INSERT INTO component_replacements 
            (ctrb_id, cycle_id, component, original_inspection_id, rejection_cause, replacement_part_number, replaced_by) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
        `;
        const result = await db.query(insertQuery, [
            ctrb_id, cycle_id, component, original_inspection_id, rejection_cause, replacement_part_number, replaced_by
        ]);

        res.status(201).json({ data: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

const addAssembly = async (req, res) => {
    try {
        const { ctrb_id, grease_type, grease_qty_g, lateral_play_mm, lateral_device, qc_inspector_id, remarks, final_status } = req.body;
        const assembled_by = req.user.sub;

        // G-81 Validation 
        if (grease_qty_g < 370 || grease_qty_g > 410) {
            return res.status(400).json({ error: 'Grease quantity must be between 370g and 410g', code: 'GREASE_OUT_OF_RANGE' });
        }

        if (lateral_device === 'hand' && (lateral_play_mm < 0.510 || lateral_play_mm > 0.660)) {
            return res.status(400).json({ error: 'Hand lateral play must be between 0.510 and 0.660', code: 'LATERAL_PLAY_FAIL' });
        }
        if (lateral_device === 'power' && (lateral_play_mm < 0.580 || lateral_play_mm > 0.740)) {
            return res.status(400).json({ error: 'Power lateral play must be between 0.580 and 0.740', code: 'LATERAL_PLAY_FAIL' });
        }

        const insertQuery = `
            INSERT INTO assembly_records 
            (ctrb_id, grease_type, grease_qty_g, lateral_play_mm, lateral_device, assembled_by, qc_inspector_id, remarks, final_status) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
        `;
        const r = await db.query(insertQuery, [
            ctrb_id, grease_type || 'AAR M-942', grease_qty_g, lateral_play_mm, lateral_device,
            assembled_by, qc_inspector_id, remarks, final_status
        ]);

        res.status(201).json({ data: r.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

const signOffAssembly = async (req, res) => {
    try {
        const { id } = req.params;
        const signed_by = req.user.sub;
        const role = req.user.role; // Extract from auth payload

        if (role !== 'inspector' && role !== 'admin') {
            return res.status(403).json({ error: 'Only Inspector can perform this sign-off', code: 'INSUFFICIENT_ROLE' });
        }

        const insertQuery = `INSERT INTO assembly_signoffs (assembly_id, signed_by, role) VALUES ($1, $2, $3) RETURNING *`;
        const result = await db.query(insertQuery, [id, signed_by, role]);
        res.status(200).json({ data: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = { addReplacement, addAssembly, signOffAssembly };
