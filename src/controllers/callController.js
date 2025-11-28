import { elevenLabsClient, twilioClient, VoiceResponse } from "../config/clients.js";
import { buildOutboundCallData } from "./personalizationController.js";

// ============================================
// Handle inbound calls from Twilio
// Note: For inbound call personalization, configure the webhook in ElevenLabs
// Agent Settings > Security > Enable "Fetch conversation initiation data"
// Set webhook URL to: {YOUR_SERVER_URL}/api/calls/personalization-webhook
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

    // Add parameters - these are available as system variables in ElevenLabs
    stream.parameter({ name: "caller_phone", value: From });
    stream.parameter({ name: "call_sid", value: CallSid });
    stream.parameter({
      name: "custom_data",
      value: JSON.stringify({
        source: "twilio_inbound",
        call_direction: "inbound",
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
// Make outbound call using ElevenLabs SDK with personalization
// ============================================
export const outboundCall = async (req, res) => {
  try {
    const { 
      to_number, 
      agent_id, 
      agent_phone_number_id,
      // New personalization options
      patient_name,
      patient_id,
      call_reason,
      specialty,
      custom_first_message,
      custom_variables,
    } = req.body;

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
    console.log("📞 Making OUTBOUND call using ElevenLabs SDK");
    console.log("To Number:", to_number);
    console.log("Agent ID:", agentId);
    console.log("Phone Number ID:", phoneNumberId);
    console.log("Patient Name:", patient_name || "Not provided");
    console.log("Call Reason:", call_reason || "general");
    console.log("====================================");

    // Build personalization data for outbound call
    const personalizationData = buildOutboundCallData({
      patientName: patient_name || "there",
      patientId: patient_id || "",
      patientPhone: to_number,
      callReason: call_reason || "general",
      specialty: specialty || process.env.CURRENT_SPECIALTY || "primaryCare",
      customFirstMessage: custom_first_message,
      additionalVariables: custom_variables || {},
    });

    console.log("🎯 Personalization Data:", JSON.stringify(personalizationData, null, 2));

    // Make outbound call using ElevenLabs SDK with conversation initiation data
    const call = await elevenLabsClient.conversationalAi.twilio.outboundCall({
      agentId: agentId,
      agentPhoneNumberId: phoneNumberId,
      toNumber: to_number,
      conversationInitiationClientData: personalizationData,
    });

    console.log("✅ Outbound call initiated:", call);

    res.json({
      success: true,
      call: call,
      message: `Outbound call initiated to ${to_number}`,
      personalization: {
        call_direction: "outbound",
        patient_name: patient_name || "there",
        call_reason: call_reason || "general",
      },
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
// Make multiple outbound calls (batch) with personalization
// ============================================
export const outboundBatchCall = async (req, res) => {
  try {
    const { 
      calls, // Array of { phone_number, patient_name, patient_id, call_reason }
      phone_numbers, // Legacy support: simple array of phone numbers
      agent_id, 
      agent_phone_number_id,
      default_call_reason,
      specialty,
    } = req.body;

    // Support both new format (calls array with details) and legacy format (phone_numbers array)
    const callList = calls || (phone_numbers ? phone_numbers.map(num => ({ phone_number: num })) : null);

    if (!callList || !Array.isArray(callList) || callList.length === 0) {
      return res.status(400).json({
        success: false,
        error: "calls array or phone_numbers array is required",
        example: {
          calls: [
            { phone_number: "+1234567890", patient_name: "John Doe", call_reason: "appointment_reminder" },
            { phone_number: "+0987654321", patient_name: "Jane Smith", call_reason: "follow_up" },
          ],
        },
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

    console.log(`📞 Initiating ${callList.length} OUTBOUND calls...`);

    const results = [];
    
    for (const callInfo of callList) {
      const toNumber = callInfo.phone_number || callInfo;
      
      try {
        // Build personalization for each call
        const personalizationData = buildOutboundCallData({
          patientName: callInfo.patient_name || "there",
          patientId: callInfo.patient_id || "",
          patientPhone: toNumber,
          callReason: callInfo.call_reason || default_call_reason || "general",
          specialty: specialty || process.env.CURRENT_SPECIALTY || "primaryCare",
        });

        const call = await elevenLabsClient.conversationalAi.twilio.outboundCall({
          agentId: agentId,
          agentPhoneNumberId: phoneNumberId,
          toNumber: toNumber,
          conversationInitiationClientData: personalizationData,
        });
        
        results.push({
          toNumber,
          patientName: callInfo.patient_name || "Unknown",
          success: true,
          call,
        });
        console.log(`✅ Call initiated to ${toNumber} (${callInfo.patient_name || "Unknown"})`);
      } catch (err) {
        results.push({
          toNumber,
          patientName: callInfo.patient_name || "Unknown",
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
        total: callList.length,
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
    // Mark as outbound call
    stream.parameter({ 
      name: "custom_data", 
      value: JSON.stringify({ 
        source: "twilio_outbound",
        call_direction: "outbound",
        timestamp: new Date().toISOString(),
      }) 
    });

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

    console.log(`📴 Ending call: ${call_sid}`);

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

// ============================================
// Get available call reasons for outbound calls
// ============================================
export const getCallReasons = (req, res) => {
  res.json({
    success: true,
    call_reasons: [
      { id: "general", name: "General Call", description: "General purpose outbound call" },
      { id: "appointment_reminder", name: "Appointment Reminder", description: "Remind patient of upcoming appointment" },
      { id: "follow_up", name: "Follow Up", description: "Follow up on recent visit" },
      { id: "results_ready", name: "Results Ready", description: "Notify patient that results are ready" },
      { id: "reschedule", name: "Reschedule", description: "Need to reschedule appointment" },
      { id: "wellness_check", name: "Wellness Check", description: "Check in on patient wellness" },
      { id: "prescription", name: "Prescription Refill", description: "Prescription refill reminder" },
    ],
  });
};