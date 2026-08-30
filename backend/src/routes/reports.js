const router = require('express').Router();
const {
  createReport, getMyReports, getAllReports,
  getReportById, verifyReport, rejectReport, getReportStats,
} = require('../controllers/infoReportController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

// Passenger routes
router.post('/',       requireRole('PASSENGER'),             createReport);
router.get('/mine',    requireRole('PASSENGER'),             getMyReports);

// Admin routes
router.get('/stats',   requireRole('ADMIN'),                 getReportStats);
router.get('/',        requireRole('ADMIN'),                 getAllReports);
router.post('/:id/verify', requireRole('ADMIN'),            verifyReport);
router.post('/:id/reject', requireRole('ADMIN'),            rejectReport);

// Shared (admin or own passenger)
router.get('/:id',     getReportById);

module.exports = router;
