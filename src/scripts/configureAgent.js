// Fixed configuration script for ElevenLabs
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const AGENT_ID = process.env.ELEVENLABS_AGENT_ID;
const API_KEY = process.env.ELEVENLABS_API_KEY;
const SERVER_URL = process.env.SERVER_URL;

if (!AGENT_ID || !API_KEY || !SERVER_URL) {
  console.error('❌ Missing required environment variables!');
  console.error('Required: ELEVENLABS_AGENT_ID, ELEVENLABS_API_KEY, SERVER_URL');
  process.exit(1);
}

// Orion West Medical Group system prompt
const SYSTEM_PROMPT = `# Personality
You are an appointment scheduling assistant for Orion West Medical Group, a healthcare organization in Las Vegas dedicated to providing comprehensive and quality healthcare services to the uninsured and underinsured. You are friendly, efficient, and committed to helping patients access the care they need.

# Environment
You are assisting callers over the phone who are looking to book appointments at Orion West Medical Clinic, located at 1771 East Flamingo Rd in downtown Las Vegas. You have access to the appointment scheduling system and can view available time slots for various services. You know about the services offered such as Primary Care and Mental Health.

# Tone
Your responses are clear, professional, and empathetic. You speak in a reassuring tone, guiding callers through the appointment booking process with ease. You use positive language and express enthusiasm about helping them get the care they need.

# Goal
Your primary goal is to efficiently book appointments for callers at Orion West Medical Clinic.

1. Gather necessary information:
   * Caller's name and contact information.
   * Reason for the appointment (e.g., primary care, mental health).
   * Preferred date and time for the appointment.
   * Insurance information (if applicable).

2. Check appointment availability:
   * Access the appointment scheduling system using the check_availability tool.
   * Search for available time slots based on the caller's preferences.

3. Book the appointment:
   * Confirm the appointment details with the caller (date, time, location, service).
   * Enter the caller's information into the scheduling system using the book_appointment tool.
   * Provide the caller with a confirmation number or other relevant information.

4. Provide confirmation:
   * Clearly state the appointment details, including date, time, location (1771 East Flamingo Rd, Las Vegas), and the type of service they are scheduled for.
   * Inform the caller of any pre-appointment instructions (e.g., forms to fill out, items to bring).
   * Thank the caller for choosing Orion West Medical Group.

# Tool Usage Instructions

## IMPORTANT: Always follow this workflow sequence

### Step 1: Get Patient Information (REQUIRED FIRST)
Use the **get_patient_info** tool to look up existing patient records:
- Ask for: Full name and date of birth
- Required parameters: name, date_of_birth (YYYY-MM-DD format)
- Optional: phone (for additional verification)
- If patient not found → proceed to register_patient tool

### Step 2: Register New Patient (If needed)
Use the **register_patient** tool when patient is not found:
- Required parameters: name, date_of_birth, phone
- Confirm spelling of name before registering
- Welcome new patients warmly to Orion West Medical Group

### Step 3: Check Availability
Use the **check_availability** tool to find open appointment slots:
- Required: date (YYYY-MM-DD format)
- Optional: doctor_id, specialty (e.g., "primary care", "mental health")
- Present 2-3 available options clearly to the caller
- Example: "I have openings at 9 AM or 2:30 PM on that day. Which works better for you?"

### Step 4: Book Appointment
Use the **book_appointment** tool ONLY after confirming all details:
- Required: patient_id (from get_patient_info), doctor_id, date, time, phone
- Time format: HH:MM in 24-hour format (e.g., "14:30" for 2:30 PM)
- Phone format: numeric only (e.g., "5551234567")
- Always repeat details back to caller before booking

### Step 5: Update/Reschedule (If needed)
Use the **update_appointment** tool when caller needs to reschedule:
- Required: appointment_id
- Optional: new_date, new_time
- Confirm new time before updating

## Date & Time Handling Tips
- When caller says "tomorrow" → calculate actual date
- When caller says "next Tuesday" → calculate actual date
- Convert spoken times to 24-hour format for tools
  * "2:30 PM" → "14:30"
  * "9 AM" → "09:00"
- Always confirm back to caller in natural language

## Phone Number Handling
- Caller says: "My number is 555-123-4567"
- Extract digits only: "5551234567"
- Store without dashes or spaces
- Confirm back: "So that's 555-123-4567, correct?"

# Error Handling
If a tool fails:
1. Stay calm and professional
2. Say: "I'm having a brief issue with our system. Let me try that again."
3. Retry once
4. If still failing: "I apologize for the inconvenience. Let me take your information and have someone from our team call you back to confirm your appointment. What's the best number to reach you?"

# Guardrails
* Do not provide medical advice or diagnoses.
* Do not ask for sensitive personal information beyond what is necessary to book the appointment.
* If you are unable to book an appointment due to unavailability, offer alternative dates and times.
* If the caller has questions about Orion West Medical Group's services or mission, provide accurate and helpful information based on the website content.
* Do not make promises or guarantees about the outcome of the appointment.
* Never share information about other patients.
* Never confirm appointments without using the book_appointment tool.
* Never make up availability or doctor information.

# Example Conversation Flow

**Caller:** "Hi, I need to schedule an appointment."

**You:** "Hello! Thank you for calling Orion West Medical Group. I'd be happy to help you schedule an appointment at our clinic on 1771 East Flamingo Rd. May I have your full name and date of birth to look up your information?"

**Caller:** "John Doe, May 15th, 1985"

**You:** [calls get_patient_info tool] "Thank you, Mr. Doe. I've found your record. What type of service are you looking for today - Primary Care or Mental Health?"

**Caller:** "Primary Care, please."

**You:** "Perfect. What date were you hoping to come in?"

**Caller:** "How about next Tuesday?"

**You:** [calculates date, calls check_availability tool] "I have availability on Tuesday, November 26th. I can offer you 9:00 AM or 2:30 PM. Which time works better for you?"

**Caller:** "The 9 AM slot sounds good."

**You:** "Excellent! So to confirm: Tuesday, November 26th at 9:00 AM for Primary Care at our clinic located at 1771 East Flamingo Rd in Las Vegas. Is that correct?"

**Caller:** "Yes, that's right."

**You:** [calls book_appointment tool] "Perfect! I've booked your appointment. Your confirmation number is CONF12345. You'll receive an SMS confirmation shortly with all the details. Please arrive 10 minutes early to complete any necessary paperwork. Is there anything else I can help you with today?"

**Caller:** "No, that's all. Thank you!"

**You:** "You're very welcome! We look forward to seeing you on Tuesday. Thank you for choosing Orion West Medical Group. Have a great day!"`;

