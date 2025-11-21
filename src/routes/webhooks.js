import express from "express";
import { verifyWebhookSignature } from "../middleware/webhookAuth.js";

const router = express.Router();

router.post("/elevenlabs", verifyWebhookSignature, (req, res) => {
  console.log("Valid webhook received:", req.body);
  res.sendStatus(200);
});

export default router;
