export interface EncryptedKey {
  /** AES-256-GCM ciphertext of the DEK */
  ciphertext: Buffer;
  /** 12-byte IV used during encryption */
  iv: Buffer;
  /** 16-byte GCM auth tag */
  authTag: Buffer;
  /** Master key version used to encrypt this DEK */
  masterKeyVersion: string;
}

export interface DataKeyResult {
  /** Encrypted DEK — store this in DB */
  encryptedKey: EncryptedKey;
  /** Plaintext DEK — use in memory only, never persist */
  plainKey: Buffer;
}

export interface KeyManagementService {
  generateDEK(patientAddress: string): Promise<DataKeyResult>;
  decryptDEK(encryptedKey: EncryptedKey): Promise<Buffer>;
  rotateMasterKey(): Promise<void>;
}
