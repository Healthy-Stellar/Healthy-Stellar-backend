import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { CriticalValuesController } from './critical-values.controller';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';

describe('CriticalValuesController (auth hardening — issue #1154)', () => {
  const mockDefinitionsService = {
    findAll: jest.fn().mockResolvedValue([{ id: 'def-1' }]),
  };
  const mockAlertsService = {
    findUnacknowledged: jest.fn().mockResolvedValue([{ id: 'alert-1' }]),
  };
  const controller = new CriticalValuesController(
    mockDefinitionsService as any,
    mockAlertsService as any,
  );

  afterEach(() => jest.clearAllMocks());

  it('applies JwtAuthGuard + RolesGuard at the controller level (closes #1154)', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, CriticalValuesController) as any[];
    expect(guards).toBeDefined();
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
  });

  it('still delegates read endpoints to the services once authenticated', async () => {
    const defs = await controller.findDefinitions();
    expect(defs).toEqual([{ id: 'def-1' }]);
    expect(mockDefinitionsService.findAll).toHaveBeenCalled();

    const alerts = await controller.getUnacknowledged();
    expect(alerts).toEqual([{ id: 'alert-1' }]);
    expect(mockAlertsService.findUnacknowledged).toHaveBeenCalled();
  });
});
