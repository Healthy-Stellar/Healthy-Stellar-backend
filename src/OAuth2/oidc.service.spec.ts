import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { OidcService } from './oidc.service';
import { OidcIdentity } from './entities/oidc-identity.entity';
import { User } from '../users/entities/user.entity';
import { OidcVerifiedProfile } from './oidc.strategy';
import { LinkStellarAddressDto } from './dto/oidc.dto';

// ---------------------------------------------------------------------------
// Helpers / factories
// ---------------------------------------------------------------------------

const mockUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-uuid-1',
    email: 'doctor@hospital.org',
    givenName: 'Ada',
    familyName: 'Lovelace',
    stellarAddress: null,
    isActive: true,
    oidcIdentities: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User);

const mockIdentity = (
  user: User,
  overrides: Partial<OidcIdentity> = {},
): OidcIdentity =>
  ({
    id: 'identity-uuid-1',
    provider: 'azure',
    providerSubject: 'sub-abc-123',
    email: user.email,
    givenName: user.givenName,
    familyName: user.familyName,
    rawClaims: {},
    lastUsedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user,
    ...overrides,
  } as OidcIdentity);

const mockProfile = (overrides: Partial<OidcVerifiedProfile> = {}): OidcVerifiedProfile => ({
  provider: 'azure',
  providerSubject: 'sub-abc-123',
  email: 'doctor@hospital.org',
  givenName: 'Ada',
  familyName: 'Lovelace',
  rawClaims: { sub: 'sub-abc-123', email: 'doctor@hospital.org' },
  tokenSet: {} as any,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mock repository factory
// ---------------------------------------------------------------------------

type MockRepo<T> = Partial<jest.Mocked<Repository<T>>>;

const repoMock = <T>(): MockRepo<T> => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  count: jest.fn(),
});

// ---------------------------------------------------------------------------
// DataSource transaction mock
// ---------------------------------------------------------------------------

