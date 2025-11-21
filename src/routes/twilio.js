// routes/twilio.js
import express from "express";
import twilio from "twilio";

const router = express.Router();
const { VoiceResponse } = twilio.twiml;

// Initialize Twilio client
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// Handle inbound calls
// Handle inbound calls
router.post("/inbound", (req, res) => {
    console.log("====================================");
    console.log("====== INBOUND CALL RECEIVED ======");
    console.log("Caller Phone:", req.body.From);
    console.log("Call SID:", req.body.CallSid);
    console.log("Full Body:", req.body);
    console.log("====================================");

    try {
        const { From, CallSid } = req.body;
        
        // Check if Agent ID exists
        const agentId = process.env.ELEVENLABS_AGENT_ID;
        
        if (!agentId || agentId === 'your_agent_id') {
            console.error("❌ ERROR: ELEVENLABS_AGENT_ID is not configured!");
            const errorTwiml = new VoiceResponse();
            errorTwiml.say('Sorry, the agent is not configured properly.');
            res.type("text/xml");
            return res.send(errorTwiml.toString());
        }

        console.log("✅ Agent ID found:", agentId);
        
        // Create TwiML response
        const twiml = new VoiceResponse();
        
        // Build WebSocket URL
        const websocketUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}`;
        console.log("📞 Connecting to:", websocketUrl);
        
        // Connect to ElevenLabs - FIX: Add parameters correctly
        const connect = twiml.connect();
        const stream = connect.stream({
            url: websocketUrl
        });
        
        // Add parameters individually (this is the correct way!)
        stream.parameter({
            name: 'caller_phone',
            value: From
        });
        
        stream.parameter({
            name: 'call_sid',
            value: CallSid
        });
        
        stream.parameter({
            name: 'custom_data',
            value: JSON.stringify({
                source: "twilio_inbound",
                timestamp: new Date().toISOString(),
            })
        });

        // Convert to string and log
        const twimlString = twiml.toString();
        console.log("📤 Sending TwiML Response:");
        console.log(twimlString);
        console.log("====================================");

        // Send response
        res.type("text/xml");
        res.send(twimlString);
        
    } catch (error) {
        console.error("❌ ERROR in /inbound route:", error);
        console.error("Stack trace:", error.stack);
        
        const errorTwiml = new VoiceResponse();
        errorTwiml.say('An error occurred. Please try again later.');
        res.type("text/xml");
        res.send(errorTwiml.toString());
    }
});

// Make outbound call
router.post("/outbound", async (req, res) => {
    try {
        const { to_number } = req.body;

        console.log("📞 Making outbound call to:", to_number);

        const call = await twilioClient.calls.create({
            url: `${process.env.SERVER_URL}/voice/outbound-twiml`,
            to: to_number,
            from: process.env.TWILIO_PHONE_NUMBER,
            statusCallback: `${process.env.SERVER_URL}/voice/status`,
            statusCallbackMethod: "POST",
        });

        console.log("✅ Call initiated:", call.sid);

        res.json({
            success: true,
            call_sid: call.sid,
            status: call.status,
        });
    } catch (error) {
        console.error("❌ Outbound call failed:", error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// Outbound TwiML
router.post("/outbound-twiml", (req, res) => {
    console.log("📞 Outbound TwiML requested");
    
    try {
        const agentId = process.env.ELEVENLABS_AGENT_ID;
        
        if (!agentId || agentId === 'your_agent_id') {
            console.error("❌ Agent ID not configured for outbound call");
            const errorTwiml = new VoiceResponse();
            errorTwiml.say('Agent not configured.');
            res.type("text/xml");
            return res.send(errorTwiml.toString());
        }

        const twiml = new VoiceResponse();
        const connect = twiml.connect();
        const stream = connect.stream({
            url: `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}`
        });
        
        // Add parameters if needed for outbound calls
        if (req.body.From) {
            stream.parameter({
                name: 'caller_phone',
                value: req.body.From
            });
        }
        
        if (req.body.CallSid) {
            stream.parameter({
                name: 'call_sid',
                value: req.body.CallSid
            });
        }

        const twimlString = twiml.toString();
        console.log("📤 Outbound TwiML:", twimlString);

        res.type("text/xml");
        res.send(twimlString);
        
    } catch (error) {
        console.error("❌ Error generating outbound TwiML:", error);
        const errorTwiml = new VoiceResponse();
        errorTwiml.say('Error occurred.');
        res.type("text/xml");
        res.send(errorTwiml.toString());
    }
});

// Call status webhook
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

export default router;