// routes/tools.js
import express from "express";
import twilio from "twilio";

import {
  checkAvailability,
  bookAppointment,
  getPatientInfo,
  createPatient,
  updateAppointment,
  getDoctors
} from "../services/emrService.js";

const router = express.Router();

// Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Tool 1: Get Patient Information
router.post("/get-patient-info", async (req, res) => {
  try {
    const { name, date_of_birth, phone } = req.body;

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
          to: phone,
        });
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

    if (!appointment_id) {
      return res.status(400).json({
        success: false,
        error: "Appointment ID is required",
      });
    }

    const updates = {};
    if (new_date) updates.date = new_date;
    if (new_time) updates.time = new_time;
    if (reason) updates.reason = reason;

    const result = await updateAppointment(appointment_id, updates);

    // SMS Notification
    if (result.success && result.appointment.phone) {
      try {
        await twilioClient.messages.create({
          body: `Your appointment has been rescheduled to ${
            new_date || result.appointment.date
          } at ${
            new_time || result.appointment.time
          }. Confirmation #${result.appointment.confirmation_number}`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: result.appointment.phone,
        });
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
router.get("/doctors", (req, res) => {
  try {
    const doctors = getDoctors();
    res.json({
      success: true,
      doctors,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Unable to retrieve doctors list",
    });
  }
});

export default router;
