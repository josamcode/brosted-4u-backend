require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const ADMIN_EMAIL = 'admin@brosted4u.com';

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');

    const adminData = {
      name: 'Admin',
      email: ADMIN_EMAIL,
      password: 'Brosted4u@123',
      phone: '+1234567890',
      role: 'admin',
      department: 'management',
      languagePreference: 'ar',
      isActive: true,
      leaveBalance: 30
    };

    const user = await User.findOneAndUpdate(
      { email: ADMIN_EMAIL },
      { $set: adminData },
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    );

    console.log('✅  admin account updated/created successfully');
    console.log(`Email: ${user.email}`);
  } catch (error) {
    console.error('❌ Error updating admin:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

run();