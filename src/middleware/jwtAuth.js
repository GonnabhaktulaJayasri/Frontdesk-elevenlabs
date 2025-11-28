import jwt from 'jsonwebtoken';
import Hospital from '../models/hospital.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Protect routes - require valid JWT
export const protect = async (req, res, next) => {
  try {
    let token;

    // Get token from header
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized - no token provided',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if hospital still exists
    const hospital = await Hospital.findById(decoded.id);

    if (!hospital) {
      return res.status(401).json({
        success: false,
        error: 'Hospital no longer exists',
      });
    }

    if (!hospital.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated',
      });
    }

    // Add hospital ID to request
    req.hospitalId = hospital._id;
    req.hospital = hospital;
    
    next();

  } catch (err) {
    console.error('Auth middleware error:', err.message);
    
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
      });
    }
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
      });
    }

    res.status(401).json({
      success: false,
      error: 'Not authorized',
    });
  }
};

// Optional auth - attach hospital if token present, but don't fail
export const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      const hospital = await Hospital.findById(decoded.id);
      
      if (hospital && hospital.isActive) {
        req.hospitalId = hospital._id;
        req.hospital = hospital;
      }
    }

    next();

  } catch (err) {
    // Token invalid but that's okay for optional auth
    next();
  }
};