function mockDataSource(managerOverrides: Record<string, MockRepo<any>> = {}): Partial<DataSource> {
  return {
    transaction: jest.fn().mockImplementation(async (cb: (em: any) => Promise<any>) => {
      const manager = {
        getRepository: jest.fn((entity: any) => {
          const name: string = entity?.name ?? '';
          return managerOverrides[name] ?? repoMock();
        }),
      };
      return cb(manager);
    }),
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('OidcService', () => {
  let service: OidcService;
  let oidcRepo: MockRepo<OidcIdentity>;
  let userRepo: MockRepo<User>;
  let jwtService: jest.Mocked<JwtService>;

  // Manager-level repos (used inside transactions)
  let managerOidcRepo: MockRepo<OidcIdentity>;
  let managerUserRepo: MockRepo<User>;
  let dataSource: Partial<DataSource>;

  beforeEach(async () => {
    oidcRepo = repoMock<OidcIdentity>();
    userRepo = repoMock<User>();
    managerOidcRepo = repoMock<OidcIdentity>();
    managerUserRepo = repoMock<User>();

    dataSource = mockDataSource({
      OidcIdentity: managerOidcRepo,
      User: managerUserRepo,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OidcService,
        { provide: getRepositoryToken(OidcIdentity), useValue: oidcRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('signed.jwt.token') },
        },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(OidcService);
    jwtService = module.get(JwtService);

    process.env.JWT_EXPIRES_IN = '8h';
  });

  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  // handleOidcLogin
  // -------------------------------------------------------------------------

  describe('handleOidcLogin', () => {
    describe('when OIDC identity already exists', () => {
      it('updates lastUsedAt and returns a JWT without creating a new user', async () => {
        const user = mockUser();
        const identity = mockIdentity(user);

        managerOidcRepo.findOne = jest.fn().mockResolvedValue(identity);
        managerOidcRepo.save = jest.fn().mockResolvedValue(identity);

        const result = await service.handleOidcLogin(mockProfile());

        expect(managerOidcRepo.findOne).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { provider: 'azure', providerSubject: 'sub-abc-123' },
          }),
        );
        expect(managerUserRepo.create).not.toHaveBeenCalled();
        expect(managerOidcRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({ lastUsedAt: expect.any(Date) }),
        );
        expect(result.accessToken).toBe('signed.jwt.token');
        expect(result.user.isNewUser).toBe(false);
      });
    });

    describe('when no identity exists but user with matching email exists', () => {
      it('links the OIDC identity to the existing user', async () => {
        const existingUser = mockUser();
        managerOidcRepo.findOne = jest.fn().mockResolvedValue(null);
        managerUserRepo.findOne = jest.fn().mockResolvedValue(existingUser);
        managerOidcRepo.create = jest.fn().mockReturnValue({} as OidcIdentity);
        managerOidcRepo.save = jest.fn().mockResolvedValue({} as OidcIdentity);

        const result = await service.handleOidcLogin(mockProfile());

        expect(managerUserRepo.create).not.toHaveBeenCalled(); // no new user
        expect(managerOidcRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            provider: 'azure',
            providerSubject: 'sub-abc-123',
            user: existingUser,
          }),
        );
        expect(result.user.isNewUser).toBe(false);
      });
    });

    describe('when no identity and no matching email user exist', () => {
      it('creates a new user and a new OIDC identity', async () => {
        const newUser = mockUser({ id: 'new-user-id' });
        managerOidcRepo.findOne = jest.fn().mockResolvedValue(null);
        managerUserRepo.findOne = jest.fn().mockResolvedValue(null);
        managerUserRepo.create = jest.fn().mockReturnValue(newUser);
        managerUserRepo.save = jest.fn().mockResolvedValue(newUser);
        managerOidcRepo.create = jest.fn().mockReturnValue({} as OidcIdentity);
        managerOidcRepo.save = jest.fn().mockResolvedValue({} as OidcIdentity);

        const result = await service.handleOidcLogin(mockProfile());

        expect(managerUserRepo.create).toHaveBeenCalled();
        expect(managerUserRepo.save).toHaveBeenCalled();
        expect(result.user.isNewUser).toBe(true);
        expect(jwtService.sign).toHaveBeenCalledWith(
          expect.objectContaining({ sub: 'new-user-id' }),
        );
      });
    });

    describe('when profile has no email', () => {
      it('creates a new user without email lookup', async () => {
        const newUser = mockUser({ email: null });
        managerOidcRepo.findOne = jest.fn().mockResolvedValue(null);
        managerUserRepo.findOne = jest.fn().mockResolvedValue(null);
        managerUserRepo.create = jest.fn().mockReturnValue(newUser);
        managerUserRepo.save = jest.fn().mockResolvedValue(newUser);
        managerOidcRepo.create = jest.fn().mockReturnValue({} as OidcIdentity);
        managerOidcRepo.save = jest.fn().mockResolvedValue({});

        await service.handleOidcLogin(mockProfile({ email: null }));

        // findOne for email should not have been called since email is null
        expect(managerUserRepo.findOne).not.toHaveBeenCalled();
      });
    });
  });

  // -------------------------------------------------------------------------
  // linkOidcIdentityToUser
  // -------------------------------------------------------------------------

  describe('linkOidcIdentityToUser', () => {
    it('creates a new OIDC identity link for the user', async () => {
      const user = mockUser();
      userRepo.findOne = jest.fn().mockResolvedValue(user);
      oidcRepo.findOne = jest.fn().mockResolvedValue(null);
      oidcRepo.create = jest.fn().mockReturnValue({} as OidcIdentity);
      oidcRepo.save = jest.fn().mockResolvedValue({} as OidcIdentity);

      const result = await service.linkOidcIdentityToUser('user-uuid-1', mockProfile());

      expect(oidcRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'azure', user }),
      );
      expect(result.linked).toBe(true);
    });

    it('is idempotent when identity already belongs to the same user', async () => {
      const user = mockUser();
      const identity = mockIdentity(user);
      userRepo.findOne = jest.fn().mockResolvedValue(user);
      oidcRepo.findOne = jest.fn().mockResolvedValue(identity);

      const result = await service.linkOidcIdentityToUser('user-uuid-1', mockProfile());

      expect(oidcRepo.save).not.toHaveBeenCalled();
      expect(result.linked).toBe(true);
    });

    it('throws ConflictException if identity belongs to a different user', async () => {
      const user = mockUser();
      const otherUser = mockUser({ id: 'other-user-id' });
      const identity = mockIdentity(otherUser);
      userRepo.findOne = jest.fn().mockResolvedValue(user);
      oidcRepo.findOne = jest.fn().mockResolvedValue(identity);

      await expect(
        service.linkOidcIdentityToUser('user-uuid-1', mockProfile()),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when user does not exist', async () => {
      userRepo.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        service.linkOidcIdentityToUser('nonexistent', mockProfile()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // getLinkedIdentities
  // -------------------------------------------------------------------------

  describe('getLinkedIdentities', () => {
    it('returns all identities for a user', async () => {
      const user = mockUser();
      const identities = [mockIdentity(user), mockIdentity(user, { provider: 'okta', id: 'id-2' })];
      oidcRepo.find = jest.fn().mockResolvedValue(identities);

      const result = await service.getLinkedIdentities('user-uuid-1');

      expect(result).toHaveLength(2);
      expect(oidcRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { user: { id: 'user-uuid-1' } } }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // unlinkOidcIdentity
  // -------------------------------------------------------------------------

  describe('unlinkOidcIdentity', () => {
    it('removes the identity when user has other auth methods', async () => {
      const user = mockUser({ stellarAddress: 'GABC...1234' });
      const identity = mockIdentity(user);
      oidcRepo.findOne = jest.fn().mockResolvedValue(identity);
      oidcRepo.count = jest.fn().mockResolvedValue(1);
      userRepo.findOne = jest.fn().mockResolvedValue(user);
      oidcRepo.remove = jest.fn().mockResolvedValue(identity);

      await service.unlinkOidcIdentity('user-uuid-1', 'identity-uuid-1');

      expect(oidcRepo.remove).toHaveBeenCalledWith(identity);
    });

    it('throws BadRequestException if removing last auth method', async () => {
      const user = mockUser({ stellarAddress: null });
      const identity = mockIdentity(user);
      oidcRepo.findOne = jest.fn().mockResolvedValue(identity);
      oidcRepo.count = jest.fn().mockResolvedValue(1);
      userRepo.findOne = jest.fn().mockResolvedValue(user);

      await expect(
        service.unlinkOidcIdentity('user-uuid-1', 'identity-uuid-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when identity not found', async () => {
      oidcRepo.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        service.unlinkOidcIdentity('user-uuid-1', 'bad-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // JWT issuance (indirectly tested)
  // -------------------------------------------------------------------------

  describe('JWT payload', () => {
    it('includes stellarAddress and oidcProvider in the token payload', async () => {
      const user = mockUser({ stellarAddress: 'GABC...', id: 'user-1' });
      const identity = mockIdentity(user);
      managerOidcRepo.findOne = jest.fn().mockResolvedValue(identity);
      managerOidcRepo.save = jest.fn().mockResolvedValue(identity);

      await service.handleOidcLogin(mockProfile());

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-1',
          stellarAddress: 'GABC...',
          oidcProvider: 'azure',
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // parseExpiresIn edge cases
  // -------------------------------------------------------------------------

  describe('expiresIn parsing', () => {
    it('converts "8h" to 28800 seconds', async () => {
      process.env.JWT_EXPIRES_IN = '8h';
      const user = mockUser();
      const identity = mockIdentity(user);
      managerOidcRepo.findOne = jest.fn().mockResolvedValue(identity);
      managerOidcRepo.save = jest.fn().mockResolvedValue(identity);

      const result = await service.handleOidcLogin(mockProfile());
      expect(result.expiresIn).toBe(28800);
    });

    it('converts "30m" to 1800 seconds', async () => {
      process.env.JWT_EXPIRES_IN = '30m';
      const user = mockUser();
      const identity = mockIdentity(user);
      managerOidcRepo.findOne = jest.fn().mockResolvedValue(identity);
      managerOidcRepo.save = jest.fn().mockResolvedValue(identity);

      const result = await service.handleOidcLogin(mockProfile());
      expect(result.expiresIn).toBe(1800);
    });
  });
});
