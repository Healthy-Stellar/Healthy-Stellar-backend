import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecordAccessGuard } from './record-access.guard';
import { Record } from '../entities/record.entity';
import { AccessControlService } from '../../access-control/services/access-control.service';
import { EmergencyAccessCleanupService } from '../../access-control/services/emergency-access-cleanup.service';
import { UserRole } from '../../auth/entities/user.entity';

describe('RecordAccessGuard', () => {
  let guard: RecordAccessGuard;
  let repository: Repository<Record>;

  const mockRepository = { findOne: jest.fn() };
  const mockAccessControlService = { canAccessRecord: jest.fn() };
  const mockCleanupService = { lockedGranteeIds: new Set<string>() };

  const createContext = (request: { [key: string]: any }): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
    }) as ExecutionContext;

  beforeEach(async () => {
    mockCleanupService.lockedGranteeIds.clear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordAccessGuard,
        { provide: getRepositoryToken(Record), useValue: mockRepository },
        { provide: AccessControlService, useValue: mockAccessControlService },
        { provide: EmergencyAccessCleanupService, useValue: mockCleanupService },
      ],
    }).compile();

    guard = module.get<RecordAccessGuard>(RecordAccessGuard);
    repository = module.get<Repository<Record>>(getRepositoryToken(Record));
    jest.clearAllMocks();
  });

  it('allows the owning patient to access the record', async () => {
    const request = { params: { id: 'record-1' }, user: { userId: 'patient-1', role: UserRole.PATIENT } };
    const record = { id: 'record-1', patientId: 'patient-1' };

    mockRepository.findOne.mockResolvedValue(record);
    mockAccessControlService.canAccessRecord.mockResolvedValue(true);

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 'record-1' } });
    expect(request.record).toEqual(record);
  });

  it('allows a grantee with active access to access the record', async () => {
    const request = { params: { id: 'record-1' }, user: { userId: 'provider-1', role: UserRole.PHYSICIAN } };
    const record = { id: 'record-1', patientId: 'patient-1' };

    mockRepository.findOne.mockResolvedValue(record);
    mockAccessControlService.canAccessRecord.mockResolvedValue(true);

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(mockAccessControlService.canAccessRecord).toHaveBeenCalledWith(
      'patient-1', 'provider-1', UserRole.PHYSICIAN, 'record-1',
    );
  });

  it('rejects an unauthorized requester', async () => {
    const request = { params: { id: 'record-1' }, user: { userId: 'outsider-1', role: UserRole.PHYSICIAN } };

    mockRepository.findOne.mockResolvedValue({ id: 'record-1', patientId: 'patient-1' });
    mockAccessControlService.canAccessRecord.mockResolvedValue(false);

    await expect(guard.canActivate(createContext(request))).rejects.toThrow(ForbiddenException);
  });

  it('rejects unauthenticated requests', async () => {
    await expect(guard.canActivate(createContext({ params: { id: 'record-1' } }))).rejects.toThrow(UnauthorizedException);
  });

  it('blocks a circuit-breaker locked grantee before any DB lookup', async () => {
    mockCleanupService.lockedGranteeIds.add('locked-provider');
    const request = { params: { id: 'record-1' }, user: { userId: 'locked-provider', role: UserRole.PHYSICIAN } };

    await expect(guard.canActivate(createContext(request))).rejects.toThrow(ForbiddenException);
    expect(mockRepository.findOne).not.toHaveBeenCalled();
  });
});
