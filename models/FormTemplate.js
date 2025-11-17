const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true
  },
  label: {
    en: { type: String, required: true },
    ar: { type: String, required: true }
  },
  type: {
    type: String,
    enum: ['text', 'textarea', 'number', 'boolean', 'select', 'date', 'time', 'datetime', 'file'],
    required: true
  },
  options: [{
    en: String,
    ar: String
  }],
  required: {
    type: Boolean,
    default: false
  },
  placeholder: {
    en: String,
    ar: String
  }
});

const sectionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  label: {
    en: { type: String, required: true },
    ar: { type: String, required: true }
  },
  fields: [fieldSchema]
});

const formTemplateSchema = new mongoose.Schema({
  title: {
    en: { type: String, required: true },
    ar: { type: String, required: true }
  },
  description: {
    en: String,
    ar: String
  },
  sections: [sectionSchema],
  visibleToRoles: [{
    type: String,
    enum: ['admin', 'supervisor', 'employee']
  }],
  editableByRoles: [{
    type: String,
    enum: ['admin', 'supervisor', 'employee']
  }],
  departments: [{
    type: String,
    enum: ['kitchen', 'counter', 'cleaning', 'management', 'delivery', 'other', 'all']
  }],
  requiresApproval: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for faster queries
formTemplateSchema.index({ 'title.en': 'text', 'title.ar': 'text' });

module.exports = mongoose.model('FormTemplate', formTemplateSchema);

