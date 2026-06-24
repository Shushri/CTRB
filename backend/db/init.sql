CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE user_role AS ENUM ('operator', 'inspector', 'admin', 'viewer');
CREATE TYPE ctrb_make AS ENUM ('timken', 'nei', 'fag', 'skf', 'brenco', 'koyo', 'other');
CREATE TYPE receipt_source AS ENUM ('scheduled_maint', 'failure', 'new_install', 'other');
CREATE TYPE current_status AS ENUM ('received', 'under_inspection', 'assembly', 'ready', 'rejected', 'hold', 'scrap');
CREATE TYPE component_type AS ENUM ('cone', 'cup', 'spacer', 'seal', 'backing_ring', 'other');
CREATE TYPE inspection_result AS ENUM ('accepted', 'rejected');
CREATE TYPE lateral_device_type AS ENUM ('hand', 'power');

-- 1. Users Registry
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    personnel_id VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    pin_hash VARCHAR(72) NOT NULL,
    role user_role NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tolerance Limits (G-81 Definitions)
CREATE TABLE tolerance_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    param_key VARCHAR(60) UNIQUE NOT NULL,
    component component_type NOT NULL,
    parameter_name VARCHAR(100) NOT NULL,
    min_val NUMERIC(10,4),
    max_val NUMERIC(10,4),
    unit VARCHAR(10) NOT NULL,
    gauge_type VARCHAR(50)
);

-- 3. CTRB Records
CREATE TABLE ctrb_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ctrb_number VARCHAR(30) UNIQUE NOT NULL,
    job_id VARCHAR(20) UNIQUE NOT NULL,
    make ctrb_make NOT NULL,
    date_received DATE NOT NULL,
    source receipt_source NOT NULL,
    source_remarks TEXT,
    status current_status NOT NULL DEFAULT 'received',
    operator_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Inspection Cycles
CREATE TABLE inspection_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ctrb_id UUID NOT NULL REFERENCES ctrb_records(id),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status current_status NOT NULL DEFAULT 'under_inspection'
);

-- 5. Dimensional Inspections
CREATE TABLE dimensional_inspections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cycle_id UUID NOT NULL REFERENCES inspection_cycles(id),
    ctrb_id UUID NOT NULL REFERENCES ctrb_records(id),
    component component_type NOT NULL,
    param_key VARCHAR(60) NOT NULL REFERENCES tolerance_limits(param_key),
    measured_value NUMERIC(10,4) NOT NULL,
    tolerance_min NUMERIC(10,4),
    tolerance_max NUMERIC(10,4),
    result inspection_result NOT NULL,
    operator_id UUID NOT NULL REFERENCES users(id),
    inspected_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Visual Inspections
CREATE TABLE visual_inspections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cycle_id UUID NOT NULL REFERENCES inspection_cycles(id),
    ctrb_id UUID NOT NULL REFERENCES ctrb_records(id),
    component component_type NOT NULL,
    is_present BOOLEAN NOT NULL DEFAULT true,
    defects TEXT[] DEFAULT '{}',
    remarks TEXT,
    overall_result inspection_result NOT NULL,
    operator_id UUID NOT NULL REFERENCES users(id),
    inspected_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Inspection Photos
CREATE TABLE inspection_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visual_inspection_id UUID NOT NULL REFERENCES visual_inspections(id),
    s3_key VARCHAR(255) NOT NULL UNIQUE,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Component Replacements
CREATE TABLE component_replacements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ctrb_id UUID NOT NULL REFERENCES ctrb_records(id),
    cycle_id UUID NOT NULL REFERENCES inspection_cycles(id),
    component component_type NOT NULL,
    original_inspection_id UUID, -- Optionally links to dimensional/visual
    rejection_cause TEXT NOT NULL,
    replacement_part_number VARCHAR(60) NOT NULL,
    replaced_by UUID NOT NULL REFERENCES users(id),
    replaced_at DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT
);

