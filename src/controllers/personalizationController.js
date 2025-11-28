import { specialtyPrompts, CLINIC_CONFIG } from "../services/agentService.js";

// ============================================
// INBOUND vs OUTBOUND CONFIGURATIONS
// ============================================

// Base prompt additions for each call direction
export const CALL_DIRECTION_PROMPTS = {
  inbound: `
## CALL CONTEXT: INBOUND CALL
The patient has called into the clinic. They initiated this call and likely have a specific need.

### Inbound Call Guidelines:
- Greet them warmly and ask how you can help
- Listen carefully to understand their request before taking action
- Be patient as they may need time to explain their situation
- Verify their identity (name + DOB) before accessing any personal information
- If they seem uncertain, offer to guide them through available services
- Use get_patient_info tool to look up their record after getting name and DOB
`,

  outbound: `
## CALL CONTEXT: OUTBOUND CALL
You are calling the patient proactively from the clinic. YOU initiated this call.

### Outbound Call Guidelines:
- Introduce yourself and the clinic immediately
- FIRST verify you're speaking with the correct person: "Am I speaking with {{patient_name}}?"
- Only proceed after they confirm their identity
- State the purpose of your call early in the conversation
- Be respectful of their time - they may be busy
- If they can't talk, offer to call back at a convenient time

### Call Purpose: {{call_reason}}
{{call_reason_details}}
`,
};

// Reason-specific messages and details for outbound calls
export const OUTBOUND_CALL_REASONS = {
  general: {
    opening: "",
    details: "",
  },
  appointment_reminder: {
    opening: "I'm calling to remind you about your upcoming appointment.",
    details: `After confirming identity, remind them:
- Appointment date and time
- Doctor's name if available
- Ask if they can still make it
- Offer to reschedule if needed`,
  },
  follow_up: {
    opening: "I'm calling to follow up on your recent visit with us.",
    details: `After confirming identity:
- Ask how they're feeling since their visit
- Check if they have any questions
- Remind them of any follow-up instructions`,
  },
  results_ready: {
    opening: "I'm calling because we have some results ready for you.",
    details: `After confirming identity:
- Let them know results are ready
- Do NOT discuss results over the phone
- Offer to schedule a callback with their provider to discuss
- Emphasize that results should be discussed with the doctor`,
  },
  reschedule: {
    opening: "I'm calling because we need to reschedule your appointment.",
    details: `After confirming identity:
- Apologize for the inconvenience
- Explain briefly (provider unavailable, scheduling conflict)
- Offer alternative times using check_availability tool
- Confirm new appointment details`,
  },
  wellness_check: {
    opening: "I'm calling for a wellness check-in. How have you been feeling?",
    details: `After confirming identity:
- Ask about their general well-being
- Inquire about any concerns or symptoms
- Remind them about preventive care/screenings if due
- Offer to schedule an appointment if needed`,
  },
  prescription: {
    opening: "I'm calling about your prescription refill.",
    details: `After confirming identity:
- Confirm which medication needs refill
- Verify pharmacy information
- Let them know status/timeline
- Ask if they need anything else`,
  },
  test_results_normal: {
    opening: "I'm calling with good news about your recent test results.",
    details: `After confirming identity:
- Share that results came back normal
- Ask if they have any questions
- Remind them of any follow-up if needed`,
  },
  missed_appointment: {
    opening: "I'm calling because we missed you at your appointment.",
    details: `After confirming identity:
- Express concern, not judgment
- Ask if everything is okay
- Offer to reschedule
- Emphasize importance of the appointment if applicable`,
  },
};

// Specialty-specific first messages for each direction
export const SPECIALTY_FIRST_MESSAGES = {
  primaryCare: {
    inbound: `Hello! Thank you for calling Primary Care at ${CLINIC_CONFIG.name}. This is your virtual assistant speaking. How may I help you today?`,
    outbound: `Hello! This is ${CLINIC_CONFIG.name} Primary Care calling. Am I speaking with {{patient_name}}?`,
  },
  mentalHealth: {
    inbound: `Hello, thank you for calling Mental Health Services at ${CLINIC_CONFIG.name}. I'm here to help you. How may I assist you today?`,
    outbound: `Hello, this is ${CLINIC_CONFIG.name} Mental Health Services. Am I speaking with {{patient_name}}? I hope this is a good time to talk.`,
  },
  sportsMedicine: {
    inbound: `Hey there! Thanks for calling Sports Medicine at ${CLINIC_CONFIG.name}. How can I help you get back in the game today?`,
    outbound: `Hey! This is ${CLINIC_CONFIG.name} Sports Medicine calling for {{patient_name}}. Is this a good time?`,
  },
  cardiology: {
    inbound: `Hello, thank you for calling the Cardiology Department at ${CLINIC_CONFIG.name}. I'm here to assist you with scheduling. How may I help you today?`,
    outbound: `Hello, this is ${CLINIC_CONFIG.name} Cardiology calling. Am I speaking with {{patient_name}}?`,
  },
  radiology: {
    inbound: `Hello, thank you for calling the Radiology Department at ${CLINIC_CONFIG.name}. I'm here to help you schedule your imaging appointment. How may I assist you today?`,
    outbound: `Hello, this is ${CLINIC_CONFIG.name} Radiology calling. Am I speaking with {{patient_name}}? I'm calling about your imaging appointment.`,
  },
};