// Define custom tools
const customTools = [
  {
    type: 'webhook',
    name: 'get_patient_info',
    description: 'Retrieve existing patient information. Use this FIRST before booking any appointment to verify patient identity. Required parameters: name (full name) and date_of_birth (YYYY-MM-DD format).',
    config: {
      url: `${SERVER_URL}/api/tools/get-patient-info`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
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
    config: {
      url: `${SERVER_URL}/api/tools/register-patient`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
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
    config: {
      url: `${SERVER_URL}/api/tools/check-availability`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
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
    description: 'Book a new appointment. IMPORTANT: Use this ONLY after (1) verifying patient with get_patient_info, (2) checking availability, and (3) confirming all details with the patient verbally.',
    config: {
      url: `${SERVER_URL}/api/tools/book-appointment`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
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
    config: {
      url: `${SERVER_URL}/api/tools/update-appointment`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
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
];

async function configureAgent() {
  console.log('========================================');
  console.log('🔧 Configuring ElevenLabs Agent');
  console.log('========================================');
  console.log(`Agent ID: ${AGENT_ID}`);
  console.log(`Server URL: ${SERVER_URL}`);
  console.log('');

  try {
    // Get current agent configuration
    console.log('📥 Fetching current agent configuration...');
    const getResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
      method: 'GET',
      headers: {
        'xi-api-key': API_KEY,
      },
    });

    if (!getResponse.ok) {
      throw new Error(`Failed to fetch agent: ${getResponse.status} ${getResponse.statusText}`);
    }

    const currentAgent = await getResponse.json();
    console.log('✅ Agent found:', currentAgent.name || 'Unnamed');
    console.log('');

    // Update agent configuration
    console.log('🔄 Updating agent configuration...');
    console.log('- Adding Orion West system prompt');
    console.log('- Adding 5 custom tools');
    console.log('');

    const updatedConfig = {
      conversation_config: {
        agent: {
          prompt: {
            prompt: SYSTEM_PROMPT,
            llm: 'gemini-2.0-flash',
          },
          first_message: 'Hello! Thank you for calling Orion West Medical Group. How may I assist you with scheduling your appointment today?',
          language: 'en',
          tools: customTools,
        },
        tts: currentAgent.conversation_config?.tts || {
          voice_id: '9T9vSqRrPPxIs5wpyZfK',
          model_id: 'eleven_turbo_v2_5',
          optimize_streaming_latency: 3,
        },
        asr: currentAgent.conversation_config?.asr || {
          quality: 'high',
          provider: 'elevenlabs',
        },
      },
    };

    const updateResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
      method: 'PATCH',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedConfig),
    });

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      throw new Error(`Failed to update agent: ${updateResponse.status} ${JSON.stringify(errorData)}`);
    }

    console.log('========================================');
    console.log('✅ Agent Configuration Complete!');
    console.log('========================================');
    console.log('');
    console.log('📋 Summary:');
    console.log('✓ Orion West system prompt updated');
    console.log('✓ First message set');
    console.log(`✓ ${customTools.length} custom tools added:`);
    customTools.forEach((tool) => {
      console.log(`  - ${tool.name}`);
    });
    console.log('');
    console.log('🎯 Next Steps:');
    console.log('1. Make a test call to your Twilio number');
    console.log('2. Agent should greet with "Orion West Medical Group"');
    console.log('3. Agent should mention "1771 East Flamingo Rd, Las Vegas"');
    console.log('4. Check server logs for tool webhook calls');
    console.log('');
    console.log('🔗 Your webhook endpoints:');
    customTools.forEach((tool) => {
      console.log(`  ${tool.name}: ${tool.config.url}`);
    });
    console.log('');

  } catch (error) {
    console.error('❌ Error configuring agent:', error.message);
    if (error.response) {
      console.error('Response:', error.response);
    }
    process.exit(1);
  }
}

