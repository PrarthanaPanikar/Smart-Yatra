const router = require('express').Router();
const { updateLocation, getBusLocation, getBusHistory } = require('../controllers/gpsController');
const { authenticate, requireRole } = require('../middleware/auth');

// Driver sends GPS update
router.post('/location', authenticate, requireRole('DRIVER', 'ADMIN'), updateLocation);
// Get current bus location (public for tracking)
router.get('/bus/:busId', authenticate, getBusLocation);
// Get GPS history
router.get('/history/:busId', authenticate, getBusHistory);

module.exports = router;
