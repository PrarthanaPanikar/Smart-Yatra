const router = require('express').Router();
const {
  getAllBuses, getBusById, getNearbyBuses, searchBuses, recommendBuses,
  getRoutes, getRouteStops,
} = require('../controllers/busController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', getAllBuses);
router.get('/nearby', getNearbyBuses);
router.get('/search', searchBuses);
router.get('/recommend', recommendBuses);
router.get('/routes', getRoutes);
router.get('/routes/:id/stops', getRouteStops);
router.get('/:id', getBusById);

module.exports = router;