// Multi-specialty first messages
function getMultiSpecialtyFirstMessage(specialties, direction) {
  const names = specialties
    .map(s => specialtyPrompts[s]?.name)
    .filter(Boolean);

  if (names.length === 0) {
    names.push("Patient Services");
  }

  if (direction === "outbound") {
    return `Hello! This is ${CLINIC_CONFIG.name} calling. Am I speaking with {{patient_name}}?`;
  }

  // Inbound
  if (names.length === 1) {
    return `Hello! Thank you for calling ${names[0]} at ${CLINIC_CONFIG.name}. How may I help you today?`;
  } else if (names.length === 2) {
    return `Hello! Thank you for calling ${CLINIC_CONFIG.name}. We offer ${names[0]} and ${names[1]} services. How may I help you today?`;
  } else {
    const last = names.pop();
    return `Hello! Thank you for calling ${CLINIC_CONFIG.name}. We offer ${names.join(", ")}, and ${last} services. How may I help you today?`;
  }
}

// ============================================
// TWILIO PERSONALIZATION WEBHOOK (INBOUND)
// Called by ElevenLabs before starting inbound calls
// ============================================
export const twilioPersonalizationWebhook = async (req, res) => {
  try {
    const { 
      caller_id,        // Phone number of caller
      agent_id,         // Your agent ID
      called_number,    // Number they called
      call_sid,         // Twilio call SID
    } = req.body;

    console.log("====================================");
    console.log("📞 INBOUND CALL PERSONALIZATION");
    console.log("====================================");
    console.log("Caller ID:", caller_id);
    console.log("Agent ID:", agent_id);
    console.log("Called Number:", called_number);
    console.log("Call SID:", call_sid);

    // Get specialty from environment or default
    const specialty = process.env.CURRENT_SPECIALTY || "primaryCare";
    const specialtyList = specialty.split(",").map(s => s.trim());

    // Get the appropriate first message
    let firstMessage;
    if (specialtyList.length === 1 && SPECIALTY_FIRST_MESSAGES[specialtyList[0]]) {
      firstMessage = SPECIALTY_FIRST_MESSAGES[specialtyList[0]].inbound;
    } else {
      firstMessage = getMultiSpecialtyFirstMessage(specialtyList, "inbound");
    }

    // Build response with overrides
    const response = {
      // Dynamic variables available in the prompt as {{variable_name}}
      dynamic_variables: {
        call_direction: "inbound",
        caller_phone: caller_id || "unknown",
        clinic_name: CLINIC_CONFIG.name,
        clinic_phone: CLINIC_CONFIG.phone,
        clinic_address: CLINIC_CONFIG.address,
        specialty: specialty,
      },
      
      // Override agent settings for this call
      // IMPORTANT: Use camelCase as expected by ElevenLabs SDK
      overrides: {
        agent: {
          firstMessage: firstMessage,  // camelCase!
          prompt: {
            prompt: CALL_DIRECTION_PROMPTS.inbound,
          },
        },
      },
    };

    console.log("📤 Returning INBOUND personalization:");
    console.log("  First Message:", firstMessage);
    console.log("====================================");

    res.json(response);

  } catch (error) {
    console.error("❌ Error in personalization webhook:", error);
    // Return minimal response to not break the call
    res.json({
      dynamic_variables: {
        call_direction: "inbound",
      },
    });
  }
};