-- 9. Assembly Records
CREATE TABLE assembly_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ctrb_id UUID NOT NULL REFERENCES ctrb_records(id),
    grease_type VARCHAR(40) NOT NULL DEFAULT 'AAR M-942',
    grease_qty_g NUMERIC(6,1) NOT NULL CHECK (grease_qty_g >= 370 AND grease_qty_g <= 410),
    lateral_play_mm NUMERIC(5,3) NOT NULL,
    lateral_device lateral_device_type NOT NULL,
    assembly_date DATE NOT NULL DEFAULT CURRENT_DATE,
    assembled_by UUID NOT NULL REFERENCES users(id),
    qc_inspector_id UUID NOT NULL REFERENCES users(id),
    final_status current_status NOT NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Assembly Signoffs
CREATE TABLE assembly_signoffs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assembly_id UUID NOT NULL REFERENCES assembly_records(id),
    signed_by UUID NOT NULL REFERENCES users(id),
    role user_role NOT NULL,
    signed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Audit Log
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    entity VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    changes JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initial User & Tolerance Limit Seeds
INSERT INTO users (personnel_id, name, pin_hash, role) VALUES 
('admin101', 'System Administrator', crypt('1234', gen_salt('bf', 12)), 'admin'),
('op201', 'Data Entry Operator', crypt('1234', gen_salt('bf', 12)), 'operator'),
('qc301', 'Quality Inspector', crypt('1234', gen_salt('bf', 12)), 'inspector');

-- G-81 Seed Limits
INSERT INTO tolerance_limits (param_key, component, parameter_name, min_val, max_val, unit, gauge_type) VALUES
('cone_bore', 'cone', 'Cone Inner Diameter', 144.450, 144.488, 'mm', 'Dial Bore Gauge'),
('cone_bore_roundness', 'cone', 'Bore Out of Roundness', 0, 0.076, 'mm', 'Dial Bore Gauge'),
('cage_roller_gap', 'cone', 'Cage-Roller Gap', 0, 1.500, 'mm', 'Feeler Gauge'),
('cage_flange_gap', 'cone', 'Cage-Flange Gap', 0, 2.300, 'mm', 'Feeler Gauge'),
('cup_counter_bore', 'cup', 'Counter Bore Diameter', 209.423, 209.677, 'mm', 'Dial Bore Gauge'),
-- Base default OD limits (others dependent on make like timken/koyo dealt in backend logic)
('cup_od_general', 'cup', 'Outside Diameter', 220.345, 220.650, 'mm', 'Outside Micrometer'),
('cup_roundness', 'cup', 'OD Out of Roundness', 0, 0.127, 'mm', 'Dial Bore Gauge'),
('spacer_parallelity', 'spacer', 'End Face Parallelity', 0, 0.025, 'mm', 'Comparator'),
('spacer_width', 'spacer', 'Width', 38.10, 38.150, 'mm', 'Micrometer'),
('seal_groove_depth', 'seal', 'Wear Ring Groove Depth', 0, 0.130, 'mm', 'Dial Indicator'),
('grease_seal_roundness', 'seal', 'Grease Seal Out of Roundness', 0, 0.260, 'mm', 'Mechanical Comparator'),
('backing_ring_id_timken', 'backing_ring', 'Inner Diameter (Timken/NEI/FAG)', 178.384, 178.511, 'mm', 'Dial Bore Gauge'),
('backing_ring_id_skf', 'backing_ring', 'Inner Diameter (SKF)', 178.384, 178.562, 'mm', 'Dial Bore Gauge'),
('lateral_play_hand', 'other', 'Lateral Play - Hand Device', 0.510, 0.660, 'mm', 'Dial Indicator'),
('lateral_play_power', 'other', 'Lateral Play - Power Device', 0.580, 0.740, 'mm', 'Dial Indicator'),
('grease_qty', 'other', 'Grease Weight', 370, 410, 'g', 'Weighing Scale');
