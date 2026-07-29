import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { randomBytes, createHmac } from 'crypto';
import { DeterministicEncryptionService } from './deterministic-encryption.service';
import { PhiColumnEncryptionService } from './phi-column-encryption.service';
import { PhiKeyManagedTransformer } from '../../common/transformers/phi-key-managed.transformer';

const PATIENT_ID = 'patient-test-1';
const DEK = randomBytes(32);

const realPhiEncryption = {
  getDek: jest.fn().mockResolvedValue(DEK),

  async encryptField(patientId: string, value: string, deterministic = false): Promise<string> {
    const tx = new PhiKeyManagedTransformer(DEK, deterministic);
    return tx.to(value) as string;
  },

  async decryptField(patientId: string, ciphertext: string): Promise<string | null> {
    const detTx = new PhiKeyManagedTransformer(DEK, true);
    const res = detTx.from(ciphertext);
    if (res !== null) return res;
    const randTx = new PhiKeyManagedTransformer(DEK, false);
    return randTx.from(ciphertext);
  },

  async computeHmacIndex(patientId: string, value: string): Promise<string> {
    return createHmac('sha256', DEK).update(value, 'utf8').digest('hex');
  },
};

describe('DeterministicEncryptionService', () => {
  let service: DeterministicEncryptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeterministicEncryptionService,
        { provide: PhiColumnEncryptionService, useValue: realPhiEncryption },
      ],
    }).compile();

    service = module.get(DeterministicEncryptionService);
  });

  // ── Exact-match lookup without full decryption ─────────────────────────────

  describe('exact-match lookup', () => {
    it('produces the same ciphertext for identical SSN values (deterministic mode)', async () => {
      const ct1 = await service.encryptField(PATIENT_ID, 'nationalId', '123-45-6789');
      const ct2 = await service.encryptField(PATIENT_ID, 'nationalId', '123-45-6789');
      expect(ct1).toBe(ct2);
    });

    it('produces different ciphertexts for different SSN values', async () => {
      const ct1 = await service.encryptField(PATIENT_ID, 'nationalId', '123-45-6789');
      const ct2 = await service.encryptField(PATIENT_ID, 'nationalId', '999-88-7777');
      expect(ct1).not.toBe(ct2);
    });

    it('computeSearchIndex returns the same HMAC for the same value', async () => {
      const idx1 = await service.computeSearchIndex(PATIENT_ID, 'nationalId', '123-45-6789');
      const idx2 = await service.computeSearchIndex(PATIENT_ID, 'nationalId', '123-45-6789');
      expect(idx1).toBe(idx2);
      expect(idx1).toHaveLength(64); // hex SHA-256
    });

    it('computeSearchIndex allows index-only lookup without decrypting the dataset', async () => {
      const targetValue = '123-45-6789';
      const dataset = [
        await service.encryptField(PATIENT_ID, 'nationalId', '999-00-1111'),
        await service.encryptField(PATIENT_ID, 'nationalId', targetValue),
        await service.encryptField(PATIENT_ID, 'nationalId', '555-66-7777'),
      ];

      const targetIdx = await service.computeSearchIndex(PATIENT_ID, 'nationalId', targetValue);

      let matchPos = -1;
      for (let i = 0; i < dataset.length; i++) {
        const rowPlain = await realPhiEncryption.decryptField(PATIENT_ID, dataset[i]);
        const rowIdx = await realPhiEncryption.computeHmacIndex(PATIENT_ID, rowPlain ?? '');
        if (rowIdx === targetIdx) {
          matchPos = i;
          break;
        }
      }

      expect(matchPos).toBe(1);
    });
  });

  // ── Low-cardinality field protection ──────────────────────────────────────

  describe('field registry enforcement', () => {
    it('throws BadRequestException when deterministic mode is forced on a low-cardinality field', async () => {
      await expect(
        service.encryptField(PATIENT_ID, 'sex', 'M', true),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when computeSearchIndex is called on a randomised-only field', async () => {
      await expect(
        service.computeSearchIndex(PATIENT_ID, 'bloodType', 'A+'),
      ).rejects.toThrow(BadRequestException);
    });

    it('falls back to randomised mode for unregistered fields', async () => {
      const ct1 = await service.encryptField(PATIENT_ID, 'unknownField', 'value');
      const ct2 = await service.encryptField(PATIENT_ID, 'unknownField', 'value');
      expect(ct1).not.toBe(ct2);
    });
  });

  // ── re-encryption migration ────────────────────────────────────────────────

  describe('reEncryptToDeterministic', () => {
    it('produces a deterministic ciphertext from an existing randomised one', async () => {
      const randomisedCiphertext = await realPhiEncryption.encryptField(PATIENT_ID, 'ABC-12345', false);

      const { ciphertext, searchIndex } = await service.reEncryptToDeterministic(
        PATIENT_ID,
        'mrn',
        randomisedCiphertext,
      );

      const decrypted = await realPhiEncryption.decryptField(PATIENT_ID, ciphertext);
      expect(decrypted).toBe('ABC-12345');

      const expectedIdx = await realPhiEncryption.computeHmacIndex(PATIENT_ID, 'ABC-12345');
      expect(searchIndex).toBe(expectedIdx);
    });

    it('throws BadRequestException for ineligible fields', async () => {
      const randomisedCiphertext = await realPhiEncryption.encryptField(PATIENT_ID, 'A+', false);

      await expect(
        service.reEncryptToDeterministic(PATIENT_ID, 'bloodType', randomisedCiphertext),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── Decryption works for both modes ───────────────────────────────────────

  describe('decryptField', () => {
    it('decrypts a deterministically encrypted value', async () => {
      const ct = await service.encryptField(PATIENT_ID, 'nationalId', 'SSN-plain');
      const plain = await service.decryptField(PATIENT_ID, ct);
      expect(plain).toBe('SSN-plain');
    });

    it('decrypts a randomised ciphertext (for non-searchable fields)', async () => {
      const ct = await realPhiEncryption.encryptField(PATIENT_ID, 'some notes here', false);
      const plain = await service.decryptField(PATIENT_ID, ct);
      expect(plain).toBe('some notes here');
    });
  });
});
