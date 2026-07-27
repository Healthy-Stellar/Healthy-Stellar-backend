import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { Readable } from 'stream';
import { RecordDownloadService } from './record-download.service';
import { Record } from '../entities/record.entity';
import { EncryptionService } from '../../encryption/services/encryption.service';
import { AccessControlService } from '../../access-control/services/access-control.service';
import { AuditService } from '../../common/audit/audit.service';
import { RecordType } from '../dto/create-record.dto';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Build a minimal packed envelope matching unpackEnvelope's expected layout */
function buildEnvelope(plaintext: Buffer): Buffer {
  const iv = Buffer.alloc(12, 0xaa);
  const authTag = Buffer.alloc(16, 0xbb);
  const encryptedDek = Buffer.alloc(48, 0xcc);
  const dekVersionBuf = Buffer.from('v1', 'utf8');
  const ciphertext = plaintext; // pretend it's already "encrypted" for test purposes

  const dekLenBuf = Buffer.allocUnsafe(4);
  dekLenBuf.writeUInt32LE(encryptedDek.length, 0);

  const verLenBuf = Buffer.allocUnsafe(2);
  verLenBuf.writeUInt16LE(dekVersionBuf.length, 0);

  return Buffer.concat([iv, authTag, dekLenBuf, encryptedDek, verLenBuf, dekVersionBuf, ciphertext]);
}

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockRecord: Partial<Record> = {
  id: 'record-uuid',
  patientId: 'patient-uuid',
  cid: 'QmTestCid',
  recordType: RecordType.LAB_RESULT,
};

const mockRecordRepo = () => ({ findOne: jest.fn() });
const mockEncryption = () => ({ decryptRecord: jest.fn() });
const mockAccessControl = () => ({ verifyAccess: jest.fn() });
const mockAudit = () => ({ logDataAccess: jest.fn().mockResolvedValue(undefined) });

describe('RecordDownloadService', () => {
  let service: RecordDownloadService;
  let recordRepo: ReturnType<typeof mockRecordRepo>;
  let encryption: ReturnType<typeof mockEncryption>;
  let accessControl: ReturnType<typeof mockAccessControl>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordDownloadService,
        { provide: getRepositoryToken(Record), useFactory: mockRecordRepo },
        { provide: EncryptionService, useFactory: mockEncryption },
        { provide: AccessControlService, useFactory: mockAccessControl },
        { provide: AuditService, useFactory: mockAudit },
      ],
    }).compile();

    service = module.get(RecordDownloadService);
    recordRepo = module.get(getRepositoryToken(Record));
    encryption = module.get(EncryptionService);
    accessControl = module.get(AccessControlService);

    // Mock IPFS fetch on the service instance
    jest.spyOn(service, 'fetchFromIpfs').mockResolvedValue(buildEnvelope(Buffer.from('plaintext-data')));
  });

  afterEach(() => jest.clearAllMocks());

  // ── 404 when record missing ────────────────────────────────────────────────
  it('throws NotFoundException when record does not exist', async () => {
    recordRepo.findOne.mockResolvedValue(null);
    await expect(service.download('bad-id', 'req-id', '127.0.0.1', 'jest')).rejects.toThrow(NotFoundException);
  });

  // ── 403 when no access grant ───────────────────────────────────────────────
  it('throws ForbiddenException when requester has no access grant', async () => {
    recordRepo.findOne.mockResolvedValue(mockRecord);
    accessControl.verifyAccess.mockResolvedValue(false);
    await expect(service.download('record-uuid', 'req-id', '127.0.0.1', 'jest')).rejects.toThrow(ForbiddenException);
  });

  // ── Successful download returns stream ────────────────────────────────────
  it('returns a Readable stream with correct content-type on success', async () => {
    recordRepo.findOne.mockResolvedValue(mockRecord);
    accessControl.verifyAccess.mockResolvedValue(true);
    encryption.decryptRecord.mockResolvedValue(Buffer.from('decrypted-content'));

    const result = await service.download('record-uuid', 'req-id', '127.0.0.1', 'jest');

    expect(result.stream).toBeInstanceOf(Readable);
    expect(result.contentType).toBe('application/pdf'); // LAB_RESULT maps to pdf
    expect(result.filename).toContain('record-uuid');
  });

  // ── Decryption failure → 500 ──────────────────────────────────────────────
  it('throws InternalServerErrorException when decryption fails', async () => {
    recordRepo.findOne.mockResolvedValue(mockRecord);
    accessControl.verifyAccess.mockResolvedValue(true);
    encryption.decryptRecord.mockRejectedValue(new Error('auth tag mismatch'));

    await expect(service.download('record-uuid', 'req-id', '127.0.0.1', 'jest')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  // ── Audit log always written ──────────────────────────────────────────────
  it('writes an audit log entry on successful download', async () => {
    recordRepo.findOne.mockResolvedValue(mockRecord);
    accessControl.verifyAccess.mockResolvedValue(true);
    encryption.decryptRecord.mockResolvedValue(Buffer.from('data'));

    const auditSpy = jest.spyOn(service['auditService'], 'logDataAccess');
    await service.download('record-uuid', 'req-id', '1.2.3.4', 'test-agent');

    expect(auditSpy).toHaveBeenCalledWith(
      'req-id',
      'Record',
      'record-uuid',
      '1.2.3.4',
      'test-agent',
      expect.any(Object),
    );
  });

  // ── No plaintext caching (Cache-Control headers tested at controller level) ─
  it('does not expose plaintext in the returned object beyond the stream', async () => {
    recordRepo.findOne.mockResolvedValue(mockRecord);
    accessControl.verifyAccess.mockResolvedValue(true);
    encryption.decryptRecord.mockResolvedValue(Buffer.from('secret'));

    const result = await service.download('record-uuid', 'req-id', '127.0.0.1', 'jest');

    // Only stream, contentType, filename — no raw buffer exposed
    expect(Object.keys(result)).toEqual(['stream', 'contentType', 'filename']);
  });

  // ── unpackEnvelope correctly parses layout ────────────────────────────────
  describe('unpackEnvelope', () => {
    it('correctly extracts iv, authTag, encryptedDek, dekVersion, ciphertext', () => {
      const payload = Buffer.from('hello-world');
      const envelope = buildEnvelope(payload);
      const unpacked = service.unpackEnvelope(envelope);

      expect(unpacked.iv).toHaveLength(12);
      expect(unpacked.authTag).toHaveLength(16);
      expect(unpacked.encryptedDek).toHaveLength(48);
      expect(unpacked.dekVersion).toBe('v1');
      expect(unpacked.ciphertext.toString()).toBe('hello-world');
    });
  });

  // ── Content-type inference ────────────────────────────────────────────────
  describe('content-type inference', () => {
    it.each([
      ['imaging', 'application/dicom'],
      ['lab_result', 'application/pdf'],
      ['prescription', 'application/pdf'],
      ['unknown_type', 'application/octet-stream'],
    ])('maps recordType %s → %s', (type, expected) => {
      const result = service['inferContentType'](type);
      expect(result).toBe(expected);
    });
  });
});
