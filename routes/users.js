const express = require('express');
const router = express.Router();
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  resetPassword
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(protect);
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

