const db = require('../config/db');

const getDashboardSummary = async (req, res) => {
    try {
        // High-level aggregates
        const totalsQuery = await db.query(`
            SELECT 
                COUNT(*) as total_received,
                COUNT(*) FILTER (WHERE status = 'ready') as total_accepted,
                COUNT(*) FILTER (WHERE status = 'rejected') as total_rejected,
                COUNT(*) FILTER (WHERE status = 'hold') as total_hold,
                COUNT(*) FILTER (WHERE status = 'scrap') as total_scrap,
                COUNT(*) FILTER (WHERE status = 'under_inspection') as total_under_inspection,
                COUNT(*) FILTER (WHERE status = 'assembly') as total_assembly,
                COUNT(*) FILTER (WHERE status = 'received') as total_received_status,
                COUNT(*) FILTER (WHERE status IN ('under_inspection', 'assembly')) as open_jobs
            FROM ctrb_records;
        `);

        res.status(200).json({ data: totalsQuery.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

const getAnalytics = async (req, res) => {
    try {
        const byMakeQuery = await db.query(`
            SELECT make, status, COUNT(*)::int as count 
            FROM ctrb_records 
            GROUP BY make, status
        `);

        // Other chart data like Rejection By Component using visual_inspections overall_result
        const byCompQuery = await db.query(`
            SELECT component, COUNT(*)::int as count 
            FROM visual_inspections 
            WHERE overall_result = 'rejected' 
            GROUP BY component
        `);

        const statusDistQuery = await db.query(`
            SELECT status, COUNT(*)::int as count 
            FROM ctrb_records 
            GROUP BY status
        `);

        res.status(200).json({
            data: {
                rejection_by_make: byMakeQuery.rows,
                rejection_by_component: byCompQuery.rows,
                status_distribution: statusDistQuery.rows
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = { getDashboardSummary, getAnalytics };
