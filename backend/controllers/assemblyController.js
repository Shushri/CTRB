const db = require('../config/db');

const getOrCreateActiveCycle = async (ctrb_id) => {
    // Check if there is an active cycle for this CTRB (completed_at is null)
    let cycleQuery = await db.query(
        "SELECT id FROM inspection_cycles WHERE ctrb_id = $1 AND completed_at IS NULL ORDER BY started_at DESC LIMIT 1",
        [ctrb_id]
    );
    if (cycleQuery.rows.length > 0) {
        return cycleQuery.rows[0].id;
    }
    // Otherwise, create one
    const insertQuery = `
        INSERT INTO inspection_cycles (ctrb_id, status) 
        VALUES ($1, 'under_inspection') RETURNING id
    `;
    const newCycle = await db.query(insertQuery, [ctrb_id]);
    return newCycle.rows[0].id;
};

const addReplacement = async (req, res) => {
    try {
        let { ctrb_id, cycle_id, component, original_inspection_id, rejection_cause, replacement_part_number } = req.body;
        const replaced_by = req.user.sub;

        if (!cycle_id || typeof cycle_id !== 'string' || cycle_id.startsWith('OFFLINE') || !cycle_id.match(/^[0-9a-fA-F-]{36}$/)) {
            cycle_id = await getOrCreateActiveCycle(ctrb_id);
        }

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

        // Update CTRB record status
        await db.query('UPDATE ctrb_records SET status = $1, updated_at = NOW() WHERE id = $2', [final_status, ctrb_id]);

        // Complete the active inspection cycle
        await db.query(
            "UPDATE inspection_cycles SET status = $1, completed_at = NOW() WHERE ctrb_id = $2 AND completed_at IS NULL",
            [final_status, ctrb_id]
        );

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
