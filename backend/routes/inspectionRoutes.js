const express = require('express');
const { addDimensionalInspection, addVisualInspection } = require('../controllers/inspectionController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticateToken); // Protect routes

router.post('/dimensional', requireRole(['operator', 'admin']), addDimensionalInspection);
router.post('/visual', requireRole(['operator', 'admin']), addVisualInspection);

module.exports = router;
