// services/toolRegistration.js
const registerAgentTools = async (agentId) => {
  const tools = [
    {
      type: 'webhook',
      name: 'check_availability',
      description: 'Check available appointment slots for a specific doctor or specialty. Use this when the patient wants to know available times.',
      url: `${process.env.SERVER_URL}/tools/check-availability`,
      method: 'POST',
      parameters: {
        doctor_id: {
          type: 'string',
          description: 'Doctor ID or specialty (e.g., "cardiology", "pediatrics")',
          required: false
        },
        date: {
          type: 'string',
          description: 'Preferred date in YYYY-MM-DD format',
          required: true
        }
      }
    },
    {
      type: 'webhook',
      name: 'book_appointment',
      description: 'Book a new appointment after confirming all details with the patient. This step is important - always verify details before calling this tool.',
      url: `${process.env.SERVER_URL}/tools/book-appointment`,
      method: 'POST',
      parameters: {
        patient_id: {
          type: 'string',
          description: 'Patient ID from EMR system',
          required: true
        },
        doctor_id: {
          type: 'string',
          description: 'Selected doctor ID',
          required: true
        },
        date: {
          type: 'string',
          description: 'Appointment date in YYYY-MM-DD format',
          required: true
        },
        time: {
          type: 'string',
          description: 'Appointment time in HH:MM format (24-hour)',
          required: true
        },
        reason: {
          type: 'string',
          description: 'Reason for visit',
          required: false
        },
        phone: {
          type: 'string',
          description: 'Patient phone number in numeric format only (e.g., "5551234567")',
          required: true
        }
      }
    },
    {
      type: 'webhook',
      name: 'get_patient_info',
      description: 'Retrieve existing patient information from EMR. Use this to look up patient records before booking.',
      url: `${process.env.SERVER_URL}/tools/get-patient-info`,
      method: 'POST',
      parameters: {
        name: {
          type: 'string',
          description: 'Patient full name',
          required: true
        },
        date_of_birth: {
          type: 'string',
          description: 'Date of birth in YYYY-MM-DD format for verification',
          required: true
        },
        phone: {
          type: 'string',
          description: 'Phone number for additional verification',
          required: false
        }
      }
    },
    {
      type: 'webhook',
      name: 'update_appointment',
      description: 'Reschedule or modify an existing appointment',
      url: `${process.env.SERVER_URL}/tools/update-appointment`,
      method: 'POST',
      parameters: {
        appointment_id: {
          type: 'string',
          description: 'Existing appointment ID',
          required: true
        },
        new_date: {
          type: 'string',
          description: 'New appointment date in YYYY-MM-DD format',
          required: false
        },
        new_time: {
          type: 'string',
          description: 'New appointment time in HH:MM format',
          required: false
        }
      }
    }
  ];

  // Update agent configuration with tools
  await elevenLabs.agents.update(agentId, {
    conversation_config: {
      agent: {
        tools: tools
      }
    }
  });
};