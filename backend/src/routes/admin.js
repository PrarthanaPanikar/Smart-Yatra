const router = require('express').Router();
const {
  getDashboard, getAllBuses, createBus, updateBus, deleteBus,
  getReports, acknowledgeReport, getUsers, getAllBookings,
} = require('../controllers/adminController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);
router.use(requireRole('ADMIN'));

router.get('/dashboard',                getDashboard);
router.get('/buses',                    getAllBuses);
router.post('/buses',                   createBus);
router.put('/buses/:id',                updateBus);
router.delete('/buses/:id',             deleteBus);
router.get('/reports',                  getReports);
router.put('/reports/:id/acknowledge',  acknowledgeReport);
router.get('/users',                    getUsers);
router.get('/bookings',                 getAllBookings);

module.exports = router;
