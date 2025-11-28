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
  timings: "Mon-Fri 8am-5pm",
  emergencySerivices: "Call 911 for emergencies",
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
// BASE PROMPT GENERATOR
// This creates a direction-agnostic base prompt.
// Direction-specific context is added at RUNTIME via:
//   - Inbound: personalization webhook
//   - Outbound: conversationInitiationClientData
// ============================================
function generateBasePrompt(specialties) {
  const specialtyNames = specialties.map(s => specialtyPrompts[s]?.name || s).join(", ");
  
  let prompt = `# Role & Identity
You are a healthcare scheduling assistant for ${CLINIC_CONFIG.name} in ${CLINIC_CONFIG.city}. 
${CLINIC_CONFIG.mission}.

# Available Departments
${specialtyNames}

# Dynamic Call Context
This prompt will be supplemented with call-specific context at runtime based on whether this is an inbound or outbound call. The additional context will include:
- Call direction (inbound/outbound)
- Patient information if available
- Purpose of the call
- Specific instructions for the call type

# Available Dynamic Variables
You may see these variables populated at runtime:
- {{call_direction}} - "inbound" or "outbound"
- {{patient_name}} - Patient's name if known
- {{caller_phone}} - Phone number
- {{call_reason}} - Purpose of outbound calls
- {{appointment_date}}, {{appointment_time}}, {{doctor_name}} - Appointment details

`;

  // Add specialty-specific prompts
  specialties.forEach(s => {
    if (specialtyPrompts[s]) {
      prompt += specialtyPrompts[s].prompt + "\n\n";
    }
  });

  // Add workflow and guardrails
  prompt += `# Standard Workflow
1. Determine call context (inbound vs outbound from the additional context provided)
2. For INBOUND: Ask how you can help, then get patient info (name, DOB)
3. For OUTBOUND: Verify identity first, then proceed with call purpose
4. Use get_patient_info tool to look up patient records
5. Use register_patient tool if patient not found
6. Use check_availability tool to find open slots
7. Use book_appointment tool to schedule
8. Always confirm details and provide location: ${CLINIC_CONFIG.address}, ${CLINIC_CONFIG.city}

# Guardrails
- Never provide medical advice or diagnoses
- Never share information about other patients
- Always verify patient identity before accessing records
- Use tools to check availability - never make up times
- For emergencies (chest pain, difficulty breathing, etc.), direct to 911
- Be warm, professional, and patient

# Clinic Information
- Name: ${CLINIC_CONFIG.name}
- Address: ${CLINIC_CONFIG.address}, ${CLINIC_CONFIG.city}
- Phone: ${CLINIC_CONFIG.phone}
`;

  return prompt;
}

// ============================================
// DEFAULT FIRST MESSAGE
// This is overridden at runtime for both inbound and outbound
// ============================================
function generateDefaultFirstMessage(specialties) {
  const names = specialties.map(s => specialtyPrompts[s]?.name).filter(Boolean);
  
  if (names.length === 1) {
    return `Hello! Thank you for calling ${CLINIC_CONFIG.name} ${names[0]}. How may I help you today?`;
  } else if (names.length === 2) {
    return `Hello! Thank you for calling ${CLINIC_CONFIG.name}. We offer ${names[0]} and ${names[1]} services. How may I help you today?`;
  } else if (names.length > 2) {
    const last = names.pop();
    return `Hello! Thank you for calling ${CLINIC_CONFIG.name}. We offer ${names.join(", ")}, and ${last} services. How may I help you today?`;
  }
  return `Hello! Thank you for calling ${CLINIC_CONFIG.name}. How may I help you today?`;
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
export async function configureAgent(specialties = ["primaryCare"]) {
  const specialtyArray = Array.isArray(specialties) ? specialties : [specialties];
  
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
  console.log(`Specialties: ${specialtyNames}`);
  console.log(`Server URL: ${SERVER_URL}`);
  console.log("\n");

  try {
    const client = await getClientInstance();
    
    // Generate base prompt (direction-agnostic)
    const basePrompt = generateBasePrompt(normalizedSpecialties);
    
    // Default first message (will be overridden at runtime)
    const defaultFirstMessage = generateDefaultFirstMessage(normalizedSpecialties);
    
    console.log("📝 Base prompt length:", basePrompt.length, "characters");
    console.log("💬 Default first message:", defaultFirstMessage);
    
    console.log("\n📥 Fetching current agent...");
    const currentAgent = await client.conversationalAi.agents.get(AGENT_ID);
    console.log(`✅ Agent found: ${currentAgent.name || "Unnamed"}`);

    console.log("\n🔄 Updating agent configuration...");
    await client.conversationalAi.agents.update(AGENT_ID, {
      conversationConfig: {
        agent: {
          prompt: {
            prompt: basePrompt,
            llm: "gemini-2.0-flash",
          },
          firstMessage: defaultFirstMessage,
          language: "en",
        },
        tts: currentAgent.conversationConfig?.tts || {
          voiceId: "lyPbHf3pO5t4kYZYenaY",
          modelId: "eleven_turbo_v2_5",
          optimizeStreamingLatency: 3,
        },
        asr: currentAgent.conversationConfig?.asr || {
          quality: "high",
          provider: "elevenlabs",
        },
      },
    });

    // Store current specialty in env for webhook reference
    process.env.CURRENT_SPECIALTY = normalizedSpecialties.join(",");

    console.log("\n========================================");
    console.log("✅ Agent Configuration Complete!");
    console.log("========================================");
    
    console.log("\n📋 Summary:");
    console.log(`  ✓ Specialties: ${specialtyNames}`);
    console.log(`  ✓ Base prompt configured`);
    console.log(`  ✓ Default first message set`);
    
    console.log("\n" + "=".repeat(50));
    console.log("📌 REQUIRED: Configure ElevenLabs Personalization");
    console.log("=".repeat(50));
    console.log("\nFor INBOUND calls to work with custom first messages:");
    console.log("1. Go to ElevenLabs Dashboard → Your Agent → Settings");
    console.log("2. Navigate to 'Security' tab");
    console.log("3. Enable 'Fetch conversation initiation data for inbound Twilio calls'");
    console.log(`4. Set webhook URL to:\n   ${SERVER_URL}/api/calls/personalization-webhook`);
    console.log("5. Enable these override fields:");
    console.log("   ✓ first_message");
    console.log("   ✓ prompt");
    console.log("\nFor OUTBOUND calls:");
    console.log("  → Personalization is automatic via SDK");
    console.log("  → Uses conversationInitiationClientData");
    console.log("\n");

    return {
      success: true,
      specialties: normalizedSpecialties,
      specialtyNames: normalizedSpecialties.map(s => specialtyPrompts[s]?.name),
      agentId: AGENT_ID,
      message: `Agent configured for ${specialtyNames}`,
      personalizationWebhook: `${SERVER_URL}/api/calls/personalization-webhook`,
      note: "Remember to configure the webhook in ElevenLabs dashboard for inbound call personalization",
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
    console.log("\nUsage: node agentService.js <specialty1> [specialty2] ...");
    console.log("\nAvailable:");
    Object.entries(specialtyPrompts).forEach(([k, v]) => console.log(`  - ${k}: ${v.name}`));
    console.log("\nExamples:");
    console.log("  node agentService.js primaryCare");
    console.log("  node agentService.js primaryCare mentalHealth cardiology\n");
    return;
  }

  try {
    await configureAgent(args);
  } catch (error) {
    console.error("Failed:", error.message);
    process.exit(1);
  }
}

if (process.argv[1]?.includes("agentService")) {
  runCLI();
}