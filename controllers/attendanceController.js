const AttendanceToken = require('../models/AttendanceToken');
const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');
const { createNotification } = require('../utils/notifications');
const { checkAbsentUsers } = require('../utils/checkAbsentUsers');

// Auto-generate QR code (called by cron job or manually by admin)
exports.generateQRCode = async (req, res) => {
  try {
    // Get next sequence number
    const sequenceNumber = await AttendanceToken.getNextSequence();

    // Generate unique token
    const token = AttendanceToken.generateToken();

    // Set validity from environment variable (default: 30 seconds)
    const validitySeconds = parseInt(process.env.QR_TOKEN_VALIDITY_SECONDS) || 30;
    const validityMs = validitySeconds * 1000;
    const validFrom = new Date();
    const validTo = new Date(validFrom.getTime() + validityMs);

    console.log(`🔑 Generating QR with validity: ${validitySeconds} seconds (validFrom: ${validFrom.toISOString()}, validTo: ${validTo.toISOString()})`);

    // Create new QR token
    const qrToken = await AttendanceToken.create({
      token,
      validFrom,
      validTo,
      status: 'active',
      sequenceNumber,
      createdBy: req.user?.id
    });

    // Expire all previous active tokens
    await AttendanceToken.updateMany(
      {
        _id: { $ne: qrToken._id },
        status: 'active'
      },
      { status: 'expired' }
    );

    // Cleanup: Keep only last 10 QR codes
    const tokensToKeep = await AttendanceToken.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('_id');

    const idsToKeep = tokensToKeep.map(t => t._id);

    await AttendanceToken.deleteMany({
      _id: { $nin: idsToKeep }
    });

    console.log(`✅ Generated QR #${sequenceNumber}, cleaned old tokens`);

    res.json({
      success: true,
      data: {
        token: qrToken.token,
        validFrom: qrToken.validFrom,
        validTo: qrToken.validTo,
        sequenceNumber: qrToken.sequenceNumber,
        usageCount: qrToken.usageCount || 0,
        expiresIn: validitySeconds // seconds
      }
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get current active QR code (admin only)
exports.getCurrentQR = async (req, res) => {
  try {
    const currentQR = await AttendanceToken.findOne({
      status: 'active',
      validTo: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    if (!currentQR) {
      return res.status(404).json({
        success: false,
        message: 'No active QR code found'
      });
    }

    // Check if expired
    if (!currentQR.isValid()) {
      await currentQR.expire();
      return res.status(404).json({
        success: false,
        message: 'QR code has expired'
      });
    }

    const now = new Date();
    const expiresIn = Math.max(0, Math.floor((currentQR.validTo - now) / 1000));

    res.json({
      success: true,
      data: {
        token: currentQR.token,
        validFrom: currentQR.validFrom,
        validTo: currentQR.validTo,
        sequenceNumber: currentQR.sequenceNumber,
        expiresIn,
        usageCount: currentQR.usageCount
      }
    });
  } catch (error) {
    console.error('Error getting current QR:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Validate QR token (public endpoint - for checking if QR is valid)
exports.validateQRToken = async (req, res) => {
  try {
    const { token } = req.params;

    const qrToken = await AttendanceToken.findOne({ token });

    if (!qrToken) {
      return res.status(404).json({
        success: false,
        message: 'Invalid QR code'
      });
    }

    // Check if valid
    if (!qrToken.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'QR code has expired or is no longer active'
      });
    }

    const now = new Date();
    const expiresIn = Math.max(0, Math.floor((qrToken.validTo - now) / 1000));

    res.json({
      success: true,
      data: {
        valid: true,
        expiresIn,
        sequenceNumber: qrToken.sequenceNumber
      }
    });
  } catch (error) {
    console.error('Error validating QR token:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Record attendance (check-in or check-out)
exports.recordAttendance = async (req, res) => {
  try {
    const { token, type } = req.body; // type: 'checkin' or 'checkout'

    // Validate required fields
    if (!token || !type) {
      return res.status(400).json({
        success: false,
        message: 'Token and type are required'
      });
    }

    if (!['checkin', 'checkout'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Type must be either checkin or checkout'
      });
    }

    // Find and validate QR token
    const qrToken = await AttendanceToken.findOne({ token });

    if (!qrToken) {
      return res.status(404).json({
        success: false,
        message: 'Invalid QR code'
      });
    }

    // Check if valid
    if (!qrToken.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'QR code has expired or is no longer active'
      });
    }

    // Check today's attendance status (using UTC to avoid timezone issues)
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

    // Check if user already has attendance records for today
    const todayAttendance = await AttendanceLog.find({
      userId: req.user.id,
      timestamp: {
        $gte: todayStart,
        $lte: todayEnd
      }
    }).sort({ timestamp: 1 });

    // Check for existing check-in today
    const hasCheckInToday = todayAttendance.some(log => log.type === 'checkin');
    // Check for existing check-out today
    const hasCheckOutToday = todayAttendance.some(log => log.type === 'checkout');

    // Validation rules
    if (type === 'checkin') {
      if (hasCheckInToday) {
        return res.status(400).json({
          success: false,
          message: 'You have already checked in today'
        });
      }
    } else if (type === 'checkout') {
      if (!hasCheckInToday) {
        return res.status(400).json({
          success: false,
          message: 'You must check in before checking out'
        });
      }
      if (hasCheckOutToday) {
        return res.status(400).json({
          success: false,
          message: 'You have already checked out today'
        });
      }
    }

    // Get request metadata
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    // Create attendance log
    const attendanceLog = await AttendanceLog.create({
      userId: req.user.id,
      type,
      timestamp: new Date(),
      method: 'qr',
      tokenId: qrToken._id,
      metadata: {
        ip,
        userAgent,
        qrSequence: qrToken.sequenceNumber
      }
    });

    // Mark QR as used (increment usage count)
    await qrToken.markAsUsed();

    // Populate user info
    await attendanceLog.populate('userId', 'name email department');

    // Check for late arrival on check-in
    if (type === 'checkin') {
      const user = await User.findById(req.user.id).select('workDays workSchedule');
      if (user && user.workDays && user.workDays.length > 0) {
        const today = new Date();
        const dayName = today.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

        if (user.workDays.includes(dayName) && user.workSchedule && user.workSchedule[dayName]) {
          const expectedStartTime = user.workSchedule[dayName].startTime;
          if (expectedStartTime) {
            const [expectedHours, expectedMinutes] = expectedStartTime.split(':').map(Number);
            const expectedTime = new Date(today);
            expectedTime.setHours(expectedHours, expectedMinutes, 0, 0);

            const checkinTime = new Date(attendanceLog.timestamp);
            if (checkinTime > expectedTime) {
              const lateMinutes = Math.floor((checkinTime - expectedTime) / (1000 * 60));

              await createNotification({
                type: 'user_late',
                title: {
                  en: 'Employee Late Arrival',
                  ar: 'تأخر موظف'
                },
                message: {
                  en: `${req.user.name} arrived ${lateMinutes} minute(s) late`,
                  ar: `${req.user.name} وصل متأخراً ${lateMinutes} دقيقة`
                },
                data: {
                  userId: req.user.id,
                  attendanceLogId: attendanceLog._id,
                  lateMinutes: lateMinutes,
                  expectedTime: expectedStartTime,
                  actualTime: checkinTime.toISOString()
                }
              });
            }
          }
        }
      }
    }

    res.json({
      success: true,
      message: type === 'checkin' ? 'Checked in successfully' : 'Checked out successfully',
      data: attendanceLog
    });
  } catch (error) {
    console.error('Error recording attendance:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get my attendance logs
exports.getMyAttendance = async (req, res) => {
  try {
    const { startDate, endDate, limit = 30 } = req.query;

    const query = { userId: req.user.id };

    // Default to last 30 days if no date range specified
    if (!startDate && !endDate) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query.timestamp = { $gte: thirtyDaysAgo };
    } else if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const logs = await AttendanceLog.find(query)
      .sort({ timestamp: -1 })
      .populate('tokenId', 'sequenceNumber')
      .populate('userId', 'name email department');

    // Group logs by date (use UTC to avoid timezone issues)
    const groupedByDate = {};
    logs.forEach(log => {
      // Use UTC date to avoid timezone shifts
      const logDate = new Date(log.timestamp);
      const year = logDate.getUTCFullYear();
      const month = String(logDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(logDate.getUTCDate()).padStart(2, '0');
      const date = `${year}-${month}-${day}`; // YYYY-MM-DD format

      if (!groupedByDate[date]) {
        groupedByDate[date] = {
          date,
          checkin: null,
          checkout: null
        };
      }

      if (log.type === 'checkin') {
        // Keep the earliest check-in of the day
        if (!groupedByDate[date].checkin || new Date(log.timestamp) < new Date(groupedByDate[date].checkin.timestamp)) {
          groupedByDate[date].checkin = log;
        }
      } else if (log.type === 'checkout') {
        // Keep the latest check-out of the day
        if (!groupedByDate[date].checkout || new Date(log.timestamp) > new Date(groupedByDate[date].checkout.timestamp)) {
          groupedByDate[date].checkout = log;
        }
      }
    });

    // Convert to array and sort by date descending
    const formattedLogs = Object.values(groupedByDate)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      count: formattedLogs.length,
      data: formattedLogs
    });
  } catch (error) {
    console.error('Error fetching attendance logs:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get attendance stats (admin/supervisor)
exports.getAttendanceStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's stats
    const todayLogs = await AttendanceLog.countDocuments({
      timestamp: { $gte: today, $lt: tomorrow }
    });

    const todayCheckins = await AttendanceLog.countDocuments({
      type: 'checkin',
      timestamp: { $gte: today, $lt: tomorrow }
    });

    const todayCheckouts = await AttendanceLog.countDocuments({
      type: 'checkout',
      timestamp: { $gte: today, $lt: tomorrow }
    });

    // Get unique users today
    const uniqueUsers = await AttendanceLog.distinct('userId', {
      timestamp: { $gte: today, $lt: tomorrow }
    });

    // Get active QR stats
    const activeQRCount = await AttendanceToken.countDocuments({
      status: 'active'
    });

    const totalQRs = await AttendanceToken.countDocuments();

    res.json({
      success: true,
      data: {
        today: {
          totalLogs: todayLogs,
          checkins: todayCheckins,
          checkouts: todayCheckouts,
          uniqueUsers: uniqueUsers.length
        },
        qr: {
          active: activeQRCount,
          total: totalQRs
        }
      }
    });
  } catch (error) {
    console.error('Error fetching attendance stats:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all attendance logs (admin/supervisor/employee - employees can only see their own)
exports.getAllAttendance = async (req, res) => {
  try {
    const { startDate, endDate, userId, type, limit = 100, page = 1 } = req.query;

    const query = {};

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    // Employees can only access their own attendance
    if (req.user.role === 'employee') {
      query.userId = req.user.id;
    } else if (userId) {
      query.userId = userId;
    }

    if (type) query.type = type;

    // Check department access for supervisors
    if (req.user.role === 'supervisor') {
      const User = require('../models/User');
      const departmentUsers = await User.find({
        department: { $in: req.user.departments || [] }
      }).select('_id');

      query.userId = {
        $in: departmentUsers.map(u => u._id)
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const logs = await AttendanceLog.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .populate('userId', 'name email department')
      .populate('tokenId', 'sequenceNumber');

    const total = await AttendanceLog.countDocuments(query);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching all attendance:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all attendance grouped by date (for admin dashboard)
exports.getAllAttendanceGrouped = async (req, res) => {
  try {
    const { startDate, endDate, userId, limit = 30 } = req.query;

    const query = {};

    // Filter by userId if provided
    if (userId) {
      query.userId = userId;
    }

    // Default to last 30 days if no date range provided
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    } else {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query.timestamp = { $gte: thirtyDaysAgo };
    }

    // Employees can only access their own attendance
    if (req.user.role === 'employee') {
      // If userId is provided and it's not the employee's own ID, deny access
      if (userId && userId !== req.user.id && userId !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      // Force userId to be the employee's own ID
      query.userId = req.user.id;
    } else if (req.user.role === 'supervisor') {
      // Check department access for supervisors
      const User = require('../models/User');
      const departmentUsers = await User.find({
        department: { $in: req.user.departments || [] }
      }).select('_id');

      // If userId is provided, check if user is in supervisor's departments
      if (userId) {
        const userInDepartment = departmentUsers.some(u => u._id.toString() === userId);
        if (!userInDepartment) {
          return res.status(403).json({
            success: false,
            message: 'Access denied'
          });
        }
      } else {
        query.userId = {
          $in: departmentUsers.map(u => u._id)
        };
      }
    }

    const logs = await AttendanceLog.find(query)
      .sort({ timestamp: -1 })
      .populate('tokenId', 'sequenceNumber')
      .populate({
        path: 'userId',
        select: 'name email department',
        match: { _id: { $exists: true } } // Only populate if user exists
      });

    // Filter out logs where userId population failed (user might be deleted)
    const validLogs = logs.filter(log => log.userId && log.userId._id);

    // Group by date AND userId (use UTC to avoid timezone issues)
    const groupedByDateAndUser = {};
    validLogs.forEach(log => {

      // Use UTC date to avoid timezone shifts
      const logDate = new Date(log.timestamp);
      const year = logDate.getUTCFullYear();
      const month = String(logDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(logDate.getUTCDate()).padStart(2, '0');
      const date = `${year}-${month}-${day}`; // YYYY-MM-DD format

      // Create unique key for date + userId combination
      // Handle both populated (object) and unpopulated (ObjectId) userId
      const userId = log.userId._id
        ? log.userId._id.toString()
        : (log.userId.toString ? log.userId.toString() : String(log.userId));
      const key = `${date}_${userId}`;

      if (!groupedByDateAndUser[key]) {
        groupedByDateAndUser[key] = {
          date,
          userId: log.userId,
          checkin: null,
          checkout: null
        };
      }

      if (log.type === 'checkin') {
        // Keep earliest check-in for this user on this date
        if (!groupedByDateAndUser[key].checkin || new Date(log.timestamp) < new Date(groupedByDateAndUser[key].checkin.timestamp)) {
          groupedByDateAndUser[key].checkin = log;
        }
      } else if (log.type === 'checkout') {
        // Keep latest check-out for this user on this date
        if (!groupedByDateAndUser[key].checkout || new Date(log.timestamp) > new Date(groupedByDateAndUser[key].checkout.timestamp)) {
          groupedByDateAndUser[key].checkout = log;
        }
      }
    });

    // Convert to array and sort by date (newest first), then by userId
    const formattedLogs = Object.values(groupedByDateAndUser)
      .sort((a, b) => {
        const dateCompare = new Date(b.date) - new Date(a.date);
        if (dateCompare !== 0) return dateCompare;
        // If same date, sort by user name
        const nameA = a.userId?.name || '';
        const nameB = b.userId?.name || '';
        return nameA.localeCompare(nameB);
      })
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      count: formattedLogs.length,
      data: formattedLogs
    });
  } catch (error) {
    console.error('Error fetching grouped attendance:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Check for absent users (can be called manually or by cron)
exports.checkAbsentUsers = async (req, res) => {
  try {
    await checkAbsentUsers();
    res.json({
      success: true,
      message: 'Absent users check completed'
    });
  } catch (error) {
    console.error('Error checking absent users:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Cleanup expired QR codes (can be called manually or by cron)
exports.cleanupExpiredQRs = async (req, res) => {
  try {
    // Mark expired tokens
    await AttendanceToken.updateMany(
      {
        status: 'active',
        validTo: { $lt: new Date() }
      },
      { status: 'expired' }
    );

    // Keep only last 10 QR codes
    const tokensToKeep = await AttendanceToken.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('_id');

    const idsToKeep = tokensToKeep.map(t => t._id);

    const deleteResult = await AttendanceToken.deleteMany({
      _id: { $nin: idsToKeep }
    });

    res.json({
      success: true,
      message: 'Cleanup completed',
      data: {
        deleted: deleteResult.deletedCount,
        kept: tokensToKeep.length
      }
    });
  } catch (error) {
    console.error('Error cleaning up QR codes:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
