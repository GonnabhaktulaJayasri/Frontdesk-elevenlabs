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
} from "../controllers/callController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

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

export default router;