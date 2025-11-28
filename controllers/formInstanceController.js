const FormInstance = require('../models/FormInstance');
const FormTemplate = require('../models/FormTemplate');
const { createNotification } = require('../utils/notifications');
const User = require('../models/User');
const pdfGenerator = require('../utils/pdfGenerator');

// @desc    Get all form instances
// @route   GET /api/form-instances
// @access  Private
exports.getFormInstances = async (req, res) => {
  try {
    const { templateId, status, department, dateFrom, dateTo, filledBy } = req.query;

    let query = {};

    // Apply filters
    if (templateId) query.templateId = templateId;
    if (status) query.status = status;
    if (department) query.department = department;
    if (filledBy) query.filledBy = filledBy;

    // Date range filter
    if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) query.date.$gte = new Date(dateFrom);
      if (dateTo) query.date.$lte = new Date(dateTo);
    }

    // Role-based filtering
    if (req.user.role === 'employee') {
      query.filledBy = req.user.id;
    } else if (req.user.role === 'supervisor') {
      query.department = { $in: req.user.departments };
    } else if (req.user.role === 'admin') {
      // Only management admins can see all forms
      // Other admins see only their department forms
      if (req.user.department !== 'management') {
        query.department = req.user.department;
      }
      // If management admin, no filter - see all forms
    }

    const instances = await FormInstance.find(query)
      .populate('templateId', 'title')
      .populate('filledBy', 'name email department')
      .populate('approvedBy', 'name email')
      .sort('-date');

    res.json({
      success: true,
      count: instances.length,
      data: instances
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get single form instance
// @route   GET /api/form-instances/:id
// @access  Private
exports.getFormInstance = async (req, res) => {
  try {
    const instance = await FormInstance.findById(req.params.id)
      .populate('templateId')
      .populate('filledBy', 'name email department')
      .populate('approvedBy', 'name email');

    if (!instance) {
      return res.status(404).json({
        success: false,
        message: 'Form instance not found'
      });
    }

    // Check access rights
    if (req.user.role === 'employee' && instance.filledBy._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this form'
      });
    }

    if (req.user.role === 'supervisor' && !req.user.departments.includes(instance.department)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this form'
      });
    }

    // Non-management admins can only access their department forms
    if (req.user.role === 'admin' && req.user.department !== 'management' && instance.department !== req.user.department) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this form'
      });
    }

    res.json({
      success: true,
      data: instance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create form instance
// @route   POST /api/form-instances
// @access  Private
exports.createFormInstance = async (req, res) => {
  try {
    const { templateId, department, date, shift, values, status } = req.body;

    // Check if template exists and user has access
    const template = await FormTemplate.findById(templateId);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Form template not found'
      });
    }

    if (!template.editableByRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to fill this form'
      });
    }

    const instance = await FormInstance.create({
      templateId,
      filledBy: req.user.id,
      department: department || req.user.department,
      date: date || Date.now(),
      shift: shift || 'morning',
      values: values || {},
      status: status || 'draft'
    });

    await instance.populate('templateId', 'title');
    await instance.populate('filledBy', 'name email department');

    // Create notification for admins when form is submitted
    if (status === 'submitted') {
      const templateTitleEn = instance.templateId?.title?.en || 'Form';
      const templateTitleAr = instance.templateId?.title?.ar || 'نموذج';
      const userName = instance.filledBy?.name || 'User';

      await createNotification({
        type: 'form_submitted',
        title: {
          en: 'New Form Submitted',
          ar: 'تم إرسال نموذج جديد'
        },
        message: {
          en: `${userName} submitted a new form: ${templateTitleEn}`,
          ar: `${userName} أرسل نموذجاً جديداً: ${templateTitleAr}`
        },
        data: {
          formId: instance._id,
          templateId: templateId,
          filledBy: instance.filledBy._id,
          department: instance.department
        }
      });
    }

    res.status(201).json({
      success: true,
      data: instance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update form instance
// @route   PUT /api/form-instances/:id
// @access  Private
exports.updateFormInstance = async (req, res) => {
  try {
    const { department, date, shift, values, status } = req.body;

    let instance = await FormInstance.findById(req.params.id);

    if (!instance) {
      return res.status(404).json({
        success: false,
        message: 'Form instance not found'
      });
    }

    // Only owner or admin/supervisor can update
    if (req.user.role === 'employee' && instance.filledBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this form'
      });
    }

    // Store old status to check if it changed to submitted
    const oldStatus = instance.status;

    // Update fields
    if (department) instance.department = department;
    if (date) instance.date = date;
    if (shift) instance.shift = shift;
    if (values) instance.values = values;
    if (status) instance.status = status;

    await instance.save();
    await instance.populate('templateId', 'title');
    await instance.populate('filledBy', 'name email department');

    // Create notification for admins when form status changes from draft to submitted
    if (oldStatus === 'draft' && instance.status === 'submitted') {
      const templateTitleEn = instance.templateId?.title?.en || 'Form';
      const templateTitleAr = instance.templateId?.title?.ar || 'نموذج';
      const userName = instance.filledBy?.name || 'User';

      await createNotification({
        type: 'form_submitted',
        title: {
          en: 'New Form Submitted',
          ar: 'تم إرسال نموذج جديد'
        },
        message: {
          en: `${userName} submitted a new form: ${templateTitleEn}`,
          ar: `${userName} أرسل نموذجاً جديداً: ${templateTitleAr}`
        },
        data: {
          formId: instance._id,
          templateId: instance.templateId._id,
          filledBy: instance.filledBy._id,
          department: instance.department
        }
      });
    }

    res.json({
      success: true,
      data: instance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete form instance
// @route   DELETE /api/form-instances/:id
// @access  Private
exports.deleteFormInstance = async (req, res) => {
  try {
    const instance = await FormInstance.findById(req.params.id);

    if (!instance) {
      return res.status(404).json({
        success: false,
        message: 'Form instance not found'
      });
    }

    // Only owner or admin can delete
    if (req.user.role === 'employee' && instance.filledBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this form'
      });
    }

    // Supervisors can only delete their department forms
    if (req.user.role === 'supervisor' && !req.user.departments.includes(instance.department)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this form'
      });
    }

    // Non-management admins can only delete their department forms
    if (req.user.role === 'admin' && req.user.department !== 'management' && instance.department !== req.user.department) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this form'
      });
    }

    await instance.deleteOne();

    res.json({
      success: true,
      message: 'Form instance deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Approve/Reject form instance
// @route   PUT /api/form-instances/:id/approve
// @access  Private (Admin, Supervisor)
exports.approveFormInstance = async (req, res) => {
  try {
    const { status, notes } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either approved or rejected'
      });
    }

    let instance = await FormInstance.findById(req.params.id);

    if (!instance) {
      return res.status(404).json({
        success: false,
        message: 'Form instance not found'
      });
    }

    // Check department access for supervisors
    if (req.user.role === 'supervisor' && !req.user.departments.includes(instance.department)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to approve forms from this department'
      });
    }

    // Non-management admins can only approve their department forms
    if (req.user.role === 'admin' && req.user.department !== 'management' && instance.department !== req.user.department) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to approve forms from this department'
      });
    }

    instance.status = status;
    instance.approvedBy = req.user.id;
    instance.approvalDate = Date.now();
    instance.approvalNotes = notes || '';

    await instance.save();
    await instance.populate('templateId', 'title');
    await instance.populate('filledBy', 'name email department');
    await instance.populate('approvedBy', 'name email');

    // Create notification for admins when form is approved/rejected
    const templateTitleEn = instance.templateId?.title?.en || 'Form';
    const templateTitleAr = instance.templateId?.title?.ar || 'نموذج';
    const userName = instance.filledBy?.name || 'User';
    const action = status === 'approved' ? 'approved' : 'rejected';

    await createNotification({
      type: `form_${action}`,
      title: {
        en: `Form ${action === 'approved' ? 'Approved' : 'Rejected'}`,
        ar: action === 'approved' ? 'تم الموافقة على النموذج' : 'تم رفض النموذج'
      },
      message: {
        en: `Form "${templateTitleEn}" filled by ${userName} has been ${action}`,
        ar: action === 'approved'
          ? `تم الموافقة على النموذج "${templateTitleAr}" الذي ملأه ${userName}`
          : `تم رفض النموذج "${templateTitleAr}" الذي ملأه ${userName}`
      },
      data: {
        formId: instance._id,
        templateId: instance.templateId._id,
        filledBy: instance.filledBy._id,
        approvedBy: instance.approvedBy._id,
        status: status
      }
    });

    res.json({
      success: true,
      data: instance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Export form instance as PDF
// @route   GET /api/form-instances/:id/export
// @access  Private
exports.exportFormInstance = async (req, res) => {
  try {
    const { language = 'en' } = req.query;

    const instance = await FormInstance.findById(req.params.id)
      .populate('templateId')
      .populate('filledBy', 'name email department')
      .populate('approvedBy', 'name email');

    if (!instance) {
      return res.status(404).json({
        success: false,
        message: 'Form instance not found'
      });
    }

    // Check access rights
    if (req.user.role === 'employee' && instance.filledBy._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this form'
      });
    }

    if (req.user.role === 'supervisor' && !req.user.departments.includes(instance.department)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this form'
      });
    }

    // Non-management admins can only export their department forms
    if (req.user.role === 'admin' && req.user.department !== 'management' && instance.department !== req.user.department) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this form'
      });
    }

    // Generate PDF
    const pdfBuffer = await pdfGenerator.generateFormPDF(
      instance,
      instance.templateId,
      instance.filledBy,
      language
    );

    // Set headers
    const filename = `form_${instance._id}_${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF Export Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get form statistics
// @route   GET /api/form-instances/stats/summary
// @access  Private (Admin, Supervisor)
exports.getFormStats = async (req, res) => {
  try {
    const { dateFrom, dateTo, department } = req.query;

    let matchQuery = {};

    // Date range
    if (dateFrom || dateTo) {
      matchQuery.date = {};
      if (dateFrom) matchQuery.date.$gte = new Date(dateFrom);
      if (dateTo) matchQuery.date.$lte = new Date(dateTo);
    }

    // Department filter
    if (department) {
      matchQuery.department = department;
    } else if (req.user.role === 'supervisor') {
      matchQuery.department = { $in: req.user.departments };
    } else if (req.user.role === 'admin' && req.user.department !== 'management') {
      // Non-management admins see only their department stats
      matchQuery.department = req.user.department;
    }

    const stats = await FormInstance.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalForms = await FormInstance.countDocuments(matchQuery);
    const byDepartment = await FormInstance.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        total: totalForms,
        byStatus: stats,
        byDepartment
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

