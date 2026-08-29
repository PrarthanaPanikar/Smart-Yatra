const router = require('express').Router();
const { createBooking, getBookingById, getMyBookings, trackParcel } = require('../controllers/bookingController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/', createBooking);
router.get('/me', getMyBookings);
router.get('/parcel/:parcelId', trackParcel);
router.get('/:id', getBookingById);

module.exports = router;
