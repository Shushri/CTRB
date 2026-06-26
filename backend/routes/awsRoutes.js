const express = require('express');
const { getPresignedUrl, getPhotoUrl } = require('../controllers/awsController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticateToken);

router.post('/presign', getPresignedUrl);
router.get('/', getPhotoUrl);
router.get('/*', getPhotoUrl);

module.exports = router;
