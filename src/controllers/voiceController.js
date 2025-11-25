import voiceService from '../services/voiceService.js';

// ============================================
// GET ALL AVAILABLE VOICES FROM ELEVENLABS
// ============================================
export const getAllVoices = async (req, res) => {
  try {
    const { category, gender, accent } = req.query;
    
    console.log('📥 Fetching all voices from ElevenLabs...');
    
    const result = await voiceService.getAvailableVoices();
    
    let voices = result.voices;
    
    // Apply filters if provided
    if (category) {
      voices = voices.filter(v => v.category === category);
    }
    if (gender) {
      voices = voices.filter(v => v.gender === gender);
    }
    if (accent) {
      voices = voices.filter(v => v.accent === accent);
    }
    
    res.json({
      success: true,
      total: voices.length,
      voices: voices,
      grouped: result.grouped,
      filters_available: {
        categories: ['premade', 'cloned', 'generated', 'professional'],
        genders: ['male', 'female'],
        accents: ['american', 'british', 'australian', 'indian', 'irish'],
      },
    });
    
  } catch (error) {
    console.error('Error fetching voices:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ============================================
// GET VOICE DETAILS
// ============================================
export const getVoiceById = async (req, res) => {
  try {
    const { voiceId } = req.params;
    
    console.log(`📥 Fetching voice details: ${voiceId}`);
    
    const voice = await voiceService.getVoiceDetails(voiceId);
    
    res.json({
      success: true,
      voice,
    });
    
  } catch (error) {
    console.error('Error fetching voice details:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ============================================
// GET RECOMMENDED VOICES FOR SPECIALTY
// ============================================
export const getRecommendedVoices = async (req, res) => {
  try {
    const { specialty } = req.query;
    
    if (!specialty) {
      return res.status(400).json({
        success: false,
        error: 'Specialty is required',
        available: ['primaryCare', 'mentalHealth', 'sportsMedicine', 'cardiology', 'radiology'],
      });
    }
    
    console.log(`📥 Getting recommended voices for: ${specialty}`);
    
    const result = await voiceService.getAvailableVoices();
    const recommended = voiceService.getRecommendedVoices(result.voices, specialty);
    
    res.json({
      success: true,
      specialty,
      recommended,
      message: `Top ${recommended.length} recommended voices for ${specialty}`,
    });
    
  } catch (error) {
    console.error('Error getting recommendations:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ============================================
// PREVIEW VOICE (Test TTS)
// ============================================
export const previewVoice = async (req, res) => {
  try {
    const { voice_id, text } = req.body;
    
    if (!voice_id) {
      return res.status(400).json({
        success: false,
        error: 'voice_id is required',
      });
    }
    
    const testText = text || 'Hello, thank you for calling our medical clinic. How may I help you today?';
    
    console.log(`🎤 Generating preview for voice: ${voice_id}`);
    
    // Generate audio preview using ElevenLabs TTS
    const { elevenLabsClient } = await import('../config/clients.js');
    
    const audio = await elevenLabsClient.textToSpeech.convert(voice_id, {
      text: testText,
      model_id: 'eleven_turbo_v2_5',
    });
    
    // Convert audio stream to base64
    const chunks = [];
    for await (const chunk of audio) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);
    const audioBase64 = audioBuffer.toString('base64');
    
    res.json({
      success: true,
      voice_id,
      text: testText,
      audio: {
        format: 'mp3',
        encoding: 'base64',
        data: audioBase64,
      },
      note: 'Use this base64 audio data in an <audio> tag or decode and play',
    });
    
  } catch (error) {
    console.error('Error generating voice preview:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};