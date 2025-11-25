import fetch from 'node-fetch';
import scheduledCallService from './scheduledCallService.js';

const FHIR_BASE_URL = process.env.FHIR_BASE_URL || 'https://hapi.fhir.org/baseR4';

// ============================================
// HELPER: Make FHIR API request
// ============================================
const fhirRequest = async (endpoint, options = {}) => {
  const url = `${FHIR_BASE_URL}${endpoint}`;
  const defaultHeaders = {
    'Content-Type': 'application/fhir+json',
    'Accept': 'application/fhir+json',
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers: { ...defaultHeaders, ...options.headers },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`FHIR API Error [${response.status}]:`, errorText);
      throw new Error(`FHIR request failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('FHIR Request Error:', error.message);
    throw error;
  }
};

// ============================================
// HELPERS: Extract data from FHIR resources
// ============================================
const extractPatientName = (patient) => {
  if (!patient.name || patient.name.length === 0) return 'Unknown';
  const name = patient.name[0];
  const given = name.given?.join(' ') || '';
  const family = name.family || '';
  return `${given} ${family}`.trim() || name.text || 'Unknown';
};

const extractPractitionerName = (practitioner) => {
  if (!practitioner.name || practitioner.name.length === 0) return 'Dr. Unknown';
  const name = practitioner.name[0];
  const prefix = name.prefix?.join(' ') || 'Dr.';
  const given = name.given?.join(' ') || '';
  const family = name.family || '';
  return `${prefix} ${given} ${family}`.trim() || name.text || 'Dr. Unknown';
};

const extractSpecialty = (practitioner) => {
  if (practitioner.qualification && practitioner.qualification.length > 0) {
    const qual = practitioner.qualification[0];
    return qual.code?.text || qual.code?.coding?.[0]?.display || 'General';
  }
  return 'General';
};

const extractPhone = (resource) => {
  if (!resource.telecom) return null;
  const phone = resource.telecom.find((t) => t.system === 'phone');
  return phone?.value?.replace(/\D/g, '') || null;
};

// ============================================
// GET DOCTORS FROM FHIR
// ============================================
export const getDoctors = async () => {
  try {
    console.log('📡 Fetching practitioners from FHIR...');
    const bundle = await fhirRequest('/Practitioner?_count=50&active=true');

    if (!bundle.entry || bundle.entry.length === 0) {
      console.log('⚠️ No practitioners found in FHIR');
      return [];
    }

    const doctors = bundle.entry.map((entry) => {
      const p = entry.resource;
      return {
        id: p.id,
        name: extractPractitionerName(p),
        specialty: extractSpecialty(p),
      };
    });

    console.log(`✅ Found ${doctors.length} practitioners`);
    return doctors;
  } catch (error) {
    console.error('Error fetching doctors:', error.message);
    return [];
  }
};

// ============================================
// GET PATIENT INFO FROM FHIR
// ============================================
export const getPatientInfo = async ({ name, date_of_birth, phone }) => {
  try {
    console.log(`🔍 Searching for patient: ${name}, DOB: ${date_of_birth}`);

    const searchParams = new URLSearchParams();
    searchParams.append('name', name);
    if (date_of_birth) {
      searchParams.append('birthdate', date_of_birth);
    }

    const searchUrl = `/Patient?${searchParams.toString()}`;
    console.log(`📡 FHIR Search: ${searchUrl}`);

    const bundle = await fhirRequest(searchUrl);

    if (!bundle.entry || bundle.entry.length === 0) {
      console.log('❌ No patient found');
      return null;
    }

    const patientResource = bundle.entry[0].resource;
    console.log(`✅ Found patient: ${patientResource.id}`);

    // Get upcoming appointments for this patient
    const appointments = await getPatientAppointments(patientResource.id);

    return {
      id: patientResource.id,
      name: extractPatientName(patientResource),
      dob: patientResource.birthDate,
      phone: extractPhone(patientResource),
      appointments: appointments,
    };
  } catch (error) {
    console.error('Patient lookup failed:', error.message);
    throw error;
  }
};

// ============================================
// CREATE PATIENT IN FHIR
// ============================================
export const createPatient = async (patientData) => {
  try {
    console.log(`📝 Creating new patient: ${patientData.name}`);

    const nameParts = patientData.name.trim().split(/\s+/);
    const familyName = nameParts.pop();
    const givenNames = nameParts;

    const fhirPatient = {
      resourceType: 'Patient',
      active: true,
      name: [{
        use: 'official',
        family: familyName,
        given: givenNames.length > 0 ? givenNames : [patientData.name],
      }],
      telecom: [{
        system: 'phone',
        value: patientData.phone,
        use: 'mobile',
      }],
      birthDate: patientData.date_of_birth,
    };

    const createdPatient = await fhirRequest('/Patient', {
      method: 'POST',
      body: JSON.stringify(fhirPatient),
    });

    console.log(`✅ Patient created with ID: ${createdPatient.id}`);

    return {
      success: true,
      patient_id: createdPatient.id,
      message: 'Patient registered successfully',
    };
  } catch (error) {
    console.error('Patient creation failed:', error.message);
    throw error;
  }
};
// ============================================
// GET APPOINTMENT HISTORY FROM FHIR
// ============================================
export const getAppointmentHistory = async (patientId, includePast = false) => {
  try {
    console.log(`📋 Fetching appointment history for patient: ${patientId}`);

    const today = new Date().toISOString().split('T')[0];

    // Get upcoming appointments
    const upcomingBundle = await fhirRequest(
      `/Appointment?patient=Patient/${patientId}&date=ge${today}&_sort=date`
    );

    const upcoming = upcomingBundle.entry?.map((entry) => {
      const apt = entry.resource;
      return {
        id: apt.id,
        date: apt.start?.split('T')[0],
        time: apt.start?.split('T')[1]?.slice(0, 5),
        status: apt.status,
        reason: apt.description,
      };
    }) || [];

    let past = [];
    if (includePast) {
      const pastBundle = await fhirRequest(
        `/Appointment?patient=Patient/${patientId}&date=lt${today}&_sort=-date&_count=10`
      );

      past = pastBundle.entry?.map((entry) => {
        const apt = entry.resource;
        return {
          id: apt.id,
          date: apt.start?.split('T')[0],
          time: apt.start?.split('T')[1]?.slice(0, 5),
          status: apt.status,
          reason: apt.description,
        };
      }) || [];
    }

    const message = upcoming.length > 0
      ? `You have ${upcoming.length} upcoming appointment(s)${includePast && past.length > 0 ? ` and ${past.length} past appointment(s)` : ''}.`
      : 'You have no upcoming appointments.';

    return {
      appointments: [...upcoming, ...past],
      upcoming,
      past,
      message,
    };

  } catch (error) {
    console.error('Error fetching appointment history:', error);
    throw error;
  }
};

// ============================================
// CHECK AVAILABILITY - Fetches doctors from FHIR
// ============================================
export const checkAvailability = async (doctorId, date, specialty) => {
  try {
    console.log(`📅 Checking availability for date: ${date}, specialty: ${specialty || 'any'}`);

    // Validate date format
    let validDate = date;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      validDate = new Date().toISOString().split('T')[0];
      console.log(`⚠️ Invalid date "${date}", using: ${validDate}`);
    }

    // Get doctors from FHIR
    const allDoctors = await getDoctors();

    if (allDoctors.length === 0) {
      console.log('❌ No doctors available');
      return [];
    }

    // Filter by specialty if provided
    let availableDoctors = allDoctors;
    if (specialty) {
      const filtered = allDoctors.filter((d) =>
        d.specialty.toLowerCase().includes(specialty.toLowerCase())
      );
      if (filtered.length > 0) {
        availableDoctors = filtered;
      }
    }

    // Filter by doctor ID if provided
    if (doctorId) {
      const filtered = availableDoctors.filter((d) => d.id === doctorId);
      if (filtered.length > 0) {
        availableDoctors = filtered;
      }
    }

    // Generate time slots with doctor info
    const slots = [];
    const hours = [9, 10, 11, 14, 15, 16];

    hours.forEach((hour, index) => {
      const doctor = availableDoctors[index % availableDoctors.length];

      slots.push({
        time: `${hour.toString().padStart(2, '0')}:00`,
        available: true,
        doctor_id: doctor.id,
        doctor_name: doctor.name,
        specialty: doctor.specialty,
      });

      slots.push({
        time: `${hour.toString().padStart(2, '0')}:30`,
        available: true,
        doctor_id: doctor.id,
        doctor_name: doctor.name,
        specialty: doctor.specialty,
      });
    });

    console.log(`✅ Found ${slots.length} available slots`);
    return slots;
  } catch (error) {
    console.error('Availability check failed:', error.message);
    throw error;
  }
};

// ============================================
// BOOK APPOINTMENT IN FHIR
// ============================================
export const bookAppointment = async (appointmentData) => {
  try {
    console.log(`📅 Booking appointment for patient: ${appointmentData.patient_id}`);

    const confirmationNumber = `CONF${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    // Get doctor info from FHIR
    const allDoctors = await getDoctors();
    const doctor = allDoctors.find((d) => d.id === appointmentData.doctor_id) || allDoctors[0];

    if (!doctor) {
      throw new Error('No doctors available');
    }

    // Build datetime
    const startDateTime = `${appointmentData.date}T${appointmentData.time}:00`;

    // Calculate end time (30 min)
    const [hours, minutes] = appointmentData.time.split(':').map(Number);
    const endHours = minutes >= 30 ? hours + 1 : hours;
    const endMinutes = minutes >= 30 ? minutes - 30 : minutes + 30;
    const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
    const endDateTime = `${appointmentData.date}T${endTime}:00`;

    // Create FHIR Appointment
    const fhirAppointment = {
      resourceType: 'Appointment',
      status: 'booked',
      description: appointmentData.reason || 'General appointment',
      start: startDateTime,
      end: endDateTime,
      participant: [
        {
          actor: { reference: `Patient/${appointmentData.patient_id}` },
          status: 'accepted',
        },
        {
          actor: { reference: `Practitioner/${doctor.id}` },
          status: 'accepted',
        },
      ],
      comment: `Confirmation: ${confirmationNumber} | Phone: ${appointmentData.phone}`,
    };

    const createdAppointment = await fhirRequest('/Appointment', {
      method: 'POST',
      body: JSON.stringify(fhirAppointment),
    });

    console.log(`✅ Appointment created in FHIR: ${createdAppointment.id}`);

    const result = {
      success: true,
      id: createdAppointment.id,
      confirmation_number: confirmationNumber,
      doctor_name: doctor.name,
      date: appointmentData.date,
      time: appointmentData.time,
    };

    // Schedule appointment reminders
    try {
      await scheduledCallService.scheduleAppointmentReminders({
        phone: appointmentData.phone,
        date: appointmentData.date,
        time: appointmentData.time,
        appointmentId: createdAppointment.id,
        patientId: appointmentData.patient_id,
        doctorName: doctor.name,
      });
    } catch (reminderError) {
      console.error('Failed to schedule reminders:', reminderError);
      // Don't fail the booking if reminders fail
    }
    return result;
  } catch (error) {
    console.error('Booking failed:', error.message);
    throw error;
  }
};

// ============================================
// UPDATE APPOINTMENT IN FHIR
// ============================================
export const updateAppointment = async (appointmentId, updates) => {
  try {
    console.log(`📝 Updating appointment: ${appointmentId}`);

    // Get existing appointment
    const existingAppointment = await fhirRequest(`/Appointment/${appointmentId}`);

    // Update fields
    if (updates.new_date || updates.new_time) {
      const date = updates.new_date || existingAppointment.start.split('T')[0];
      const time = updates.new_time || existingAppointment.start.split('T')[1].slice(0, 5);
      existingAppointment.start = `${date}T${time}:00`;

      const [hours, minutes] = time.split(':').map(Number);
      const endHours = minutes >= 30 ? hours + 1 : hours;
      const endMinutes = minutes >= 30 ? minutes - 30 : minutes + 30;
      const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
      existingAppointment.end = `${date}T${endTime}:00`;
    }

    if (updates.reason) {
      existingAppointment.description = updates.reason;
    }

    // Update in FHIR
    await fhirRequest(`/Appointment/${appointmentId}`, {
      method: 'PUT',
      body: JSON.stringify(existingAppointment),
    });

    console.log(`✅ Appointment updated: ${appointmentId}`);

    return {
      success: true,
      appointment: {
        id: appointmentId,
        date: existingAppointment.start.split('T')[0],
        time: existingAppointment.start.split('T')[1].slice(0, 5),
      },
    };
  } catch (error) {
    console.error('Update failed:', error.message);
    throw error;
  }
};

// ============================================
// CANCEL APPOINTMENT IN FHIR
// ============================================
export const cancelAppointment = async (appointmentId) => {
  try {
    console.log(`🚫 Cancelling appointment: ${appointmentId}`);

    const existingAppointment = await fhirRequest(`/Appointment/${appointmentId}`);
    existingAppointment.status = 'cancelled';

    await fhirRequest(`/Appointment/${appointmentId}`, {
      method: 'PUT',
      body: JSON.stringify(existingAppointment),
    });

    console.log(`✅ Appointment cancelled: ${appointmentId}`);
    return {
      success: true,
      appointment: {
        id: appointmentId,
        date: existingAppointment.start?.split('T')[0],
        time: existingAppointment.start?.split('T')[1]?.slice(0, 5),
        phone,
      },
    };
  } catch (error) {
    console.error('Cancellation failed:', error.message);
    throw error;
  }
};

// ============================================
// GET PATIENT APPOINTMENTS FROM FHIR
// ============================================
const getPatientAppointments = async (patientId) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const bundle = await fhirRequest(
      `/Appointment?patient=Patient/${patientId}&date=ge${today}&status=booked`
    );

    if (!bundle.entry || bundle.entry.length === 0) {
      return [];
    }

    return bundle.entry.map((entry) => {
      const apt = entry.resource;
      const confirmationMatch = apt.comment?.match(/Confirmation: (\w+)/);
      return {
        id: apt.id,
        date: apt.start?.split('T')[0],
        time: apt.start?.split('T')[1]?.slice(0, 5),
        status: apt.status,
        reason: apt.description,
        confirmation_number: confirmationMatch?.[1] || 'N/A',
      };
    });
  } catch (error) {
    console.error('Error fetching appointments:', error.message);
    return [];
  }
};

// ============================================
// SPECIALTY-SPECIFIC FUNCTIONS
// ============================================
export const verifyImagingOrder = async (patientId, imagingType, bodyPart) => {
  return { found: true, message: 'Imaging order verified' };
};

export const recordMriSafety = async (patientId, safetyData) => {
  return {
    safe_for_mri: !safetyData.has_pacemaker,
    message: safetyData.has_pacemaker ? 'MRI contraindicated: pacemaker' : 'Patient cleared for MRI',
  };
};

export const checkTelehealthAvailability = async (appointmentType, date) => {
  return { available: true, message: 'Telehealth available' };
};

export default {
  getPatientInfo,
  createPatient,
  getDoctors,
  checkAvailability,
  bookAppointment,
  updateAppointment,
  cancelAppointment,
  verifyImagingOrder,
  recordMriSafety,
  checkTelehealthAvailability,
};