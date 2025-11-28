const express = require('express');
const router = express.Router();
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  getAdminUser
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(protect);

// Public route for all authenticated users (to get admin for messaging)
router.get('/admin', getAdminUser);

// Protected routes (admin, supervisor only)
router.use(authorize('admin', 'supervisor'));

router.route('/')
  .get(getUsers)
  .post(authorize('admin'), upload.single('image'), createUser);

router.route('/:id')
  .get(getUser)
  .put(authorize('admin'), upload.single('image'), updateUser)
  .delete(authorize('admin'), deleteUser);

router.put('/:id/reset-password', authorize('admin'), resetPassword);

module.exports = router;

