import mongoose from 'mongoose';

const scheduledCallSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
  },
  scheduledTime: {
    type: Date,
    required: true,
  },
  callType: {
    type: String,
    enum: ['callback', 'reminder', 'hospital_scheduled'],
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending',
  },
  appointmentId: String,
  patientId: String,
  reason: String,
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: Date,
  callSid: String, // Twilio call SID when call is made
});

scheduledCallSchema.index({ scheduledTime: 1, status: 1 });

export default mongoose.model('ScheduledCall', scheduledCallSchema);