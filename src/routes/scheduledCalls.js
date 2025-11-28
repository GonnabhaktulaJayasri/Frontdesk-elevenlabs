import express from 'express';
import {
  getUpcomingScheduledCalls,
  scheduleHospitalCall,
  cancelScheduledCall,
  getScheduledCallById,
  getAllScheduledCalls,
  rescheduleCall,
  getScheduledCallsStats,
  getCallReasons,  // NEW
} from '../controllers/scheduledCallsController.js';

const router = express.Router();

// ============================================
// SCHEDULED CALLS ROUTES
// ============================================

// Get statistics
router.get('/stats', getScheduledCallsStats);

// Get available call reasons (NEW)
router.get('/reasons', getCallReasons);

// Get upcoming scheduled calls
router.get('/upcoming', getUpcomingScheduledCalls);

// Get all scheduled calls (with filters)
router.get('/', getAllScheduledCalls);

// Get specific scheduled call by ID
router.get('/:callId', getScheduledCallById);

// Hospital schedules a call (UPDATED - now accepts personalization)
router.post('/schedule', scheduleHospitalCall);

// Reschedule a call
router.patch('/:callId/reschedule', rescheduleCall);

// Cancel scheduled call
router.delete('/:callId', cancelScheduledCall);

export default router;