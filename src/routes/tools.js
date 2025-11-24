import express from "express";
import twilio from "twilio";

import {
  checkAvailability,
  bookAppointment,
  getPatientInfo,
  createPatient,
  updateAppointment,
  getDoctors,
  verifyImagingOrder,
  recordMriSafety,
  checkTelehealthAvailability,
} from "../services/emrService.js";

const router = express.Router();

// Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// ============================================
// CORE APPOINTMENT TOOLS
// ============================================

// Tool 1: Get Patient Information
router.post("/get-patient-info", async (req, res) => {
  try {
    const { name, date_of_birth, phone } = req.body;

    console.log("📥 get-patient-info request:", { name, date_of_birth, phone });

    if (!name || !date_of_birth) {
      return res.status(400).json({
        success: false,
        error: "Name and date of birth are required",
      });
    }

    const patient = await getPatientInfo({ name, date_of_birth, phone });

    if (!patient) {
      return res.json({
        success: false,
        message:
          "Patient not found in our system. Would you like to register as a new patient?",
        action: "register",
      });
    }

    res.json({
      success: true,
      patient_id: patient.id,
      name: patient.name,
      upcoming_appointments: patient.appointments || [],
      message: `Found record for ${patient.name}`,
    });
  } catch (error) {
    console.error("Error in get-patient-info:", error);
    res.status(500).json({
      success: false,
      error: "Unable to retrieve patient information",
      message: "Please try again or speak with our staff",
    });
  }
});

// Tool 2: Check Availability
router.post("/check-availability", async (req, res) => {
  try {
    const { doctor_id, date, specialty } = req.body;

    console.log("📥 check-availability request:", { doctor_id, date, specialty });

    if (!date) {
      return res.status(400).json({
        success: false,
        error: "Date is required",
      });
    }

    const slots = await checkAvailability(doctor_id, date, specialty);

    res.json({
      success: true,
      date,
      available_slots: slots,
      message: `Found ${slots.length} available time slots for ${date}`,
    });
  } catch (error) {
    console.error("Error in check-availability:", error);
    res.status(500).json({
      success: false,
      error: "Unable to check availability",
      message: "Please try again or speak with our staff",
    });
  }
});

// Tool 3: Book Appointment
router.post("/book-appointment", async (req, res) => {
  try {
    const { patient_id, doctor_id, date, time, reason, phone } = req.body;

    console.log("📥 book-appointment request:", { patient_id, doctor_id, date, time, reason });

    if (!patient_id || !doctor_id || !date || !time || !phone) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message:
          "Patient ID, doctor ID, date, time, and phone number are required",
      });
    }

    const appointment = await bookAppointment({
      patient_id,
      doctor_id,
      date,
      time,
      reason,
      phone: phone.replace(/\D/g, ""),
    });

    // Send SMS confirmation (non-blocking)
    if (phone && appointment.success) {
      try {
        await twilioClient.messages.create({
          body: `Appointment confirmed for ${date} at ${time} with ${appointment.doctor_name}. Confirmation #${appointment.confirmation_number}. Reply CANCEL to cancel.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`,
        });
        console.log("✅ SMS confirmation sent");
      } catch (smsError) {
        console.error("Failed to send SMS confirmation:", smsError.message);
      }
    }

    res.json({
      success: true,
      appointment_id: appointment.id,
      confirmation_number: appointment.confirmation_number,
      doctor_name: appointment.doctor_name,
      date,
      time,
      message: `Appointment confirmed for ${date} at ${time} with ${appointment.doctor_name}`,
    });
  } catch (error) {
    console.error("Error in book-appointment:", error);
    res.status(500).json({
      success: false,
      error: "Unable to book appointment",
      message: "Please try again or speak with our staff",
    });
  }
});

