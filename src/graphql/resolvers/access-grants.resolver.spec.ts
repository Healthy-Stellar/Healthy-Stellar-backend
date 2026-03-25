import { Test, TestingModule } from '@nestjs/testing';
import { AccessGrantsResolver } from './access-grants.resolver';
import { AccessControlService } from '../../access-control/services/access-control.service';

const mockAccessControlService = {
  getPatientGrants: jest.fn(),
  getReceivedGrants: jest.fn(),
  grantAccess: jest.fn(),
  revokeAccess: jest.fn(),
};

describe('AccessGrantsResolver', () => {
  let resolver: AccessGrantsResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessGrantsResolver,
        { provide: AccessControlService, useValue: mockAccessControlService },
      ],
    }).compile();

    resolver = module.get<AccessGrantsResolver>(AccessGrantsResolver);
    jest.clearAllMocks();
  });

  const ctx = { req: { user: { userId: 'patient-1' } } };

  describe('myGrants', () => {
    it('returns active grants for the patient', async () => {
      const grants = [{ id: 'g1', patientId: 'patient-1' }];
      mockAccessControlService.getPatientGrants.mockResolvedValue(grants);

      const result = await resolver.myGrants(ctx);

      expect(mockAccessControlService.getPatientGrants).toHaveBeenCalledWith('patient-1');
      expect(result).toEqual(grants);
    });
  });

  describe('receivedGrants', () => {
    it('returns grants received by the provider', async () => {
      const grants = [{ id: 'g2', granteeId: 'patient-1' }];
      mockAccessControlService.getReceivedGrants.mockResolvedValue(grants);

      const result = await resolver.receivedGrants(ctx);

      expect(mockAccessControlService.getReceivedGrants).toHaveBeenCalledWith('patient-1');
      expect(result).toEqual(grants);
    });
  });

  describe('grantAccess', () => {
    it('creates a new access grant', async () => {
      const grant = { id: 'g3', patientId: 'patient-1', granteeId: 'provider-1' };
      mockAccessControlService.grantAccess.mockResolvedValue(grant);

      const result = await resolver.grantAccess('provider-1', ['r1'], 'READ', undefined, ctx);

      expect(mockAccessControlService.grantAccess).toHaveBeenCalledWith('patient-1', {
        granteeId: 'provider-1',
        recordIds: ['r1'],
        accessLevel: 'READ',
        expiresAt: undefined,
      });
      expect(result).toEqual(grant);
    });
  });

  describe('revokeAccess', () => {
    it('revokes an existing grant', async () => {
      const grant = { id: 'g1', status: 'REVOKED' };
      mockAccessControlService.revokeAccess.mockResolvedValue(grant);

      const result = await resolver.revokeAccess('g1', 'no longer needed', ctx);

      expect(mockAccessControlService.revokeAccess).toHaveBeenCalledWith('g1', 'patient-1', 'no longer needed');
      expect(result).toEqual(grant);
    });
  });
});
