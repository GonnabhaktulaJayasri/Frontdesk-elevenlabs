import { elevenLabsClient } from "../config/clients.js";
import {
  configureAgent,
  getAvailableSpecialties,
  specialtyPrompts,
  CLINIC_CONFIG,
  createTool,
  listTools,
  deleteTool,
} from "../services/agentService.js";
import voiceService from "../services/voiceService.js";

// Use centralized ElevenLabs client
const client = elevenLabsClient;

// ============================================
// SPECIALTIES MANAGEMENT
// ============================================

// Get list of available medical specialties
export const getSpecialties = (req, res) => {
  try {
    const specialties = getAvailableSpecialties();
    res.json({
      success: true,
      specialties,
      clinic: CLINIC_CONFIG,
      note: "Multiple specialties can be selected when configuring the agent",
    });
  } catch (error) {
    console.error("Error fetching specialties:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch specialties",
    });
  }
};

// Preview combined configuration for multiple specialties
export const previewSpecialties = (req, res) => {
  try {
    const { specialties } = req.query;

    if (!specialties) {
      return res.status(400).json({
        success: false,
        error: "Specialties query parameter is required",
        example: "/api/agent/preview?specialties=primaryCare,mentalHealth",
      });
    }

    const specialtyArray = specialties.split(",").map(s => s.trim().toLowerCase());
    
    const keyMap = {
      "primary care": "primaryCare", 
      "primarycare": "primaryCare", 
      "primary": "primaryCare",
      "mental health": "mentalHealth", 
      "mentalhealth": "mentalHealth", 
      "mental": "mentalHealth",
      "sports medicine": "sportsMedicine", 
      "sportsmedicine": "sportsMedicine", 
      "sports": "sportsMedicine",
      "cardiology": "cardiology", 
      "radiology": "radiology",
    };

    const normalizedSpecialties = specialtyArray.map(s => keyMap[s] || s);
    const invalid = normalizedSpecialties.filter(s => !specialtyPrompts[s]);
    
    if (invalid.length > 0) {
      return res.status(404).json({
        success: false,
        error: `Specialties not found: ${invalid.join(", ")}`,
        availableSpecialties: Object.keys(specialtyPrompts),
      });
    }

    const selectedSpecialties = normalizedSpecialties.map(key => ({
      id: key,
      name: specialtyPrompts[key].name,
    }));

    const names = selectedSpecialties.map(s => s.name);
    let firstMessagePreview;
    
    if (names.length === 1) {
      firstMessagePreview = `Hello! Thank you for calling ${CLINIC_CONFIG.name} ${names[0]}. How may I help you today?`;
    } else if (names.length === 2) {
      firstMessagePreview = `Hello! Thank you for calling ${CLINIC_CONFIG.name}. We offer ${names[0]} and ${names[1]} services. How may I help you today?`;
    } else {
      const last = names.pop();
      firstMessagePreview = `Hello! Thank you for calling ${CLINIC_CONFIG.name}. We offer ${names.join(", ")}, and ${last} services. How may I help you today?`;
    }

    res.json({
      success: true,
      selectedSpecialties,
      count: selectedSpecialties.length,
      first_message_preview: firstMessagePreview,
      departments: selectedSpecialties.map(s => s.name).join(", "),
    });
  } catch (error) {
    console.error("Error previewing:", error);
    res.status(500).json({
      success: false,
      error: "Failed to preview",
    });
  }
};

// ============================================
// AGENT CONFIGURATION
// ============================================

// Configure agent with selected specialty/specialties
export const configureAgentSpecialties = async (req, res) => {
  try {
    let specialties = req.body.specialties || req.body.specialty;

    if (!specialties) {
      return res.status(400).json({
        success: false,
        error: "Specialty/specialties is required",
        availableSpecialties: Object.keys(specialtyPrompts),
        example: {
          singleSpecialty: { specialty: "primaryCare" },
          multipleSpecialties: { 
            specialties: ["primaryCare", "mentalHealth", "cardiology"] 
          },
        },
      });
    }

    const specialtyArray = Array.isArray(specialties) ? specialties : [specialties];

    if (specialtyArray.length === 0) {
      return res.status(400).json({
        success: false,
        error: "At least one specialty must be selected",
        availableSpecialties: Object.keys(specialtyPrompts),
      });
    }

    console.log(`Configuring agent for: ${specialtyArray.join(", ")}`);

    const result = await configureAgent(specialtyArray);

    res.json({
      success: true,
      message: result.message,
      data: {
        specialties: result.specialties,
        specialtyNames: result.specialtyNames,
        agentId: result.agentId,
        toolsCount: result.toolsCount,
        toolIds: result.toolIds,
      },
    });
  } catch (error) {
    console.error("Error configuring agent:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      availableSpecialties: Object.keys(specialtyPrompts),
    });
  }
};

// Get current agent configuration
export const getCurrentAgent = async (req, res) => {
  try {
    const agentId = process.env.ELEVENLABS_AGENT_ID;

    if (!agentId) {
      return res.status(500).json({
        success: false,
        error: "ELEVENLABS_AGENT_ID not configured",
      });
    }

    const agent = await client.conversationalAi.agents.get(agentId);
    
    // Detect current specialties from prompt
    const prompt = agent.conversation_config?.agent?.prompt?.prompt || "";
    const currentSpecialties = [];
    
    for (const [key, config] of Object.entries(specialtyPrompts)) {
      if (prompt.includes(config.name.toUpperCase()) || prompt.includes(`## ${config.name}`)) {
        currentSpecialties.push({ id: key, name: config.name });
      }
    }

    res.json({
      success: true,
      agent: {
        id: agentId,
        name: agent.name,
        currentSpecialties: currentSpecialties.length > 0 ? currentSpecialties : "unknown",
        firstMessage: agent.conversation_config?.agent?.first_message,
        toolIds: agent.conversation_config?.agent?.tool_ids || [],
        toolsCount: agent.conversation_config?.agent?.tool_ids?.length || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching current agent:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch agent",
    });
  }
};

// ============================================
// TOOLS MANAGEMENT
// ============================================

// List all created tools
export const getToolsList = async (req, res) => {
  try {
    const tools = await listTools();
    res.json({
      success: true,
      tools: tools.tools || tools,
    });
  } catch (error) {
    console.error("Error listing tools:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list tools",
    });
  }
};

// Create a new tool using SDK
export const createNewTool = async (req, res) => {
  try {
    const { name, description, type, webhook, parameters } = req.body;

    if (!name || !description || !type) {
      return res.status(400).json({
        success: false,
        error: "name, description, and type are required",
      });
    }

    const tool = await createTool({
      name,
      description,
      type,
      webhook,
      parameters,
    });

    res.json({
      success: true,
      tool,
    });
  } catch (error) {
    console.error("Error creating tool:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Delete a tool
export const removeTool = async (req, res) => {
  try {
    const { toolId } = req.params;
    await deleteTool(toolId);
    res.json({
      success: true,
      message: `Tool ${toolId} deleted`,
    });
  } catch (error) {
    console.error("Error deleting tool:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};