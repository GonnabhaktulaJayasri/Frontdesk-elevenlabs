// scripts/seedFHIRData.js
// Run this once to add test doctors to FHIR EMR
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const FHIR_BASE_URL = process.env.FHIR_BASE_URL || 'https://hapi.fhir.org/baseR4';

// Test doctors to create in FHIR
const TEST_DOCTORS = [
  { given: 'Sarah', family: 'Johnson', specialty: 'Primary Care' },
  { given: 'Michael', family: 'Chen', specialty: 'Mental Health' },
  { given: 'Emily', family: 'Rodriguez', specialty: 'Primary Care' },
  { given: 'James', family: 'Wilson', specialty: 'Cardiology' },
  { given: 'Lisa', family: 'Park', specialty: 'Radiology' },
  { given: 'Robert', family: 'Kim', specialty: 'Sports Medicine' },
];

// Test patients to create
const TEST_PATIENTS = [
  { given: 'John', family: 'Doe', dob: '1985-05-15', phone: '5551234567' },
  { given: 'Jane', family: 'Smith', dob: '1990-08-22', phone: '5559876543' },
  { given: 'Test', family: 'Patient', dob: '2000-01-01', phone: '5551111111' },
];

async function createPractitioner(doctor) {
  const practitioner = {
    resourceType: 'Practitioner',
    active: true,
    name: [{
      use: 'official',
      prefix: ['Dr.'],
      given: [doctor.given],
      family: doctor.family,
    }],
    qualification: [{
      code: {
        text: doctor.specialty,
        coding: [{
          system: 'http://example.org/specialty',
          code: doctor.specialty.toLowerCase().replace(/\s+/g, '-'),
          display: doctor.specialty,
        }],
      },
    }],
  };

  try {
    const response = await fetch(`${FHIR_BASE_URL}/Practitioner`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json',
      },
      body: JSON.stringify(practitioner),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create practitioner: ${error}`);
    }

    const created = await response.json();
    console.log(`✅ Created Dr. ${doctor.given} ${doctor.family} (${doctor.specialty}) - ID: ${created.id}`);
    return created;
  } catch (error) {
    console.error(`❌ Failed to create Dr. ${doctor.given} ${doctor.family}:`, error.message);
    return null;
  }
}

async function createPatient(patient) {
  const fhirPatient = {
    resourceType: 'Patient',
    active: true,
    name: [{
      use: 'official',
      given: [patient.given],
      family: patient.family,
    }],
    birthDate: patient.dob,
    telecom: [{
      system: 'phone',
      value: patient.phone,
      use: 'mobile',
    }],
  };

  try {
    const response = await fetch(`${FHIR_BASE_URL}/Patient`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json',
      },
      body: JSON.stringify(fhirPatient),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create patient: ${error}`);
    }

    const created = await response.json();
    console.log(`✅ Created ${patient.given} ${patient.family} (DOB: ${patient.dob}) - ID: ${created.id}`);
    return created;
  } catch (error) {
    console.error(`❌ Failed to create ${patient.given} ${patient.family}:`, error.message);
    return null;
  }
}

async function seedData() {
  console.log('========================================');
  console.log('🏥 Seeding FHIR EMR with Test Data');
  console.log('========================================');
  console.log(`FHIR Server: ${FHIR_BASE_URL}\n`);

  // Create practitioners
  console.log('📋 Creating Practitioners (Doctors)...\n');
  const createdDoctors = [];
  for (const doctor of TEST_DOCTORS) {
    const created = await createPractitioner(doctor);
    if (created) {
      createdDoctors.push({
        id: created.id,
        name: `Dr. ${doctor.given} ${doctor.family}`,
        specialty: doctor.specialty,
      });
    }
  }

  // Create patients
  console.log('\n📋 Creating Test Patients...\n');
  const createdPatients = [];
  for (const patient of TEST_PATIENTS) {
    const created = await createPatient(patient);
    if (created) {
      createdPatients.push({
        id: created.id,
        name: `${patient.given} ${patient.family}`,
        dob: patient.dob,
      });
    }
  }

  // Summary
  console.log('\n========================================');
  console.log('✅ Seeding Complete!');
  console.log('========================================');
  
  console.log('\n📋 Created Doctors:');
  createdDoctors.forEach(d => {
    console.log(`   ${d.name} (${d.specialty}) - ID: ${d.id}`);
  });

  console.log('\n📋 Created Patients:');
  createdPatients.forEach(p => {
    console.log(`   ${p.name} (DOB: ${p.dob}) - ID: ${p.id}`);
  });

  console.log('\n💡 Save these IDs! You can use them for testing.');
  console.log('\n⚠️  Note: HAPI FHIR is a public test server.');
  console.log('   Data may be cleared periodically.\n');
}

// Run
seedData().catch(console.error);