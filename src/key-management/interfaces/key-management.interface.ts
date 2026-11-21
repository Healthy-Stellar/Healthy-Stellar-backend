export interface EncryptedKey {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  masterKeyVersion: string;
}

export interface DataKeyResult {
  encryptedKey: EncryptedKey;
  plainKey: Buffer;
}

export interface KeyManagementService {
  generateDEK(patientAddress: string): Promise<DataKeyResult>;
  decryptDEK(encryptedKey: EncryptedKey): Promise<Buffer>;
  rotateMasterKey(operatorId: string): Promise<{ reencryptedCount: number }>;
}

export interface KeyManagementStrategy {
  generateDEK(patientAddress: string): Promise<DataKeyResult>;
  decryptDEK(encryptedKey: EncryptedKey): Promise<Buffer>;
  rotateMasterKey(operatorId: string): Promise<{ reencryptedCount: number }>;
}
