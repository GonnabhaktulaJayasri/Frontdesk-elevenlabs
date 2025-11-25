import express from "express";
import {
  // Specialties Management
  getSpecialties,
  previewSpecialties,
  
  // Agent Configuration
  configureAgentSpecialties,
  getCurrentAgent,
  
  // Tools Management
  getToolsList,
  createNewTool,
  removeTool,
} from "../controllers/agentController.js";

const router = express.Router();

// ============================================
// SPECIALTIES ROUTES
// ============================================
router.get("/specialties", getSpecialties);
router.get("/preview", previewSpecialties);

// ============================================
// AGENT CONFIGURATION ROUTES
// ============================================
router.post("/configure", configureAgentSpecialties);
router.get("/current", getCurrentAgent);

// ============================================
// TOOLS ROUTES
// ============================================
router.get("/tools", getToolsList);
router.post("/tools", createNewTool);
router.delete("/tools/:toolId", removeTool);

export default router;