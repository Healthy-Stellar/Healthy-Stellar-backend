import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { MultiSigController } from './multi-sig.controller';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';

describe('MultiSigController (auth hardening — issue #1152)', () => {
  const mockService = {
    createMultiSigPayment: jest.fn().mockResolvedValue({ id: 'tx-1' }),
  };
  const controller = new MultiSigController(mockService as any);

  afterEach(() => jest.clearAllMocks());

  it('applies JwtAuthGuard + RolesGuard at the controller level (closes #1152)', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, MultiSigController) as any[];
    expect(guards).toBeDefined();
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
  });

  it('still delegates createPayment to the service once authenticated', async () => {
    const dto = { tenantId: 't', destination: 'G', amount: '1', asset: 'XLM' } as any;
    const req = { user: { userId: 'u-1' } } as any;
    const result = await controller.createPayment(dto, req);
    expect(result).toEqual({ id: 'tx-1' });
    expect(mockService.createMultiSigPayment).toHaveBeenCalledWith(dto, 'u-1');
  });
});