// ============================================
// BUILD OUTBOUND CALL DATA
// Used when making outbound calls via SDK
// ============================================
export const buildOutboundCallData = (options = {}) => {
  const {
    patientName = "there",
    patientId = "",
    patientPhone = "",
    callReason = "general",
    specialty = "primaryCare",
    appointmentDate = "",
    appointmentTime = "",
    doctorName = "",
    customFirstMessage = null,
    additionalVariables = {},
  } = options;

  const specialtyList = specialty.split(",").map(s => s.trim());
  
  // Get the appropriate first message
  let firstMessage;
  if (customFirstMessage) {
    firstMessage = customFirstMessage;
  } else if (specialtyList.length === 1 && SPECIALTY_FIRST_MESSAGES[specialtyList[0]]) {
    firstMessage = SPECIALTY_FIRST_MESSAGES[specialtyList[0]].outbound;
  } else {
    firstMessage = getMultiSpecialtyFirstMessage(specialtyList, "outbound");
  }

  // Replace patient name placeholder
  firstMessage = firstMessage.replace(/\{\{patient_name\}\}/g, patientName);

  // Get reason-specific content
  const reasonConfig = OUTBOUND_CALL_REASONS[callReason] || OUTBOUND_CALL_REASONS.general;
  
  // Build the outbound prompt addition
  let outboundPrompt = CALL_DIRECTION_PROMPTS.outbound
    .replace(/\{\{patient_name\}\}/g, patientName)
    .replace(/\{\{call_reason\}\}/g, callReason.replace(/_/g, " ").toUpperCase())
    .replace(/\{\{call_reason_details\}\}/g, reasonConfig.details);

  // Add opening line instruction if present
  if (reasonConfig.opening) {
    outboundPrompt += `\n\n### Opening Line (after identity confirmation):\n"${reasonConfig.opening}"`;
  }

  // Add appointment-specific info if present
  if (appointmentDate || appointmentTime || doctorName) {
    outboundPrompt += `\n\n### Appointment Details:\n`;
    if (appointmentDate) outboundPrompt += `- Date: ${appointmentDate}\n`;
    if (appointmentTime) outboundPrompt += `- Time: ${appointmentTime}\n`;
    if (doctorName) outboundPrompt += `- Doctor: ${doctorName}\n`;
  }

  console.log("====================================");
  console.log("📞 OUTBOUND CALL DATA BUILT");
  console.log("====================================");
  console.log("Patient:", patientName);
  console.log("Reason:", callReason);
  console.log("First Message:", firstMessage);
  console.log("====================================");

  return {
    // Dynamic variables available in the prompt as {{variable_name}}
    dynamic_variables: {
      call_direction: "outbound",
      patient_name: patientName,
      patient_id: patientId,
      patient_phone: patientPhone,
      call_reason: callReason,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      doctor_name: doctorName,
      clinic_name: CLINIC_CONFIG.name,
      clinic_phone: CLINIC_CONFIG.phone,
      clinic_address: CLINIC_CONFIG.address,
      specialty: specialty,
      ...additionalVariables,
    },
    
    // Override agent settings for this call
    // IMPORTANT: Use camelCase as expected by ElevenLabs SDK
    overrides: {
      agent: {
        firstMessage: firstMessage,  // camelCase!
        prompt: {
          prompt: outboundPrompt,
        },
      },
    },
  };
};

// ============================================
// GET CALL CONFIG (API Endpoint)
// ============================================
export const getCallConfig = (req, res) => {
  const { direction, specialty, reason } = req.query;

  if (!direction || !["inbound", "outbound"].includes(direction)) {
    return res.status(400).json({
      success: false,
      error: "Invalid direction. Must be 'inbound' or 'outbound'",
    });
  }

  const spec = specialty || "primaryCare";
  const specList = spec.split(",").map(s => s.trim());
  
  let firstMessage;
  if (specList.length === 1 && SPECIALTY_FIRST_MESSAGES[specList[0]]) {
    firstMessage = SPECIALTY_FIRST_MESSAGES[specList[0]][direction];
  } else {
    firstMessage = getMultiSpecialtyFirstMessage(specList, direction);
  }

  const promptAddition = CALL_DIRECTION_PROMPTS[direction];
  
  let reasonDetails = null;
  if (direction === "outbound" && reason) {
    reasonDetails = OUTBOUND_CALL_REASONS[reason] || OUTBOUND_CALL_REASONS.general;
  }

  res.json({
    success: true,
    direction,
    specialty: spec,
    config: {
      firstMessage,
      promptAddition,
      reasonDetails,
    },
    available_reasons: Object.keys(OUTBOUND_CALL_REASONS),
  });
};

// ============================================
// GET AVAILABLE CALL REASONS
// ============================================
export const getCallReasons = (req, res) => {
  const reasons = Object.entries(OUTBOUND_CALL_REASONS).map(([id, config]) => ({
    id,
    opening: config.opening || "General outbound call",
    has_details: !!config.details,
  }));

  res.json({
    success: true,
    reasons,
  });
};

export default {
  twilioPersonalizationWebhook,
  buildOutboundCallData,
  getCallConfig,
  getCallReasons,
  CALL_DIRECTION_PROMPTS,
  SPECIALTY_FIRST_MESSAGES,
  OUTBOUND_CALL_REASONS,
};