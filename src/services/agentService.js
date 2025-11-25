import dotenv from "dotenv";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

dotenv.config();

const AGENT_ID = process.env.ELEVENLABS_AGENT_ID;
const API_KEY = process.env.ELEVENLABS_API_KEY;
const SERVER_URL = process.env.SERVER_URL;

// ============================================
// SMART CLIENT INITIALIZATION
// ============================================
let clientInstance = null;

async function getClientInstance() {
  if (!clientInstance) {
    try {
      const { elevenLabsClient } = await import("../config/clients.js");
      clientInstance = elevenLabsClient;
      console.log("✅ Using shared ElevenLabs client");
    } catch (error) {
      clientInstance = new ElevenLabsClient({ apiKey: API_KEY });
      console.log("✅ Created new ElevenLabs client for CLI");
    }
  }
  return clientInstance;
}

// ============================================
// CLINIC CONFIGURATION
// ============================================
export const CLINIC_CONFIG = {
  name: "Orion West Medical Group",
  address: "1771 East Flamingo Rd",
  city: "Las Vegas",
  phone: process.env.CLINIC_PHONE || "(555) 123-4567",
  mission: "Providing comprehensive and quality healthcare services to the uninsured and underinsured",
};

// ============================================
// SPECIALTY PROMPTS
// ============================================
export const specialtyPrompts = {
  primaryCare: {
    name: "Primary Care",
    prompt: `## PRIMARY CARE SERVICES
# Scope: Annual physicals, sick visits, chronic disease management, preventive screenings, immunizations, referrals
# Appointment Types: Annual Physical (45min), Wellness Visit (30min), Sick Visit (20min), Follow-up (15min), Chronic Care (30min), Immunization (15min), New Patient (60min)
# Urgency: Same-day for fever >101°F, severe pain, difficulty breathing, infection signs. ER for chest pain, stroke symptoms, severe allergic reaction, uncontrolled bleeding.`,
  },
  mentalHealth: {
    name: "Mental Health Services",
    prompt: `## MENTAL HEALTH SERVICES
# Tone: Calm, gentle, non-judgmental, trauma-informed
# Scope: Psychiatric evaluations, therapy, couples/family therapy, substance abuse, anxiety/depression, PTSD, ADHD, grief counseling
# Appointment Types: Psychiatric Eval (60min), Med Follow-up (20min), Initial Therapy (60min), Individual Therapy (50min), Couples/Family (60min), Group (90min)
# Crisis Protocol: For suicidal thoughts - provide 988 Lifeline, Crisis Text 741741, offer to stay on line`,
  },
  sportsMedicine: {
    name: "Sports Medicine",
    prompt: `## SPORTS MEDICINE SERVICES
# Tone: Energetic, upbeat, understands athlete mindset
# Scope: Sports injuries, concussions, fractures, sprains/strains, tendinitis, sports physicals, return-to-play evals, joint injections
# Appointment Types: Sports Physical (30min), Injury Eval (30min), Concussion Assessment (45min), Follow-up (20min), Injection (30min), Return-to-Play (30min)
# Urgency: Same-day for concussion, acute swelling, can't bear weight, visible deformity, locked joint`,
  },
  cardiology: {
    name: "Cardiology Department",
    prompt: `## CARDIOLOGY SERVICES
# Tone: Professional, calm, reassuring, patient with elderly
# Scope: Cardiac consults, heart disease, chest pain, arrhythmias, heart failure, hypertension, cholesterol, pacemaker checks
# Appointment Types: New Patient (45min), Follow-up (20min), Echo (45min), EKG (15min), Stress Test (60min), Nuclear Stress (3-4hrs), Holter Setup (30min)
# CRITICAL: Direct to 911 for chest pain NOW, radiating pain, severe shortness of breath, racing heart with dizziness, fainting`,
  },
  radiology: {
    name: "Radiology Department",
    prompt: `## RADIOLOGY SERVICES
# Scope: X-rays, CT scans, MRIs, ultrasounds, mammograms, DEXA, PET scans
# CRITICAL: Most imaging requires physician order. MRI safety screening required (pacemakers, implants, metal fragments)
# Prep: CT contrast - no food 4hrs, kidney test within 30 days. MRI - remove all metal. Abdominal US - fast 8hrs. Pelvic US - full bladder`,
  },
};

