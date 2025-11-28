const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');
const { createNotification } = require('./notifications');

/**
 * Check for absent users at the end of the day
 * This should be called daily (e.g., via cron job at end of day)
 */
const checkAbsentUsers = async () => {
  try {
    const today = new Date();
    const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0));
    const todayEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999));

    // Get all active users
    const activeUsers = await User.find({ isActive: true }).select('_id name email department workDays workSchedule');

    // Get all check-ins for today
    const todayCheckins = await AttendanceLog.find({
      type: 'checkin',
      timestamp: {
        $gte: todayStart,
        $lte: todayEnd
      }
    }).select('userId');

    const checkedInUserIds = new Set(todayCheckins.map(log => log.userId.toString()));

    // Check each user
    for (const user of activeUsers) {
      if (!user.workDays || user.workDays.length === 0) {
        continue; // Skip users without work days
      }

      const dayName = today.toLocaleDateString('en-US', { weekday: 'lowercase' });

      // Check if today is a work day for this user
      if (!user.workDays.includes(dayName)) {
        continue; // Not a work day, skip
      }

      // Check if user checked in today
      if (!checkedInUserIds.has(user._id.toString())) {
        // User is absent
        await createNotification({
          type: 'user_absent',
          title: {
            en: 'Employee Absent',
            ar: 'غياب موظف'
          },
          message: {
            en: `${user.name} did not check in today`,
            ar: `${user.name} لم يسجل الحضور اليوم`
          },
          data: {
            userId: user._id,
            date: today.toISOString(),
            department: user.department
          }
        });
      }
    }

    console.log('✅ Absent users check completed');
  } catch (error) {
    console.error('Error checking absent users:', error);
  }
};

module.exports = {
  checkAbsentUsers
};

