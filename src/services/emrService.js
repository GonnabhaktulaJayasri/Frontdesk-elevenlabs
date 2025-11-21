// services/emrService.js
// Simple in-memory data store (replace with database in production)

// Mock patient database
let patients = [
  {
    id: 'PAT001',
    name: 'John Doe',
    date_of_birth: '1985-05-15',
    phone: '5551234567',
  },
  {
    id: 'PAT002',
    name: 'Jane Smith',
    date_of_birth: '1990-08-22',
    phone: '5559876543',
  },
];

// Mock appointments database
let appointments = [];

// Mock doctors/availability
const doctors = [
  { id: 'DOC001', name: 'Dr. Sarah Johnson', specialty: 'General Practice' },
  { id: 'DOC002', name: 'Dr. Michael Chen', specialty: 'Cardiology' },
  { id: 'DOC003', name: 'Dr. Emily Rodriguez', specialty: 'Pediatrics' },
];

// Generate available time slots for a given date
const generateTimeSlots = (date) => {
  const slots = [];
  const hours = [9, 10, 11, 14, 15, 16]; // 9am-11am, 2pm-4pm

  hours.forEach((hour) => {
    slots.push({
      time: `${hour.toString().padStart(2, '0')}:00`,
      available: true,
      doctor_id: doctors[Math.floor(Math.random() * doctors.length)].id,
    });
    slots.push({
      time: `${hour.toString().padStart(2, '0')}:30`,
      available: true,
      doctor_id: doctors[Math.floor(Math.random() * doctors.length)].id,
    });
  });

  return slots;
};

// Check availability
export const checkAvailability = async (doctorId, date, specialty) => {
  try {
    let slots = generateTimeSlots(date);

    if (doctorId) {
      slots = slots.filter((slot) => slot.doctor_id === doctorId);
    }

    if (specialty) {
      const specialtyDoctors = doctors
        .filter((doc) =>
          doc.specialty.toLowerCase().includes(specialty.toLowerCase())
        )
        .map((doc) => doc.id);

      slots = slots.filter((slot) =>
        specialtyDoctors.includes(slot.doctor_id)
      );
    }

    slots = slots.map((slot) => {
      const doctor = doctors.find((d) => d.id === slot.doctor_id);
      return {
        ...slot,
        doctor_name: doctor?.name || 'Unknown',
        specialty: doctor?.specialty || 'Unknown',
      };
    });

    return slots;
  } catch (error) {
    console.error('Availability check failed:', error);
    throw error;
  }
};

// Book appointment
export const bookAppointment = async (appointmentData) => {
  try {
    const appointmentId = `APT${Date.now()}`;
    const confirmationNumber = `CONF${Math.random()
      .toString(36)
      .substring(2, 10)
      .toUpperCase()}`;

    const doctor = doctors.find((d) => d.id === appointmentData.doctor_id);

    const appointment = {
      id: appointmentId,
      confirmation_number: confirmationNumber,
      patient_id: appointmentData.patient_id,
      doctor_id: appointmentData.doctor_id,
      doctor_name: doctor?.name || 'Unknown',
      date: appointmentData.date,
      time: appointmentData.time,
      reason: appointmentData.reason || 'General checkup',
      phone: appointmentData.phone,
      status: 'scheduled',
      created_at: new Date().toISOString(),
    };

    appointments.push(appointment);

    return {
      success: true,
      id: appointmentId,
      confirmation_number: confirmationNumber,
      doctor_name: doctor?.name || 'Unknown',
    };
  } catch (error) {
    console.error('Booking failed:', error);
    throw error;
  }
};

// Get patient info
export const getPatientInfo = async ({ name, date_of_birth, phone }) => {
  try {
    let patient = patients.find(
      (p) =>
        p.name.toLowerCase().includes(name.toLowerCase()) &&
        p.date_of_birth === date_of_birth
    );

    if (!patient && phone) {
      patient = patients.find((p) => p.phone === phone.replace(/\D/g, ''));
    }

    if (!patient) return null;

    const patientAppointments = appointments.filter(
      (apt) => apt.patient_id === patient.id && apt.status === 'scheduled'
    );

    return {
      id: patient.id,
      name: patient.name,
      dob: patient.date_of_birth,
      phone: patient.phone,
      appointments: patientAppointments,
    };
  } catch (error) {
    console.error('Patient lookup failed:', error);
    throw error;
  }
};

// Create new patient
export const createPatient = async (patientData) => {
  try {
    const patientId = `PAT${String(patients.length + 1).padStart(3, '0')}`;

    const newPatient = {
      id: patientId,
      name: patientData.name,
      date_of_birth: patientData.date_of_birth,
      phone: patientData.phone.replace(/\D/g, ''),
      created_at: new Date().toISOString(),
    };

    patients.push(newPatient);

    return {
      success: true,
      patient_id: patientId,
      message: 'Patient registered successfully',
    };
  } catch (error) {
    console.error('Patient creation failed:', error);
    throw error;
  }
};

// Update appointment
export const updateAppointment = async (appointmentId, updates) => {
  try {
    const index = appointments.findIndex((apt) => apt.id === appointmentId);

    if (index === -1) throw new Error('Appointment not found');

    appointments[index] = {
      ...appointments[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    return {
      success: true,
      appointment: appointments[index],
    };
  } catch (error) {
    console.error('Appointment update failed:', error);
    throw error;
  }
};

// Cancel appointment
export const cancelAppointment = async (appointmentId) => {
  try {
    const index = appointments.findIndex((apt) => apt.id === appointmentId);

    if (index === -1) throw new Error('Appointment not found');

    appointments[index].status = 'cancelled';
    appointments[index].cancelled_at = new Date().toISOString();

    return {
      success: true,
      message: 'Appointment cancelled successfully',
    };
  } catch (error) {
    console.error('Appointment cancellation failed:', error);
    throw error;
  }
};

// Get all doctors
export const getDoctors = () => doctors;