// ============================================
// GENERATE COMBINED PROMPT
// ============================================
function generateCombinedPrompt(specialties, options = {}) {
  const specialtyNames = specialties.map(s => specialtyPrompts[s]?.name || s).join(", ");
  const isOutbound = options.callType === 'outbound';
  
  let prompt = `# Personality
You are a healthcare scheduling assistant for ${CLINIC_CONFIG.name} in ${CLINIC_CONFIG.city}. ${CLINIC_CONFIG.mission}.

# Available Departments: ${specialtyNames}

`;

  if (isOutbound) {
    prompt += `# OUTBOUND CALL INSTRUCTIONS
You are making an OUTBOUND call to a patient. Follow these guidelines:

## Opening Protocol
1. Identify yourself: "Hello, this is calling from ${CLINIC_CONFIG.name}."
2. Ask for the patient by name: "May I speak with [Patient Name]?"
3. Verify identity: "I'm calling to help schedule your appointment. For verification, can you confirm your date of birth?"
4. State purpose clearly: "I'm reaching out to help you schedule an appointment with our [specialty] department."

## Important Outbound Guidelines
- Be respectful of their time - ask "Is this a good time to talk?"
- If they're busy, offer to call back: "Would you prefer I call back at a better time?"
- Keep the call focused and efficient
- If they don't answer, leave a brief voicemail with callback number: ${CLINIC_CONFIG.phone}
- Never sound like a robocall - be warm and human
- If they seem confused about why you're calling, explain: "You [were referred by your doctor / requested an appointment / are due for a follow-up]"

## Handling Common Situations
- **Wrong number**: "I apologize for the inconvenience. Have a great day!"
- **Voicemail**: "Hello [Patient Name], this is calling from ${CLINIC_CONFIG.name}. I'm calling to help schedule your appointment. Please call us back at ${CLINIC_CONFIG.phone}. Thank you!"
- **Patient declines**: "I understand. If you change your mind, please feel free to call us at ${CLINIC_CONFIG.phone}. Take care!"
- **Patient is interested**: Proceed with normal workflow below

`;
  }
  
  specialties.forEach(s => {
    if (specialtyPrompts[s]) {
      prompt += specialtyPrompts[s].prompt + "\n\n";
    }
  });
  
  prompt += `# Workflow
1. ${isOutbound ? 'Verify patient identity (name, DOB) using get_patient_info tool' : 'Get patient info (name, DOB) using get_patient_info tool'}
2. Register new patient if not found using register_patient tool
3. Check availability using check_availability tool
4. Book appointment using book_appointment tool
5. Confirm details and location: ${CLINIC_CONFIG.address}, ${CLINIC_CONFIG.city}
${isOutbound ? '6. Thank them for their time and confirm they received SMS confirmation' : ''}

# Guardrails
- No medical advice. No sensitive info beyond necessary. Never share other patient info.
- Always use tools to confirm/book. Never make up availability.
${isOutbound ? '- For outbound calls: Be respectful, professional, and not pushy. Patient can decline anytime.' : ''}`;

  return prompt;
}

// ============================================
// GENERATE FIRST MESSAGE
// ============================================
function generateFirstMessage(specialties, options = {}) {
  const names = specialties.map(s => specialtyPrompts[s]?.name).filter(Boolean);
  const isOutbound = options.callType === 'outbound';
  
  if (isOutbound) {
    return `Hello, this is calling from ${CLINIC_CONFIG.name}. I'm reaching out to help you schedule an appointment. May I speak with you for a moment?`;
  }
  
  if (names.length === 1) {
    return `Hello! Thank you for calling ${CLINIC_CONFIG.name} ${names[0]}. How may I help you today?`;
  } else if (names.length === 2) {
    return `Hello! Thank you for calling ${CLINIC_CONFIG.name}. We offer ${names[0]} and ${names[1]} services. How may I help you today?`;
  } else {
    const last = names.pop();
    return `Hello! Thank you for calling ${CLINIC_CONFIG.name}. We offer ${names.join(", ")}, and ${last} services. How may I help you today?`;
  }
}

