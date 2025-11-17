const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['vacation', 'sick', 'permission', 'emergency', 'unpaid', 'other'],
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvalDate: {
    type: Date
  },
  approvalNotes: {
    type: String
  },
  days: {
    type: Number,
    required: true
  },
  attachments: [{
    filename: String,
    path: String,
    mimetype: String
  }]
}, {
  timestamps: true
});

// Calculate number of days before saving
leaveRequestSchema.pre('save', function(next) {
  if (this.startDate && this.endDate) {
    const diffTime = Math.abs(this.endDate - this.startDate);
    this.days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }
  next();
});

// Indexes
leaveRequestSchema.index({ userId: 1, startDate: -1 });
leaveRequestSchema.index({ status: 1, startDate: -1 });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);

