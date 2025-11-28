import express from 'express';
import {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  verifyToken,
} from '../controllers/authController.js';
import { protect } from '../middleware/jwtAuth.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes (require JWT)
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);
router.get('/verify', protect, verifyToken);

export default router;