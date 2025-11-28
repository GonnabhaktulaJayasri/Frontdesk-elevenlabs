import fetch from 'node-fetch';
import Hospital from '../models/hospital.js';

const FHIR_BASE_URL = process.env.FHIR_BASE_URL || 'https://hapi.fhir.org/baseR4';

// Helper for FHIR requests
const fhirRequest = async (endpoint, options = {}) => {
  const url = `${FHIR_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/fhir+json',
      'Accept': 'application/fhir+json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`FHIR Error [${response.status}]: ${error}`);
  }

  return response.json();
};

class HospitalService {
  // Register new hospital - creates in both MongoDB and FHIR
  async registerHospital(hospitalData) {
    const {
      name,
      email,
      password,
      phoneNumber,
      twilioPhoneNumber,
      hospitalAddress,
      specialities,
    } = hospitalData;

    console.log(`📧 Registering with email: ${email}`);
    console.log(`🔐 Password in service: "${password}" (${password?.length} chars)`);
    console.log(`🔐 Is already hashed: ${password?.startsWith('$2')}`);

    // Check if hospital already exists
    const existingHospital = await Hospital.findOne({
      $or: [{ email }, { phoneNumber }],
    });

    if (existingHospital) {
      console.log(`❌ Duplicate found - Email: ${existingHospital.email}, Phone: ${existingHospital.phoneNumber}`);
      throw new Error(
        existingHospital.email === email
          ? 'Email already registered'
          : 'Phone number already registered'
      );
    }

    // Create FHIR Organization first
    const fhirOrganization = {
      resourceType: 'Organization',
      active: true,
      name: name,
      identifier: [
        {
          system: 'http://orionwest.com/hospital-email',
          value: email,
        },
        {
          system: 'http://orionwest.com/hospital-phone',
          value: phoneNumber,
        },
      ],
      telecom: [
        {
          system: 'phone',
          value: phoneNumber,
          use: 'work',
        },
        {
          system: 'email',
          value: email,
          use: 'work',
        },
      ],
      address: hospitalAddress ? [{
        use: 'work',
        type: 'physical',
        text: hospitalAddress,
      }] : undefined,
      extension: [],
    };

    // Add Twilio phone as identifier if provided
    if (twilioPhoneNumber) {
      fhirOrganization.identifier.push({
        system: 'http://orionwest.com/twilio-phone',
        value: twilioPhoneNumber,
      });
      fhirOrganization.telecom.push({
        system: 'phone',
        value: twilioPhoneNumber,
        use: 'mobile',
        extension: [{
          url: 'http://orionwest.com/phone-type',
          valueString: 'twilio-agent',
        }],
      });
    }

    // Add specialities as extension
    if (specialities && specialities.length > 0) {
      fhirOrganization.extension.push({
        url: 'http://orionwest.com/specialities',
        valueString: specialities.join(','),
      });

      // Also add as type for FHIR standard compliance
      fhirOrganization.type = specialities.map(spec => ({
        coding: [{
          system: 'http://orionwest.com/specialty',
          code: spec,
          display: spec.replace(/([A-Z])/g, ' $1').trim(), // camelCase to Title Case
        }],
      }));
    }

    // Create in FHIR
    console.log('📡 Creating FHIR Organization...');
    const createdOrg = await fhirRequest('/Organization', {
      method: 'POST',
      body: JSON.stringify(fhirOrganization),
    });
    console.log(`✅ FHIR Organization created: ${createdOrg.id}`);

    // Create MongoDB record with FHIR reference
    const hospital = await Hospital.create({
      name,
      email,
      password, // Will be hashed by pre-save hook
      phoneNumber,
      twilioPhoneNumber,
      hospitalAddress,
      specialities: specialities || [],
      fhirOrganizationId: createdOrg.id,
    });

    console.log(`✅ Hospital registered: ${hospital._id}`);

    return {
      hospital: {
        _id: hospital._id,
        ...hospital.toJSON(),
      },
      fhirOrganizationId: createdOrg.id,
    };
  }

  // Authenticate hospital
  async authenticateHospital(email, password) {
    console.log(`🔍 Looking up hospital: ${email}`);
    
    // Find hospital with password field included
    const hospital = await Hospital.findOne({ email }).select('+password');

    if (!hospital) {
      console.log(`❌ Hospital not found: ${email}`);
      throw new Error('Invalid email or password');
    }

    console.log(`✅ Hospital found: ${hospital.name}`);
    console.log(`🔐 Password hash exists: ${!!hospital.password}`);

    if (!hospital.isActive) {
      throw new Error('Account is deactivated');
    }

    // Check if password exists
    if (!hospital.password) {
      console.log('❌ No password hash stored for this hospital');
      throw new Error('Invalid email or password');
    }

    const isMatch = await hospital.comparePassword(password);
    console.log(`🔐 Password match: ${isMatch}`);

    if (!isMatch) {
      throw new Error('Invalid email or password');
    }

    // Update last login
    hospital.lastLogin = new Date();
    await hospital.save();

    // Get FHIR Organization details
    let fhirOrg = null;
    if (hospital.fhirOrganizationId) {
      try {
        fhirOrg = await fhirRequest(`/Organization/${hospital.fhirOrganizationId}`);
      } catch (err) {
        console.warn('Could not fetch FHIR org:', err.message);
      }
    }

    return {
      hospital: {
        _id: hospital._id,
        ...hospital.toJSON(),
      },
      fhirOrganization: fhirOrg,
    };
  }

  // Get hospital by ID
  async getHospitalById(hospitalId) {
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) throw new Error('Hospital not found');
    return hospital;
  }

  // Get hospital by Twilio phone number (for inbound call identification)
  async getHospitalByTwilioPhone(twilioPhone) {
    const hospital = await Hospital.findOne({ twilioPhoneNumber: twilioPhone });
    return hospital;
  }

  // Update hospital details
  async updateHospital(hospitalId, updates) {
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) throw new Error('Hospital not found');

    // Update MongoDB fields
    const allowedUpdates = ['name', 'phoneNumber', 'twilioPhoneNumber'];
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        hospital[field] = updates[field];
      }
    });
    await hospital.save();

    // Update FHIR Organization if exists
    if (hospital.fhirOrganizationId) {
      const fhirOrg = await fhirRequest(`/Organization/${hospital.fhirOrganizationId}`);
      
      if (updates.name) fhirOrg.name = updates.name;
      if (updates.hospitalAddress) {
        fhirOrg.address = [{
          use: 'work',
          type: 'physical',
          text: updates.hospitalAddress,
        }];
      }
      if (updates.twilioPhoneNumber) {
        // Update or add Twilio identifier
        const twilioIdx = fhirOrg.identifier?.findIndex(
          i => i.system === 'http://orionwest.com/twilio-phone'
        );
        if (twilioIdx >= 0) {
          fhirOrg.identifier[twilioIdx].value = updates.twilioPhoneNumber;
        } else {
          fhirOrg.identifier = fhirOrg.identifier || [];
          fhirOrg.identifier.push({
            system: 'http://orionwest.com/twilio-phone',
            value: updates.twilioPhoneNumber,
          });
        }
      }

      await fhirRequest(`/Organization/${hospital.fhirOrganizationId}`, {
        method: 'PUT',
        body: JSON.stringify(fhirOrg),
      });
    }

    return hospital;
  }

  // Change password
  async changePassword(hospitalId, currentPassword, newPassword) {
    const hospital = await Hospital.findById(hospitalId).select('+password');
    if (!hospital) throw new Error('Hospital not found');

    const isMatch = await hospital.comparePassword(currentPassword);
    if (!isMatch) throw new Error('Current password is incorrect');

    hospital.password = newPassword;
    await hospital.save();

    return { success: true, message: 'Password updated' };
  }

  // Get full hospital details (MongoDB + FHIR)
  async getFullHospitalDetails(hospitalId) {
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) throw new Error('Hospital not found');

    let fhirOrg = null;

    if (hospital.fhirOrganizationId) {
      try {
        fhirOrg = await fhirRequest(`/Organization/${hospital.fhirOrganizationId}`);
      } catch (err) {
        console.warn('Could not fetch FHIR org:', err.message);
      }
    }

    return {
      ...hospital.toJSON(),
      address: hospital.hospitalAddress || fhirOrg?.address?.[0]?.text,
      specialities: hospital.specialities || [],
    };
  }
}

export default new HospitalService();