import { Test } from '@nestjs/testing';
import { RecordingService } from './recording.service';
import { SessionRecording, RecordingStatus } from '../entity/session-recording.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('RecordingService', () => {
  let service: RecordingService;
  let repo: any;

  beforeEach(async () => {
    repo = {
      create: jest.fn(v => v),
      save: jest.fn(v => Promise.resolve({ ...v, id: 'rec-1' })),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };
    const configMock = { get: jest.fn((key, def) => def) };
    const module = await Test.createTestingModule({
      providers: [
        RecordingService,
        { provide: getRepositoryToken(SessionRecording), useValue: repo },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();
    service = module.get(RecordingService);
  });

  it('uploads recording and stores it', async () => {
    const file = { size: 1024, mimetype: 'video/mp4' } as any;
    const result = await service.uploadRecording('session-1', file, 'user-1');
    expect(result.storageKey).toContain('recordings/session-1/');
    expect(result.status).toBe(RecordingStatus.STORED);
  });

  it('getSignedUrl returns url and expiresAt for allowed role', async () => {
    repo.findOne.mockResolvedValue({ id: 'rec-1', storageKey: 'recordings/s/file', status: RecordingStatus.STORED });
    const { url, expiresAt } = await service.getSignedUrl('s-1', 'clinician', 'u-1');
    expect(url).toContain('recordings/stream/rec-1');
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('getSignedUrl throws ForbiddenException for unauthorized role', async () => {
    await expect(service.getSignedUrl('s-1', 'receptionist', 'u-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('getSignedUrl throws NotFoundException when no recording exists', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.getSignedUrl('s-1', 'admin', 'u-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('purgeExpiredRecordings marks expired recordings as PURGED', async () => {
    const expired = [{ id: 'r1', status: RecordingStatus.STORED }];
    repo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(expired),
    });
    const count = await service.purgeExpiredRecordings();
    expect(count).toBe(1);
    expect(expired[0].status).toBe(RecordingStatus.PURGED);
  });
});