// Tool 4: Update/Reschedule Appointment
router.post("/update-appointment", async (req, res) => {
  try {
    const { appointment_id, new_date, new_time, reason } = req.body;

    console.log("📥 update-appointment request:", { appointment_id, new_date, new_time });

    if (!appointment_id) {
      return res.status(400).json({
        success: false,
        error: "Appointment ID is required",
      });
    }

    const updates = {};
    if (new_date) updates.new_date = new_date;
    if (new_time) updates.new_time = new_time;
    if (reason) updates.reason = reason;

    const result = await updateAppointment(appointment_id, updates);

    // SMS Notification
    if (result.success && result.appointment.phone) {
      try {
        const phone = result.appointment.phone;
        await twilioClient.messages.create({
          body: `Your appointment has been rescheduled to ${
            new_date || result.appointment.date
          } at ${
            new_time || result.appointment.time
          }. Confirmation #${result.appointment.confirmation_number}`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`,
        });
        console.log("✅ Reschedule SMS sent");
      } catch (smsError) {
        console.error("Failed to send SMS notification:", smsError.message);
      }
    }

    res.json({
      success: true,
      appointment: result.appointment,
      message: `Appointment rescheduled to ${
        new_date || result.appointment.date
      } at ${new_time || result.appointment.time}`,
    });
  } catch (error) {
    console.error("Error in update-appointment:", error);
    res.status(500).json({
      success: false,
      error: "Unable to update appointment",
      message: error.message || "Please try again or speak with our staff",
    });
  }
});

// Tool 5: Register New Patient
router.post("/register-patient", async (req, res) => {
  try {
    const { name, date_of_birth, phone } = req.body;

    console.log("📥 register-patient request:", { name, date_of_birth, phone });

    if (!name || !date_of_birth || !phone) {
      return res.status(400).json({
        success: false,
        error: "Name, date of birth, and phone number are required",
      });
    }

    const result = await createPatient({ name, date_of_birth, phone });

    res.json({
      success: true,
      patient_id: result.patient_id,
      message: `Welcome ${name}! Your patient account has been created.`,
    });
  } catch (error) {
    console.error("Error in register-patient:", error);
    res.status(500).json({
      success: false,
      error: "Unable to register patient",
      message: "Please try again or speak with our staff",
    });
  }
});

// Helper: Get list of doctors
router.get("/doctors", async (req, res) => {
  try {
    const doctors = await getDoctors();
    res.json({
      success: true,
      doctors,
    });
  } catch (error) {
    console.error("Error in get-doctors:", error);
    res.status(500).json({
      success: false,
      error: "Unable to retrieve doctors list",
    });
  }
});

// ============================================
// RADIOLOGY-SPECIFIC TOOLS
// ============================================

// Verify imaging order/referral
router.post("/verify-order", async (req, res) => {
  try {
    const { patient_id, imaging_type, body_part } = req.body;

    console.log("📥 verify-order request:", { patient_id, imaging_type, body_part });

    if (!patient_id || !imaging_type) {
      return res.status(400).json({
        success: false,
        error: "Patient ID and imaging type are required",
      });
    }

    const result = await verifyImagingOrder(patient_id, imaging_type, body_part);

    res.json({
      success: true,
      order_found: result.found,
      order_id: result.order_id,
      message: result.message,
    });
  } catch (error) {
    console.error("Error in verify-order:", error);
    res.status(500).json({
      success: false,
      error: "Unable to verify imaging order",
      message: "Please try again or speak with our staff",
    });
  }
});

// MRI safety screening
router.post("/mri-safety", async (req, res) => {
  try {
    const { patient_id, has_pacemaker, has_implants, implant_details, has_metal_fragments, is_claustrophobic } = req.body;

    console.log("📥 mri-safety request:", { patient_id, has_pacemaker, has_implants });

    if (!patient_id || has_pacemaker === undefined || has_implants === undefined) {
      return res.status(400).json({
        success: false,
        error: "Patient ID, pacemaker status, and implant status are required",
      });
    }

    const result = await recordMriSafety(patient_id, {
      has_pacemaker,
      has_implants,
      implant_details,
      has_metal_fragments,
      is_claustrophobic,
    });

    res.json({
      success: true,
      safe_for_mri: result.safe_for_mri,
      contraindications: result.contraindications,
      is_claustrophobic: result.is_claustrophobic,
      message: result.message,
    });
  } catch (error) {
    console.error("Error in mri-safety:", error);
    res.status(500).json({
      success: false,
      error: "Unable to process MRI safety screening",
      message: "Please try again or speak with our staff",
    });
  }
});

// Get preparation instructions for imaging procedures
router.post("/prep-instructions", async (req, res) => {
  try {
    const { imaging_type } = req.body;

    console.log("📥 prep-instructions request:", { imaging_type });

    if (!imaging_type) {
      return res.status(400).json({
        success: false,
        error: "Imaging type is required",
      });
    }

    const prepInstructions = {
      xray: {
        prep: "No special preparation required.",
        instructions: [
          "Wear comfortable, loose clothing",
          "Remove jewelry and metal objects from the area being imaged",
          "Inform technologist if you are or may be pregnant",
        ],
        duration: "15-30 minutes",
      },
      ct_without_contrast: {
        prep: "Minimal preparation required.",
        instructions: [
          "Wear comfortable clothing without metal",
          "Remove jewelry, glasses, hearing aids",
          "You may eat and drink normally",
        ],
        duration: "30 minutes",
      },
      ct_with_contrast: {
        prep: "Requires fasting and kidney function test.",
        instructions: [
          "No food for 4 hours before exam (clear liquids OK)",
          "Take medications as usual with small sip of water",
          "Need recent kidney function test (creatinine) within 30 days",
          "Stay well hydrated day before exam",
          "Inform us of any allergies, especially to iodine or contrast",
        ],
        duration: "45 minutes",
      },
      mri_without_contrast: {
        prep: "No food/drink restrictions, but metal safety is critical.",
        instructions: [
          "Remove ALL metal (jewelry, watches, hairpins, belts, underwire bras)",
          "Wear clothing without metal zippers or buttons",
          "Leave credit cards and electronics in locker",
          "Inform us of: pacemakers, implants, metal fragments, cochlear implants",
        ],
        duration: "45-60 minutes",
      },
      mri_with_contrast: {
        prep: "Same as MRI without contrast, plus kidney function test.",
        instructions: [
          "Remove ALL metal items",
          "Need recent kidney function test (creatinine) within 30 days",
          "Inform us of any kidney disease or allergies",
        ],
        duration: "60-75 minutes",
      },
      ultrasound_abdominal: {
        prep: "Requires fasting.",
        instructions: [
          "Nothing to eat or drink for 8 hours before exam",
          "This allows gallbladder to be properly visualized",
        ],
        duration: "30-45 minutes",
      },
      ultrasound_pelvic: {
        prep: "Requires full bladder.",
        instructions: [
          "Drink 32 oz of water 1 hour before exam",
          "Do NOT empty bladder - full bladder required",
          "This helps visualize pelvic organs",
        ],
        duration: "30-45 minutes",
      },
      ultrasound_obstetric: {
        prep: "Varies by trimester.",
        instructions: [
          "First trimester: Full bladder required (drink 32 oz water 1 hour before)",
          "Second/Third trimester: No preparation needed",
        ],
        duration: "30-45 minutes",
      },
      mammogram: {
        prep: "No deodorant or lotions.",
        instructions: [
          "Do not use deodorant, powder, or lotion under arms or on breasts day of exam",
          "Wear two-piece outfit for easy access",
          "Best to schedule 1-2 weeks after period (when breasts less tender)",
        ],
        duration: "30 minutes",
      },
      dexa: {
        prep: "No calcium supplements.",
        instructions: [
          "No calcium supplements for 24 hours before exam",
          "Wear clothing without metal buttons or zippers",
          "No barium studies within 7 days prior",
        ],
        duration: "20 minutes",
      },
      pet_scan: {
        prep: "Extensive preparation required.",
        instructions: [
          "No strenuous exercise 24 hours before",
          "No food for 6 hours before (water OK)",
          "No sugar, candy, gum day of exam",
          "Diabetics: special instructions for blood sugar control",
          "Arrive 1-2 hours before scan time for injection and uptake period",
        ],
        duration: "2-3 hours",
      },
    };

    const instructions = prepInstructions[imaging_type.toLowerCase()];

    if (!instructions) {
      return res.json({
        success: true,
        message: "Please contact our staff for specific preparation instructions for this imaging type.",
        general_instructions: [
          "Arrive 15 minutes early",
          "Bring your photo ID and insurance card",
          "Bring any prior imaging CDs if you have them",
        ],
      });
    }

    res.json({
      success: true,
      imaging_type,
      ...instructions,
    });
  } catch (error) {
    console.error("Error in prep-instructions:", error);
    res.status(500).json({
      success: false,
      error: "Unable to retrieve preparation instructions",
    });
  }
});

// ============================================
// CARDIOLOGY-SPECIFIC TOOLS
// ============================================

// Get cardiac procedure preparation
router.post("/procedure-prep", async (req, res) => {
  try {
    const { procedure_type } = req.body;

    console.log("📥 procedure-prep request:", { procedure_type });

    if (!procedure_type) {
      return res.status(400).json({
        success: false,
        error: "Procedure type is required",
      });
    }

    const procedurePrep = {
      stress_test: {
        name: "Stress Test",
        prep: [
          "No food or drink 4 hours before (water OK)",
          "No caffeine 24 hours before",
          "Wear comfortable walking shoes and loose clothing",
          "Take medications as usual unless told otherwise",
        ],
        duration: "About 1 hour",
        notes: "You will walk on a treadmill while your heart is monitored.",
      },
      nuclear_stress_test: {
        name: "Nuclear Stress Test",
        prep: [
          "No caffeine 24 hours before",
          "No food 4 hours before",
          "Plan for 3-4 hours at the office",
          "Wear comfortable clothing, no metal",
        ],
        duration: "3-4 hours",
        notes: "Two sets of images will be taken. A small amount of radioactive tracer will be injected.",
      },
      echocardiogram: {
        name: "Echocardiogram",
        prep: [
          "No special preparation required",
        ],
        duration: "About 45 minutes",
        notes: "Ultrasound gel will be applied to your chest.",
      },
      holter_monitor: {
        name: "Holter Monitor",
        prep: [
          "Wear button-down shirt for easy access",
        ],
        duration: "Setup takes about 30 minutes",
        notes: "You will wear the monitor for 24-48 hours. Keep a diary of any symptoms.",
      },
      event_monitor: {
        name: "Event Monitor",
        prep: [
          "Wear button-down shirt for easy access",
        ],
        duration: "Setup takes about 30 minutes",
        notes: "You may wear the monitor for up to 30 days. Press the button when you feel symptoms.",
      },
      ekg: {
        name: "EKG/ECG",
        prep: [
          "No special preparation required",
          "Avoid applying lotions to chest area",
        ],
        duration: "About 15 minutes",
        notes: "Quick, painless test that records your heart rhythm.",
      },
    };

    const prep = procedurePrep[procedure_type.toLowerCase()];

    if (!prep) {
      return res.json({
        success: true,
        message: "Please contact our cardiology department for specific preparation instructions.",
      });
    }

    res.json({
      success: true,
      procedure_type,
      ...prep,
    });
  } catch (error) {
    console.error("Error in procedure-prep:", error);
    res.status(500).json({
      success: false,
      error: "Unable to retrieve procedure preparation",
    });
  }
});

// ============================================
// MENTAL HEALTH-SPECIFIC TOOLS
// ============================================

// Check telehealth availability
router.post("/telehealth-check", async (req, res) => {
  try {
    const { appointment_type, date } = req.body;

    console.log("📥 telehealth-check request:", { appointment_type, date });

    if (!appointment_type || !date) {
      return res.status(400).json({
        success: false,
        error: "Appointment type and date are required",
      });
    }

    const result = await checkTelehealthAvailability(appointment_type, date);

    res.json({
      success: true,
      telehealth_available: result.available,
      available_slots: result.slots,
      message: result.message,
    });
  } catch (error) {
    console.error("Error in telehealth-check:", error);
    res.status(500).json({
      success: false,
      error: "Unable to check telehealth availability",
    });
  }
});

// ============================================
// SPORTS MEDICINE-SPECIFIC TOOLS
// ============================================

// Check if imaging is recommended based on injury
router.post("/imaging-check", async (req, res) => {
  try {
    const { injury_type, injury_date } = req.body;

    console.log("📥 imaging-check request:", { injury_type, injury_date });

    if (!injury_type) {
      return res.status(400).json({
        success: false,
        error: "Injury type is required",
      });
    }

    // Determine if imaging is recommended based on injury type
    const imagingRecommendations = {
      "ankle sprain": {
        recommend_imaging: false,
        imaging_type: null,
        reason: "Most ankle sprains can be evaluated clinically. Imaging may be ordered if fracture is suspected.",
      },
      "knee pain": {
        recommend_imaging: true,
        imaging_type: "mri",
        reason: "MRI recommended to evaluate soft tissue structures (ACL, meniscus).",
      },
      "shoulder pain": {
        recommend_imaging: true,
        imaging_type: "xray",
        reason: "X-ray recommended as initial imaging to rule out fracture or dislocation.",
      },
      "concussion": {
        recommend_imaging: false,
        imaging_type: null,
        reason: "Imaging not typically needed for concussion unless red flags present.",
      },
      "stress fracture": {
        recommend_imaging: true,
        imaging_type: "xray",
        reason: "X-ray recommended, MRI may be needed if X-ray is negative but clinical suspicion is high.",
      },
      "back pain": {
        recommend_imaging: false,
        imaging_type: null,
        reason: "Imaging typically not needed for acute back pain without red flags.",
      },
    };

    const injuryLower = injury_type.toLowerCase();
    let recommendation = null;

    // Search for matching injury type
    for (const [key, value] of Object.entries(imagingRecommendations)) {
      if (injuryLower.includes(key) || key.includes(injuryLower)) {
        recommendation = value;
        break;
      }
    }

    if (!recommendation) {
      recommendation = {
        recommend_imaging: false,
        imaging_type: null,
        reason: "The doctor will evaluate the need for imaging during your appointment.",
      };
    }

    res.json({
      success: true,
      injury_type,
      ...recommendation,
    });
  } catch (error) {
    console.error("Error in imaging-check:", error);
    res.status(500).json({
      success: false,
      error: "Unable to check imaging requirements",
    });
  }
});

export default router;