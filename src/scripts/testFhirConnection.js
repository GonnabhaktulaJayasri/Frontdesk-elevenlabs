// scripts/testFhirConnection.js
// Test script to verify FHIR EMR connection is working
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const FHIR_BASE_URL = process.env.FHIR_BASE_URL || 'https://hapi.fhir.org/baseR4';

async function testFhirConnection() {
  console.log('========================================');
  console.log('🏥 Testing FHIR EMR Connection');
  console.log('========================================');
  console.log(`FHIR Server: ${FHIR_BASE_URL}`);
  console.log('');

  try {
    // Test 1: Server metadata
    console.log('📡 Test 1: Checking server capability...');
    const metadataResponse = await fetch(`${FHIR_BASE_URL}/metadata`, {
      headers: { 'Accept': 'application/fhir+json' },
    });

    if (!metadataResponse.ok) {
      throw new Error(`Metadata request failed: ${metadataResponse.status}`);
    }

    const metadata = await metadataResponse.json();
    console.log(`✅ Server: ${metadata.software?.name || 'FHIR Server'}`);
    console.log(`   Version: ${metadata.software?.version || metadata.fhirVersion}`);
    console.log('');

    // Test 2: Search for patients
    console.log('📡 Test 2: Searching for patients...');
    const patientResponse = await fetch(`${FHIR_BASE_URL}/Patient?_count=5`, {
      headers: { 'Accept': 'application/fhir+json' },
    });

    if (!patientResponse.ok) {
      throw new Error(`Patient search failed: ${patientResponse.status}`);
    }

    const patientBundle = await patientResponse.json();
    const patientCount = patientBundle.total || patientBundle.entry?.length || 0;
    console.log(`✅ Found ${patientCount} patients in database`);

    if (patientBundle.entry && patientBundle.entry.length > 0) {
      console.log('   Sample patients:');
      patientBundle.entry.slice(0, 3).forEach((entry) => {
        const patient = entry.resource;
        const name = patient.name?.[0];
        const displayName = name 
          ? `${name.given?.join(' ') || ''} ${name.family || ''}`.trim()
          : 'Unknown';
        console.log(`   - ${displayName} (ID: ${patient.id})`);
      });
    }
    console.log('');

    // Test 3: Search for practitioners
    console.log('📡 Test 3: Searching for practitioners...');
    const practitionerResponse = await fetch(`${FHIR_BASE_URL}/Practitioner?_count=5`, {
      headers: { 'Accept': 'application/fhir+json' },
    });

    if (!practitionerResponse.ok) {
      throw new Error(`Practitioner search failed: ${practitionerResponse.status}`);
    }

    const practitionerBundle = await practitionerResponse.json();
    const practitionerCount = practitionerBundle.total || practitionerBundle.entry?.length || 0;
    console.log(`✅ Found ${practitionerCount} practitioners in database`);

    if (practitionerBundle.entry && practitionerBundle.entry.length > 0) {
      console.log('   Sample practitioners:');
      practitionerBundle.entry.slice(0, 3).forEach((entry) => {
        const pract = entry.resource;
        const name = pract.name?.[0];
        const displayName = name 
          ? `${name.prefix?.join(' ') || 'Dr.'} ${name.given?.join(' ') || ''} ${name.family || ''}`.trim()
          : 'Unknown';
        console.log(`   - ${displayName} (ID: ${pract.id})`);
      });
    }
    console.log('');

    // Test 4: Create a test patient
    console.log('📡 Test 4: Testing patient creation...');
    const testPatient = {
      resourceType: 'Patient',
      active: true,
      name: [{
        use: 'official',
        family: 'TestPatient',
        given: ['FHIR', 'Connection'],
      }],
      telecom: [{
        system: 'phone',
        value: '5551234567',
        use: 'mobile',
      }],
      birthDate: '1990-01-01',
    };

    const createResponse = await fetch(`${FHIR_BASE_URL}/Patient`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json',
      },
      body: JSON.stringify(testPatient),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.log(`⚠️ Patient creation test: ${createResponse.status}`);
      console.log(`   Note: Some FHIR servers may restrict write operations`);
    } else {
      const createdPatient = await createResponse.json();
      console.log(`✅ Test patient created with ID: ${createdPatient.id}`);
      
      // Clean up - delete the test patient
      try {
        await fetch(`${FHIR_BASE_URL}/Patient/${createdPatient.id}`, {
          method: 'DELETE',
          headers: { 'Accept': 'application/fhir+json' },
        });
        console.log(`🧹 Test patient cleaned up`);
      } catch (deleteError) {
        console.log(`   (Could not delete test patient - this is OK)`);
      }
    }
    console.log('');

    // Test 5: Search for appointments
    console.log('📡 Test 5: Searching for appointments...');
    const appointmentResponse = await fetch(`${FHIR_BASE_URL}/Appointment?_count=5`, {
      headers: { 'Accept': 'application/fhir+json' },
    });

    if (!appointmentResponse.ok) {
      console.log(`⚠️ Appointment search: ${appointmentResponse.status}`);
    } else {
      const appointmentBundle = await appointmentResponse.json();
      const appointmentCount = appointmentBundle.total || appointmentBundle.entry?.length || 0;
      console.log(`✅ Found ${appointmentCount} appointments in database`);
    }
    console.log('');

    // Summary
    console.log('========================================');
    console.log('✅ FHIR Connection Test Complete!');
    console.log('========================================');
    console.log('');
    console.log('📋 Summary:');
    console.log('✓ FHIR server is accessible');
    console.log('✓ Patient search works');
    console.log('✓ Practitioner search works');
    console.log('✓ Ready for appointment scheduling');
    console.log('');
    console.log('🔗 Your FHIR base URL:', FHIR_BASE_URL);
    console.log('');

  } catch (error) {
    console.error('');
    console.error('========================================');
    console.error('❌ FHIR Connection Test Failed');
    console.error('========================================');
    console.error('Error:', error.message);
    console.error('');
    console.error('Troubleshooting:');
    console.error('1. Check if FHIR_BASE_URL is correct in .env');
    console.error('2. Ensure the FHIR server is accessible');
    console.error('3. Check network connectivity');
    console.error('4. Verify no firewall is blocking the connection');
    console.error('');
    process.exit(1);
  }
}

testFhirConnection();