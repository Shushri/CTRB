const express = require('express');
const { addReplacement, addAssembly, signOffAssembly } = require('../controllers/assemblyController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticateToken);

router.post('/replacements', requireRole(['operator', 'admin']), addReplacement);
router.post('/', requireRole(['operator', 'admin']), addAssembly);
router.patch('/:id/signoff', requireRole(['inspector', 'admin']), signOffAssembly);

module.exports = router;
