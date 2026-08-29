const router = require('express').Router();
const {
  getMyBus, getDriverBookings, updateOccupancy,
  submitReport, loadParcel, getReports,
} = require('../controllers/driverController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);
router.use(requireRole('DRIVER'));

router.get('/bus', getMyBus);
router.get('/bookings', getDriverBookings);
router.post('/occupancy', updateOccupancy);
router.post('/report', submitReport);
router.get('/reports', getReports);
router.post('/parcel/:bookingId/load', loadParcel);

module.exports = router;
