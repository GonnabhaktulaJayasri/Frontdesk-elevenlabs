// scripts/verifyBothAgents.js
import { elevenLabs } from '../services/agentService.js';

async function verifyAgent(agentId, name) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`🔍 Checking: ${name} (${agentId})`);
    console.log("=".repeat(60));
    
    try {
        const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
            headers: {
                'xi-api-key': process.env.ELEVENLABS_API_KEY,
            }
        });
        
        if (!response.ok) {
            console.log(`❌ Error: ${response.status} ${response.statusText}`);
            return;
        }
        
        const agent = await response.json();
        
        console.log("\n📋 Basic Info:");
        console.log("├─ Name:", agent.name || "NOT SET");
        console.log("└─ Created:", agent.created_at);
        
        const config = agent.conversation_config;
        
        if (config?.agent) {
            console.log("\n🤖 Agent Config:");
            console.log("├─ First Message:", config.agent.first_message ? "✅ SET" : "❌ NOT SET");
            console.log("├─ Language:", config.agent.language || "NOT SET");
            console.log("└─ Prompt:", config.agent.prompt?.prompt ? `✅ ${config.agent.prompt.prompt.length} chars` : "❌ NOT SET");
            
            if (config.agent.first_message) {
                console.log("\n💬 First Message:");
                console.log(`   "${config.agent.first_message}"`);
            }
        } else {
            console.log("\n❌ No agent configuration found!");
        }
        
        if (config?.tts) {
            console.log("\n🔊 Voice (TTS):");
            console.log("├─ Voice ID:", config.tts.voice_id ? "✅ SET" : "❌ NOT SET");
            console.log("├─ Model:", config.tts.model_id || "NOT SET");
            console.log("└─ Latency:", config.tts.optimize_streaming_latency || "default");
        } else {
            console.log("\n❌ No TTS configuration found!");
        }
        
        if (config?.asr) {
            console.log("\n🎤 Speech Recognition (ASR):");
            console.log("├─ Provider:", config.asr.provider || "default");
            console.log("└─ Quality:", config.asr.quality || "default");
        }
        
        // Check for issues
        console.log("\n⚠️  Issues Check:");
        const issues = [];
        
        if (!config?.agent?.first_message) {
            issues.push("Missing first_message - agent won't greet caller");
        }
        if (!config?.agent?.prompt?.prompt) {
            issues.push("Missing prompt - agent won't know how to respond");
        }
        if (!config?.tts?.voice_id) {
            issues.push("Missing voice_id - agent can't speak");
        }
        
        if (issues.length === 0) {
            console.log("✅ No critical issues found!");
        } else {
            issues.forEach(issue => console.log(`❌ ${issue}`));
        }
        
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

async function checkBoth() {
    await verifyAgent('agent_4101kag4r8teej3v0tvf2w4n3r20', 'appointment-scheduling');
    await verifyAgent('agent_2001k3gkss4hf7vr1ztwc4v8qbwg', 'frontdeskAgent');
    
    console.log(`\n${"=".repeat(60)}`);
    console.log("✅ Verification Complete!");
    console.log(`"=".repeat(60)}\n`);
}

checkBoth();