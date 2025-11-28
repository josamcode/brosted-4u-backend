const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  phone: {
    type: String,
    trim: true
  },
  nationality: {
    type: String,
    trim: true,
    default: 'Egyptian'
  },
  idNumber: {
    type: String,
    trim: true
  },
  jobTitle: {
    type: String,
    trim: true
  },
  image: {
    type: String,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: ['admin', 'supervisor', 'employee'],
    default: 'employee'
  },
  department: {
    type: String,
    enum: ['kitchen', 'counter', 'cleaning', 'management', 'delivery', 'other'],
    default: 'other'
  },
  departments: [{
    type: String,
    enum: ['kitchen', 'counter', 'cleaning', 'management', 'delivery', 'other']
  }],
  languagePreference: {
    type: String,
    enum: ['ar', 'en'],
    default: 'en'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  leaveBalance: {
    type: Number,
    default: 0
  },
  workDays: [{
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  }],
  workSchedule: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  refreshToken: {
    type: String,
    select: false
  },
  metadata: {
    type: Map,
    of: String
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Ensure supervisor has departments array
userSchema.pre('save', function (next) {
  if (this.role === 'supervisor' && (!this.departments || this.departments.length === 0)) {
    if (this.department && this.department !== 'other') {
      this.departments = [this.department];
    }
  }
  next();
});

module.exports = mongoose.model('User', userSchema);

