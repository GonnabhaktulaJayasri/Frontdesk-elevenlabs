// // services/agentService.js
// const createHealthcareAgent = async () => {
//   const agentConfig = {
//     conversation_config: {
//       agent: {
//         prompt: {
//           prompt: `# Role
// You are a professional healthcare assistant for [Clinic Name]. Your role is to handle appointment scheduling and general inquiries with warmth and efficiency.

// # Personality
// - Friendly, empathetic, and professional
// - Patient and clear in communication
// - Respect patient privacy and HIPAA compliance

// # Goal
// 1. Identify the purpose of the call (appointment, reschedule, inquiry)
// 2. Collect necessary information accurately
// 3. Use appropriate tools to complete tasks
// 4. Confirm all details with the caller
// 5. End the call professionally

// # Tools Available
// - check_availability: Check doctor availability for appointments
// - book_appointment: Schedule new appointments
// - get_patient_info: Retrieve existing patient information from EMR
// - update_appointment: Modify existing appointments
// - send_confirmation: Send appointment confirmations via SMS

// # Guardrails
// - Never share patient information without verification
// - Always confirm appointment details before booking
// - Do not provide medical advice
// - Escalate complex medical questions to healthcare staff
// - Follow HIPAA compliance strictly

// # Character Normalization
// When collecting:
// - Phone numbers: Speak as "five five five, one two three four" but store as "5551234"
// - Emails: Speak as "john at example dot com" but store as "john@example.com"
// - Dates: Speak as "December fifteenth" but store as "2024-12-15"

// # Error Handling
// If a tool fails:
// - Apologize: "I'm having trouble accessing our system"
// - Offer alternatives: "Let me try again or transfer you to our staff"
// - Never guess or make up information

// # Examples
// Caller: "I need to book an appointment"
// Agent: "I'd be happy to help you schedule an appointment. May I have your full name and date of birth to look up your record?"

// Caller: "I want to reschedule my appointment"
// Agent: "Of course, I can help with that. Can you provide your name and the current appointment date?"`,
//           llm: 'gemini-2.5-flash',
//         },
//         first_message: 'Hello! Thank you for calling [Clinic Name]. How may I assist you today?',
//         language: 'en',
//       },
//       tts: {
//         voice_id: '9T9vSqRrPPxIs5wpyZfK', // Choose from ElevenLabs voice library
//         model_id: 'eleven_turbo_v2_5',
//         optimize_streaming_latency: 3,
//       },
//     },
//     platform_settings: {
//       widget: {
//         enabled: true,
//       },
//     },
//   };

//   try {
//     const agent = await elevenLabs.agents.create(agentConfig);
//     console.log('Agent created:', agent.agent_id);
//     return agent;
//   } catch (error) {
//     console.error('Error creating agent:', error);
//     throw error;
//   }
// };

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import "dotenv/config";

// Initialize ElevenLabs client
const elevenLabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

/**
 * Create a healthcare appointment scheduling agent
 */
export const createHealthcareAgent = async () => {
  const agentConfig = {
    conversation_config: {
      agent: {
        prompt: {
          prompt: `# Role
You are a professional healthcare assistant ... (your long prompt continues here)
`,
          llm: "gemini-2.5-flash",
        },
        first_message:
          "Hello! Thank you for calling Sunshine Medical Clinic. How may I assist you today?",
        language: "en",
      },
      tts: {
        voice_id: "9T9vSqRrPPxIs5wpyZfK",
        model_id: "eleven_turbo_v2_5",
        optimize_streaming_latency: 3,
        stability: 0.5,
        similarity_boost: 0.75,
      },
      asr: {
        quality: "high",
        provider: "elevenlabs",
      },
    },
    platform_settings: {
      widget: { enabled: true },
    },
  };

  try {
    const agent = await elevenLabs.conversationalAi.createAgent(agentConfig);
    console.log("✅ Agent created successfully!");
    console.log("Agent ID:", agent.agent_id);
    return agent;
  } catch (error) {
    console.error("❌ Error creating agent:", error.message);
    if (error.response) {
      console.error("Response:", JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
};

export const getAgent = async (agentId) => {
  try {
    return await elevenLabs.conversationalAi.getAgent(agentId);
  } catch (error) {
    console.error("Error fetching agent:", error.message);
    throw error;
  }
};

export const updateAgent = async (agentId, updates) => {
  try {
    const agent = await elevenLabs.conversationalAi.updateAgent(
      agentId,
      updates
    );
    console.log("✅ Agent updated successfully!");
    return agent;
  } catch (error) {
    console.error("Error updating agent:", error.message);
    throw error;
  }
};

export const addToolsToAgent = async (agentId, tools) => {
  try {
    const currentAgent = await getAgent(agentId);

    const updates = {
      conversation_config: {
        ...currentAgent.conversation_config,
        agent: {
          ...currentAgent.conversation_config.agent,
          tools,
        },
      },
    };

    await updateAgent(agentId, updates);
    console.log(`✅ Added ${tools.length} tools to agent`);
  } catch (error) {
    console.error("Error adding tools:", error.message);
    throw error;
  }
};

export const listVoices = async () => {
  try {
    const voices = await elevenLabs.voices.getAll();
    console.log(`Found ${voices.voices.length} voices`);
    return voices.voices;
  } catch (error) {
    console.error("Error listing voices:", error.message);
    throw error;
  }
};

export const deleteAgent = async (agentId) => {
  try {
    await elevenLabs.conversationalAi.deleteAgent(agentId);
    console.log("✅ Agent deleted");
  } catch (error) {
    console.error("Error deleting agent:", error.message);
    throw error;
  }
};

export const listAllAgents = async () => {
  try {
    const agents = await elevenLabs.conversationalAi.getAgents();
    return agents;
  } catch (error) {
    console.error("Error listing agents:", error.message);
    throw error;
  }
};

// Export client also
export { elevenLabs };
