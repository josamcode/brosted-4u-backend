const express = require('express');
const router = express.Router();
const {
  getFormInstances,
  getFormInstance,
  createFormInstance,
  updateFormInstance,
  deleteFormInstance,
  approveFormInstance,
  exportFormInstance,
  getFormStats
} = require('../controllers/formInstanceController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getFormInstances)
  .post(createFormInstance);

router.get('/stats/summary', authorize('admin', 'supervisor'), getFormStats);

router.route('/:id')
  .get(getFormInstance)
  .put(updateFormInstance)
  .delete(deleteFormInstance);

router.put('/:id/approve', authorize('admin', 'supervisor'), approveFormInstance);
router.get('/:id/export', exportFormInstance);

module.exports = router;

