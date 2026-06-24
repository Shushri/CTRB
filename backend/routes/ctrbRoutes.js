const express = require('express');
const { createCTRB, searchCTRB, getCTRBById, updateStatus } = require('../controllers/ctrbController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticateToken); // Protect all routes

router.post('/', requireRole(['operator', 'admin']), createCTRB);
router.get('/search', searchCTRB);
router.get('/:id', getCTRBById);
router.patch('/:id/status', requireRole(['operator', 'inspector', 'admin']), updateStatus);

module.exports = router;
