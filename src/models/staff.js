import mongoose from 'mongoose';

const staffSchema = new mongoose.Schema({
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true,
  },
  fhirPractitionerId: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['doctor', 'receptionist', 'nurse', 'admin', 'emergency_contact'],
    required: true,
  },
  specialty: String, // For doctors
  email: String,
  phone: {
    type: String,
    required: true,
  },
  extension: String, // Internal extension for transfers
  isEmergencyContact: {
    type: Boolean,
    default: false,
  },
  emergencyPriority: {
    type: Number,
    default: 0, // Higher = called first
  },
  availableForTransfer: {
    type: Boolean,
    default: true,
  },
  workingHours: {
    monday: { start: String, end: String },
    tuesday: { start: String, end: String },
    wednesday: { start: String, end: String },
    thursday: { start: String, end: String },
    friday: { start: String, end: String },
    saturday: { start: String, end: String },
    sunday: { start: String, end: String },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for quick lookups
staffSchema.index({ hospitalId: 1, role: 1 });
staffSchema.index({ hospitalId: 1, isEmergencyContact: 1 });

export default mongoose.model('Staff', staffSchema);