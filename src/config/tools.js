// config/tools.js
module.exports = [
  {
    type: 'webhook',
    name: 'get_patient_info',
    description: 'Retrieve existing patient information. Use this FIRST before booking any appointment to verify patient identity. Required parameters: name (full name) and date_of_birth (YYYY-MM-DD format).',
    url: `${process.env.SERVER_URL}/tools/get-patient-info`,
    method: 'POST',
    body_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Patient full name as spoken',
        },
        date_of_birth: {
          type: 'string',
          description: 'Date of birth in YYYY-MM-DD format (e.g., "1985-05-15")',
        },
        phone: {
          type: 'string',
          description: 'Phone number for additional verification (numeric only)',
        },
      },
      required: ['name', 'date_of_birth'],
    },
  },
  {
    type: 'webhook',
    name: 'register_patient',
    description: 'Register a new patient in the system. Use when patient is not found during lookup. Required: name, date_of_birth, and phone.',
    url: `${process.env.SERVER_URL}/tools/register-patient`,
    method: 'POST',
    body_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Patient full name',
        },
        date_of_birth: {
          type: 'string',
          description: 'Date of birth in YYYY-MM-DD format',
        },
        phone: {
          type: 'string',
          description: 'Phone number (numeric only)',
        },
      },
      required: ['name', 'date_of_birth', 'phone'],
    },
  },
  {
    type: 'webhook',
    name: 'check_availability',
    description: 'Check available appointment slots for a specific date or specialty. Use AFTER getting patient information. Returns available time slots.',
    url: `${process.env.SERVER_URL}/tools/check-availability`,
    method: 'POST',
    body_schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Preferred date in YYYY-MM-DD format',
        },
        doctor_id: {
          type: 'string',
          description: 'Specific doctor ID (optional)',
        },
        specialty: {
          type: 'string',
          description: 'Medical specialty like "cardiology" or "pediatrics" (optional)',
        },
      },
      required: ['date'],
    },
  },
  {
    type: 'webhook',
    name: 'book_appointment',
    description: 'Book a new appointment. IMPORTANT: Use this ONLY after (1) verifying patient with get_patient_info, (2) checking availability, and (3) confirming all details with the patient verbally. This step is critical.',
    url: `${process.env.SERVER_URL}/tools/book-appointment`,
    method: 'POST',
    body_schema: {
      type: 'object',
      properties: {
        patient_id: {
          type: 'string',
          description: 'Patient ID from get_patient_info response',
        },
        doctor_id: {
          type: 'string',
          description: 'Doctor ID from availability check',
        },
        date: {
          type: 'string',
          description: 'Appointment date in YYYY-MM-DD format',
        },
        time: {
          type: 'string',
          description: 'Appointment time in HH:MM 24-hour format (e.g., "14:30")',
        },
        reason: {
          type: 'string',
          description: 'Reason for visit',
        },
        phone: {
          type: 'string',
          description: 'Patient phone number for confirmation (numeric only)',
        },
      },
      required: ['patient_id', 'doctor_id', 'date', 'time', 'phone'],
    },
  },
  {
    type: 'webhook',
    name: 'update_appointment',
    description: 'Reschedule or modify an existing appointment. Use when patient wants to change their appointment time or date.',
    url: `${process.env.SERVER_URL}/tools/update-appointment`,
    method: 'POST',
    body_schema: {
      type: 'object',
      properties: {
        appointment_id: {
          type: 'string',
          description: 'Existing appointment ID from patient record',
        },
        new_date: {
          type: 'string',
          description: 'New appointment date in YYYY-MM-DD format (optional)',
        },
        new_time: {
          type: 'string',
          description: 'New appointment time in HH:MM format (optional)',
        },
        reason: {
          type: 'string',
          description: 'Reason for rescheduling (optional)',
        },
      },
      required: ['appointment_id'],
    },
  },
  {
    type: 'webhook',
    name: 'schedule_callback',
    description: 'Schedule a callback when patient requests "call me back in X minutes". Use when patient wants to be called back later.',
    url: `${process.env.SERVER_URL}/tools/schedule-callback`,
    method: 'POST',
    body_schema: {
      type: 'object',
      properties: {
        phone_number: {
          type: 'string',
          description: 'Patient phone number to call back',
        },
        delay_minutes: {
          type: 'number',
          description: 'Number of minutes to wait before calling back (e.g., 5, 10, 30)',
        },
        reason: {
          type: 'string',
          description: 'Reason for callback (optional)',
        },
      },
      required: ['phone_number', 'delay_minutes'],
    },
  },
  {
    type: 'webhook',
    name: 'get_appointment_history',
    description: 'Retrieve patient appointment history from EMR. Use when patient asks about their past or upcoming appointments.',
    url: `${process.env.SERVER_URL}/tools/appointment-history`,
    method: 'POST',
    body_schema: {
      type: 'object',
      properties: {
        patient_id: {
          type: 'string',
          description: 'Patient ID from get_patient_info',
        },
        include_past: {
          type: 'boolean',
          description: 'Include past appointments (default: false, only upcoming)',
        },
      },
      required: ['patient_id'],
    },
  },
  {
    type: 'webhook',
    name: 'cancel_appointment',
    description: 'Cancel an existing appointment. Use when patient wants to cancel their appointment.',
    url: `${process.env.SERVER_URL}/tools/cancel-appointment`,
    method: 'POST',
    body_schema: {
      type: 'object',
      properties: {
        appointment_id: {
          type: 'string',
          description: 'Appointment ID to cancel',
        },
        reason: {
          type: 'string',
          description: 'Reason for cancellation (optional)',
        },
      },
      required: ['appointment_id'],
    },
  },
];