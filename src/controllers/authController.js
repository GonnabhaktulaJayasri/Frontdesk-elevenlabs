import jwt from 'jsonwebtoken';
import hospitalService from '../services/hospitalService.js';
import Hospital from '../models/hospital.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Generate JWT token
const generateToken = (hospitalId) => {
  return jwt.sign({ id: hospitalId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

// ============================================
// REGISTER NEW HOSPITAL
// ============================================
export const register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phonenumber,        // From frontend
      hospitalAddress,
      speciality,         // Array of specialities from frontend
    } = req.body;

    // Debug: Log received password
    console.log(`📥 Received password: "${password}"`);
    console.log(`📥 Password length: ${password?.length}`);
    console.log(`📥 Password starts with $2: ${password?.startsWith('$2')}`);

    // Default Twilio number (can be changed later per hospital)
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER || '+19499971087';

    // Validation
    if (!name || !email || !password || !phonenumber) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, password, and phone number are required',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters',
      });
    }

    // Validate specialities if provided
    const validSpecialities = ['primaryCare', 'mentalHealth', 'sportsMedicine', 'cardiology', 'radiology'];
    if (speciality && Array.isArray(speciality)) {
      const invalidSpecs = speciality.filter(s => !validSpecialities.includes(s));
      if (invalidSpecs.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid specialities: ${invalidSpecs.join(', ')}`,
          validOptions: validSpecialities,
        });
      }
    }

    console.log(`📝 Registering hospital: ${name}`);
    console.log(`📋 Specialities: ${speciality?.join(', ') || 'None specified'}`);

    const result = await hospitalService.registerHospital({
      name,
      email,
      password,
      phoneNumber: phonenumber,
      twilioPhoneNumber,
      hospitalAddress,
      specialities: speciality || [],
    });

    // Generate token
    const token = generateToken(result.hospital._id);

    res.status(201).json({
      success: true,
      message: 'Hospital registered successfully',
      token,
      hospital: result.hospital,
      fhirOrganizationId: result.fhirOrganizationId,
    });

  } catch (err) {
    console.error('Registration error:', err.message);
    
    // Handle duplicate key errors
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({
        success: false,
        error: `${field} already exists`,
      });
    }

    res.status(400).json({
      success: false,
      error: err.message,
    });
  }
};

// ============================================
// LOGIN
// ============================================
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    console.log(`🔐 Login attempt: ${email}`);

    const result = await hospitalService.authenticateHospital(email, password);

    // Generate token
    const token = generateToken(result.hospital._id);

    console.log(`✅ Login successful: ${result.hospital.name}`);

    res.json({
      success: true,
      token,
      hospital: result.hospital,
      fhirOrganization: result.fhirOrganization,
    });

  } catch (err) {
    console.error('Login error:', err.message);
    res.status(401).json({
      success: false,
      error: err.message,
    });
  }
};

// ============================================
// DEBUG: Check if hospital exists (remove in production)
// ============================================
export const checkHospital = async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      // List all hospitals (emails only)
      const hospitals = await Hospital.find({}, 'email name phoneNumber createdAt');
      return res.json({
        success: true,
        count: hospitals.length,
        hospitals: hospitals.map(h => ({
          id: h._id,
          email: h.email,
          name: h.name,
          phoneNumber: h.phoneNumber,
          createdAt: h.createdAt,
        })),
      });
    }

    const hospital = await Hospital.findOne({ email }).select('+password');
    
    if (!hospital) {
      return res.json({
        success: false,
        exists: false,
        message: 'Hospital not found with this email',
      });
    }

    res.json({
      success: true,
      exists: true,
      hospital: {
        id: hospital._id,
        name: hospital.name,
        email: hospital.email,
        phoneNumber: hospital.phoneNumber,
        hasPassword: !!hospital.password,
        passwordLength: hospital.password?.length,
        isActive: hospital.isActive,
        createdAt: hospital.createdAt,
      },
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ============================================
// DEBUG: Delete hospital (remove in production)
// ============================================
export const deleteHospital = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    const hospital = await Hospital.findOneAndDelete({ email });
    
    if (!hospital) {
      return res.status(404).json({
        success: false,
        error: 'Hospital not found',
      });
    }

    console.log(`🗑️ Deleted hospital: ${hospital.name} (${email})`);

    res.json({
      success: true,
      message: `Hospital ${hospital.name} deleted`,
      deletedId: hospital._id,
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ============================================
// DEBUG: Reset password (remove in production)
// ============================================
export const resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    
    if (!email || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Email and newPassword are required',
      });
    }

    const hospital = await Hospital.findOne({ email });
    
    if (!hospital) {
      return res.status(404).json({
        success: false,
        error: 'Hospital not found',
      });
    }

    hospital.password = newPassword; // Will be hashed by pre-save hook
    await hospital.save();

    console.log(`🔐 Password reset for: ${hospital.name} (${email})`);

    res.json({
      success: true,
      message: `Password reset for ${hospital.name}`,
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ============================================
// GET CURRENT HOSPITAL (Protected)
// ============================================
export const getMe = async (req, res) => {
  try {
    const hospital = await hospitalService.getFullHospitalDetails(req.hospitalId);

    res.json({
      success: true,
      hospital,
    });

  } catch (err) {
    res.status(404).json({
      success: false,
      error: err.message,
    });
  }
};

// ============================================
// UPDATE HOSPITAL PROFILE (Protected)
// ============================================
export const updateProfile = async (req, res) => {
  try {
    const updates = req.body;
    
    // Don't allow password update through this endpoint
    delete updates.password;
    delete updates.email; // Email change requires verification

    const hospital = await hospitalService.updateHospital(req.hospitalId, updates);

    res.json({
      success: true,
      message: 'Profile updated',
      hospital,
    });

  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message,
    });
  }
};

// ============================================
// CHANGE PASSWORD (Protected)
// ============================================
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current and new password are required',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters',
      });
    }

    await hospitalService.changePassword(req.hospitalId, currentPassword, newPassword);

    res.json({
      success: true,
      message: 'Password changed successfully',
    });

  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message,
    });
  }
};

// ============================================
// VERIFY TOKEN (For frontend to check auth status)
// ============================================
export const verifyToken = async (req, res) => {
  try {
    const hospital = await hospitalService.getHospitalById(req.hospitalId);

    res.json({
      success: true,
      valid: true,
      hospital: hospital.toJSON(),
    });

  } catch (err) {
    res.status(401).json({
      success: false,
      valid: false,
      error: 'Invalid token',
    });
  }
};