configureAgent();

// test-agent-config-fixed.js
// import dotenv from 'dotenv';
// import fetch from 'node-fetch';

// dotenv.config();

// const AGENT_ID = process.env.ELEVENLABS_AGENT_ID;
// const API_KEY = process.env.ELEVENLABS_API_KEY;

// async function testAgentConfig() {
//   console.log('========================================');
//   console.log('🧪 Testing Agent Configuration');
//   console.log('========================================\n');

//   try {
//     const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
//       method: 'GET',
//       headers: {
//         'xi-api-key': API_KEY,
//       },
//     });

//     if (!response.ok) {
//       throw new Error(`Failed to fetch agent: ${response.status} ${response.statusText}`);
//     }

//     const agent = await response.json();

//     console.log('📋 Agent Details:');
//     console.log(`  Name: ${agent.name || 'Not set'}`);
//     console.log(`  Agent ID: ${AGENT_ID}`);
//     console.log(`  Created: ${agent.created_at}\n`);

//     // Check agent configuration
//     const agentConfig = agent.conversation_config?.agent;

//     if (!agentConfig) {
//       console.log('❌ No agent configuration found!\n');
//       return;
//     }

//     // Check prompt
//     console.log('🤖 System Prompt:');
//     if (agentConfig.prompt?.prompt) {
//       const promptLength = agentConfig.prompt.prompt.length;
//       const firstLine = agentConfig.prompt.prompt.split('\n')[0];
//       console.log(`  ✓ Configured (${promptLength} characters)`);
//       console.log(`  First line: "${firstLine}..."`);
//       console.log(`  LLM: ${agentConfig.prompt.llm || 'Not set'}\n`);
//     } else {
//       console.log('  ❌ Not configured\n');
//     }

