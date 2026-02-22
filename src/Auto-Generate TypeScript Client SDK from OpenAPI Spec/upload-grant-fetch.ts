/**
 * MedChain SDK - Full Example
 *
 * Demonstrates the complete upload → grant → fetch flow:
 *   1. Authenticate as an uploader
 *   2. Upload a medical record
 *   3. Grant read access to a doctor
 *   4. Authenticate as the doctor
 *   5. Fetch the record
 *   6. Download the file
 *   7. Check audit logs
 *
 * Run: ts-node examples/upload-grant-fetch.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  MedChainClient,
  RecordMetadata,
  Permission,
} from '../src/index';

const API_BASE = process.env.MEDCHAIN_API_URL ?? 'http://localhost:3000/v1';

// ─── Credentials (load from env in production) ───────────────────────────────
const UPLOADER = { username: 'nurse@hospital.org', password: 'nurse_pass' };
const DOCTOR   = { username: 'doctor@hospital.org', password: 'doctor_pass' };
const PATIENT_ID = 'patient-uuid-1234';

async function main() {
  // ── Step 1: Authenticate as the uploader ──────────────────────────────────
  console.log('\n[1] Logging in as uploader…');
  const uploaderClient = new MedChainClient({ basePath: API_BASE });
  const { data: authData } = await uploaderClient.auth.login(UPLOADER);
  uploaderClient.setToken(authData.token!);
  console.log(`    ✓ Token acquired (expires in ${authData.expiresIn}s)`);

  // ── Step 2: Upload a medical record ───────────────────────────────────────
  console.log('\n[2] Uploading lab result…');
  const fileBuffer = fs.readFileSync(path.join(__dirname, 'sample-lab-result.pdf'));

  const metadata: RecordMetadata = {
    recordType: 'LAB_RESULT',
    title: 'Complete Blood Count – 2026-02-21',
    description: 'Routine CBC panel',
    tags: ['cbc', 'routine', '2026'],
  };

  const { data: record } = await uploaderClient.records.uploadRecord(
    fileBuffer,
    PATIENT_ID,
    JSON.stringify(metadata)
  );
  console.log(`    ✓ Record created: ${record.id}`);
  console.log(`    ✓ IPFS CID: ${record.ipfsCid}`);
  console.log(`    ✓ Content hash: ${record.contentHash}`);

  // ── Step 3: Grant read access to the doctor ───────────────────────────────
  console.log('\n[3] Granting READ access to doctor…');
  const DOCTOR_USER_ID = 'doctor-uuid-5678';
  const permissions: Permission[] = ['READ'];

  const { data: grant } = await uploaderClient.access.grantAccess({
    recordId: record.id!,
    granteeId: DOCTOR_USER_ID,
    permissions,
    // Grant expires in 30 days
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
  console.log(`    ✓ Grant created: ${grant.id}`);
  console.log(`    ✓ Permissions: ${grant.permissions?.join(', ')}`);
  console.log(`    ✓ Expires: ${grant.expiresAt}`);

  // ── Step 4: Authenticate as the doctor ────────────────────────────────────
  console.log('\n[4] Logging in as doctor…');
  const doctorClient = new MedChainClient({ basePath: API_BASE });
  const { data: doctorAuth } = await doctorClient.auth.login(DOCTOR);
  doctorClient.setToken(doctorAuth.token!);
  console.log('    ✓ Doctor token acquired');

  // ── Step 5: Fetch the record metadata ─────────────────────────────────────
  console.log('\n[5] Fetching record metadata…');
  const { data: fetchedRecord } = await doctorClient.records.getRecord(record.id!);
  console.log(`    ✓ Record title: ${fetchedRecord.metadata?.title}`);
  console.log(`    ✓ Record type: ${fetchedRecord.metadata?.recordType}`);
  console.log(`    ✓ Tags: ${fetchedRecord.metadata?.tags?.join(', ')}`);

  // ── Step 6: Download the raw file ─────────────────────────────────────────
  console.log('\n[6] Downloading record file…');
  const { data: fileData } = await doctorClient.records.downloadRecord(record.id!);
  const outPath = path.join(__dirname, 'downloaded-lab-result.pdf');
  fs.writeFileSync(outPath, Buffer.from(fileData));
  console.log(`    ✓ File saved to ${outPath} (${Buffer.from(fileData).length} bytes)`);

  // ── Step 7: Inspect audit logs ────────────────────────────────────────────
  console.log('\n[7] Checking audit trail…');
  const { data: auditPage } = await uploaderClient.audit.listAuditLogs({
    resourceId: record.id,
    pageSize: 10,
  });
  console.log(`    ✓ ${auditPage.total} audit events for this record:`);
  auditPage.data?.forEach((log) => {
    console.log(`       ${log.timestamp}  [${log.actorId}]  ${log.action}`);
  });

  // ── Step 8: Revoke access (cleanup) ───────────────────────────────────────
  console.log('\n[8] Revoking access grant…');
  await uploaderClient.access.revokeAccess(grant.id!);
  console.log('    ✓ Grant revoked');

  console.log('\n✅ Full upload → grant → fetch flow complete!\n');
}

main().catch((err) => {
  console.error('\n❌ Error:', err.response?.data ?? err.message);
  process.exit(1);
});
