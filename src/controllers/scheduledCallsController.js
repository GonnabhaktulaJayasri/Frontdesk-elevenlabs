import scheduledCallService from '../services/scheduledCallService.js';
import ScheduledCall from '../models/scheduledCall.js';

// ============================================
// GET UPCOMING SCHEDULED CALLS
// ============================================
export const getUpcomingScheduledCalls = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const calls = await scheduledCallService.getUpcomingCalls(limit);
    
    res.json({ 
      success: true, 
      count: calls.length,
      calls 
    });
    
  } catch (error) {
    console.error('Error fetching upcoming calls:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

// ============================================
// HOSPITAL SCHEDULES A CALL
// ============================================
export const scheduleHospitalCall = async (req, res) => {
  try {
    const { phone_number, scheduled_time, reason, metadata } = req.body;
    
    console.log('📅 Hospital scheduling call:', { phone_number, scheduled_time, reason });
    
    if (!phone_number || !scheduled_time) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and scheduled time are required',
      });
    }
    
    // Validate scheduled time is in the future
    const scheduledDate = new Date(scheduled_time);
    if (scheduledDate <= new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Scheduled time must be in the future',
      });
    }
    
    const scheduledCall = await scheduledCallService.scheduleHospitalCall(
      phone_number,
      scheduled_time,
      reason || 'Hospital scheduled call',
      metadata
    );
    
    console.log(`✅ Call scheduled: ${scheduledCall._id}`);
    
    res.json({
      success: true,
      scheduled_call: {
        id: scheduledCall._id,
        phone_number: scheduledCall.phoneNumber,
        scheduled_time: scheduledCall.scheduledTime,
        call_type: scheduledCall.callType,
        status: scheduledCall.status,
        reason: scheduledCall.reason,
      },
      message: `Call scheduled for ${scheduledCall.scheduledTime}`,
    });
    
  } catch (error) {
    console.error('Error scheduling hospital call:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

// ============================================
// CANCEL SCHEDULED CALL
// ============================================
export const cancelScheduledCall = async (req, res) => {
  try {
    const { callId } = req.params;
    
    console.log(`🚫 Cancelling scheduled call: ${callId}`);
    
    const call = await ScheduledCall.findById(callId);
    
    if (!call) {
      return res.status(404).json({ 
        success: false, 
        error: 'Scheduled call not found' 
      });
    }
    
    if (call.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel a completed call',
      });
    }
    
    if (call.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Call is already cancelled',
      });
    }
    
    call.status = 'cancelled';
    await call.save();
    
    console.log(`✅ Scheduled call cancelled: ${callId}`);
    
    res.json({ 
      success: true, 
      message: 'Scheduled call cancelled successfully',
      call: {
        id: call._id,
        status: call.status,
      }
    });
    
  } catch (error) {
    console.error('Error cancelling scheduled call:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

// ============================================
// GET SCHEDULED CALL BY ID
// ============================================
export const getScheduledCallById = async (req, res) => {
  try {
    const { callId } = req.params;
    
    const call = await ScheduledCall.findById(callId);
    
    if (!call) {
      return res.status(404).json({ 
        success: false, 
        error: 'Scheduled call not found' 
      });
    }
    
    res.json({ 
      success: true, 
      call 
    });
    
  } catch (error) {
    console.error('Error fetching scheduled call:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

// ============================================
// GET ALL SCHEDULED CALLS (with filters)
// ============================================
export const getAllScheduledCalls = async (req, res) => {
  try {
    const { status, call_type, limit = 100, skip = 0 } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (call_type) filter.callType = call_type;
    
    const calls = await ScheduledCall.find(filter)
      .sort({ scheduledTime: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));
    
    const total = await ScheduledCall.countDocuments(filter);
    
    res.json({ 
      success: true,
      total,
      count: calls.length,
      calls 
    });
    
  } catch (error) {
    console.error('Error fetching scheduled calls:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

// ============================================
// RESCHEDULE A CALL
// ============================================
export const rescheduleCall = async (req, res) => {
  try {
    const { callId } = req.params;
    const { new_scheduled_time } = req.body;
    
    console.log(`🔄 Rescheduling call: ${callId} to ${new_scheduled_time}`);
    
    if (!new_scheduled_time) {
      return res.status(400).json({
        success: false,
        error: 'New scheduled time is required',
      });
    }
    
    const call = await ScheduledCall.findById(callId);
    
    if (!call) {
      return res.status(404).json({ 
        success: false, 
        error: 'Scheduled call not found' 
      });
    }
    
    if (call.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Cannot reschedule a completed call',
      });
    }
    
    // Validate new time is in the future
    const newDate = new Date(new_scheduled_time);
    if (newDate <= new Date()) {
      return res.status(400).json({
        success: false,
        error: 'New scheduled time must be in the future',
      });
    }
    
    const oldTime = call.scheduledTime;
    call.scheduledTime = newDate;
    call.status = 'pending'; // Reset to pending if it was cancelled
    await call.save();
    
    console.log(`✅ Call rescheduled from ${oldTime} to ${newDate}`);
    
    res.json({ 
      success: true, 
      message: 'Call rescheduled successfully',
      call: {
        id: call._id,
        old_time: oldTime,
        new_time: call.scheduledTime,
        status: call.status,
      }
    });
    
  } catch (error) {
    console.error('Error rescheduling call:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

// ============================================
// GET SCHEDULED CALLS STATISTICS
// ============================================
export const getScheduledCallsStats = async (req, res) => {
  try {
    const [pending, completed, failed, cancelled] = await Promise.all([
      ScheduledCall.countDocuments({ status: 'pending' }),
      ScheduledCall.countDocuments({ status: 'completed' }),
      ScheduledCall.countDocuments({ status: 'failed' }),
      ScheduledCall.countDocuments({ status: 'cancelled' }),
    ]);
    
    const byType = await ScheduledCall.aggregate([
      {
        $group: {
          _id: '$callType',
          count: { $sum: 1 },
        },
      },
    ]);
    
    res.json({
      success: true,
      stats: {
        total: pending + completed + failed + cancelled,
        by_status: {
          pending,
          completed,
          failed,
          cancelled,
        },
        by_type: byType.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
      },
    });
    
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};