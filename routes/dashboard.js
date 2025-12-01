const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const FormInstance = require('../models/FormInstance');
const LeaveRequest = require('../models/LeaveRequest');
const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');

// @desc    Get dashboard summary
// @route   GET /api/dashboard/summary
// @access  Private
router.get('/summary', protect, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay());

    // Employee-specific data
    if (req.user.role === 'employee') {
      // Get user's leave balance
      const user = await User.findById(req.user.id).select('leaveBalance');

      // Get user's attendance for today
      const todayCheckin = await AttendanceLog.findOne({
        userId: req.user.id,
        type: 'checkin',
        timestamp: { $gte: today }
      });

      const todayCheckout = await AttendanceLog.findOne({
        userId: req.user.id,
        type: 'checkout',
        timestamp: { $gte: today }
      });

      // Get user's leave requests
      const myPendingLeaves = await LeaveRequest.countDocuments({
        userId: req.user.id,
        status: 'pending'
      });

      const myApprovedLeaves = await LeaveRequest.countDocuments({
        userId: req.user.id,
        status: 'approved'
      });

      const myRejectedLeaves = await LeaveRequest.countDocuments({
        userId: req.user.id,
        status: 'rejected'
      });

      // Get this month's attendance count
      const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const thisMonthAttendance = await AttendanceLog.distinct('timestamp', {
        userId: req.user.id,
        type: 'checkin',
        timestamp: { $gte: thisMonthStart }
      });

      // Get upcoming approved leaves
      const upcomingLeaves = await LeaveRequest.countDocuments({
        userId: req.user.id,
        status: 'approved',
        startDate: { $gte: today }
      });

      return res.json({
        success: true,
        data: {
          attendance: {
            today: todayCheckin ? 1 : 0,
            checkedIn: !!todayCheckin,
            checkedOut: !!todayCheckout,
            thisMonth: thisMonthAttendance.length
          },
          leaves: {
            balance: user?.leaveBalance || 0,
            pending: myPendingLeaves,
            approved: myApprovedLeaves,
            rejected: myRejectedLeaves,
            upcoming: upcomingLeaves
          }
        }
      });
    }

    // Admin/Supervisor data
    let query = {};

    // Department filter for supervisors
    if (req.user.role === 'supervisor') {
      query.department = { $in: req.user.departments };
    }

    // Forms statistics
    const todayForms = await FormInstance.countDocuments({
      ...query,
      date: { $gte: today }
    });

    const thisWeekForms = await FormInstance.countDocuments({
      ...query,
      date: { $gte: thisWeekStart }
    });

    const pendingApprovals = await FormInstance.countDocuments({
      ...query,
      status: 'submitted'
    });

    // Attendance statistics
    let attendanceQuery = {};
    if (req.user.role === 'supervisor') {
      const users = await User.find({
        department: { $in: req.user.departments }
      }).select('_id');
      attendanceQuery.userId = { $in: users.map(u => u._id) };
    }

    const todayAttendance = await AttendanceLog.countDocuments({
      ...attendanceQuery,
      type: 'checkin',
      timestamp: { $gte: today }
    });

    // Leave requests
    let leaveQuery = {};
    if (req.user.role === 'supervisor') {
      const users = await User.find({
        department: { $in: req.user.departments }
      }).select('_id');
      leaveQuery.userId = { $in: users.map(u => u._id) };
    }

    const pendingLeaves = await LeaveRequest.countDocuments({
      ...leaveQuery,
      status: 'pending'
    });

    const upcomingLeaves = await LeaveRequest.countDocuments({
      ...leaveQuery,
      status: 'approved',
      startDate: { $gte: today, $lte: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) }
    });

    // Total users
    let userQuery = { isActive: true };
    if (req.user.role === 'supervisor') {
      userQuery.department = { $in: req.user.departments };
    }
    const totalUsers = await User.countDocuments(userQuery);

    // Recent forms
    const recentForms = await FormInstance.find(query)
      .populate('templateId', 'title')
      .populate('filledBy', 'name department')
      .sort('-createdAt')
      .limit(5);

    res.json({
      success: true,
      data: {
        forms: {
          today: todayForms,
          thisWeek: thisWeekForms,
          pendingApprovals
        },
        attendance: {
          today: todayAttendance
        },
        leaves: {
          pending: pendingLeaves,
          upcoming: upcomingLeaves
        },
        users: {
          total: totalUsers
        },
        recentForms
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;

