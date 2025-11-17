const express = require('express');
const router = express.Router();
const {
  generateQRCode,
  checkIn,
  checkOut,
  getAttendanceLogs,
  getMyAttendance,
  getAttendanceStats,
  manualAttendance
} = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/qr-code', authorize('admin', 'supervisor'), generateQRCode);
router.post('/check-in', checkIn);
router.post('/check-out', checkOut);
router.get('/logs', getAttendanceLogs);
router.get('/my-attendance', getMyAttendance);
router.get('/stats', authorize('admin', 'supervisor'), getAttendanceStats);
router.post('/manual', authorize('admin', 'supervisor'), manualAttendance);

module.exports = router;

