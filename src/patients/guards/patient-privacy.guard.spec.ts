import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PatientPrivacyGuard } from './patient-privacy.guard';
import { PatientsService } from '../patients.service';

describe('PatientPrivacyGuard', () => {
  let guard: PatientPrivacyGuard;
  let patientsService: jest.Mocked<Partial<PatientsService>>;

  const createMockContext = (request: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: jest.fn(),
        getNext: jest.fn(),
      }),
      getClass: jest.fn(),
      getHandler: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    patientsService = {
      findById: jest.fn(),
    };
    guard = new PatientPrivacyGuard(patientsService as PatientsService);
  });

  it('throws ForbiddenException if user is not authenticated', async () => {
    const context = createMockContext({ user: null });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('allows access if user has admin role', async () => {
    const context = createMockContext({
      user: { id: 'admin-1', role: 'admin' },
      params: { id: 'patient-123' },
    });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('allows patient access when matching route param :id', async () => {
    const patientRecord = { id: 'patient-123', stellarAddress: 'GABC123' };
    (patientsService.findById as jest.Mock).mockResolvedValue(patientRecord);

    const context = createMockContext({
      user: { id: 'user-1', patientId: 'patient-123', role: 'patient' },
      params: { id: 'patient-123' },
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(patientsService.findById).toHaveBeenCalledWith('patient-123');
  });

  it('allows patient access when matching route param :address', async () => {
    const patientRecord = { id: 'patient-123', stellarAddress: 'GABC123' };
    (patientsService.findById as jest.Mock).mockResolvedValue(patientRecord);

    const context = createMockContext({
      user: { id: 'user-1', patientId: 'patient-123', stellarAddress: 'GABC123', role: 'patient' },
      params: { address: 'GABC123' },
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(patientsService.findById).toHaveBeenCalledWith('GABC123');
  });

  it('allows patient access when user.id matches patient.id via :address param', async () => {
    const patientRecord = { id: 'patient-123', stellarAddress: 'GABC123' };
    (patientsService.findById as jest.Mock).mockResolvedValue(patientRecord);

    const context = createMockContext({
      user: { id: 'patient-123', role: 'patient' },
      params: { address: 'GABC123' },
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('rejects patient access when user does not own the record', async () => {
    const patientRecord = { id: 'other-patient', stellarAddress: 'GXYZ999' };
    (patientsService.findById as jest.Mock).mockResolvedValue(patientRecord);

    const context = createMockContext({
      user: { id: 'user-1', patientId: 'my-patient', role: 'patient' },
      params: { address: 'GXYZ999' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('rejects access when patient lookup fails', async () => {
    (patientsService.findById as jest.Mock).mockRejectedValue(new Error('Not found'));

    const context = createMockContext({
      user: { id: 'user-1', patientId: 'my-patient', role: 'patient' },
      params: { address: 'GXYZ999' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
});
