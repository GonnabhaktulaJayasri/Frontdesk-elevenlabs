import express from 'express';
import {
  getAllVoices,
  getVoiceById,
  getRecommendedVoices,
  previewVoice,
} from '../controllers/voiceController.js';

const router = express.Router();

// ============================================
// VOICE ROUTES
// ============================================

// Get all available voices
router.get('/', getAllVoices);

// Get recommended voices for a specialty
router.get('/recommended', getRecommendedVoices);

// Get specific voice details
router.get('/:voiceId', getVoiceById);

// Preview voice with sample text
router.post('/preview', previewVoice);

export default router;