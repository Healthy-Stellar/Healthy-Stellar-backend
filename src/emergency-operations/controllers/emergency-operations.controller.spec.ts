import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { EmergencyOperationsController } from './emergency-operations.controller';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';

describe('EmergencyOperationsController (auth hardening — issue #1153)', () => {
  const mockService = {
    createTriageCase: jest.fn().mockResolvedValue({ id: 'triage-1' }),
  };
  const controller = new EmergencyOperationsController(mockService as any);

  afterEach(() => jest.clearAllMocks());

  it('applies JwtAuthGuard + RolesGuard at the controller level (closes #1153)', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, EmergencyOperationsController) as any[];
    expect(guards).toBeDefined();
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
  });

  it('still delegates business logic to the service once authenticated', async () => {
    const dto = { patientId: 'p-1' } as any;
    const result = await controller.createTriageCase(dto);
    expect(result).toEqual({ id: 'triage-1' });
    expect(mockService.createTriageCase).toHaveBeenCalledWith(dto);
  });
});
