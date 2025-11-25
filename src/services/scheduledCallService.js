import ScheduledCall from '../models/scheduledCall.js';
import { elevenLabsClient } from '../config/clients.js';

class ScheduledCallService {
  // Schedule a callback
  async scheduleCallback(phoneNumber, delayMinutes, reason = 'Callback requested') {
    const scheduledTime = new Date(Date.now() + delayMinutes * 60 * 1000);
    
    const scheduledCall = await ScheduledCall.create({
      phoneNumber,
      scheduledTime,
      callType: 'callback',
      reason,
      status: 'pending',
    });
    
    console.log(`📅 Callback scheduled for ${phoneNumber} at ${scheduledTime}`);
    return scheduledCall;
  }
  
  // Schedule appointment reminder
  async scheduleAppointmentReminders(appointmentData) {
    const { phone, date, time, appointmentId, patientId, doctorName } = appointmentData;
    
    // Parse appointment datetime
    const appointmentDateTime = new Date(`${date}T${time}:00`);
    
    // Schedule 1 day before reminder
    const oneDayBefore = new Date(appointmentDateTime.getTime() - 24 * 60 * 60 * 1000);
    const oneHourBefore = new Date(appointmentDateTime.getTime() - 60 * 60 * 1000);
    
    const reminders = [];
    
    // Only schedule if in future
    if (oneDayBefore > new Date()) {
      const reminder1Day = await ScheduledCall.create({
        phoneNumber: phone,
        scheduledTime: oneDayBefore,
        callType: 'reminder',
        appointmentId,
        patientId,
        reason: '24-hour appointment reminder',
        metadata: { appointmentDate: date, appointmentTime: time, doctorName },
        status: 'pending',
      });
      reminders.push(reminder1Day);
    }
    
    if (oneHourBefore > new Date()) {
      const reminder1Hour = await ScheduledCall.create({
        phoneNumber: phone,
        scheduledTime: oneHourBefore,
        callType: 'reminder',
        appointmentId,
        patientId,
        reason: '1-hour appointment reminder',
        metadata: { appointmentDate: date, appointmentTime: time, doctorName },
        status: 'pending',
      });
      reminders.push(reminder1Hour);
    }
    
    console.log(`📅 ${reminders.length} reminders scheduled for appointment ${appointmentId}`);
    return reminders;
  }
  
  // Hospital schedules call for patient
  async scheduleHospitalCall(phoneNumber, scheduledTime, reason, metadata = {}) {
    const scheduledCall = await ScheduledCall.create({
      phoneNumber,
      scheduledTime: new Date(scheduledTime),
      callType: 'hospital_scheduled',
      reason,
      metadata,
      status: 'pending',
    });
    
    console.log(`📅 Hospital call scheduled for ${phoneNumber} at ${scheduledTime}`);
    return scheduledCall;
  }
  
  // Execute scheduled call
  async executeScheduledCall(scheduledCall) {
    try {
      console.log(`📞 Executing scheduled call: ${scheduledCall._id}`);
      
      const agentId = process.env.ELEVENLABS_AGENT_ID;
      const phoneNumberId = process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID;
      
      if (!agentId || !phoneNumberId) {
        throw new Error('Agent ID or Phone Number ID not configured');
      }
      
      // Make outbound call using ElevenLabs
      const call = await elevenLabsClient.conversationalAi.twilio.outboundCall({
        agentId: agentId,
        agentPhoneNumberId: phoneNumberId,
        toNumber: scheduledCall.phoneNumber,
      });
      
      // Update scheduled call status
      scheduledCall.status = 'completed';
      scheduledCall.completedAt = new Date();
      scheduledCall.callSid = call.callId || call.sid;
      await scheduledCall.save();
      
      console.log(`✅ Scheduled call completed: ${scheduledCall._id}`);
      return { success: true, call };
      
    } catch (error) {
      console.error(`❌ Failed to execute scheduled call ${scheduledCall._id}:`, error);
      
      scheduledCall.status = 'failed';
      scheduledCall.metadata = { 
        ...scheduledCall.metadata, 
        error: error.message 
      };
      await scheduledCall.save();
      
      return { success: false, error: error.message };
    }
  }
  
  // Get pending scheduled calls
  async getPendingCalls() {
    const now = new Date();
    return await ScheduledCall.find({
      status: 'pending',
      scheduledTime: { $lte: now },
    }).sort({ scheduledTime: 1 });
  }
  
  // Cancel scheduled calls for an appointment
  async cancelAppointmentReminders(appointmentId) {
    const result = await ScheduledCall.updateMany(
      { appointmentId, status: 'pending' },
      { status: 'cancelled' }
    );
    
    console.log(`🚫 Cancelled ${result.modifiedCount} reminders for appointment ${appointmentId}`);
    return result;
  }
  
  // Get upcoming scheduled calls
  async getUpcomingCalls(limit = 20) {
    return await ScheduledCall.find({
      status: 'pending',
      scheduledTime: { $gt: new Date() },
    })
    .sort({ scheduledTime: 1 })
    .limit(limit);
  }
}

export default new ScheduledCallService();