// routes/twilio.js
// Handles inbound and outbound calls using ElevenLabs SDK
import express from "express";
import twilio from "twilio";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const router = express.Router();
const { VoiceResponse } = twilio.twiml;

// Initialize ElevenLabs client
const elevenLabsClient = new ElevenLabsClient({
  apiKey: 'sk_00ed21dbd40e8ef9c2345f45b2a1f5ef3f23e056d2a5879b',
});

// Initialize Twilio client (for status callbacks and other Twilio operations)
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// ============================================
// POST /api/calls/inbound
// Handle inbound calls from Twilio
// ============================================
router.post("/inbound", (req, res) => {
  console.log("====================================");
  console.log("====== INBOUND CALL RECEIVED ======");
  console.log("Caller Phone:", req.body.From);
  console.log("Call SID:", req.body.CallSid);
  console.log("====================================");

  try {
    const { From, CallSid } = req.body;
    const agentId = process.env.ELEVENLABS_AGENT_ID;

    if (!agentId || agentId === "your_agent_id") {
      console.error("❌ ELEVENLABS_AGENT_ID is not configured!");
      const errorTwiml = new VoiceResponse();
      errorTwiml.say("Sorry, the agent is not configured properly.");
      res.type("text/xml");
      return res.send(errorTwiml.toString());
    }

    console.log("✅ Agent ID found:", agentId);

    // Create TwiML response
    const twiml = new VoiceResponse();
    const websocketUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}`;
    console.log("📞 Connecting to:", websocketUrl);

    // Connect to ElevenLabs
    const connect = twiml.connect();
    const stream = connect.stream({ url: websocketUrl });

    // Add parameters
    stream.parameter({ name: "caller_phone", value: From });
    stream.parameter({ name: "call_sid", value: CallSid });
    stream.parameter({
      name: "custom_data",
      value: JSON.stringify({
        source: "twilio_inbound",
        timestamp: new Date().toISOString(),
      }),
    });

    const twimlString = twiml.toString();
    console.log("📤 Sending TwiML Response");
    console.log("====================================");

    res.type("text/xml");
    res.send(twimlString);
  } catch (error) {
    console.error("❌ ERROR in /inbound route:", error);
    const errorTwiml = new VoiceResponse();
    errorTwiml.say("An error occurred. Please try again later.");
    res.type("text/xml");
    res.send(errorTwiml.toString());
  }
});

// ============================================
// POST /api/calls/outbound
// Make outbound call using ElevenLabs SDK
// ============================================
router.post("/outbound", async (req, res) => {
  try {
    const { to_number, agent_id, agent_phone_number_id } = req.body;

    if (!to_number) {
      return res.status(400).json({
        success: false,
        error: "to_number is required",
      });
    }

    // Use provided agent_id or fall back to env variable
    const agentId = agent_id || process.env.ELEVENLABS_AGENT_ID;
    const phoneNumberId = agent_phone_number_id || process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID;

    if (!agentId) {
      return res.status(400).json({
        success: false,
        error: "agent_id is required (or set ELEVENLABS_AGENT_ID env variable)",
      });
    }

    if (!phoneNumberId) {
      return res.status(400).json({
        success: false,
        error: "agent_phone_number_id is required (or set ELEVENLABS_AGENT_PHONE_NUMBER_ID env variable)",
      });
    }

    console.log("====================================");
    console.log("📞 Making outbound call using ElevenLabs SDK");
    console.log("To Number:", to_number);
    console.log("Agent ID:", agentId);
    console.log("Phone Number ID:", phoneNumberId);
    console.log("====================================");

    // Make outbound call using ElevenLabs SDK
    const call = await elevenLabsClient.conversationalAi.twilio.outboundCall({
      agentId: agentId,
      agentPhoneNumberId: phoneNumberId,
      toNumber: to_number,
    });

    console.log("✅ Outbound call initiated:", call);

    res.json({
      success: true,
      call: call,
      message: `Outbound call initiated to ${to_number}`,
    });
  } catch (error) {
    console.error("❌ Outbound call failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// POST /api/calls/outbound-batch
// Make multiple outbound calls
// ============================================
router.post("/outbound-batch", async (req, res) => {
  try {
    const { phone_numbers, agent_id, agent_phone_number_id } = req.body;

    if (!phone_numbers || !Array.isArray(phone_numbers) || phone_numbers.length === 0) {
      return res.status(400).json({
        success: false,
        error: "phone_numbers array is required",
      });
    }

    const agentId = agent_id || process.env.ELEVENLABS_AGENT_ID;
    const phoneNumberId = agent_phone_number_id || process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID;

    if (!agentId || !phoneNumberId) {
      return res.status(400).json({
        success: false,
        error: "agent_id and agent_phone_number_id are required",
      });
    }

    console.log(`📞 Initiating ${phone_numbers.length} outbound calls...`);

    const results = [];
    
    for (const toNumber of phone_numbers) {
      try {
        const call = await elevenLabsClient.conversationalAi.twilio.outboundCall({
          agentId: agentId,
          agentPhoneNumberId: phoneNumberId,
          toNumber: toNumber,
        });
        
        results.push({
          toNumber,
          success: true,
          call,
        });
        console.log(`✅ Call initiated to ${toNumber}`);
      } catch (err) {
        results.push({
          toNumber,
          success: false,
          error: err.message,
        });
        console.error(`❌ Failed to call ${toNumber}:`, err.message);
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      success: true,
      summary: {
        total: phone_numbers.length,
        successful,
        failed,
      },
      results,
    });
  } catch (error) {
    console.error("❌ Batch outbound calls failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// POST /api/calls/outbound-twiml (Legacy - for direct Twilio integration)
// Returns TwiML for outbound calls if using Twilio's call create method
// ============================================
router.post("/outbound-twiml", (req, res) => {
  console.log("📞 Outbound TwiML requested");

  try {
    const agentId = process.env.ELEVENLABS_AGENT_ID;

    if (!agentId || agentId === "your_agent_id") {
      console.error("❌ Agent ID not configured for outbound call");
      const errorTwiml = new VoiceResponse();
      errorTwiml.say("Agent not configured.");
      res.type("text/xml");
      return res.send(errorTwiml.toString());
    }

    const twiml = new VoiceResponse();
    const connect = twiml.connect();
    const stream = connect.stream({
      url: `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}`,
    });

    if (req.body.From) {
      stream.parameter({ name: "caller_phone", value: req.body.From });
    }
    if (req.body.CallSid) {
      stream.parameter({ name: "call_sid", value: req.body.CallSid });
    }

    const twimlString = twiml.toString();
    console.log("📤 Outbound TwiML generated");

    res.type("text/xml");
    res.send(twimlString);
  } catch (error) {
    console.error("❌ Error generating outbound TwiML:", error);
    const errorTwiml = new VoiceResponse();
    errorTwiml.say("Error occurred.");
    res.type("text/xml");
    res.send(errorTwiml.toString());
  }
});

// ============================================
// POST /api/calls/outbound-legacy
// Legacy outbound call using Twilio client directly
// (Keep for backwards compatibility)
// ============================================
router.post("/outbound-legacy", async (req, res) => {
  try {
    const { to_number } = req.body;

    if (!to_number) {
      return res.status(400).json({
        success: false,
        error: "to_number is required",
      });
    }

    console.log("📞 Making legacy outbound call via Twilio to:", to_number);

    const call = await twilioClient.calls.create({
      url: `${process.env.SERVER_URL}/api/calls/outbound-twiml`,
      to: to_number,
      from: process.env.TWILIO_PHONE_NUMBER,
      statusCallback: `${process.env.SERVER_URL}/api/calls/status`,
      statusCallbackMethod: "POST",
    });

    console.log("✅ Legacy call initiated:", call.sid);

    res.json({
      success: true,
      call_sid: call.sid,
      status: call.status,
    });
  } catch (error) {
    console.error("❌ Legacy outbound call failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// POST /api/calls/status
// Call status webhook
// ============================================
router.post("/status", (req, res) => {
  const { CallSid, CallStatus, CallDuration, ErrorCode, ErrorMessage } = req.body;

  console.log("====================================");
  console.log("====== CALL STATUS UPDATE ======");
  console.log(`Call SID: ${CallSid}`);
  console.log(`Status: ${CallStatus}`);
  console.log(`Duration: ${CallDuration}s`);

  if (ErrorCode) {
    console.error(`❌ Error Code: ${ErrorCode}`);
    console.error(`❌ Error Message: ${ErrorMessage}`);
  }

  console.log("====================================");

  res.sendStatus(200);
});

// ============================================
// GET /api/calls/phone-numbers
// List available phone numbers from ElevenLabs
// ============================================
router.get("/phone-numbers", async (req, res) => {
  try {
    // Note: This endpoint depends on ElevenLabs SDK support
    // You may need to use the API directly if not available in SDK
    const response = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", {
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch phone numbers: ${response.status}`);
    }

    const phoneNumbers = await response.json();

    res.json({
      success: true,
      phoneNumbers,
    });
  } catch (error) {
    console.error("❌ Error fetching phone numbers:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;