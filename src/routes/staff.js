import express from 'express';
import { protect } from '../middleware/jwtAuth.js';
import {
  // Doctors
  getDoctors,
  getDoctor,
  addDoctor,
  updateDoctor,
  removeDoctor,
  // Staff
  getStaff,
  addStaff,
  updateStaff,
  removeStaff,
  // Emergency
  getEmergencyContacts,
  setEmergencyContact,
  removeEmergencyContact,
  toggleTransferAvailability,
  getTransferTarget,
} from '../controllers/staffController.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// ============================================
// DOCTOR ROUTES
// ============================================
router.get('/doctors', getDoctors);
router.post('/doctors', addDoctor);
router.get('/doctors/:doctorId', getDoctor);
router.put('/doctors/:doctorId', updateDoctor);
router.delete('/doctors/:doctorId', removeDoctor);

// ============================================
// STAFF ROUTES (Receptionists, Nurses, etc.)
// ============================================
router.get('/', getStaff);
router.post('/', addStaff);
router.put('/:staffId', updateStaff);
router.delete('/:staffId', removeStaff);

// ============================================
// EMERGENCY CONTACTS & TRANSFER
// ============================================
router.get('/emergency-contacts', getEmergencyContacts);
router.post('/:staffId/emergency', setEmergencyContact);
router.delete('/:staffId/emergency', removeEmergencyContact);
router.put('/:staffId/transfer-availability', toggleTransferAvailability);

// For AI to get transfer target
router.get('/transfer-target', getTransferTarget);

export default router;