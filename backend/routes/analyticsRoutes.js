const express = require('express');
const { getDashboardSummary, getAnalytics } = require('../controllers/analyticsController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticateToken); // Protect all routes

router.get('/dashboard/summary', getDashboardSummary);
router.get('/analytics/summary', getAnalytics);

module.exports = router;
