import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KekRotationService } from '../services/kek-rotation.service';
import { EnvelopeKeyManagementService } from '../services/envelope-key-management.service';

describe('KekRotationService', () => {
  let service: KekRotationService;
  let keyManagement: jest.Mocked<Partial<EnvelopeKeyManagementService>>;
  let configService: jest.Mocked<Partial<ConfigService>>;

  beforeEach(async () => {
    keyManagement = { rotateMasterKey: jest.fn().mockResolvedValue({ reencryptedCount: 5 }) };
    configService = { get: jest.fn().mockReturnValue(90) };
    const module = await Test.createTestingModule({
      providers: [
        KekRotationService,
        { provide: EnvelopeKeyManagementService, useValue: keyManagement },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();
    service = module.get(KekRotationService);
  });

  it('rotates and records result', async () => {
    const result = await service.rotate('operator-1');
    expect(result.reencryptedCount).toBe(5);
    const status = service.getStatus();
    expect(status.lastRotatedAt).toBeDefined();
    expect(status.inProgress).toBe(false);
    expect(status.lastResult?.reencryptedCount).toBe(5);
  });

  it('throws when rotation already in progress', async () => {
    // Simulate in-progress by making rotateMasterKey never resolve during test
    let resolve: () => void;
    keyManagement.rotateMasterKey = jest.fn(
      () => new Promise<any>(r => { resolve = () => r({ reencryptedCount: 0 }); }),
    );
    const p = service.rotate('op1');
    await expect(service.rotate('op2')).rejects.toThrow('already in progress');
    resolve!();
    await p;
  });

  it('scheduledRotation skips if interval has not elapsed', async () => {
    // Set lastRotatedAt to now — interval (90 days) hasn't elapsed
    (service as any).lastRotatedAt = new Date();
    await service.scheduledRotation();
    expect(keyManagement.rotateMasterKey).not.toHaveBeenCalled();
  });

  it('scheduledRotation rotates if interval elapsed', async () => {
    // Set lastRotatedAt to 91 days ago
    const past = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
    (service as any).lastRotatedAt = past;
    await service.scheduledRotation();
    expect(keyManagement.rotateMasterKey).toHaveBeenCalled();
  });
});
