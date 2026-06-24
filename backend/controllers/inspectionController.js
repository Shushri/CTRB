const db = require('../config/db');

// Validation engine checking measured values against G-81 tolerances
const validateDimensional = async (component, param_key, measured_value) => {
    const limQuery = await db.query('SELECT min_val, max_val FROM tolerance_limits WHERE param_key = $1 AND component = $2', [param_key, component]);
    if (limQuery.rows.length === 0) return { result: 'rejected', reason: 'Configuration missing' }; // Failsafe

    const { min_val, max_val } = limQuery.rows[0];
    let accepted = true;

    if (min_val !== null && measured_value < Number(min_val)) accepted = false;
    if (max_val !== null && measured_value > Number(max_val)) accepted = false;

    return { result: accepted ? 'accepted' : 'rejected', min_val, max_val };
};

const addDimensionalInspection = async (req, res) => {
    try {
        const { ctrb_id, cycle_id, component, measurements } = req.body;
        const operator_id = req.user.sub;

        const results = [];
        let allAccepted = true;

        for (const m of measurements) {
            const valCheck = await validateDimensional(component, m.param_key, m.measured_value);

            const insertQuery = `
                INSERT INTO dimensional_inspections 
                (cycle_id, ctrb_id, component, param_key, measured_value, tolerance_min, tolerance_max, result, operator_id) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
            `;
            const r = await db.query(insertQuery, [
                cycle_id, ctrb_id, component, m.param_key, m.measured_value,
                valCheck.min_val, valCheck.max_val, valCheck.result, operator_id
            ]);
            results.push(r.rows[0]);
            if (valCheck.result === 'rejected') allAccepted = false;
        }

        res.status(201).json({ data: results, overall_status: allAccepted ? 'accepted' : 'rejected' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

const addVisualInspection = async (req, res) => {
    try {
        const { ctrb_id, cycle_id, component, is_present, defects, remarks, photo_keys } = req.body;
        const operator_id = req.user.sub;

        const AUTO_REJECT_DEFECTS = ['Electric Burn', 'Fatigue Spalling', 'Peeling', 'Fluting', 'Cage Broken'];
        let overall_result = 'accepted';

        if (!is_present) {
            overall_result = 'rejected';
        } else if (defects && defects.length > 0) {
            const hasAutoReject = defects.some(d => AUTO_REJECT_DEFECTS.includes(d));
            if (hasAutoReject || component === 'backing_ring' && defects.includes('vent_holes')) {
                overall_result = 'rejected';
            }
        }

        const insertQuery = `
            INSERT INTO visual_inspections 
            (cycle_id, ctrb_id, component, is_present, defects, remarks, overall_result, operator_id) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
        `;
        const r = await db.query(insertQuery, [cycle_id, ctrb_id, component, is_present, defects || '{}', remarks, overall_result, operator_id]);

        const visual_id = r.rows[0].id;

        // Link Photos
        if (photo_keys && photo_keys.length > 0) {
            for (let s3_key of photo_keys) {
                await db.query('INSERT INTO inspection_photos (visual_inspection_id, s3_key) VALUES ($1, $2)', [visual_id, s3_key]);
            }
        }

        res.status(201).json({ data: r.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = { addDimensionalInspection, addVisualInspection };
