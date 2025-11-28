const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Notification = require('../models/Notification');
const User = require('../models/User');

// Load environment variables
dotenv.config();

// Connect to database
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/brosted4u', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
};

// Create test notifications
const createTestNotifications = async () => {
  try {
    console.log('🚀 Starting to create test notifications...\n');

    // Find all admin users
    const adminUsers = await User.find({ role: 'admin', isActive: true });

    if (adminUsers.length === 0) {
      console.log('❌ No admin users found. Please create an admin user first.');
      process.exit(1);
    }

    console.log(`📋 Found ${adminUsers.length} admin user(s)\n`);

    // Sample notifications data with bilingual support
    const notificationsData = [
      // Form notifications
      {
        type: 'form_submitted',
        title: {
          en: 'New Form Submitted',
          ar: 'تم إرسال نموذج جديد'
        },
        message: {
          en: 'John Doe submitted a new form: Daily Report',
          ar: 'جون دو أرسل نموذجاً جديداً: التقرير اليومي'
        },
        data: {
          formId: new mongoose.Types.ObjectId(),
          templateId: new mongoose.Types.ObjectId(),
          filledBy: new mongoose.Types.ObjectId(),
          department: 'kitchen'
        },
        read: false
      },
      {
        type: 'form_approved',
        title: {
          en: 'Form Approved',
          ar: 'تم الموافقة على النموذج'
        },
        message: {
          en: 'Form "Wastage/Damage Sheet" filled by Jane Smith has been approved',
          ar: 'تم الموافقة على النموذج "ورقة الهالك/الضرر" الذي ملأته جين سميث'
        },
        data: {
          formId: new mongoose.Types.ObjectId(),
          templateId: new mongoose.Types.ObjectId(),
          filledBy: new mongoose.Types.ObjectId(),
          approvedBy: new mongoose.Types.ObjectId(),
          status: 'approved'
        },
        read: false
      },
      {
        type: 'form_rejected',
        title: {
          en: 'Form Rejected',
          ar: 'تم رفض النموذج'
        },
        message: {
          en: 'Form "Oil Change Log" filled by Mike Johnson has been rejected',
          ar: 'تم رفض النموذج "سجل تغيير الزيت" الذي ملأه مايك جونسون'
        },
        data: {
          formId: new mongoose.Types.ObjectId(),
          templateId: new mongoose.Types.ObjectId(),
          filledBy: new mongoose.Types.ObjectId(),
          approvedBy: new mongoose.Types.ObjectId(),
          status: 'rejected'
        },
        read: true
      },

      // Attendance notifications
      {
        type: 'user_late',
        title: {
          en: 'Employee Late Arrival',
          ar: 'تأخر موظف'
        },
        message: {
          en: 'Sarah Williams arrived 15 minutes late',
          ar: 'سارة ويليامز وصلت متأخرة 15 دقيقة'
        },
        data: {
          userId: new mongoose.Types.ObjectId(),
          attendanceLogId: new mongoose.Types.ObjectId(),
          lateMinutes: 15,
          expectedTime: '09:00',
          actualTime: new Date().toISOString()
        },
        read: false
      },
      {
        type: 'user_absent',
        title: {
          en: 'Employee Absent',
          ar: 'غياب موظف'
        },
        message: {
          en: 'Tom Brown did not check in today',
          ar: 'توم براون لم يسجل الحضور اليوم'
        },
        data: {
          userId: new mongoose.Types.ObjectId(),
          date: new Date().toISOString(),
          department: 'delivery'
        },
        read: false
      },

      // Leave notifications
      {
        type: 'leave_requested',
        title: {
          en: 'New Leave Request',
          ar: 'طلب إجازة جديد'
        },
        message: {
          en: 'Emily Davis requested 3 day(s) of Vacation leave',
          ar: 'إيميلي ديفيس طلبت 3 أيام من إجازة عادية'
        },
        data: {
          leaveId: new mongoose.Types.ObjectId(),
          userId: new mongoose.Types.ObjectId(),
          type: 'vacation',
          days: 3,
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
        },
        read: false
      },
      {
        type: 'leave_approved',
        title: {
          en: 'Leave Request Approved',
          ar: 'تم الموافقة على طلب الإجازة'
        },
        message: {
          en: 'Leave request from Robert Wilson (2 day(s) Sick) has been approved',
          ar: 'تم الموافقة على طلب إجازة من روبرت ويلسون (يومان إجازة مرضية)'
        },
        data: {
          leaveId: new mongoose.Types.ObjectId(),
          userId: new mongoose.Types.ObjectId(),
          approvedBy: new mongoose.Types.ObjectId(),
          type: 'sick',
          days: 2,
          status: 'approved'
        },
        read: true
      },
      {
        type: 'leave_rejected',
        title: {
          en: 'Leave Request Rejected',
          ar: 'تم رفض طلب الإجازة'
        },
        message: {
          en: 'Leave request from Lisa Anderson (5 day(s) Vacation) has been rejected',
          ar: 'تم رفض طلب إجازة من ليزا أندرسون (5 أيام إجازة عادية)'
        },
        data: {
          leaveId: new mongoose.Types.ObjectId(),
          userId: new mongoose.Types.ObjectId(),
          approvedBy: new mongoose.Types.ObjectId(),
          type: 'vacation',
          days: 5,
          status: 'rejected'
        },
        read: false
      },

      // User notifications
      {
        type: 'user_created',
        title: {
          en: 'New User Created',
          ar: 'تم إنشاء مستخدم جديد'
        },
        message: {
          en: 'New user "David Martinez" has been created with role: Employee',
          ar: 'تم إنشاء مستخدم جديد "ديفيد مارتينيز" بدور: موظف'
        },
        data: {
          userId: new mongoose.Types.ObjectId(),
          name: 'David Martinez',
          email: 'david.martinez@example.com',
          role: 'employee',
          department: 'counter'
        },
        read: false
      },

      // System notifications
      {
        type: 'system_alert',
        title: {
          en: 'System Alert',
          ar: 'تنبيه النظام'
        },
        message: {
          en: 'High number of pending forms detected. Please review.',
          ar: 'تم اكتشاف عدد كبير من النماذج المعلقة. يرجى المراجعة.'
        },
        data: {
          alertType: 'pending_forms',
          count: 12
        },
        read: false
      }
    ];

    // Create notifications for each admin user
    const createdNotifications = [];

    for (const admin of adminUsers) {
      console.log(`📝 Creating notifications for admin: ${admin.name} (${admin.email})`);

      for (const notificationData of notificationsData) {
        // Add some time variation to notifications (spread over last 2 days)
        const hoursAgo = Math.floor(Math.random() * 48); // 0-48 hours ago
        const createdAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

        const notification = await Notification.create({
          recipient: admin._id,
          ...notificationData,
          createdAt,
          updatedAt: createdAt
        });

        createdNotifications.push(notification);
      }
    }

    console.log(`\n✅ Successfully created ${createdNotifications.length} test notifications!`);
    console.log(`\n📊 Summary:`);
    console.log(`   - Admins: ${adminUsers.length}`);
    console.log(`   - Notifications per admin: ${notificationsData.length}`);
    console.log(`   - Total notifications: ${createdNotifications.length}`);

    // Count by type
    const typeCount = {};
    notificationsData.forEach(n => {
      typeCount[n.type] = (typeCount[n.type] || 0) + adminUsers.length;
    });

    console.log(`\n📈 Notifications by type:`);
    Object.entries(typeCount).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count}`);
    });

    // Count read vs unread
    const readCount = createdNotifications.filter(n => n.read).length;
    const unreadCount = createdNotifications.filter(n => !n.read).length;

    console.log(`\n📬 Read status:`);
    console.log(`   - Read: ${readCount}`);
    console.log(`   - Unread: ${unreadCount}`);

    console.log(`\n✨ Test notifications created successfully!`);
    console.log(`\n💡 You can now test the notifications system in the frontend.`);

  } catch (error) {
    console.error('❌ Error creating test notifications:', error);
    throw error;
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    await createTestNotifications();
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
};

// Run the script
if (require.main === module) {
  main();
}

module.exports = { createTestNotifications };

