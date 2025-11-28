import express from 'express';
import { protect } from '../middleware/jwtAuth.js';
import {
  getAppointments,
  getAppointment,
  checkAvailability,
  bookAppointment,
  rescheduleAppointment,
  cancelAppointment,
  getPatientAppointments,
} from '../controllers/appointmentController.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// ============================================
// APPOINTMENT ROUTES
// ============================================

// Get all appointments (with filters)
// GET /api/appointments?date=2024-01-15&status=booked&doctor_id=xxx
router.get('/', getAppointments);

// Check availability
// POST /api/appointments/availability
router.post('/availability', checkAvailability);

// Book new appointment
// POST /api/appointments
router.post('/', bookAppointment);

// Get single appointment
// GET /api/appointments/:appointmentId
router.get('/:appointmentId', getAppointment);

// Reschedule appointment
// PUT /api/appointments/:appointmentId/reschedule
router.put('/:appointmentId/reschedule', rescheduleAppointment);

// Cancel appointment
// DELETE /api/appointments/:appointmentId
router.delete('/:appointmentId', cancelAppointment);

// Get patient's appointments
// GET /api/appointments/patient/:patientId
router.get('/patient/:patientId', getPatientAppointments);

export default router;