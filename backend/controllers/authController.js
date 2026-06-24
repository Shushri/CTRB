const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
    try {
        const { personnel_id, pin } = req.body;

        const userQuery = await db.query('SELECT * FROM users WHERE personnel_id = $1 AND is_active = true', [personnel_id]);
        if (userQuery.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
        }

        const user = userQuery.rows[0];
        const isMatch = await bcrypt.compare(pin, user.pin_hash);

        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
        }

        const token = jwt.sign(
            { sub: user.id, role: user.role, personnel_id: user.personnel_id },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '8h' }
        );

        res.json({
            data: {
                token,
                user: { id: user.id, personnel_id: user.personnel_id, name: user.name, role: user.role }
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
};

module.exports = { login };
