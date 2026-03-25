export interface DataKeyResult {
  encryptedKey: Buffer;
  plainKey: Buffer;
}

export interface KeyManagementService {
  generateDataKey(patientId: string): Promise<DataKeyResult>;
  decryptDataKey(encryptedKey: Buffer, patientId: string): Promise<Buffer>;
  rotatePatientKey(patientId: string): Promise<void>;
  destroyPatientKeys(patientId: string): Promise<void>;
}