// ============================================
// NORMALIZE SPECIALTY KEY
// ============================================
function normalizeSpecialtyKey(specialty) {
  const keyMap = {
    "primary care": "primaryCare", "primarycare": "primaryCare", "primary": "primaryCare",
    "mental health": "mentalHealth", "mentalhealth": "mentalHealth", "mental": "mentalHealth",
    "sports medicine": "sportsMedicine", "sportsmedicine": "sportsMedicine", "sports": "sportsMedicine",
    "cardiology": "cardiology", "cardiac": "cardiology", "heart": "cardiology",
    "radiology": "radiology", "imaging": "radiology", "xray": "radiology", "mri": "radiology",
  };
  return keyMap[specialty.toLowerCase().trim()] || specialty.toLowerCase().trim();
}

// ============================================
// MAIN CONFIGURATION FUNCTION
// ============================================
export async function configureAgent(specialties = ["primaryCare"], options = {}) {
  const specialtyArray = Array.isArray(specialties) ? specialties : [specialties];
  
  // Default options - ensure all values are explicitly set
  const config = {
    callType: options.callType || 'inbound',
    voiceId: options.voiceId || "lyPbHf3pO5t4kYZYenaY",
    ttsModel: options.ttsModel || "eleven_turbo_v2_5",
    llmModel: options.llmModel || "gemini-2.0-flash",
    asrProvider: options.asrProvider || "elevenlabs",
    asrQuality: options.asrQuality || "high",
    optimizeLatency: options.optimizeLatency !== undefined ? options.optimizeLatency : 3,
    stability: options.stability !== undefined ? options.stability : 0.5,
    similarityBoost: options.similarityBoost !== undefined ? options.similarityBoost : 0.75,
    language: options.language || "en",
  };
  
  if (!AGENT_ID || !API_KEY || !SERVER_URL) {
    throw new Error("Missing: ELEVENLABS_AGENT_ID, ELEVENLABS_API_KEY, SERVER_URL");
  }

  const normalizedSpecialties = specialtyArray.map(normalizeSpecialtyKey);
  const invalid = normalizedSpecialties.filter(s => !specialtyPrompts[s]);
  if (invalid.length > 0) {
    throw new Error(`Unknown specialties: ${invalid.join(", ")}. Available: ${Object.keys(specialtyPrompts).join(", ")}`);
  }

  const specialtyNames = normalizedSpecialties.map(s => specialtyPrompts[s]?.name).join(", ");

  console.log("========================================");
  console.log("🔧 Configuring ElevenLabs Agent");
  console.log("========================================");
  console.log(`Agent ID: ${AGENT_ID}`);
  console.log(`Call Type: ${config.callType.toUpperCase()}`);
  console.log(`Specialties: ${specialtyNames}`);
  console.log(`LLM Model: ${config.llmModel}`);
  console.log(`Voice ID: ${config.voiceId}`);
  console.log(`TTS Model: ${config.ttsModel}`);
  console.log(`Server URL: ${SERVER_URL}\n`);

  try {
    const client = await getClientInstance();
    
    const combinedPrompt = generateCombinedPrompt(normalizedSpecialties, config);
    const firstMessage = generateFirstMessage(normalizedSpecialties, config);
    
    console.log("📝 Generated prompt length:", combinedPrompt.length, "characters");
    console.log("💬 First message:", firstMessage);
    if (config.callType === 'outbound') {
      console.log("📞 Outbound call instructions: ENABLED");
    }
    
    console.log("\n📥 Fetching current agent...");
    const currentAgent = await client.conversationalAi.agents.get(AGENT_ID);
    console.log(`✅ Agent found: ${currentAgent.name || "Unnamed"}`);

    console.log("\n🔄 Updating agent configuration...");
    
    // Use snake_case field names as expected by the API
    const updatePayload = {
      conversation_config: {
        agent: {
          prompt: {
            prompt: combinedPrompt,
            llm: config.llmModel,
          },
          first_message: firstMessage,
          language: config.language,
        },
        tts: {
          voice_id: config.voiceId,
          model_id: config.ttsModel,
          optimize_streaming_latency: config.optimizeLatency,
          stability: config.stability,
          similarity_boost: config.similarityBoost,
        },
        asr: {
          quality: config.asrQuality,
          provider: config.asrProvider,
        },
      },
    };

    console.log("📋 Configuration values:");
    console.log(`  Voice ID: ${updatePayload.conversation_config.tts.voice_id}`);
    console.log(`  TTS Model: ${updatePayload.conversation_config.tts.model_id}`);
    console.log(`  LLM: ${updatePayload.conversation_config.agent.prompt.llm}`);
    console.log(`  Stability: ${updatePayload.conversation_config.tts.stability}`);
    console.log(`  Similarity: ${updatePayload.conversation_config.tts.similarity_boost}`);
    console.log(`  Latency: ${updatePayload.conversation_config.tts.optimize_streaming_latency}`);
    console.log(`  ASR Provider: ${updatePayload.conversation_config.asr.provider}`);
    console.log(`  ASR Quality: ${updatePayload.conversation_config.asr.quality}`);
    console.log(`  Language: ${updatePayload.conversation_config.agent.language}`);

    await client.conversationalAi.agents.update(AGENT_ID, updatePayload);

    console.log("\n========================================");
    console.log("✅ Agent Configuration Complete!");
    console.log("========================================");
    console.log(`\n📋 Summary:`);
    console.log(`  ✓ Call Type: ${config.callType}`);
    console.log(`  ✓ Specialties: ${specialtyNames}`);
    console.log(`  ✓ System prompt updated`);
    console.log(`  ✓ First message updated`);
    console.log(`  ✓ Voice: ${config.voiceId}`);
    console.log(`  ✓ LLM: ${config.llmModel}\n`);

    return {
      success: true,
      specialties: normalizedSpecialties,
      specialtyNames: normalizedSpecialties.map(s => specialtyPrompts[s]?.name),
      agentId: AGENT_ID,
      callType: config.callType,
      config: config,
      message: `Agent configured for ${specialtyNames} (${config.callType})`,
    };
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    throw error;
  }
}

