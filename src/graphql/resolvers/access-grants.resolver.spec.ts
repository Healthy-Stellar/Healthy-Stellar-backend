import { Test } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { AccessGrantsResolver } from './access-grants.resolver';
import { AccessControlService } from '../../access-control/services/access-control.service';
import { GqlAuthGuard } from '../guards/gql-auth.guard';

const mockGrant = {
  id: 'g-1', patientId: 'p-1', granteeId: 'u-2',
  recordIds: ['r-1'], accessLevel: 'READ', status: 'ACTIVE', createdAt: new Date(),
};

const mockAccessControlService = {
  getPatientGrants: jest.fn().mockResolvedValue([mockGrant]),
  grantAccess: jest.fn().mockResolvedValue(mockGrant),
  revokeAccess: jest.fn().mockResolvedValue(undefined),
};

describe('AccessGrantsResolver', () => {
  let resolver: AccessGrantsResolver;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AccessGrantsResolver,
        { provide: AccessControlService, useValue: mockAccessControlService },
      ],
    })
      .overrideGuard(GqlAuthGuard)
      .useValue({ canActivate: (_ctx: ExecutionContext) => true })
      .compile();
    resolver = module.get(AccessGrantsResolver);
  });

  it('accessGrants returns grants for patient', async () => {
    const result = await resolver.accessGrants('p-1');
    expect(mockAccessControlService.getPatientGrants).toHaveBeenCalledWith('p-1');
    expect(result).toEqual([mockGrant]);
  });

  it('grantAccess creates a grant', async () => {
    const result = await resolver.grantAccess(
      { patientId: 'p-1', granteeId: 'u-2', recordIds: ['r-1'], accessLevel: 'READ' },
      { sub: 'p-1' },
    );
    expect(mockAccessControlService.grantAccess).toHaveBeenCalled();
    expect(result).toEqual(mockGrant);
  });

  it('revokeAccess returns true', async () => {
    const result = await resolver.revokeAccess({ grantId: 'g-1' }, { sub: 'p-1' });
    expect(mockAccessControlService.revokeAccess).toHaveBeenCalledWith('g-1', 'p-1', undefined);
    expect(result).toBe(true);
  });
});
