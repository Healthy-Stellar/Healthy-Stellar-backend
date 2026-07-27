import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { EnvelopeEncryptionService } from '../../src/encryption/envelope-encryption.service';

// ─── KMS mock ─────────────────────────────────────────────────────────────────

const FAKE_DEK = Buffer.alloc(32, 0xab); // 32-byte DEK
const FAKE_ENCRYPTED_DEK = Buffer.alloc(56, 0xcd); // KMS ciphertext blob

jest.mock('@aws-sdk/client-kms', () => {
  const sendMock = jest.fn();

  return {
    KMSClient: jest.fn().mockImplementation(() => ({ send: sendMock })),
    GenerateDataKeyCommand: jest.fn(),
    DecryptCommand: jest.fn(),
    EncryptCommand: jest.fn(),
    __sendMock: sendMock, // exported so tests can configure it
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { __sendMock: sendMock } = require('@aws-sdk/client-kms');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EnvelopeEncryptionService', () => {
  let service: EnvelopeEncryptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EnvelopeEncryptionService],
    }).compile();

    service = module.get(EnvelopeEncryptionService);
    sendMock.mockReset();
  });

  // ── generateDek ────────────────────────────────────────────────────────────

  describe('generateDek', () => {
    it('returns plaintext DEK and sealed envelope', async () => {
      sendMock.mockResolvedValueOnce({
        Plaintext: FAKE_DEK,
        CiphertextBlob: FAKE_ENCRYPTED_DEK,
      });

      const { plaintext, envelope } = await service.generateDek(
        'arn:aws:kms:us-east-1:123456789012:key/test-key',
        'v1717000000000',
      );

      expect(plaintext).toHaveLength(32);
      expect(envelope.encryptedDek).toBe(FAKE_ENCRYPTED_DEK.toString('base64'));
      expect(envelope.kekVersion).toBe('v1717000000000');
    });

    it('throws when KMS response is incomplete', async () => {
      sendMock.mockResolvedValueOnce({ Plaintext: null, CiphertextBlob: null });

      await expect(
        service.generateDek('arn:aws:kms:...', 'v1'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ── unwrapDek ──────────────────────────────────────────────────────────────

  describe('unwrapDek', () => {
    it('returns the plaintext DEK', async () => {
      sendMock.mockResolvedValueOnce({ Plaintext: FAKE_DEK });

      const result = await service.unwrapDek(
        FAKE_ENCRYPTED_DEK.toString('base64'),
      );

      expect(Buffer.compare(result, FAKE_DEK)).toBe(0);
    });

    it('throws when KMS returns no plaintext', async () => {
      sendMock.mockResolvedValueOnce({ Plaintext: null });

      await expect(
        service.unwrapDek(FAKE_ENCRYPTED_DEK.toString('base64')),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ── rewrapDek ──────────────────────────────────────────────────────────────

  describe('rewrapDek', () => {
    it('decrypts old DEK and re-encrypts under new KEK', async () => {
      const NEW_ENCRYPTED_DEK = Buffer.alloc(56, 0xef);

      // First call: Decrypt (unwrap old DEK)
      sendMock.mockResolvedValueOnce({ Plaintext: FAKE_DEK });
      // Second call: Encrypt (wrap with new KEK)
      sendMock.mockResolvedValueOnce({ CiphertextBlob: NEW_ENCRYPTED_DEK });

      const newEnvelope = await service.rewrapDek(
        FAKE_ENCRYPTED_DEK.toString('base64'),
        'arn:aws:kms:us-east-1:123456789012:key/new-key',
        'v1717000001000',
      );

      expect(newEnvelope.encryptedDek).toBe(
        NEW_ENCRYPTED_DEK.toString('base64'),
      );
      expect(newEnvelope.kekVersion).toBe('v1717000001000');
      expect(sendMock).toHaveBeenCalledTimes(2);
    });
  });

  // ── AES-256-GCM round-trip ─────────────────────────────────────────────────

  describe('encryptWithDek / decryptWithDek', () => {
    it('round-trips arbitrary data', () => {
      const dek = Buffer.alloc(32, 0x42);
      const plaintext = Buffer.from('Hello, HIPAA-compliant world!');

      const payload = service.encryptWithDek(Buffer.from(plaintext), dek);

      // DEK was zeroed inside encryptWithDek, recreate for decryption
      const dek2 = Buffer.alloc(32, 0x42);
      const decrypted = service.decryptWithDek(payload, dek2);

      expect(decrypted.toString()).toBe(plaintext.toString());
    });

    it('throws on tampered auth tag (GCM integrity check)', () => {
      const dek = Buffer.alloc(32, 0x55);
      const payload = service.encryptWithDek(
        Buffer.from('sensitive data'),
        dek,
      );

      // Tamper with the auth tag
      const tampered = {
        ...payload,
        authTag: Buffer.alloc(16, 0xff).toString('base64'),
      };

      const dek2 = Buffer.alloc(32, 0x55);
      expect(() => service.decryptWithDek(tampered, dek2)).toThrow();
    });

    it('ciphertext differs for same plaintext (random IV)', () => {
      const plaintext = Buffer.from('same content');
      const payload1 = service.encryptWithDek(
        Buffer.from(plaintext),
        Buffer.alloc(32, 0x77),
      );
      const payload2 = service.encryptWithDek(
        Buffer.from(plaintext),
        Buffer.alloc(32, 0x77),
      );

      // IVs must be different
      expect(payload1.iv).not.toBe(payload2.iv);
      expect(payload1.ciphertext).not.toBe(payload2.ciphertext);
    });
  });
});