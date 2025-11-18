const AttendanceToken = require('../models/AttendanceToken');
const AttendanceLog = require('../models/AttendanceLog');

// Auto-generate QR code (called by cron job or manually by admin)
exports.generateQRCode = async (req, res) => {
  try {
    // Get next sequence number
    const sequenceNumber = await AttendanceToken.getNextSequence();

    // Generate unique token
    const token = AttendanceToken.generateToken();

    // Set validity: 1 minute from now
    const validFrom = new Date();
    const validTo = new Date(validFrom.getTime() + 60 * 1000); // 1 minute

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
        expiresIn: 60 // seconds
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

    // Group logs by date
    const groupedByDate = {};
    logs.forEach(log => {
      const date = new Date(log.timestamp).toLocaleDateString('en-CA'); // YYYY-MM-DD format

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

// Get all attendance logs (admin/supervisor)
exports.getAllAttendance = async (req, res) => {
  try {
    const { startDate, endDate, userId, type, limit = 100, page = 1 } = req.query;

    const query = {};

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    if (userId) query.userId = userId;
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
