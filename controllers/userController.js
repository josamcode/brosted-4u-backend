const User = require('../models/User');

// @desc    Get all users
// @route   GET /api/users
// @access  Private (Admin, Supervisor)
exports.getUsers = async (req, res) => {
  try {
    const { role, department, isActive, search } = req.query;

    let query = {};

    // Apply filters
    if (role) query.role = role;
    if (department) query.department = department;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    // Search by name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Supervisors can only see users in their departments
    if (req.user.role === 'supervisor') {
      query.department = { $in: req.user.departments };
    }

    const users = await User.find(query).select('-password -refreshToken');

    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private (Admin, Supervisor)
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -refreshToken');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Supervisors can only see users in their departments
    if (req.user.role === 'supervisor') {
      if (!req.user.departments.includes(user.department)) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this user'
        });
      }
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create user
// @route   POST /api/users
// @access  Private (Admin only)
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, phone, role, department, departments, languagePreference, leaveBalance, workDays, workSchedule, nationality, idNumber } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Handle image upload
    const imagePath = req.file ? `/uploads/${req.file.filename}` : undefined;

    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: role || 'employee',
      department: department || 'other',
      departments: departments || [],
      languagePreference: languagePreference || 'en',
      leaveBalance: leaveBalance || 0,
      workDays: workDays || [],
      workSchedule: workSchedule || {},
      nationality: nationality || undefined,
      idNumber: idNumber || undefined,
      image: imagePath
    });

    res.status(201).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Admin only)
exports.updateUser = async (req, res) => {
  try {
    const { name, email, phone, role, department, departments, languagePreference, isActive, leaveBalance, workDays, workSchedule, nationality, idNumber } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Handle image upload
    if (req.file) {
      // Delete old image if exists
      if (user.image) {
        const fs = require('fs');
        const path = require('path');
        const oldImagePath = path.join(process.env.UPLOAD_DIR || './uploads', path.basename(user.image));
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      user.image = `/uploads/${req.file.filename}`;
    }

    // Update fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (role) user.role = role;
    if (department) user.department = department;
    if (departments) user.departments = departments;
    if (languagePreference) user.languagePreference = languagePreference;
    if (isActive !== undefined) user.isActive = isActive;
    if (leaveBalance !== undefined) user.leaveBalance = leaveBalance;
    if (workDays !== undefined) user.workDays = workDays;
    if (workSchedule !== undefined) user.workSchedule = workSchedule;
    if (nationality !== undefined) user.nationality = nationality;
    if (idNumber !== undefined) user.idNumber = idNumber;

    await user.save();

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Admin only)
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deleting yourself
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    await user.deleteOne();

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Reset user password
// @route   PUT /api/users/:id/reset-password
// @access  Private (Admin only)
exports.resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide new password'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

