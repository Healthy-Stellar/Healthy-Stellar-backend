import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { SessionRecording } from '../entity/session-recording.entity';
import { VideoConferenceSession } from '../entity/Video conference session.entity';
import { KEY_MANAGEMENT_SERVICE } from '../../../key-management/key-management.module';

// Point file storage at an isolated temp dir before the service module's
// top-level `STORAGE_DIR` constant is evaluated.
const TEST_STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'session-recordings-test-'));
process.env.TELEMEDICINE_RECORDING_STORAGE_DIR = TEST_STORAGE_DIR;
process.env.TELEMEDICINE_RECORDING_RETENTION_DAYS = '90';
process.env.TELEMEDICINE_RECORDING_URL_TTL_S = '900';
process.env.TELEMEDICINE_RECORDING_SIGNING_SECRET = 'test-signing-secret';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SessionRecordingService } = require('./session-recording.service');

describe('SessionRecordingService', () => {
  let service: any;
  let recordingRepo: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock; delete: jest.Mock; createQueryBuilder: jest.Mock };
  let sessionRepo: { findOne: jest.Mock; save: jest.Mock };
  let keyManagement: { generateDEK: jest.Mock; decryptDEK: jest.Mock };

  beforeEach(async () => {
    recordingRepo = {
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => ({ id: 'recording-1', createdAt: new Date(), ...data })),
      findOne: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    sessionRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'session-1', recordingEnabled: false }),
      save: jest.fn(async (s) => s),
    };
    keyManagement = {
      generateDEK: jest.fn(),
      decryptDEK: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionRecordingService,
        { provide: getRepositoryToken(SessionRecording), useValue: recordingRepo },
        { provide: getRepositoryToken(VideoConferenceSession), useValue: sessionRepo },
        { provide: KEY_MANAGEMENT_SERVICE, useValue: keyManagement },
      ],
    }).compile();

    service = module.get(SessionRecordingService);
  });

  afterAll(async () => {
    await fs.promises.rm(TEST_STORAGE_DIR, { recursive: true, force: true });
  });

  it('throws NotFoundException when the session does not exist', async () => {
    sessionRepo.findOne.mockResolvedValue(null);
    await expect(
      service.uploadRecording('missing-session', {
        buffer: Buffer.from('x'),
        originalname: 'a.webm',
        mimetype: 'video/webm',
        size: 1,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('encrypts the recording at rest and is retrievable byte-for-byte', async () => {
    const plainKey = Buffer.alloc(32, 7);
    keyManagement.generateDEK.mockResolvedValue({
      encryptedKey: {
        ciphertext: Buffer.from('ct'),
        iv: Buffer.from('iv12'),
        authTag: Buffer.from('tag16'),
        masterKeyVersion: 'v1',
      },
      plainKey: Buffer.from(plainKey),
    });
    keyManagement.decryptDEK.mockResolvedValue(Buffer.from(plainKey));

    const original = Buffer.from('the quick brown fox session recording bytes');
    const saved = await service.uploadRecording('session-1', {
      buffer: original,
      originalname: 'visit.webm',
      mimetype: 'video/webm',
      size: original.length,
    });

    expect(saved.sessionId).toBe('session-1');
    expect(sessionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ recordingEnabled: true }),
    );

    // The bytes on disk must not equal the plaintext (encrypted at rest).
    const onDisk = await fs.promises.readFile(path.join(TEST_STORAGE_DIR, saved.storageKey));
    expect(onDisk.equals(original)).toBe(false);

    recordingRepo.findOne.mockResolvedValue(saved);
    const { buffer } = await service.getDecryptedRecording('session-1');
    expect(buffer.equals(original)).toBe(true);
  });

  it('generates a signed URL that verifies successfully and rejects tampering', async () => {
    recordingRepo.findOne.mockResolvedValue({ id: 'recording-1', sessionId: 'session-1' });

    const { url } = await service.getSignedRecordingUrl('session-1');
    const params = new URLSearchParams(url.split('?')[1]);

    expect(
      service.verifySignedUrl('session-1', params.get('expires'), params.get('sig')),
    ).toBe(true);

    expect(service.verifySignedUrl('session-1', params.get('expires'), 'deadbeef')).toBe(false);
    expect(service.verifySignedUrl('session-1', '1', params.get('sig'))).toBe(false);
  });

  it('throws NotFoundException when no recording exists for the session', async () => {
    recordingRepo.findOne.mockResolvedValue(null);
    await expect(service.getSignedRecordingUrl('session-without-recording')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('deletes recordings (DB row + file) past their retention window', async () => {
    const expiredRecording = {
      id: 'recording-old',
      storageKey: 'old-file.enc',
      retentionExpiresAt: new Date(Date.now() - 1000),
    };
    await fs.promises.writeFile(path.join(TEST_STORAGE_DIR, 'old-file.enc'), 'ciphertext');

    recordingRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([expiredRecording]),
    });

    const result = await service.deleteExpiredRecordings();

    expect(result.deleted).toBe(1);
    expect(recordingRepo.delete).toHaveBeenCalledWith('recording-old');
    await expect(
      fs.promises.access(path.join(TEST_STORAGE_DIR, 'old-file.enc')),
    ).rejects.toThrow();
  });
});
