const router = require('express').Router();
const { getParcel, updateParcelStatus } = require('../controllers/parcelController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/:parcelId', getParcel);
router.put('/:bookingId/status', updateParcelStatus);

module.exports = router;
