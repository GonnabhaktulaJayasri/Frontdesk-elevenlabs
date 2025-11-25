import { elevenLabsClient, twilioClient, VoiceResponse } from "../config/clients.js";

// ============================================
// Handle inbound calls from Twilio
// ============================================
export const inboundCall = (req, res) => {
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
    console.error("❌ ERROR in inbound call:", error);
    const errorTwiml = new VoiceResponse();
    errorTwiml.say("An error occurred. Please try again later.");
    res.type("text/xml");
    res.send(errorTwiml.toString());
  }
};

// ============================================
// Make outbound call using ElevenLabs SDK
// ============================================
export const outboundCall = async (req, res) => {
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
};

// ============================================
// Make multiple outbound calls (batch)
// ============================================
export const outboundBatchCall = async (req, res) => {
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
};

// ============================================
// Returns TwiML for outbound calls (Legacy)
// ============================================
export const outboundTwiml = (req, res) => {
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
};

// ============================================
// Legacy outbound call using Twilio directly
// ============================================
export const outboundLegacyCall = async (req, res) => {
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
};

// ============================================
// Handle call status webhook
// ============================================
export const handleCallStatus = (req, res) => {
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
};

// ============================================
// List available phone numbers from ElevenLabs
// ============================================
export const getPhoneNumbers = async (req, res) => {
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
};

// ============================================
// Get call logs (placeholder for future implementation)
// ============================================
export const callLogs = async (req, res) => {
  try {
    // Fetch call logs from Twilio
    const calls = await twilioClient.calls.list({ limit: 20 });

    const logs = calls.map(call => ({
      sid: call.sid,
      from: call.from,
      to: call.to,
      status: call.status,
      duration: call.duration,
      startTime: call.startTime,
      endTime: call.endTime,
    }));

    res.json({
      success: true,
      calls: logs,
    });
  } catch (error) {
    console.error("❌ Error fetching call logs:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ============================================
// End/terminate an ongoing call
// ============================================
export const endCall = async (req, res) => {
  try {
    const { call_sid } = req.body;

    if (!call_sid) {
      return res.status(400).json({
        success: false,
        error: "call_sid is required",
      });
    }

    console.log(`🔚 Ending call: ${call_sid}`);

    await twilioClient.calls(call_sid).update({ status: 'completed' });

    console.log(`✅ Call ended: ${call_sid}`);

    res.json({
      success: true,
      message: `Call ${call_sid} ended`,
    });
  } catch (error) {
    console.error("❌ Error ending call:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ============================================
// Transfer call to another number
// ============================================
export const transferCall = async (req, res) => {
  try {
    const { call_sid, to_number } = req.body;

    if (!call_sid || !to_number) {
      return res.status(400).json({
        success: false,
        error: "call_sid and to_number are required",
      });
    }

    console.log(`📞 Transferring call ${call_sid} to ${to_number}`);

    // Generate TwiML for transfer
    const twiml = new VoiceResponse();
    twiml.say("Please hold while we transfer your call.");
    twiml.dial(to_number);

    // Update the call with new TwiML
    await twilioClient.calls(call_sid).update({
      twiml: twiml.toString(),
    });

    console.log(`✅ Call transferred to ${to_number}`);

    res.json({
      success: true,
      message: `Call transferred to ${to_number}`,
    });
  } catch (error) {
    console.error("❌ Error transferring call:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};