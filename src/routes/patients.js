import express from 'express';
import { protect } from '../middleware/jwtAuth.js';
import {
  searchPatients,
  getPatient,
  lookupPatient,
  createPatient,
  updatePatient,
  getPatientHistory,
} from '../controllers/patientController.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// ============================================
// PATIENT ROUTES
// ============================================

// Search patients
// GET /api/patients/search?q=john
router.get('/search', searchPatients);

// Lookup patient by name + DOB
// POST /api/patients/lookup
router.post('/lookup', lookupPatient);

// Create new patient
// POST /api/patients
router.post('/', createPatient);

// Get patient by ID
// GET /api/patients/:patientId
router.get('/:patientId', getPatient);

// Update patient
// PUT /api/patients/:patientId
router.put('/:patientId', updatePatient);

// Get patient appointment history
// GET /api/patients/:patientId/history
router.get('/:patientId/history', getPatientHistory);

export default router;