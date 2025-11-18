const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');

// @desc    Get all leave requests
// @route   GET /api/leaves
// @access  Private
exports.getLeaveRequests = async (req, res) => {
  try {
    const { status, type, userId, dateFrom, dateTo } = req.query;

    let query = {};

    // Role-based filtering
    if (req.user.role === 'employee') {
      query.userId = req.user.id;
    } else {
      if (userId) query.userId = userId;

      // Supervisors see only their departments
      if (req.user.role === 'supervisor') {
        const users = await User.find({
          department: { $in: req.user.departments }
        }).select('_id');
        query.userId = { $in: users.map(u => u._id) };
      }
    }

    if (status) query.status = status;
    if (type) query.type = type;

    // Date range
    if (dateFrom || dateTo) {
      query.startDate = {};
      if (dateFrom) query.startDate.$gte = new Date(dateFrom);
      if (dateTo) query.startDate.$lte = new Date(dateTo);
    }

    const leaves = await LeaveRequest.find(query)
      .populate('userId', 'name email department')
      .populate('approvedBy', 'name email')
      .sort('-createdAt');

    res.json({
      success: true,
      count: leaves.length,
      data: leaves
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get single leave request
// @route   GET /api/leaves/:id
// @access  Private
exports.getLeaveRequest = async (req, res) => {
  try {
    const leave = await LeaveRequest.findById(req.params.id)
      .populate('userId', 'name email department')
      .populate('approvedBy', 'name email');

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    // Check access rights
    if (req.user.role === 'employee' && leave.userId._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this leave request'
      });
    }

    if (req.user.role === 'supervisor') {
      const user = await User.findById(leave.userId);
      if (!req.user.departments.includes(user.department)) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this leave request'
        });
      }
    }

    res.json({
      success: true,
      data: leave
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create leave request
// @route   POST /api/leaves
// @access  Private
exports.createLeaveRequest = async (req, res) => {
  try {
    const { type, startDate, endDate, reason, days } = req.body;

    if (!type || !startDate || !endDate || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      return res.status(400).json({
        success: false,
        message: 'End date cannot be before start date'
      });
    }

    // Calculate days if not provided (fallback)
    let calculatedDays = days;
    if (!calculatedDays || calculatedDays <= 0) {
      const diffTime = Math.abs(end - start);
      calculatedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    // Check for overlapping leave requests
    const overlapping = await LeaveRequest.findOne({
      userId: req.user.id,
      status: { $in: ['pending', 'approved'] },
      $or: [
        { startDate: { $lte: end }, endDate: { $gte: start } }
      ]
    });

    if (overlapping) {
      return res.status(400).json({
        success: false,
        message: 'You already have a leave request for this period'
      });
    }

    const leave = await LeaveRequest.create({
      userId: req.user.id,
      type,
      startDate: start,
      endDate: end,
      reason,
      days: calculatedDays,
      status: 'pending'
    });

    await leave.populate('userId', 'name email department');

    res.status(201).json({
      success: true,
      data: leave
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update leave request
// @route   PUT /api/leaves/:id
// @access  Private
exports.updateLeaveRequest = async (req, res) => {
  try {
    const { type, startDate, endDate, reason, days } = req.body;

    let leave = await LeaveRequest.findById(req.params.id);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    // Only owner can update
    if (leave.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this leave request'
      });
    }

    // Can only update pending requests
    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update a leave request that has been processed'
      });
    }

    // Update fields
    if (type) leave.type = type;
    if (startDate) leave.startDate = new Date(startDate);
    if (endDate) leave.endDate = new Date(endDate);
    if (reason) leave.reason = reason;

    // Recalculate days if dates changed
    if (startDate || endDate) {
      const start = leave.startDate;
      const end = leave.endDate;
      const diffTime = Math.abs(end - start);
      leave.days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    } else if (days) {
      leave.days = days;
    }

    await leave.save();
    await leave.populate('userId', 'name email department');

    res.json({
      success: true,
      data: leave
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete leave request
// @route   DELETE /api/leaves/:id
// @access  Private
exports.deleteLeaveRequest = async (req, res) => {
  try {
    const leave = await LeaveRequest.findById(req.params.id);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    // Only owner can delete
    if (leave.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this leave request'
      });
    }

    // Can only delete pending requests
    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a leave request that has been processed'
      });
    }

    await leave.deleteOne();

    res.json({
      success: true,
      message: 'Leave request deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Approve/Reject leave request
// @route   PUT /api/leaves/:id/approve
// @access  Private (Admin, Supervisor)
exports.approveLeaveRequest = async (req, res) => {
  try {
    const { status, notes } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either approved or rejected'
      });
    }

    let leave = await LeaveRequest.findById(req.params.id);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    // Check department access for supervisors
    if (req.user.role === 'supervisor') {
      const user = await User.findById(leave.userId);
      if (!req.user.departments.includes(user.department)) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to approve this leave request'
        });
      }
    }

    // Can only approve/reject pending requests
    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This leave request has already been processed'
      });
    }

    leave.status = status;
    leave.approvedBy = req.user.id;
    leave.approvalDate = Date.now();
    leave.approvalNotes = notes || '';

    await leave.save();

    // Update user's leave balance if approved
    if (status === 'approved') {
      const user = await User.findById(leave.userId);
      if (user.leaveBalance >= leave.days) {
        user.leaveBalance -= leave.days;
        await user.save();
      }
    }

    await leave.populate('userId', 'name email department');
    await leave.populate('approvedBy', 'name email');

    res.json({
      success: true,
      data: leave
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Cancel leave request
// @route   PUT /api/leaves/:id/cancel
// @access  Private
exports.cancelLeaveRequest = async (req, res) => {
  try {
    let leave = await LeaveRequest.findById(req.params.id);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    // Only owner can cancel
    if (leave.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to cancel this leave request'
      });
    }

    // Can only cancel pending requests
    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Can only cancel pending leave requests'
      });
    }

    leave.status = 'cancelled';
    await leave.save();
    await leave.populate('userId', 'name email department');

    res.json({
      success: true,
      data: leave
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get leave statistics
// @route   GET /api/leaves/stats/summary
// @access  Private (Admin, Supervisor)
exports.getLeaveStats = async (req, res) => {
  try {
    const { dateFrom, dateTo, department } = req.query;

    let matchQuery = {};

    // Date range
    if (dateFrom || dateTo) {
      matchQuery.startDate = {};
      if (dateFrom) matchQuery.startDate.$gte = new Date(dateFrom);
      if (dateTo) matchQuery.startDate.$lte = new Date(dateTo);
    }

    // Department filter for supervisors
    if (req.user.role === 'supervisor') {
      const users = await User.find({
        department: { $in: req.user.departments }
      }).select('_id');
      matchQuery.userId = { $in: users.map(u => u._id) };
    } else if (department) {
      const users = await User.find({ department }).select('_id');
      matchQuery.userId = { $in: users.map(u => u._id) };
    }

    const stats = await LeaveRequest.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalDays: { $sum: '$days' }
        }
      }
    ]);

    const byType = await LeaveRequest.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalDays: { $sum: '$days' }
        }
      }
    ]);

    const totalRequests = await LeaveRequest.countDocuments(matchQuery);

    res.json({
      success: true,
      data: {
        total: totalRequests,
        byStatus: stats,
        byType
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get my leave balance
// @route   GET /api/leaves/my-balance
// @access  Private
exports.getMyLeaveBalance = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    // Get approved leaves
    const approvedLeaves = await LeaveRequest.find({
      userId: req.user.id,
      status: 'approved'
    });

    const usedDays = approvedLeaves.reduce((sum, leave) => sum + leave.days, 0);

    res.json({
      success: true,
      data: {
        totalBalance: user.leaveBalance,
        usedDays,
        remainingDays: user.leaveBalance
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

