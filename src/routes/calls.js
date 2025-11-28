import express from "express";
import {
  inboundCall,
  outboundCall,
  outboundBatchCall,
  outboundTwiml,
  outboundLegacyCall,
  handleCallStatus,
  getPhoneNumbers,
  callLogs,
  endCall,
  transferCall,
  getCallReasons,
} from "../controllers/callController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { getCallConfig, twilioPersonalizationWebhook } from "../controllers/personalizationController.js";

const router = express.Router();

router.post("/inbound", inboundCall);

router.post("/outbound", outboundCall);
router.post("/outbound-batch", outboundBatchCall);

router.post("/outbound-legacy", outboundLegacyCall);
router.post("/outbound-twiml", outboundTwiml);

router.post("/status", handleCallStatus);
router.post("/end", endCall);
router.post("/transfer", transferCall);
router.get("/logs", callLogs);

router.get("/phone-numbers", getPhoneNumbers);

router.post("/personalization-webhook", twilioPersonalizationWebhook);

// Get call configuration for a specific direction/specialty
router.get("/config", getCallConfig);

// Get available call reasons for outbound calls
router.get("/reasons", getCallReasons);

export default router;