//     // Check first message
//     console.log('💬 First Message:');
//     if (agentConfig.first_message) {
//       console.log(`  ✓ "${agentConfig.first_message}"\n`);
//     } else {
//       console.log('  ❌ Not configured\n');
//     }

//     // Check tools
//     console.log('🛠️  Custom Tools:');
//     if (agentConfig.tools && agentConfig.tools.length > 0) {
//       console.log(`  ✓ ${agentConfig.tools.length} tools configured:\n`);
//       agentConfig.tools.forEach((tool, index) => {
//         console.log(`  ${index + 1}. ${tool.name}`);
//         console.log(`     Type: ${tool.type}`);
//         console.log(`     URL: ${tool.config?.url || 'Not set'}`);
//         console.log(`     Description: ${tool.description?.substring(0, 60)}...`);
//         console.log('');
//       });
//     } else {
//       console.log('  ❌ No tools configured\n');
//     }

//     // Check TTS (voice)
//     console.log('🔊 Voice Configuration (TTS):');
//     const tts = agent.conversation_config?.tts;
//     if (tts) {
//       console.log(`  ✓ Voice ID: ${tts.voice_id || 'Not set'}`);
//       console.log(`  ✓ Model: ${tts.model_id || 'Not set'}`);
//       console.log(`  ✓ Latency Optimization: ${tts.optimize_streaming_latency || 'default'}\n`);
//     } else {
//       console.log('  ❌ Not configured\n');
//     }

//     // Check ASR (speech recognition)
//     console.log('🎤 Speech Recognition (ASR):');
//     const asr = agent.conversation_config?.asr;
//     if (asr) {
//       console.log(`  ✓ Provider: ${asr.provider || 'default'}`);
//       console.log(`  ✓ Quality: ${asr.quality || 'default'}\n`);
//     } else {
//       console.log('  ⚠️  Using defaults\n');
//     }

//     // Overall status
//     console.log('========================================');
//     console.log('📊 Configuration Status:');
//     console.log('========================================\n');

//     const checks = {
//       'System Prompt': !!agentConfig.prompt?.prompt,
//       'First Message': !!agentConfig.first_message,
//       'Custom Tools': agentConfig.tools && agentConfig.tools.length > 0,
//       'Voice (TTS)': !!tts?.voice_id,
//       'LLM Model': !!agentConfig.prompt?.llm,
//     };

//     let allGood = true;
//     Object.entries(checks).forEach(([name, status]) => {
//       console.log(`  ${status ? '✅' : '❌'} ${name}`);
//       if (!status) allGood = false;
//     });

//     console.log('\n========================================');
//     if (allGood) {
//       console.log('✅ Agent is fully configured and ready!');
//       console.log('\n🎯 Next: Make a test call to your Twilio number');
//       console.log(`   Twilio Number: ${process.env.TWILIO_PHONE_NUMBER || 'Not set in .env'}`);
//     } else {
//       console.log('⚠️  Agent configuration incomplete');
//       console.log('\n🔧 Fix: Run the configuration script:');
//       console.log('   node configure-agent-fixed.js');
//     }
//     console.log('========================================\n');

//   } catch (error) {
//     console.error('❌ Error testing agent:', error.message);
//   }
// }

// testAgentConfig();