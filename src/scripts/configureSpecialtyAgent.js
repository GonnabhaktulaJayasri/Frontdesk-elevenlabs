// scripts/configureSpecialtyAgent.js
// Dynamic configuration script for specialty-based ElevenLabs agents
// Supports MULTIPLE specialties - hospital can select more than one
// Uses ElevenLabs SDK for tool creation

import dotenv from "dotenv";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

dotenv.config();

const AGENT_ID = process.env.ELEVENLABS_AGENT_ID;
const API_KEY = process.env.ELEVENLABS_API_KEY;
const SERVER_URL = process.env.SERVER_URL;

// Initialize ElevenLabs client
const client = new ElevenLabsClient({
  apiKey: API_KEY,
});

// ============================================
// CLINIC CONFIGURATION
// ============================================
const CLINIC_CONFIG = {
  name: "Orion West Medical Group",
  address: "1771 East Flamingo Rd",
  city: "Las Vegas",
  phone: process.env.CLINIC_PHONE || "(555) 123-4567",
  mission: "Providing comprehensive and quality healthcare services to the uninsured and underinsured",
};

// ============================================
// SPECIALTY PROMPTS
// ============================================
const specialtyPrompts = {
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
function generateCombinedPrompt(specialties) {
  const specialtyNames = specialties.map(s => specialtyPrompts[s]?.name || s).join(", ");
  
  let prompt = `# Personality
You are a healthcare scheduling assistant for ${CLINIC_CONFIG.name} in ${CLINIC_CONFIG.city}. ${CLINIC_CONFIG.mission}.

# Available Departments: ${specialtyNames}

`;
  
  specialties.forEach(s => {
    if (specialtyPrompts[s]) {
      prompt += specialtyPrompts[s].prompt + "\n\n";
    }
  });
  
  prompt += `# Workflow
1. Get patient info (name, DOB) using get_patient_info tool
2. Register new patient if not found using register_patient tool
3. Check availability using check_availability tool
4. Book appointment using book_appointment tool
5. Confirm details and location: ${CLINIC_CONFIG.address}, ${CLINIC_CONFIG.city}

# Guardrails
- No medical advice. No sensitive info beyond necessary. Never share other patient info.
- Always use tools to confirm/book. Never make up availability.`;

  return prompt;
}

// ============================================
// GENERATE FIRST MESSAGE
// ============================================
function generateFirstMessage(specialties) {
  const names = specialties.map(s => specialtyPrompts[s]?.name).filter(Boolean);
  
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
// TOOL DEFINITIONS - Using correct SDK format
// ============================================
function getBaseToolConfigs() {
  return [
    {
      name: "get_patient_info",
      description: "Retrieve existing patient information. Use FIRST before booking.",
      toolConfig: {
        webhook: {
          url: `${SERVER_URL}/api/tools/get-patient-info`,
          method: "POST",
          requestBodySchema: {
            type: "object",
            properties: {
              name: { type: "string", description: "Patient full name" },
              date_of_birth: { type: "string", description: "DOB in YYYY-MM-DD format" },
              phone: { type: "string", description: "Phone number (optional)" },
            },
            required: ["name", "date_of_birth"],
          },
        },
      },
    },
    {
      name: "register_patient",
      description: "Register new patient when not found in lookup.",
      toolConfig: {
        webhook: {
          url: `${SERVER_URL}/api/tools/register-patient`,
          method: "POST",
          requestBodySchema: {
            type: "object",
            properties: {
              name: { type: "string", description: "Patient full name" },
              date_of_birth: { type: "string", description: "DOB in YYYY-MM-DD format" },
              phone: { type: "string", description: "Phone number" },
            },
            required: ["name", "date_of_birth", "phone"],
          },
        },
      },
    },
    {
      name: "check_availability",
      description: "Check available appointment slots for a date.",
      toolConfig: {
        webhook: {
          url: `${SERVER_URL}/api/tools/check-availability`,
          method: "POST",
          requestBodySchema: {
            type: "object",
            properties: {
              date: { type: "string", description: "Date in YYYY-MM-DD format" },
              doctor_id: { type: "string", description: "Doctor ID (optional)" },
              specialty: { type: "string", description: "Specialty (optional)" },
            },
            required: ["date"],
          },
        },
      },
    },
    {
      name: "book_appointment",
      description: "Book appointment after verifying patient and availability.",
      toolConfig: {
        webhook: {
          url: `${SERVER_URL}/api/tools/book-appointment`,
          method: "POST",
          requestBodySchema: {
            type: "object",
            properties: {
              patient_id: { type: "string", description: "Patient ID" },
              doctor_id: { type: "string", description: "Doctor ID" },
              date: { type: "string", description: "Date YYYY-MM-DD" },
              time: { type: "string", description: "Time HH:MM 24hr format" },
              reason: { type: "string", description: "Reason for visit" },
              phone: { type: "string", description: "Phone number" },
              specialty: { type: "string", description: "Department" },
            },
            required: ["patient_id", "doctor_id", "date", "time", "phone"],
          },
        },
      },
    },
    {
      name: "update_appointment",
      description: "Reschedule or modify existing appointment.",
      toolConfig: {
        webhook: {
          url: `${SERVER_URL}/api/tools/update-appointment`,
          method: "POST",
          requestBodySchema: {
            type: "object",
            properties: {
              appointment_id: { type: "string", description: "Appointment ID" },
              new_date: { type: "string", description: "New date (optional)" },
              new_time: { type: "string", description: "New time (optional)" },
              reason: { type: "string", description: "Reason (optional)" },
            },
            required: ["appointment_id"],
          },
        },
      },
    },
  ];
}

function getSpecialtyToolConfigs(specialty) {
  const tools = {
    radiology: [
      {
        name: "verify_imaging_order",
        description: "Verify physician order for imaging study",
        toolConfig: {
          webhook: {
            url: `${SERVER_URL}/api/tools/verify-order`,
            method: "POST",
            requestBodySchema: {
              type: "object",
              properties: {
                patient_id: { type: "string", description: "Patient ID" },
                imaging_type: { type: "string", description: "Type: xray, ct, mri, ultrasound, mammogram, dexa, pet" },
                body_part: { type: "string", description: "Body part to image" },
              },
              required: ["patient_id", "imaging_type"],
            },
          },
        },
      },
      {
        name: "check_mri_safety",
        description: "MRI safety screening for patient",
        toolConfig: {
          webhook: {
            url: `${SERVER_URL}/api/tools/mri-safety`,
            method: "POST",
            requestBodySchema: {
              type: "object",
              properties: {
                patient_id: { type: "string", description: "Patient ID" },
                has_pacemaker: { type: "boolean", description: "Has pacemaker?" },
                has_implants: { type: "boolean", description: "Has metal implants?" },
                implant_details: { type: "string", description: "Implant details" },
                is_claustrophobic: { type: "boolean", description: "Is claustrophobic?" },
              },
              required: ["patient_id", "has_pacemaker", "has_implants"],
            },
          },
        },
      },
    ],
    cardiology: [
      {
        name: "get_procedure_prep",
        description: "Get cardiac procedure preparation instructions",
        toolConfig: {
          webhook: {
            url: `${SERVER_URL}/api/tools/procedure-prep`,
            method: "POST",
            requestBodySchema: {
              type: "object",
              properties: {
                procedure_type: { type: "string", description: "Type: stress_test, nuclear_stress_test, echocardiogram, holter_monitor, ekg" },
              },
              required: ["procedure_type"],
            },
          },
        },
      },
    ],
    mentalHealth: [
      {
        name: "check_telehealth_availability",
        description: "Check telehealth availability for mental health",
        toolConfig: {
          webhook: {
            url: `${SERVER_URL}/api/tools/telehealth-check`,
            method: "POST",
            requestBodySchema: {
              type: "object",
              properties: {
                appointment_type: { type: "string", description: "Type: therapy, psychiatric, medication_followup, couples, family" },
                date: { type: "string", description: "Date in YYYY-MM-DD format" },
              },
              required: ["appointment_type", "date"],
            },
          },
        },
      },
    ],
    sportsMedicine: [
      {
        name: "check_imaging_requirements",
        description: "Check if imaging needed before sports medicine appointment",
        toolConfig: {
          webhook: {
            url: `${SERVER_URL}/api/tools/imaging-check`,
            method: "POST",
            requestBodySchema: {
              type: "object",
              properties: {
                injury_type: { type: "string", description: "Type of injury" },
                injury_date: { type: "string", description: "When injury occurred" },
              },
              required: ["injury_type"],
            },
          },
        },
      },
    ],
    primaryCare: [],
  };
  return tools[specialty] || [];
}

// ============================================
// CREATE TOOLS USING SDK
// ============================================
async function createToolsWithSDK(toolConfigs) {
  const createdTools = [];
  
  for (const config of toolConfigs) {
    try {
      console.log(`  Creating tool: ${config.name}`);
      
      // Use the correct SDK format with toolConfig wrapper
      const tool = await client.conversationalAi.tools.create({
        name: config.name,
        description: config.description,
        toolConfig: config.toolConfig,
      });
      
      createdTools.push(tool);
      console.log(`  ✅ Created: ${config.name} (ID: ${tool.toolId})`);
    } catch (error) {
      // If tool already exists, try to find it
      if (error.message?.includes("already exists") || error.statusCode === 409) {
        console.log(`  ⚠️ Tool ${config.name} may already exist, continuing...`);
        try {
          const existingTools = await client.conversationalAi.tools.list();
          const existing = existingTools.tools?.find(t => t.name === config.name);
          if (existing) {
            createdTools.push(existing);
            console.log(`  ✅ Found existing: ${config.name} (ID: ${existing.toolId})`);
          }
        } catch (listError) {
          console.log(`  ⚠️ Could not list tools: ${listError.message}`);
        }
      } else {
        console.error(`  ❌ Failed: ${config.name} - ${error.message}`);
        throw error;
      }
    }
  }
  
  return createdTools;
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
  console.log(`Server URL: ${SERVER_URL}\n`);

  try {
    // Generate prompt and first message
    const combinedPrompt = generateCombinedPrompt(normalizedSpecialties);
    const firstMessage = generateFirstMessage(normalizedSpecialties);
    
    console.log("📝 Generated prompt length:", combinedPrompt.length, "characters");
    console.log("💬 First message:", firstMessage);
    
    // Get current agent
    console.log("\n📥 Fetching current agent...");
    const currentAgent = await client.conversationalAi.agents.get(AGENT_ID);
    console.log(`✅ Agent found: ${currentAgent.name || "Unnamed"}`);

    // Update agent with prompt and first message only (no tools for now)
    console.log("\n🔄 Updating agent configuration...");
    await client.conversationalAi.agents.update(AGENT_ID, {
      conversationConfig: {
        agent: {
          prompt: {
            prompt: combinedPrompt,
            llm: "gemini-2.0-flash-001",
          },
          firstMessage: firstMessage,
          language: "en",
        },
        tts: currentAgent.conversationConfig?.tts || {
          voiceId: "21m00Tcm4TlvDq8ikWAM",
          modelId: "eleven_turbo_v2_5",
          optimizeStreamingLatency: 3,
        },
        asr: currentAgent.conversationConfig?.asr || {
          quality: "high",
          provider: "elevenlabs",
        },
      },
    });

    console.log("\n========================================");
    console.log("✅ Agent Configuration Complete!");
    console.log("========================================");
    console.log(`\n📋 Summary:`);
    console.log(`  ✓ Specialties: ${specialtyNames}`);
    console.log(`  ✓ System prompt updated`);
    console.log(`  ✓ First message updated\n`);

    return {
      success: true,
      specialties: normalizedSpecialties,
      specialtyNames: normalizedSpecialties.map(s => specialtyPrompts[s]?.name),
      agentId: AGENT_ID,
      message: `Agent configured for ${specialtyNames}`,
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
  return await client.conversationalAi.tools.create(config);
}

export async function listTools() {
  return await client.conversationalAi.tools.list();
}

export async function deleteTool(toolId) {
  return await client.conversationalAi.tools.delete(toolId);
}

// ============================================
// CLI RUNNER
// ============================================
async function runCLI() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log("\n🏥 Multi-Specialty Agent Configuration (SDK)");
    console.log("=============================================");
    console.log("\nUsage: node configureSpecialtyAgent.js <specialty1> [specialty2] ...");
    console.log("\nAvailable:");
    Object.entries(specialtyPrompts).forEach(([k, v]) => console.log(`  - ${k}: ${v.name}`));
    console.log("\nExamples:");
    console.log("  node configureSpecialtyAgent.js primaryCare");
    console.log("  node configureSpecialtyAgent.js primaryCare mentalHealth cardiology\n");
    return;
  }

  try {
    await configureAgent(args);
  } catch (error) {
    console.error("Failed:", error.message);
    process.exit(1);
  }
}

if (process.argv[1]?.includes("configureSpecialtyAgent")) {
  runCLI();
}

export { specialtyPrompts, CLINIC_CONFIG, client };