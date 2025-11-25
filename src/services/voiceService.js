import { elevenLabsClient } from '../config/clients.js';

class VoiceService {
  // Get all available voices from ElevenLabs
  async getAvailableVoices() {
    try {
      console.log('🎤 Fetching voices from ElevenLabs...');
      
      const response = await elevenLabsClient.voices.getAll();
      
      // Format voices for easy selection
      const voices = response.voices.map(voice => ({
        voice_id: voice.voice_id,
        name: voice.name,
        category: voice.category,
        description: voice.description || 'No description',
        labels: voice.labels || {},
        preview_url: voice.preview_url,
        // Add helpful metadata
        gender: voice.labels?.gender || 'unknown',
        age: voice.labels?.age || 'unknown',
        accent: voice.labels?.accent || 'american',
        use_case: voice.labels?.use_case || 'general',
      }));
      
      console.log(`✅ Found ${voices.length} voices`);
      
      // Group by category for easier selection
      const grouped = {
        premade: voices.filter(v => v.category === 'premade'),
        cloned: voices.filter(v => v.category === 'cloned'),
        generated: voices.filter(v => v.category === 'generated'),
        professional: voices.filter(v => v.category === 'professional'),
      };
      
      return {
        voices,
        grouped,
        total: voices.length,
      };
      
    } catch (error) {
      console.error('❌ Error fetching voices:', error);
      throw new Error(`Failed to fetch voices: ${error.message}`);
    }
  }
  
  // Get specific voice details
  async getVoiceDetails(voiceId) {
    try {
      console.log(`🎤 Fetching voice details: ${voiceId}`);
      
      const voice = await elevenLabsClient.voices.get(voiceId);
      
      return {
        voice_id: voice.voice_id,
        name: voice.name,
        category: voice.category,
        description: voice.description,
        labels: voice.labels,
        preview_url: voice.preview_url,
        settings: voice.settings,
      };
      
    } catch (error) {
      console.error(`❌ Error fetching voice ${voiceId}:`, error);
      throw new Error(`Failed to fetch voice details: ${error.message}`);
    }
  }
  
  // Get recommended voices for specialties
  getRecommendedVoices(voices, specialty) {
    const recommendations = {
      primaryCare: {
        gender: 'female',
        age: 'middle aged',
        qualities: ['warm', 'professional', 'friendly'],
      },
      mentalHealth: {
        gender: 'any',
        age: 'middle aged',
        qualities: ['calm', 'soothing', 'empathetic'],
      },
      sportsMedicine: {
        gender: 'any',
        age: 'young',
        qualities: ['energetic', 'upbeat', 'clear'],
      },
      cardiology: {
        gender: 'any',
        age: 'middle aged',
        qualities: ['professional', 'calm', 'authoritative'],
      },
      radiology: {
        gender: 'any',
        age: 'middle aged',
        qualities: ['professional', 'clear', 'informative'],
      },
    };
    
    const criteria = recommendations[specialty] || recommendations.primaryCare;
    
    // Simple recommendation based on labels
    return voices.filter(voice => {
      const matchesGender = criteria.gender === 'any' || 
                           voice.gender === criteria.gender;
      const matchesAge = voice.age === criteria.age || 
                        voice.age === 'unknown';
      return matchesGender && matchesAge;
    }).slice(0, 5); // Return top 5 recommendations
  }
}

export default new VoiceService();