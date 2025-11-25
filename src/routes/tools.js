import express from "express";
import {
  // Patient Management
  getPatient,
  registerPatient,
  
  // Appointment Management
  checkAppointmentAvailability,
  bookNewAppointment,
  rescheduleAppointment,
  
  // Doctors
  getDoctorsList,
  
  // Radiology Tools
  verifyOrder,
  mriSafetyCheck,
  getImagingPrepInstructions,
  
  // Cardiology Tools
  getCardiologyPrepInstructions,
  
  // Mental Health Tools
  checkTelehealth,
  
  // Sports Medicine Tools
  checkImagingRecommendation,
  scheduleCallback,
  getPatientAppointmentHistory,
  cancelAppointmentTool,
} from "../controllers/toolsController.js";

const router = express.Router();

// ============================================
// PATIENT MANAGEMENT
// ============================================
router.post("/get-patient-info", getPatient);
router.post("/register-patient", registerPatient);

// ============================================
// APPOINTMENT MANAGEMENT
// ============================================
router.post("/check-availability", checkAppointmentAvailability);
router.post("/book-appointment", bookNewAppointment);
router.post("/update-appointment", rescheduleAppointment);

// ============================================
// DOCTORS
// ============================================
router.get("/doctors", getDoctorsList);

// ============================================
// RADIOLOGY TOOLS
// ============================================
router.post("/verify-order", verifyOrder);
router.post("/mri-safety", mriSafetyCheck);
router.post("/prep-instructions", getImagingPrepInstructions);

// ============================================
// CARDIOLOGY TOOLS
// ============================================
router.post("/procedure-prep", getCardiologyPrepInstructions);

// ============================================
// MENTAL HEALTH TOOLS
// ============================================
router.post("/telehealth-check", checkTelehealth);

// ============================================
// SPORTS MEDICINE TOOLS
// ============================================
router.post("/imaging-check", checkImagingRecommendation);
router.post('/schedule-callback', scheduleCallback);
router.post('/appointment-history', getPatientAppointmentHistory);
router.post('/cancel-appointment', cancelAppointmentTool);

export default router;