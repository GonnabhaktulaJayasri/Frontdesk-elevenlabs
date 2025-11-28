import * as emrService from '../services/emrService.js';

// ============================================
// DOCTORS
// ============================================

// Get all doctors for hospital
export const getDoctors = async (req, res) => {
  try {
    const doctors = await emrService.getDoctors(req.hospitalId);

    res.json({
      success: true,
      count: doctors.length,
      doctors,
    });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get single doctor
export const getDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const doctor = await emrService.getDoctorById(doctorId);

    res.json({ success: true, doctor });
  } catch (error) {
    console.error('Error fetching doctor:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Add new doctor
export const addDoctor = async (req, res) => {
  try {
    const { name, specialty, phone, email, workingHours } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Name and phone are required',
      });
    }

    const result = await emrService.createDoctor(req.hospitalId, {
      name,
      specialty,
      phone,
      email,
      workingHours,
    });

    res.status(201).json({
      success: true,
      message: 'Doctor added successfully',
      doctor: result.doctor,
    });
  } catch (error) {
    console.error('Error adding doctor:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update doctor
export const updateDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const updates = req.body;

    await emrService.updateDoctor(doctorId, updates);

    res.json({
      success: true,
      message: 'Doctor updated',
    });
  } catch (error) {
    console.error('Error updating doctor:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Remove doctor
export const removeDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;

    await emrService.deleteDoctor(doctorId, req.hospitalId);

    res.json({
      success: true,
      message: 'Doctor removed',
    });
  } catch (error) {
    console.error('Error removing doctor:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================
// STAFF (Receptionists, Nurses, etc.)
// ============================================

// Get all staff
export const getStaff = async (req, res) => {
  try {
    const { role, emergency_only } = req.query;

    const staff = await emrService.getStaff(req.hospitalId, {
      role,
      isEmergencyContact: emergency_only === 'true',
    });

    res.json({
      success: true,
      count: staff.length,
      staff,
    });
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Add staff member
export const addStaff = async (req, res) => {
  try {
    const {
      name,
      role,
      phone,
      email,
      extension,
      isEmergencyContact,
      emergencyPriority,
      workingHours,
    } = req.body;

    if (!name || !role || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Name, role, and phone are required',
      });
    }

    const validRoles = ['receptionist', 'nurse', 'admin', 'emergency_contact'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
      });
    }

    const result = await emrService.createStaff(req.hospitalId, {
      name,
      role,
      phone,
      email,
      extension,
      isEmergencyContact,
      emergencyPriority,
      workingHours,
    });

    res.status(201).json({
      success: true,
      message: 'Staff member added',
      staff: result.staff,
    });
  } catch (error) {
    console.error('Error adding staff:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update staff member
export const updateStaff = async (req, res) => {
  try {
    const { staffId } = req.params;
    const updates = req.body;

    const result = await emrService.updateStaff(staffId, updates);

    res.json({
      success: true,
      message: 'Staff updated',
      staff: result.staff,
    });
  } catch (error) {
    console.error('Error updating staff:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Remove staff member
export const removeStaff = async (req, res) => {
  try {
    const { staffId } = req.params;

    await emrService.deleteStaff(staffId);

    res.json({
      success: true,
      message: 'Staff removed',
    });
  } catch (error) {
    console.error('Error removing staff:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================
// EMERGENCY CONTACTS
// ============================================

// Get emergency contacts for AI transfers
export const getEmergencyContacts = async (req, res) => {
  try {
    const contacts = await emrService.getEmergencyContacts(req.hospitalId);

    res.json({
      success: true,
      count: contacts.length,
      contacts,
    });
  } catch (error) {
    console.error('Error fetching emergency contacts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Set staff as emergency contact
export const setEmergencyContact = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { priority } = req.body;

    await emrService.updateStaff(staffId, {
      isEmergencyContact: true,
      emergencyPriority: priority || 1,
    });

    res.json({
      success: true,
      message: 'Staff set as emergency contact',
    });
  } catch (error) {
    console.error('Error setting emergency contact:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Remove emergency contact status
export const removeEmergencyContact = async (req, res) => {
  try {
    const { staffId } = req.params;

    await emrService.updateStaff(staffId, {
      isEmergencyContact: false,
      emergencyPriority: 0,
    });

    res.json({
      success: true,
      message: 'Emergency contact status removed',
    });
  } catch (error) {
    console.error('Error removing emergency contact:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Toggle transfer availability
export const toggleTransferAvailability = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { available } = req.body;

    await emrService.updateStaff(staffId, {
      availableForTransfer: available,
    });

    res.json({
      success: true,
      message: `Transfer availability ${available ? 'enabled' : 'disabled'}`,
    });
  } catch (error) {
    console.error('Error toggling availability:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get best transfer target (for AI to use)
export const getTransferTarget = async (req, res) => {
  try {
    const { situation } = req.query; // 'emergency', 'critical', or 'general'

    const target = await emrService.getTransferTarget(
      req.hospitalId,
      situation || 'general'
    );

    if (!target) {
      return res.status(404).json({
        success: false,
        error: 'No available staff for transfer',
      });
    }

    res.json({
      success: true,
      transfer_target: target,
    });
  } catch (error) {
    console.error('Error getting transfer target:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};