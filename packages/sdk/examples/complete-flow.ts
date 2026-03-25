/**
 * Complete Flow Example
 * Demonstrates a full workflow:
 * 1. User registration
 * 2. Medical record creation (upload)
 * 3. Access grant to healthcare provider
 * 4. Record retrieval by provider (fetch)
 * 5. Access revocation
 *
 * Run with: npx ts-node examples/complete-flow.ts
 */

import {
  AuthApi,
  RecordsApi,
  AccessApi,
  Configuration,
} from '../src/index';

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/v1';

/**
 * Step 1: Register a new user (patient)
 */
async function registerPatient(): Promise<string> {
  console.log('\n📝 Step 1: Registering patient...');

  const authApi = new AuthApi(
    new Configuration({ basePath: API_BASE_URL }),
  );

  try {
    const response = await authApi.register({
      email: `patient-${Date.now()}@example.com`,
      password: 'SecurePassword123!',
      name: 'John Doe',
      role: 'patient',
    });

    console.log('✅ Patient registered successfully');
    console.log(`   User ID: ${response.user?.id}`);
    console.log(`   Access Token: ${response.accessToken.substring(0, 20)}...`);

    return response.accessToken;
  } catch (error: any) {
    console.error('❌ Registration failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Step 2: Create a medical record (upload)
 */
async function uploadMedicalRecord(
  patientToken: string,
): Promise<string> {
  console.log('\n📤 Step 2: Creating medical record...');

  const recordsApi = new RecordsApi(
    new Configuration({
      accessToken: patientToken,
      basePath: API_BASE_URL,
    }),
  );

  try {
    const record = await recordsApi.createRecord({
      patientId: 'patient-001',
      recordType: 'LAB_RESULT',
      data: {
        testName: 'Complete Blood Count',
        date: new Date().toISOString(),
        results: {
          hemoglobin: '14.5 g/dL',
          whiteCellCount: '7.2 x10^9/L',
          plateletCount: '250 x10^9/L',
        },
        labName: 'Central Medical Laboratory',
      },
      metadata: {
        source: 'lab-automation',
        priority: 'normal',
        reviewed: false,
      },
    });

    console.log('✅ Medical record created successfully');
    console.log(`   Record ID: ${record.id}`);
    console.log(`   IPFS Hash: ${record.ipfsHash || 'pending'}`);
    console.log(`   Stellar Tx: ${record.stellarTxHash || 'pending'}`);

    return record.id;
  } catch (error: any) {
    console.error('❌ Record creation failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Step 3: Register healthcare provider and grant access
 */
async function registerProviderAndGrantAccess(
  patientToken: string,
  recordId: string,
): Promise<{ providerToken: string; grantId: string }> {
  console.log('\n👨‍⚕️ Step 3: Registering healthcare provider and granting access...');

  const authApi = new AuthApi(
    new Configuration({ basePath: API_BASE_URL }),
  );

  try {
    // Register provider
    const providerResponse = await authApi.register({
      email: `doctor-${Date.now()}@example.com`,
      password: 'ProviderPassword123!',
      name: 'Dr. Jane Smith',
      role: 'healthcare_provider',
    });

    const providerToken = providerResponse.accessToken;
    const providerId = providerResponse.user?.id || 'provider-001';

    console.log('✅ Healthcare provider registered');
    console.log(`   Provider ID: ${providerId}`);

    // Grant access to the record
    const accessApi = new AccessApi(
      new Configuration({
        accessToken: patientToken,
        basePath: API_BASE_URL,
      }),
    );

    const grant = await accessApi.grantAccess({
      recordId: recordId,
      recipientId: providerId,
      permissions: ['read', 'comment'],
      expiresAt: new Date(
        Date.now() + 90 * 24 * 60 * 60 * 1000, // 90 days
      ).toISOString(),
    });

    console.log('✅ Access granted to healthcare provider');
    console.log(`   Grant ID: ${grant.id}`);
    console.log(`   Permissions: ${grant.permissions.join(', ')}`);
    console.log(`   Expires: ${grant.expiresAt}`);

    return { providerToken, grantId: grant.id };
  } catch (error: any) {
    console.error('❌ Provider setup failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Step 4: Retrieve record as healthcare provider (fetch)
 */
async function providerFetchRecord(
  providerToken: string,
  recordId: string,
): Promise<void> {
  console.log('\n📥 Step 4: Provider fetching medical record...');

  const recordsApi = new RecordsApi(
    new Configuration({
      accessToken: providerToken,
      basePath: API_BASE_URL,
    }),
  );

  try {
    const record = await recordsApi.getRecord(recordId);

    console.log('✅ Record retrieved successfully');
    console.log(`   Record ID: ${record.id}`);
    console.log(`   Record Type: ${record.recordType}`);
    console.log(`   Data: ${JSON.stringify(record.data, null, 2)}`);
    console.log(`   Created: ${record.createdAt}`);

    // Provider can also comment on the record
    console.log('\n💬 Provider can now:');
    console.log('   - View the medical record');
    console.log('   - Add comments (if permitted)');
    console.log('   - Save/reference for treatment decisions');
  } catch (error: any) {
    console.error('❌ Record fetch failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Step 5: Verify access and list grants
 */
async function verifyAccessAndListGrants(
  patientToken: string,
  recordId: string,
): Promise<void> {
  console.log('\n🔍 Step 5: Verifying access and listing grants...');

  const accessApi = new AccessApi(
    new Configuration({
      accessToken: patientToken,
      basePath: API_BASE_URL,
    }),
  );

  try {
    // List all access grants for the record
    const grants = await accessApi.listAccessGrants(recordId, 1, 10);

    console.log('✅ Access grants retrieved');
    console.log(`   Total grants: ${grants.total}`);

    grants.data.forEach((grant, index) => {
      console.log(`   Grant ${index + 1}:`);
      console.log(`     - Granted to: ${grant.grantedTo}`);
      console.log(`     - Permissions: ${grant.permissions.join(', ')}`);
      console.log(`     - Expires: ${grant.expiresAt || 'Never'}`);
      console.log(`     - Revoked: ${grant.revokedAt ? 'Yes' : 'No'}`);
    });
  } catch (error: any) {
    console.error('❌ Grant listing failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Step 6: Revoke access
 */
async function revokeAccess(
  patientToken: string,
  grantId: string,
): Promise<void> {
  console.log('\n🔐 Step 6: Revoking access...');

  const accessApi = new AccessApi(
    new Configuration({
      accessToken: patientToken,
      basePath: API_BASE_URL,
    }),
  );

  try {
    const revoked = await accessApi.revokeAccess(grantId);

    console.log('✅ Access revoked successfully');
    console.log(`   Grant ID: ${revoked.id}`);
    console.log(`   Revoked at: ${revoked.revokedAt}`);
  } catch (error: any) {
    console.error('❌ Access revocation failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  console.log('🚀 MedChain SDK - Complete Flow Example');
  console.log('=====================================');
  console.log(`API Base URL: ${API_BASE_URL}`);

  try {
    // Step 1: Register patient
    const patientToken = await registerPatient();

    // Step 2: Upload medical record
    const recordId = await uploadMedicalRecord(patientToken);

    // Step 3: Register provider and grant access
    const { providerToken, grantId } =
      await registerProviderAndGrantAccess(patientToken, recordId);

    // Step 4: Provider fetches record
    await providerFetchRecord(providerToken, recordId);

    // Step 5: Verify access and list grants
    await verifyAccessAndListGrants(patientToken, recordId);

    // Step 6: Revoke access
    await revokeAccess(patientToken, grantId);

    console.log('\n✅ Complete flow executed successfully!');
    console.log('\n📊 Summary:');
    console.log('  ✓ Patient registered');
    console.log('  ✓ Medical record created');
    console.log('  ✓ Healthcare provider registered');
    console.log('  ✓ Access granted to provider');
    console.log('  ✓ Provider fetched record');
    console.log('  ✓ Access grants verified');
    console.log('  ✓ Access revoked');
  } catch (error) {
    console.error('\n❌ Flow execution failed');
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  main();
}

export { registerPatient, uploadMedicalRecord, registerProviderAndGrantAccess };
