import twilio from "twilio";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import dotenv from "dotenv";

dotenv.config();

// ============================================
// ELEVENLABS CLIENT
// ============================================
export const elevenLabsClient = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

// ============================================
// TWILIO CLIENT
// ============================================
export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export const { VoiceResponse } = twilio.twiml;

if (!process.env.ELEVENLABS_API_KEY) {
  console.warn("ELEVENLABS_API_KEY is not set in environment variables");
}

if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
  console.warn("TWILIO credentials are not set in environment variables");
}

console.log("Clients initialized successfully");