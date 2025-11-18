const express = require('express');
const router = express.Router();
const {
  generateQRCode,
  getCurrentQR,
  validateQRToken,
  recordAttendance,
  getMyAttendance,
  getAttendanceStats,
  getAllAttendance,
  cleanupExpiredQRs
} = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/auth');

// Public route - validate QR token
router.get('/validate/:token', validateQRToken);

// Protected routes - require authentication
router.use(protect);

// Admin only - QR code management
router.post('/qr/generate', authorize('admin'), generateQRCode);
router.get('/qr/current', authorize('admin'), getCurrentQR);
router.post('/qr/cleanup', authorize('admin'), cleanupExpiredQRs);

// All authenticated users - record attendance
router.post('/record', recordAttendance);

// Get my attendance
router.get('/my-attendance', getMyAttendance);

// Admin and Supervisor - stats and all logs
router.get('/stats', authorize('admin', 'supervisor'), getAttendanceStats);
router.get('/logs', authorize('admin', 'supervisor'), getAllAttendance);

module.exports = router;
