import fetch from 'node-fetch';
import Staff from '../models/staff.js';
import scheduledCallService from './scheduledCallService.js';

const FHIR_BASE_URL = process.env.FHIR_BASE_URL || 'https://hapi.fhir.org/baseR4';

// ============================================
// FHIR API HELPER
// ============================================
const fhirRequest = async (endpoint, options = {}) => {
  const url = `${FHIR_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/fhir+json',
      'Accept': 'application/fhir+json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`FHIR Error [${response.status}]:`, error);
    throw new Error(`FHIR request failed: ${response.status}`);
  }

  // Handle 204 No Content
  if (response.status === 204) return { success: true };
  
  return response.json();
};

// ============================================
// HELPER FUNCTIONS
// ============================================
const extractName = (resource) => {
  if (!resource.name?.[0]) return 'Unknown';
  const n = resource.name[0];
  const prefix = n.prefix?.join(' ') || '';
  const given = n.given?.join(' ') || '';
  const family = n.family || '';
  return `${prefix} ${given} ${family}`.trim() || n.text || 'Unknown';
};

const extractPhone = (resource) => {
  const phone = resource.telecom?.find(t => t.system === 'phone');
  return phone?.value?.replace(/\D/g, '') || null;
};

const extractEmail = (resource) => {
  const email = resource.telecom?.find(t => t.system === 'email');
  return email?.value || null;
};

const extractSpecialty = (practitioner) => {
  const qual = practitioner.qualification?.[0];
  return qual?.code?.text || qual?.code?.coding?.[0]?.display || 'General';
};

// ============================================
// PATIENT MANAGEMENT
// ============================================
export const getPatientInfo = async ({ name, date_of_birth, phone }) => {
  console.log(`🔍 Searching patient: ${name}, DOB: ${date_of_birth}`);

  const params = new URLSearchParams();
  params.append('name', name);
  if (date_of_birth) params.append('birthdate', date_of_birth);
  if (phone) params.append('telecom', phone);

  const bundle = await fhirRequest(`/Patient?${params}`);

  if (!bundle.entry?.length) return null;

  const patient = bundle.entry[0].resource;
  const appointments = await getPatientAppointments(patient.id);

  return {
    id: patient.id,
    name: extractName(patient),
    dob: patient.birthDate,
    phone: extractPhone(patient),
    email: extractEmail(patient),
    appointments,
  };
};

export const getPatientById = async (patientId) => {
  const patient = await fhirRequest(`/Patient/${patientId}`);
  return {
    id: patient.id,
    name: extractName(patient),
    dob: patient.birthDate,
    phone: extractPhone(patient),
    email: extractEmail(patient),
  };
};

export const createPatient = async (data) => {
  const nameParts = data.name.trim().split(/\s+/);
  const family = nameParts.pop();
  const given = nameParts.length ? nameParts : [data.name];

  const patient = {
    resourceType: 'Patient',
    active: true,
    name: [{ use: 'official', family, given }],
    birthDate: data.date_of_birth,
    telecom: [
      { system: 'phone', value: data.phone, use: 'mobile' },
      data.email && { system: 'email', value: data.email },
    ].filter(Boolean),
  };

  const created = await fhirRequest('/Patient', {
    method: 'POST',
    body: JSON.stringify(patient),
  });

  return { success: true, patient_id: created.id };
};

export const updatePatient = async (patientId, updates) => {
  const existing = await fhirRequest(`/Patient/${patientId}`);

  if (updates.name) {
    const parts = updates.name.trim().split(/\s+/);
    existing.name = [{ use: 'official', family: parts.pop(), given: parts }];
  }
  if (updates.phone) {
    const phoneIdx = existing.telecom?.findIndex(t => t.system === 'phone') ?? -1;
    if (phoneIdx >= 0) existing.telecom[phoneIdx].value = updates.phone;
    else existing.telecom = [...(existing.telecom || []), { system: 'phone', value: updates.phone }];
  }
  if (updates.email) {
    const emailIdx = existing.telecom?.findIndex(t => t.system === 'email') ?? -1;
    if (emailIdx >= 0) existing.telecom[emailIdx].value = updates.email;
    else existing.telecom = [...(existing.telecom || []), { system: 'email', value: updates.email }];
  }

  await fhirRequest(`/Patient/${patientId}`, {
    method: 'PUT',
    body: JSON.stringify(existing),
  });

  return { success: true, patient_id: patientId };
};

export const searchPatients = async (query, limit = 20) => {
  const bundle = await fhirRequest(`/Patient?name=${encodeURIComponent(query)}&_count=${limit}`);
  
  return bundle.entry?.map(e => ({
    id: e.resource.id,
    name: extractName(e.resource),
    dob: e.resource.birthDate,
    phone: extractPhone(e.resource),
  })) || [];
};

// ============================================
// APPOINTMENT MANAGEMENT
// ============================================
export const getPatientAppointments = async (patientId) => {
  const today = new Date().toISOString().split('T')[0];
  const bundle = await fhirRequest(
    `/Appointment?patient=Patient/${patientId}&date=ge${today}&status=booked&_sort=date`
  );

  return bundle.entry?.map(e => {
    const apt = e.resource;
    const confMatch = apt.comment?.match(/Confirmation: (\w+)/);
    return {
      id: apt.id,
      date: apt.start?.split('T')[0],
      time: apt.start?.split('T')[1]?.slice(0, 5),
      status: apt.status,
      reason: apt.description,
      confirmation_number: confMatch?.[1] || 'N/A',
    };
  }) || [];
};

export const getAppointmentById = async (appointmentId) => {
  const apt = await fhirRequest(`/Appointment/${appointmentId}`);
  
  // Extract patient and practitioner IDs
  const patientRef = apt.participant?.find(p => p.actor?.reference?.startsWith('Patient/'));
  const practRef = apt.participant?.find(p => p.actor?.reference?.startsWith('Practitioner/'));
  
  const confMatch = apt.comment?.match(/Confirmation: (\w+)/);
  const phoneMatch = apt.comment?.match(/Phone: (\+?\d+)/);

  return {
    id: apt.id,
    date: apt.start?.split('T')[0],
    time: apt.start?.split('T')[1]?.slice(0, 5),
    endTime: apt.end?.split('T')[1]?.slice(0, 5),
    status: apt.status,
    reason: apt.description,
    confirmation_number: confMatch?.[1],
    phone: phoneMatch?.[1],
    patient_id: patientRef?.actor?.reference?.replace('Patient/', ''),
    doctor_id: practRef?.actor?.reference?.replace('Practitioner/', ''),
  };
};

export const getAppointmentHistory = async (patientId, includePast = false) => {
  const today = new Date().toISOString().split('T')[0];

  const upcomingBundle = await fhirRequest(
    `/Appointment?patient=Patient/${patientId}&date=ge${today}&_sort=date`
  );

  const upcoming = upcomingBundle.entry?.map(e => ({
    id: e.resource.id,
    date: e.resource.start?.split('T')[0],
    time: e.resource.start?.split('T')[1]?.slice(0, 5),
    status: e.resource.status,
    reason: e.resource.description,
  })) || [];

  let past = [];
  if (includePast) {
    const pastBundle = await fhirRequest(
      `/Appointment?patient=Patient/${patientId}&date=lt${today}&_sort=-date&_count=20`
    );
    past = pastBundle.entry?.map(e => ({
      id: e.resource.id,
      date: e.resource.start?.split('T')[0],
      time: e.resource.start?.split('T')[1]?.slice(0, 5),
      status: e.resource.status,
      reason: e.resource.description,
    })) || [];
  }

  return { upcoming, past, appointments: [...upcoming, ...past] };
};

export const checkAvailability = async (doctorId, date, specialty, hospitalId) => {
  let doctors = await getDoctors(hospitalId);

  if (!doctors.length) {
    console.log('⚠️ No doctors found');
    return [];
  }

  if (specialty) {
    const filtered = doctors.filter(d => 
      d.specialty.toLowerCase().includes(specialty.toLowerCase())
    );
    if (filtered.length) doctors = filtered;
  }

  if (doctorId) {
    const filtered = doctors.filter(d => d.id === doctorId);
    if (filtered.length) doctors = filtered;
  }

  // Check existing appointments for the date
  const existingBundle = await fhirRequest(
    `/Appointment?date=${date}&status=booked`
  );
  
  const bookedSlots = new Set();
  existingBundle.entry?.forEach(e => {
    const time = e.resource.start?.split('T')[1]?.slice(0, 5);
    const docRef = e.resource.participant?.find(p => 
      p.actor?.reference?.startsWith('Practitioner/')
    )?.actor?.reference;
    if (time && docRef) {
      bookedSlots.add(`${docRef}-${time}`);
    }
  });

  // Generate available slots
  const slots = [];
  const hours = [9, 10, 11, 14, 15, 16];

  doctors.forEach(doctor => {
    hours.forEach(hour => {
      ['00', '30'].forEach(min => {
        const time = `${hour.toString().padStart(2, '0')}:${min}`;
        const key = `Practitioner/${doctor.id}-${time}`;
        
        if (!bookedSlots.has(key)) {
          slots.push({
            time,
            available: true,
            doctor_id: doctor.id,
            doctor_name: doctor.name,
            specialty: doctor.specialty,
          });
        }
      });
    });
  });

  return slots;
};

export const bookAppointment = async (data) => {
  const { patient_id, doctor_id, date, time, reason, phone } = data;

  const confirmation = `CONF${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  
  const startDateTime = `${date}T${time}:00`;
  const [h, m] = time.split(':').map(Number);
  const endH = m >= 30 ? h + 1 : h;
  const endM = m >= 30 ? m - 30 : m + 30;
  const endDateTime = `${date}T${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}:00`;

  const appointment = {
    resourceType: 'Appointment',
    status: 'booked',
    description: reason || 'General appointment',
    start: startDateTime,
    end: endDateTime,
    participant: [
      { actor: { reference: `Patient/${patient_id}` }, status: 'accepted' },
      { actor: { reference: `Practitioner/${doctor_id}` }, status: 'accepted' },
    ],
    comment: `Confirmation: ${confirmation} | Phone: ${phone}`,
  };

  const created = await fhirRequest('/Appointment', {
    method: 'POST',
    body: JSON.stringify(appointment),
  });

  // Get doctor name
  const doctors = await getDoctors();
  const doctor = doctors.find(d => d.id === doctor_id);

  const result = {
    success: true,
    id: created.id,
    confirmation_number: confirmation,
    doctor_name: doctor?.name || 'Doctor',
    date,
    time,
  };

  // Schedule appointment reminders
  try {
    await scheduledCallService.scheduleAppointmentReminders({
      phone,
      date,
      time,
      appointmentId: created.id,
      patientId: patient_id,
      doctorName: doctor?.name || 'Doctor',
    });
    console.log('✅ Appointment reminders scheduled');
  } catch (reminderError) {
    console.error('Failed to schedule reminders:', reminderError);
    // Don't fail the booking if reminders fail
  }

  return result;
};

export const updateAppointment = async (appointmentId, updates) => {
  const existing = await fhirRequest(`/Appointment/${appointmentId}`);

  if (updates.new_date || updates.new_time) {
    const date = updates.new_date || existing.start.split('T')[0];
    const time = updates.new_time || existing.start.split('T')[1].slice(0, 5);
    
    existing.start = `${date}T${time}:00`;
    
    const [h, m] = time.split(':').map(Number);
    const endH = m >= 30 ? h + 1 : h;
    const endM = m >= 30 ? m - 30 : m + 30;
    existing.end = `${date}T${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}:00`;

    // Reschedule reminders if date/time changed
    const phoneMatch = existing.comment?.match(/Phone: (\+?\d+)/);
    const patientRef = existing.participant?.find(p => p.actor?.reference?.startsWith('Patient/'));
    
    if (phoneMatch?.[1]) {
      try {
        // Cancel old reminders
        await scheduledCallService.cancelAppointmentReminders(appointmentId);
        // Schedule new reminders
        await scheduledCallService.scheduleAppointmentReminders({
          phone: phoneMatch[1],
          date,
          time,
          appointmentId,
          patientId: patientRef?.actor?.reference?.replace('Patient/', ''),
        });
        console.log('✅ Appointment reminders rescheduled');
      } catch (reminderError) {
        console.error('Failed to reschedule reminders:', reminderError);
      }
    }
  }

  if (updates.reason) {
    existing.description = updates.reason;
  }

  if (updates.doctor_id) {
    const practIdx = existing.participant.findIndex(p => 
      p.actor?.reference?.startsWith('Practitioner/')
    );
    if (practIdx >= 0) {
      existing.participant[practIdx].actor.reference = `Practitioner/${updates.doctor_id}`;
    }
  }

  await fhirRequest(`/Appointment/${appointmentId}`, {
    method: 'PUT',
    body: JSON.stringify(existing),
  });

  const phoneMatch = existing.comment?.match(/Phone: (\+?\d+)/);

  return {
    success: true,
    appointment: {
      id: appointmentId,
      date: existing.start.split('T')[0],
      time: existing.start.split('T')[1].slice(0, 5),
      phone: phoneMatch?.[1],
    },
  };
};

export const cancelAppointment = async (appointmentId, reason) => {
  const existing = await fhirRequest(`/Appointment/${appointmentId}`);
  
  existing.status = 'cancelled';
  if (reason) {
    existing.cancelationReason = { text: reason };
  }

  await fhirRequest(`/Appointment/${appointmentId}`, {
    method: 'PUT',
    body: JSON.stringify(existing),
  });

  // Cancel any scheduled reminders for this appointment
  try {
    await scheduledCallService.cancelAppointmentReminders(appointmentId);
    console.log('✅ Appointment reminders cancelled');
  } catch (cancelError) {
    console.error('Failed to cancel reminders:', cancelError);
  }

  const phoneMatch = existing.comment?.match(/Phone: (\+?\d+)/);

  return {
    success: true,
    appointment: {
      id: appointmentId,
      date: existing.start?.split('T')[0],
      time: existing.start?.split('T')[1]?.slice(0, 5),
      phone: phoneMatch?.[1],
    },
  };
};

export const getAllAppointments = async (filters = {}) => {
  const { date, status, doctor_id, limit = 10 } = filters;
  
  const params = new URLSearchParams();
  params.append('_count', limit);
  params.append('_sort', '-date');
  
  if (date) params.append('date', date);
  if (status) params.append('status', status);
  if (doctor_id) params.append('practitioner', `Practitioner/${doctor_id}`);

  const bundle = await fhirRequest(`/Appointment?${params}`);

  return bundle.entry?.map(e => {
    const apt = e.resource;
    const confMatch = apt.comment?.match(/Confirmation: (\w+)/);
    return {
      id: apt.id,
      date: apt.start?.split('T')[0],
      time: apt.start?.split('T')[1]?.slice(0, 5),
      status: apt.status,
      reason: apt.description,
      confirmation_number: confMatch?.[1],
    };
  }) || [];
};

// ============================================
// DOCTOR/PRACTITIONER MANAGEMENT
// ============================================
export const getDoctors = async (hospitalId) => {
  // If hospitalId provided, get from Staff collection first
  if (hospitalId) {
    const staff = await Staff.find({ 
      hospitalId, 
      role: 'doctor', 
      isActive: true 
    });
    
    if (staff.length) {
      return staff.map(s => ({
        id: s.fhirPractitionerId,
        name: s.name,
        specialty: s.specialty || 'General',
        phone: s.phone,
        email: s.email,
      }));
    }
  }

  // Fallback to FHIR
  const bundle = await fhirRequest('/Practitioner?_count=10&active=true');
  
  return bundle.entry?.map(e => ({
    id: e.resource.id,
    name: extractName(e.resource),
    specialty: extractSpecialty(e.resource),
    phone: extractPhone(e.resource),
    email: extractEmail(e.resource),
  })) || [];
};

export const getDoctorById = async (doctorId) => {
  const practitioner = await fhirRequest(`/Practitioner/${doctorId}`);
  
  return {
    id: practitioner.id,
    name: extractName(practitioner),
    specialty: extractSpecialty(practitioner),
    phone: extractPhone(practitioner),
    email: extractEmail(practitioner),
  };
};

export const createDoctor = async (hospitalId, data) => {
  const { name, specialty, phone, email, workingHours } = data;

  const nameParts = name.trim().split(/\s+/);
  const family = nameParts.pop();
  const given = nameParts.length ? nameParts : [name];

  const practitioner = {
    resourceType: 'Practitioner',
    active: true,
    name: [{ use: 'official', prefix: ['Dr.'], family, given }],
    telecom: [
      { system: 'phone', value: phone, use: 'work' },
      email && { system: 'email', value: email, use: 'work' },
    ].filter(Boolean),
    qualification: specialty ? [{
      code: {
        text: specialty,
        coding: [{
          system: 'http://orionwest.com/specialty',
          code: specialty.toLowerCase().replace(/\s+/g, '-'),
          display: specialty,
        }],
      },
    }] : undefined,
  };

  const created = await fhirRequest('/Practitioner', {
    method: 'POST',
    body: JSON.stringify(practitioner),
  });

  // Also save to Staff collection for hospital association
  const staff = await Staff.create({
    hospitalId,
    fhirPractitionerId: created.id,
    name: `Dr. ${given.join(' ')} ${family}`,
    role: 'doctor',
    specialty,
    phone,
    email,
    workingHours,
    isActive: true,
  });

  return {
    success: true,
    doctor: {
      id: created.id,
      staff_id: staff._id,
      name: staff.name,
      specialty,
    },
  };
};

export const updateDoctor = async (doctorId, updates) => {
  const existing = await fhirRequest(`/Practitioner/${doctorId}`);

  if (updates.name) {
    const parts = updates.name.replace(/^Dr\.?\s*/i, '').trim().split(/\s+/);
    existing.name = [{ use: 'official', prefix: ['Dr.'], family: parts.pop(), given: parts }];
  }

  if (updates.specialty) {
    existing.qualification = [{
      code: {
        text: updates.specialty,
        coding: [{
          system: 'http://orionwest.com/specialty',
          code: updates.specialty.toLowerCase().replace(/\s+/g, '-'),
          display: updates.specialty,
        }],
      },
    }];
  }

  if (updates.phone) {
    const phoneIdx = existing.telecom?.findIndex(t => t.system === 'phone') ?? -1;
    if (phoneIdx >= 0) existing.telecom[phoneIdx].value = updates.phone;
    else existing.telecom = [...(existing.telecom || []), { system: 'phone', value: updates.phone }];
  }

  await fhirRequest(`/Practitioner/${doctorId}`, {
    method: 'PUT',
    body: JSON.stringify(existing),
  });

  // Update Staff collection too
  await Staff.findOneAndUpdate(
    { fhirPractitionerId: doctorId },
    { 
      name: updates.name,
      specialty: updates.specialty,
      phone: updates.phone,
      email: updates.email,
    }
  );

  return { success: true, doctor_id: doctorId };
};

export const deleteDoctor = async (doctorId, hospitalId) => {
  // Soft delete - mark as inactive
  const existing = await fhirRequest(`/Practitioner/${doctorId}`);
  existing.active = false;

  await fhirRequest(`/Practitioner/${doctorId}`, {
    method: 'PUT',
    body: JSON.stringify(existing),
  });

  // Update Staff collection
  await Staff.findOneAndUpdate(
    { fhirPractitionerId: doctorId, hospitalId },
    { isActive: false }
  );

  return { success: true };
};

// ============================================
// STAFF/RECEPTIONIST MANAGEMENT
// ============================================
export const createStaff = async (hospitalId, data) => {
  const { 
    name, role, phone, email, extension,
    isEmergencyContact, emergencyPriority, workingHours 
  } = data;

  // Create in FHIR as Practitioner with role
  const nameParts = name.trim().split(/\s+/);
  const family = nameParts.pop();
  const given = nameParts.length ? nameParts : [name];

  const practitioner = {
    resourceType: 'Practitioner',
    active: true,
    name: [{ use: 'official', family, given }],
    telecom: [
      { system: 'phone', value: phone, use: 'work' },
      email && { system: 'email', value: email, use: 'work' },
      extension && { system: 'phone', value: extension, use: 'work', 
        extension: [{ url: 'http://orionwest.com/extension-type', valueString: 'internal' }]
      },
    ].filter(Boolean),
    qualification: [{
      code: { text: role, coding: [{ display: role }] },
    }],
  };

  const created = await fhirRequest('/Practitioner', {
    method: 'POST',
    body: JSON.stringify(practitioner),
  });

  // Save to Staff collection
  const staff = await Staff.create({
    hospitalId,
    fhirPractitionerId: created.id,
    name,
    role,
    phone,
    email,
    extension,
    isEmergencyContact: isEmergencyContact || false,
    emergencyPriority: emergencyPriority || 0,
    workingHours,
    isActive: true,
  });

  return {
    success: true,
    staff: {
      id: staff._id,
      fhir_id: created.id,
      name: staff.name,
      role: staff.role,
    },
  };
};

export const getStaff = async (hospitalId, filters = {}) => {
  const query = { hospitalId, isActive: true };
  
  if (filters.role) query.role = filters.role;
  if (filters.isEmergencyContact) query.isEmergencyContact = true;

  const staff = await Staff.find(query).sort({ role: 1, name: 1 });

  return staff.map(s => ({
    id: s._id,
    fhir_id: s.fhirPractitionerId,
    name: s.name,
    role: s.role,
    specialty: s.specialty,
    phone: s.phone,
    email: s.email,
    extension: s.extension,
    isEmergencyContact: s.isEmergencyContact,
    emergencyPriority: s.emergencyPriority,
    availableForTransfer: s.availableForTransfer,
  }));
};

export const updateStaff = async (staffId, updates) => {
  const staff = await Staff.findByIdAndUpdate(staffId, updates, { new: true });
  
  if (!staff) throw new Error('Staff not found');

  // Update FHIR if name/phone changed
  if (updates.name || updates.phone || updates.email) {
    const existing = await fhirRequest(`/Practitioner/${staff.fhirPractitionerId}`);
    
    if (updates.name) {
      const parts = updates.name.trim().split(/\s+/);
      existing.name = [{ use: 'official', family: parts.pop(), given: parts }];
    }
    if (updates.phone) {
      const idx = existing.telecom?.findIndex(t => t.system === 'phone') ?? -1;
      if (idx >= 0) existing.telecom[idx].value = updates.phone;
    }

    await fhirRequest(`/Practitioner/${staff.fhirPractitionerId}`, {
      method: 'PUT',
      body: JSON.stringify(existing),
    });
  }

  return { success: true, staff };
};

export const deleteStaff = async (staffId) => {
  const staff = await Staff.findByIdAndUpdate(staffId, { isActive: false });
  
  if (staff?.fhirPractitionerId) {
    const existing = await fhirRequest(`/Practitioner/${staff.fhirPractitionerId}`);
    existing.active = false;
    await fhirRequest(`/Practitioner/${staff.fhirPractitionerId}`, {
      method: 'PUT',
      body: JSON.stringify(existing),
    });
  }

  return { success: true };
};

// ============================================
// EMERGENCY CONTACTS FOR AI TRANSFER
// ============================================
export const getEmergencyContacts = async (hospitalId) => {
  const contacts = await Staff.find({
    hospitalId,
    isEmergencyContact: true,
    isActive: true,
    availableForTransfer: true,
  }).sort({ emergencyPriority: -1 });

  return contacts.map(c => ({
    id: c._id,
    name: c.name,
    role: c.role,
    phone: c.phone,
    extension: c.extension,
    priority: c.emergencyPriority,
  }));
};

export const getTransferTarget = async (hospitalId, situation = 'general') => {
  // Get best available person to transfer to
  const query = {
    hospitalId,
    isActive: true,
    availableForTransfer: true,
  };

  // For emergencies, prioritize emergency contacts
  if (situation === 'emergency' || situation === 'critical') {
    query.isEmergencyContact = true;
  } else {
    // For general transfers, prefer receptionists
    query.role = { $in: ['receptionist', 'admin', 'nurse'] };
  }

  const staff = await Staff.findOne(query).sort({ emergencyPriority: -1 });

  if (!staff) {
    // Fallback to any available staff
    const fallback = await Staff.findOne({
      hospitalId,
      isActive: true,
      availableForTransfer: true,
    }).sort({ emergencyPriority: -1 });

    return fallback ? {
      name: fallback.name,
      phone: fallback.phone,
      extension: fallback.extension,
    } : null;
  }

  return {
    name: staff.name,
    phone: staff.phone,
    extension: staff.extension,
    role: staff.role,
  };
};

// Legacy exports for backward compatibility
export const verifyImagingOrder = async () => ({ found: true, message: 'Order verified' });
export const recordMriSafety = async (patientId, data) => ({
  safe_for_mri: !data.has_pacemaker,
  message: data.has_pacemaker ? 'MRI contraindicated' : 'Cleared for MRI',
});
export const checkTelehealthAvailability = async () => ({ available: true, message: 'Available' });

export default {
  getPatientInfo, getPatientById, createPatient, updatePatient, searchPatients,
  getPatientAppointments, getAppointmentById, getAppointmentHistory,
  checkAvailability, bookAppointment, updateAppointment, cancelAppointment, getAllAppointments,
  getDoctors, getDoctorById, createDoctor, updateDoctor, deleteDoctor,
  createStaff, getStaff, updateStaff, deleteStaff,
  getEmergencyContacts, getTransferTarget,
};