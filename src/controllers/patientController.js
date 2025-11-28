import * as emrService from '../services/emrService.js';

// ============================================
// SEARCH PATIENTS
// ============================================
export const searchPatients = async (req, res) => {
  try {
    const { q, query, limit } = req.query;
    const searchQuery = q || query;

    if (!searchQuery) {
      return res.status(400).json({
        success: false,
        error: 'Search query (q) is required',
      });
    }

    const patients = await emrService.searchPatients(
      searchQuery,
      parseInt(limit) || 20
    );

    res.json({
      success: true,
      count: patients.length,
      patients,
    });
  } catch (error) {
    console.error('Error searching patients:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================
// GET PATIENT BY ID
// ============================================
export const getPatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const patient = await emrService.getPatientById(patientId);

    // Get appointments too
    const appointments = await emrService.getPatientAppointments(patientId);

    res.json({
      success: true,
      patient: {
        ...patient,
        appointments,
      },
    });
  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================
// LOOKUP PATIENT (by name + DOB)
// ============================================
export const lookupPatient = async (req, res) => {
  try {
    const { name, date_of_birth, phone } = req.body;

    if (!name || !date_of_birth) {
      return res.status(400).json({
        success: false,
        error: 'Name and date_of_birth are required',
      });
    }

    const patient = await emrService.getPatientInfo({
      name,
      date_of_birth,
      phone,
    });

    if (!patient) {
      return res.json({
        success: false,
        found: false,
        message: 'Patient not found',
      });
    }

    res.json({
      success: true,
      found: true,
      patient,
    });
  } catch (error) {
    console.error('Error looking up patient:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================
// CREATE PATIENT
// ============================================
export const createPatient = async (req, res) => {
  try {
    const { name, date_of_birth, phone, email } = req.body;

    if (!name || !date_of_birth || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Name, date_of_birth, and phone are required',
      });
    }

    const result = await emrService.createPatient({
      name,
      date_of_birth,
      phone,
      email,
    });

    res.status(201).json({
      success: true,
      message: 'Patient created',
      patient_id: result.patient_id,
    });
  } catch (error) {
    console.error('Error creating patient:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================
// UPDATE PATIENT
// ============================================
export const updatePatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const updates = req.body;

    await emrService.updatePatient(patientId, updates);

    res.json({
      success: true,
      message: 'Patient updated',
    });
  } catch (error) {
    console.error('Error updating patient:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================
// GET PATIENT APPOINTMENT HISTORY
// ============================================
export const getPatientHistory = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { include_past } = req.query;

    const history = await emrService.getAppointmentHistory(
      patientId,
      include_past === 'true'
    );

    res.json({
      success: true,
      ...history,
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};