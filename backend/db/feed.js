const db = require('../config/db');

async function feed() {
    console.log('Starting to feed mock database records...');
    
    try {
        // 1. Fetch the users
        const usersRes = await db.query('SELECT id, personnel_id, role FROM users');
        if (usersRes.rows.length === 0) {
            console.error('No users found in database. Please run migrations first.');
            process.exit(1);
        }

        const userMap = {};
        usersRes.rows.forEach(r => {
            userMap[r.personnel_id] = r.id;
        });

        const opId = userMap['op201'];
        const qcId = userMap['qc301'];
        const adminId = userMap['admin101'];

        if (!opId || !qcId || !adminId) {
            console.error('Expected seed users op201, qc301, and admin101 were not found.');
            process.exit(1);
        }

        // Clean existing dynamic records if any to make feed repeatable
        console.log('Cleaning dynamic tables...');
        await db.query('DELETE FROM audit_log');
        await db.query('DELETE FROM assembly_signoffs');
        await db.query('DELETE FROM assembly_records');
        await db.query('DELETE FROM component_replacements');
        await db.query('DELETE FROM inspection_photos');
        await db.query('DELETE FROM visual_inspections');
        await db.query('DELETE FROM dimensional_inspections');
        await db.query('DELETE FROM inspection_cycles');
        await db.query('DELETE FROM ctrb_records');

        console.log('Seeding CTRB records and inspections...');

        // CTRB 1: Ready status
        const ctrb1 = await db.query(`
            INSERT INTO ctrb_records (ctrb_number, job_id, make, date_received, source, status, operator_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
        `, ['CTRB-2026-001', 'JOB-20260610-4821', 'timken', '2026-06-10', 'scheduled_maint', 'ready', opId]);
        const ctrb1Id = ctrb1.rows[0].id;

        const cycle1 = await db.query(`
            INSERT INTO inspection_cycles (ctrb_id, started_at, completed_at, status)
            VALUES ($1, $2, $3, $4) RETURNING id
        `, [ctrb1Id, '2026-06-10T09:00:00Z', '2026-06-11T11:30:00Z', 'ready']);
        const cycle1Id = cycle1.rows[0].id;

        // Dimensional for CTRB 1
        await db.query(`
            INSERT INTO dimensional_inspections (cycle_id, ctrb_id, component, param_key, measured_value, tolerance_min, tolerance_max, result, operator_id, inspected_at)
            VALUES 
            ($1, $2, 'cone', 'cone_bore', 144.462, 144.450, 144.488, 'accepted', $3, '2026-06-10T10:00:00Z'),
            ($1, $2, 'cone', 'cone_bore_roundness', 0.021, 0.000, 0.076, 'accepted', $3, '2026-06-10T10:05:00Z'),
            ($1, $2, 'cup', 'cup_counter_bore', 209.510, 209.423, 209.677, 'accepted', $3, '2026-06-10T10:15:00Z'),
            ($1, $2, 'spacer', 'spacer_width', 38.115, 38.100, 38.150, 'accepted', $3, '2026-06-10T10:20:00Z')
        `, [cycle1Id, ctrb1Id, opId]);

        // Visual for CTRB 1
        await db.query(`
            INSERT INTO visual_inspections (cycle_id, ctrb_id, component, is_present, defects, remarks, overall_result, operator_id, inspected_at)
            VALUES 
            ($1, $2, 'cone', true, '{}', 'Cones clean, cages intact.', 'accepted', $3, '2026-06-10T11:00:00Z'),
            ($1, $2, 'cup', true, '{}', 'Raceway looks good.', 'accepted', $3, '2026-06-10T11:10:00Z')
        `, [cycle1Id, ctrb1Id, opId]);

        // Assembly for CTRB 1
        const ass1 = await db.query(`
            INSERT INTO assembly_records (ctrb_id, grease_type, grease_qty_g, lateral_play_mm, lateral_device, assembly_date, assembled_by, qc_inspector_id, final_status, remarks)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id
        `, [ctrb1Id, 'AAR M-942', 385.0, 0.585, 'hand', '2026-06-11', opId, qcId, 'ready', 'Greased and pressed successfully. Hand device lateral play within specs.']);
        const ass1Id = ass1.rows[0].id;

        // QC Signoff for CTRB 1
        await db.query(`
            INSERT INTO assembly_signoffs (assembly_id, signed_by, role, signed_at)
            VALUES ($1, $2, 'inspector', '2026-06-11T12:00:00Z')
        `, [ass1Id, qcId]);


        // CTRB 2: Rejected status
        const ctrb2 = await db.query(`
            INSERT INTO ctrb_records (ctrb_number, job_id, make, date_received, source, status, operator_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
        `, ['CTRB-2026-002', 'JOB-20260612-9213', 'skf', '2026-06-12', 'failure', 'rejected', opId]);
        const ctrb2Id = ctrb2.rows[0].id;

        const cycle2 = await db.query(`
            INSERT INTO inspection_cycles (ctrb_id, started_at, completed_at, status)
            VALUES ($1, $2, $3, $4) RETURNING id
        `, [ctrb2Id, '2026-06-12T14:00:00Z', '2026-06-12T16:00:00Z', 'rejected']);
        const cycle2Id = cycle2.rows[0].id;

        // Dimensional for CTRB 2 (Failed cone bore)
        await db.query(`
            INSERT INTO dimensional_inspections (cycle_id, ctrb_id, component, param_key, measured_value, tolerance_min, tolerance_max, result, operator_id, inspected_at)
            VALUES 
            ($1, $2, 'cone', 'cone_bore', 144.512, 144.450, 144.488, 'rejected', $3, '2026-06-12T14:30:00Z'),
            ($1, $2, 'cup', 'cup_counter_bore', 209.450, 209.423, 209.677, 'accepted', $3, '2026-06-12T14:45:00Z')
        `, [cycle2Id, ctrb2Id, opId]);

        // Visual for CTRB 2 (Failed due to Fatigue Spalling)
        await db.query(`
            INSERT INTO visual_inspections (cycle_id, ctrb_id, component, is_present, defects, remarks, overall_result, operator_id, inspected_at)
            VALUES 
            ($1, $2, 'cup', true, '{"Fatigue Spalling"}', 'Heavy spalling on inner raceway.', 'rejected', $3, '2026-06-12T15:15:00Z')
        `, [cycle2Id, ctrb2Id, opId]);


        // CTRB 3: Assembly status
        const ctrb3 = await db.query(`
            INSERT INTO ctrb_records (ctrb_number, job_id, make, date_received, source, status, operator_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
        `, ['CTRB-2026-003', 'JOB-20260615-5812', 'nei', '2026-06-15', 'new_install', 'assembly', opId]);
        const ctrb3Id = ctrb3.rows[0].id;

        const cycle3 = await db.query(`
            INSERT INTO inspection_cycles (ctrb_id, started_at, status)
            VALUES ($1, $2, $3) RETURNING id
        `, [ctrb3Id, '2026-06-15T09:30:00Z', 'assembly']);
        const cycle3Id = cycle3.rows[0].id;

        // Dimensional for CTRB 3
        await db.query(`
            INSERT INTO dimensional_inspections (cycle_id, ctrb_id, component, param_key, measured_value, tolerance_min, tolerance_max, result, operator_id, inspected_at)
            VALUES 
            ($1, $2, 'cone', 'cone_bore', 144.475, 144.450, 144.488, 'accepted', $3, '2026-06-15T10:00:00Z'),
            ($1, $2, 'cup', 'cup_counter_bore', 209.610, 209.423, 209.677, 'accepted', $3, '2026-06-15T10:30:00Z'),
            ($1, $2, 'spacer', 'spacer_width', 38.140, 38.100, 38.150, 'accepted', $3, '2026-06-15T10:45:00Z')
        `, [cycle3Id, ctrb3Id, opId]);

        // Visual for CTRB 3
        await db.query(`
            INSERT INTO visual_inspections (cycle_id, ctrb_id, component, is_present, defects, remarks, overall_result, operator_id, inspected_at)
            VALUES 
            ($1, $2, 'cone', true, '{}', 'All clear.', 'accepted', $3, '2026-06-15T11:15:00Z'),
            ($1, $2, 'cup', true, '{}', 'All clear.', 'accepted', $3, '2026-06-15T11:30:00Z')
        `, [cycle3Id, ctrb3Id, opId]);


        // CTRB 4: Under Inspection status
        const ctrb4 = await db.query(`
            INSERT INTO ctrb_records (ctrb_number, job_id, make, date_received, source, status, operator_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
        `, ['CTRB-2026-004', 'JOB-20260618-2947', 'koyo', '2026-06-18', 'scheduled_maint', 'under_inspection', opId]);
        const ctrb4Id = ctrb4.rows[0].id;

        const cycle4 = await db.query(`
            INSERT INTO inspection_cycles (ctrb_id, started_at, status)
            VALUES ($1, $2, $3) RETURNING id
        `, [ctrb4Id, '2026-06-18T11:00:00Z', 'under_inspection']);
        const cycle4Id = cycle4.rows[0].id;

        // Dimensional for CTRB 4 (only cone measured so far)
        await db.query(`
            INSERT INTO dimensional_inspections (cycle_id, ctrb_id, component, param_key, measured_value, tolerance_min, tolerance_max, result, operator_id, inspected_at)
            VALUES 
            ($1, $2, 'cone', 'cone_bore', 144.458, 144.450, 144.488, 'accepted', $3, '2026-06-18T11:20:00Z')
        `, [cycle4Id, ctrb4Id, opId]);


        // CTRB 5: Received status (just registered, no inspections yet)
        await db.query(`
            INSERT INTO ctrb_records (ctrb_number, job_id, make, date_received, source, status, operator_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, ['CTRB-2026-005', 'JOB-20260620-8361', 'brenco', '2026-06-20', 'other', 'received', opId]);


        // CTRB 6: Hold status (with component replacement)
        const ctrb6 = await db.query(`
            INSERT INTO ctrb_records (ctrb_number, job_id, make, date_received, source, status, operator_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
        `, ['CTRB-2026-006', 'JOB-20260621-1748', 'fag', '2026-06-21', 'scheduled_maint', 'hold', opId]);
        const ctrb6Id = ctrb6.rows[0].id;

        const cycle6 = await db.query(`
            INSERT INTO inspection_cycles (ctrb_id, started_at, status)
            VALUES ($1, $2, $3) RETURNING id
        `, [ctrb6Id, '2026-06-21T13:00:00Z', 'hold']);
        const cycle6Id = cycle6.rows[0].id;

        // Dimensional for CTRB 6
        await db.query(`
            INSERT INTO dimensional_inspections (cycle_id, ctrb_id, component, param_key, measured_value, tolerance_min, tolerance_max, result, operator_id, inspected_at)
            VALUES 
            ($1, $2, 'cone', 'cone_bore', 144.465, 144.450, 144.488, 'accepted', $3, '2026-06-21T13:30:00Z'),
            ($1, $2, 'spacer', 'spacer_width', 38.080, 38.100, 38.150, 'rejected', $3, '2026-06-21T13:45:00Z')
        `, [cycle6Id, ctrb6Id, opId]);

        // Component Replacement for CTRB 6 (spacer was out of tolerance)
        await db.query(`
            INSERT INTO component_replacements (ctrb_id, cycle_id, component, rejection_cause, replacement_part_number, replaced_by, replaced_at, notes)
            VALUES ($1, $2, 'spacer', 'Spacer width 38.080mm was below the 38.100mm G-81 threshold.', 'SP-FAG-9921', $3, '2026-06-22', 'Replaced spacer with FAG OEM replacement part.')
        `, [ctrb6Id, cycle6Id, opId]);


        // 2. Audit logs
        console.log('Seeding audit logs...');
        await db.query(`
            INSERT INTO audit_log (user_id, action, entity, entity_id, changes)
            VALUES 
            ($1, 'create', 'ctrb_records', $2, '{"ctrb_number": "CTRB-2026-001", "status": "received"}'),
            ($1, 'update_status', 'ctrb_records', $2, '{"old_status": "received", "new_status": "under_inspection"}'),
            ($1, 'update_status', 'ctrb_records', $2, '{"old_status": "assembly", "new_status": "ready"}'),
            ($1, 'create', 'ctrb_records', $3, '{"ctrb_number": "CTRB-2026-002", "status": "received"}')
        `, [opId, ctrb1Id, ctrb2Id]);

        console.log('Database seeding successfully finished.');
    } catch (err) {
        console.error('Seeding failed:', err.message);
        console.error(err);
        process.exit(1);
    } finally {
        await db.pool.end();
        console.log('Database pool connection closed.');
    }
}

feed();
