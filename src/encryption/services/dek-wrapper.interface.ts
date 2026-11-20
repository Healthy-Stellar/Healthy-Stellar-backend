/**
 * Contract for wrapping/unwrapping per-record Data Encryption Keys with a
 * patient-specific Key Encryption Key.
 *
 * Production: PersistentKeyManagementService (KEKs persisted via KeyStore).
 * Tests:      KeyManagementService (in-memory, test-only).
 *
 * Both are injected under the KeyManagementService class token.
 */
export interface DekWrapper {
  wrapDek(dek: Buffer, patientId: string): Promise<Buffer>;
  unwrapDek(encryptedDek: Buffer, patientId: string): Promise<Buffer>;
  getDekVersion(patientId: string): string;
}
