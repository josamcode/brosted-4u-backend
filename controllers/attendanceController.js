const AttendanceLog = require('../models/AttendanceLog');
const AttendanceToken = require('../models/AttendanceToken');
const { generateQRToken, verifyQRToken } = require('../utils/tokenUtils');
const QRCode = require('qrcode');

// @desc    Generate QR code for attendance
// @route   GET /api/attendance/qr-code
// @access  Private (Admin, Supervisor)
exports.generateQRCode = async (req, res) => {
  try {
    // Generate token
    const { token, validFrom, validTo } = generateQRToken();

    // Save token to database
    await AttendanceToken.create({
      token,
      validFrom,
      validTo
    });

    // Generate QR code image
    const qrCodeDataURL = await QRCode.toDataURL(token, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      width: 300
    });

    res.json({
      success: true,
      data: {
        token,
        qrCode: qrCodeDataURL,
        validFrom,
        validTo
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Verify QR code and record attendance
// @route   POST /api/attendance/check-in
// @access  Private
exports.checkIn = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }

    // Verify token
    const isValid = verifyQRToken(token);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired QR code'
      });
    }

    // Check if token exists in database and is not expired
    const tokenDoc = await AttendanceToken.findOne({
      token,
      validTo: { $gte: new Date() }
    });

    if (!tokenDoc) {
      return res.status(400).json({
        success: false,
        message: 'QR code has expired or is invalid'
      });
    }

    // Check if user already checked in today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const existingCheckIn = await AttendanceLog.findOne({
      userId: req.user.id,
      type: 'checkin',
      timestamp: { $gte: today }
    });

    if (existingCheckIn) {
      return res.status(400).json({
        success: false,
        message: 'You have already checked in today'
      });
    }

    // Record attendance
    const attendance = await AttendanceLog.create({
      userId: req.user.id,
      type: 'checkin',
      timestamp: new Date(),
      method: 'qr',
      metadata: {
        token,
        ip: req.ip,
        device: req.headers['user-agent']
      }
    });

    await attendance.populate('userId', 'name email department');

    res.status(201).json({
      success: true,
      data: attendance,
      message: 'Checked in successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Check out
// @route   POST /api/attendance/check-out
// @access  Private
exports.checkOut = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }

    // Verify token
    const isValid = verifyQRToken(token);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired QR code'
      });
    }

    // Check if token exists
    const tokenDoc = await AttendanceToken.findOne({
      token,
      validTo: { $gte: new Date() }
    });

    if (!tokenDoc) {
      return res.status(400).json({
        success: false,
        message: 'QR code has expired or is invalid'
      });
    }

    // Check if user checked in today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const checkIn = await AttendanceLog.findOne({
      userId: req.user.id,
      type: 'checkin',
      timestamp: { $gte: today }
    });

    if (!checkIn) {
      return res.status(400).json({
        success: false,
        message: 'You must check in first'
      });
    }

    // Check if already checked out
    const existingCheckOut = await AttendanceLog.findOne({
      userId: req.user.id,
      type: 'checkout',
      timestamp: { $gte: today }
    });

    if (existingCheckOut) {
      return res.status(400).json({
        success: false,
        message: 'You have already checked out today'
      });
    }

    // Record checkout
    const attendance = await AttendanceLog.create({
      userId: req.user.id,
      type: 'checkout',
      timestamp: new Date(),
      method: 'qr',
      metadata: {
        token,
        ip: req.ip,
        device: req.headers['user-agent']
      }
    });

    await attendance.populate('userId', 'name email department');

    res.status(201).json({
      success: true,
      data: attendance,
      message: 'Checked out successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get attendance logs
// @route   GET /api/attendance/logs
// @access  Private
exports.getAttendanceLogs = async (req, res) => {
  try {
    const { userId, type, dateFrom, dateTo, department } = req.query;
    
    let query = {};

    // Role-based filtering
    if (req.user.role === 'employee') {
      query.userId = req.user.id;
    } else {
      if (userId) query.userId = userId;
      
      // Supervisors see only their departments
      if (req.user.role === 'supervisor' && department) {
        const users = await User.find({ 
          department: { $in: req.user.departments } 
        }).select('_id');
        query.userId = { $in: users.map(u => u._id) };
      }
    }

    if (type) query.type = type;
    
    // Date range
    if (dateFrom || dateTo) {
      query.timestamp = {};
      if (dateFrom) query.timestamp.$gte = new Date(dateFrom);
      if (dateTo) query.timestamp.$lte = new Date(dateTo);
    }

    const logs = await AttendanceLog.find(query)
      .populate('userId', 'name email department')
      .sort('-timestamp')
      .limit(100);

    res.json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get my attendance
// @route   GET /api/attendance/my-attendance
// @access  Private
exports.getMyAttendance = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    let query = { userId: req.user.id };
    
    // Date range (default to last 30 days)
    const endDate = dateTo ? new Date(dateTo) : new Date();
    const startDate = dateFrom ? new Date(dateFrom) : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    query.timestamp = {
      $gte: startDate,
      $lte: endDate
    };

    const logs = await AttendanceLog.find(query)
      .sort('-timestamp');

    // Group by date
    const groupedByDate = {};
    logs.forEach(log => {
      const date = log.timestamp.toISOString().split('T')[0];
      if (!groupedByDate[date]) {
        groupedByDate[date] = { date, checkin: null, checkout: null };
      }
      if (log.type === 'checkin') {
        groupedByDate[date].checkin = log;
      } else {
        groupedByDate[date].checkout = log;
      }
    });

    res.json({
      success: true,
      data: Object.values(groupedByDate).sort((a, b) => new Date(b.date) - new Date(a.date))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get attendance statistics
// @route   GET /api/attendance/stats
// @access  Private (Admin, Supervisor)
exports.getAttendanceStats = async (req, res) => {
  try {
    const { dateFrom, dateTo, department } = req.query;
    
    let matchQuery = {};
    
    // Date range (default to today)
    if (dateFrom || dateTo) {
      matchQuery.timestamp = {};
      if (dateFrom) matchQuery.timestamp.$gte = new Date(dateFrom);
      if (dateTo) matchQuery.timestamp.$lte = new Date(dateTo);
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      matchQuery.timestamp = { $gte: today };
    }

    // Get today's attendance
    const todayLogs = await AttendanceLog.find(matchQuery)
      .populate('userId', 'name email department');

    // Calculate present/absent
    const User = require('../models/User');
    let userQuery = { isActive: true, role: 'employee' };
    
    if (department) {
      userQuery.department = department;
    } else if (req.user.role === 'supervisor') {
      userQuery.department = { $in: req.user.departments };
    }

    const allEmployees = await User.find(userQuery).select('name email department');
    
    const checkedInUsers = new Set(
      todayLogs
        .filter(log => log.type === 'checkin')
        .map(log => log.userId._id.toString())
    );

    const present = allEmployees.filter(emp => checkedInUsers.has(emp._id.toString()));
    const absent = allEmployees.filter(emp => !checkedInUsers.has(emp._id.toString()));

    res.json({
      success: true,
      data: {
        total: allEmployees.length,
        present: present.length,
        absent: absent.length,
        presentEmployees: present,
        absentEmployees: absent
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Manual attendance entry
// @route   POST /api/attendance/manual
// @access  Private (Admin, Supervisor)
exports.manualAttendance = async (req, res) => {
  try {
    const { userId, type, timestamp, notes } = req.body;

    if (!userId || !type) {
      return res.status(400).json({
        success: false,
        message: 'User ID and type are required'
      });
    }

    const User = require('../models/User');
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check department access for supervisors
    if (req.user.role === 'supervisor' && !req.user.departments.includes(user.department)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to manage this user\'s attendance'
      });
    }

    const attendance = await AttendanceLog.create({
      userId,
      type,
      timestamp: timestamp || new Date(),
      method: 'manual',
      notes,
      metadata: {
        addedBy: req.user.id,
        ip: req.ip
      }
    });

    await attendance.populate('userId', 'name email department');

    res.status(201).json({
      success: true,
      data: attendance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

