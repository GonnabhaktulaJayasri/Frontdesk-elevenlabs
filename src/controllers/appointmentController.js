import { twilioClient } from '../config/clients.js';
import * as emrService from '../services/emrService.js';
import scheduledCallService from '../services/scheduledCallService.js';

// ============================================
// GET ALL APPOINTMENTS
// ============================================
export const getAppointments = async (req, res) => {
  try {
    const { date, status, doctor_id, limit } = req.query;
    
    const appointments = await emrService.getAllAppointments({
      date,
      status,
      doctor_id,
      limit: parseInt(limit) || 10,
    });

    console.log('Fetched appointments:', appointments);
    res.json({
      success: true,
      count: appointments.length,
      appointments,
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================
// GET SINGLE APPOINTMENT
// ============================================
export const getAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const appointment = await emrService.getAppointmentById(appointmentId);

    res.json({ success: true, appointment });
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================
// CHECK AVAILABILITY
// ============================================
export const checkAvailability = async (req, res) => {
  try {
    const { date, doctor_id, specialty } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Date is required',
      });
    }

    const slots = await emrService.checkAvailability(
      doctor_id,
      date,
      specialty,
      req.hospitalId
    );

    res.json({
      success: true,
      date,
      count: slots.length,
      available_slots: slots,
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================
// BOOK APPOINTMENT
// ============================================
export const bookAppointment = async (req, res) => {
  try {
    const { patient_id, doctor_id, date, time, reason, phone, send_sms } = req.body;

    if (!patient_id || !doctor_id || !date || !time || !phone) {
      return res.status(400).json({
        success: false,
        error: 'patient_id, doctor_id, date, time, and phone are required',
      });
    }

    const result = await emrService.bookAppointment({
      patient_id,
      doctor_id,
      date,
      time,
      reason,
      phone: phone.replace(/\D/g, ''),
    });

    // Schedule reminders
    try {
      await scheduledCallService.scheduleAppointmentReminders({
        phone,
        date,
        time,
        appointmentId: result.id,
        patientId: patient_id,
        doctorName: result.doctor_name,
      });
    } catch (err) {
      console.error('Failed to schedule reminders:', err);
    }

    // Send SMS confirmation if requested
    if (send_sms !== false && phone) {
      try {
        await twilioClient.messages.create({
          body: `Appointment confirmed for ${date} at ${time} with ${result.doctor_name}. Confirmation #${result.confirmation_number}. Reply CANCEL to cancel.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`,
        });
      } catch (smsErr) {
        console.error('SMS failed:', smsErr.message);
      }
    }

    res.status(201).json({
      success: true,
      message: `Appointment booked for ${date} at ${time}`,
      appointment: result,
    });
  } catch (error) {
    console.error('Error booking appointment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================
// RESCHEDULE APPOINTMENT
// ============================================
export const rescheduleAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { new_date, new_time, new_doctor_id, reason, send_sms } = req.body;

    if (!new_date && !new_time && !new_doctor_id) {
      return res.status(400).json({
        success: false,
        error: 'At least one of new_date, new_time, or new_doctor_id is required',
      });
    }

    const result = await emrService.updateAppointment(appointmentId, {
      new_date,
      new_time,
      doctor_id: new_doctor_id,
      reason,
    });

    // Update scheduled reminders
    if (new_date || new_time) {
      await scheduledCallService.cancelAppointmentReminders(appointmentId);
      
      if (result.appointment.phone) {
        await scheduledCallService.scheduleAppointmentReminders({
          phone: result.appointment.phone,
          date: result.appointment.date,
          time: result.appointment.time,
          appointmentId,
        });
      }
    }

    // Send SMS notification
    if (send_sms !== false && result.appointment.phone) {
      try {
        const phone = result.appointment.phone;
        await twilioClient.messages.create({
          body: `Your appointment has been rescheduled to ${result.appointment.date} at ${result.appointment.time}.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`,
        });
      } catch (smsErr) {
        console.error('SMS failed:', smsErr.message);
      }
    }

    res.json({
      success: true,
      message: 'Appointment rescheduled',
      appointment: result.appointment,
    });
  } catch (error) {
    console.error('Error rescheduling:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================
// CANCEL APPOINTMENT
// ============================================
export const cancelAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { reason, send_sms } = req.body;

    const result = await emrService.cancelAppointment(appointmentId, reason);

    // Cancel reminders
    await scheduledCallService.cancelAppointmentReminders(appointmentId);

    // Send SMS notification
    if (send_sms !== false && result.appointment.phone) {
      try {
        const phone = result.appointment.phone;
        await twilioClient.messages.create({
          body: `Your appointment on ${result.appointment.date} at ${result.appointment.time} has been cancelled. Call us to reschedule.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`,
        });
      } catch (smsErr) {
        console.error('SMS failed:', smsErr.message);
      }
    }

    res.json({
      success: true,
      message: 'Appointment cancelled',
    });
  } catch (error) {
    console.error('Error cancelling:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================
// GET PATIENT APPOINTMENTS
// ============================================
export const getPatientAppointments = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { include_past } = req.query;

    const result = await emrService.getAppointmentHistory(
      patientId,
      include_past === 'true'
    );

    res.json({
      success: true,
      upcoming: result.upcoming,
      past: result.past,
      total: result.appointments.length,
    });
  } catch (error) {
    console.error('Error fetching patient appointments:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};