// ============================================
// EXPORTED HELPERS
// ============================================
export function getAvailableSpecialties() {
  return Object.entries(specialtyPrompts).map(([key, value]) => ({
    id: key,
    name: value.name,
  }));
}

export async function createTool(config) {
  const client = await getClientInstance();
  return await client.conversationalAi.tools.create(config);
}

export async function listTools() {
  const client = await getClientInstance();
  return await client.conversationalAi.tools.list();
}

export async function deleteTool(toolId) {
  const client = await getClientInstance();
  return await client.conversationalAi.tools.delete(toolId);
}

// ============================================
// CLI RUNNER
// ============================================
async function runCLI() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log("\n🏥 Multi-Specialty Agent Configuration");
    console.log("=============================================");
    console.log("\nUsage: node configureSpecialtyAgent.js <specialty1> [specialty2] ... [--outbound]");
    console.log("\nAvailable:");
    Object.entries(specialtyPrompts).forEach(([k, v]) => console.log(`  - ${k}: ${v.name}`));
    console.log("\nOptions:");
    console.log("  --outbound    Configure for outbound calls");
    console.log("  --inbound     Configure for inbound calls (default)");
    console.log("\nExamples:");
    console.log("  node configureSpecialtyAgent.js primaryCare");
    console.log("  node configureSpecialtyAgent.js primaryCare mentalHealth --outbound");
    console.log("  node configureSpecialtyAgent.js cardiology radiology\n");
    return;
  }

  const specialties = args.filter(arg => !arg.startsWith('--'));
  const isOutbound = args.includes('--outbound');
  
  const options = {
    callType: isOutbound ? 'outbound' : 'inbound'
  };

  try {
    await configureAgent(specialties, options);
  } catch (error) {
    console.error("Failed:", error.message);
    process.exit(1);
  }
}

if (process.argv[1]?.includes("agentService") || process.argv[1]?.includes("configureSpecialtyAgent")) {
  runCLI();
}