const mongoose = require('mongoose');

const attendanceTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  validFrom: {
    type: Date,
    required: true
  },
  validTo: {
    type: Date,
    required: true
  },
  isUsed: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Auto-delete expired tokens after 24 hours
attendanceTokenSchema.index({ validTo: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('AttendanceToken', attendanceTokenSchema);

