import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersResolver } from './users.resolver';
import { User } from '../../auth/entities/user.entity';

const mockUserRepo = {
  findOneOrFail: jest.fn(),
  find: jest.fn(),
};

describe('UsersResolver', () => {
  let resolver: UsersResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersResolver,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
      ],
    }).compile();

    resolver = module.get<UsersResolver>(UsersResolver);
    jest.clearAllMocks();
  });

  const ctx = {
    req: { user: { userId: 'user-1' } },
    loaders: { userLoader: { load: jest.fn() } },
  };

  describe('me', () => {
    it('returns the authenticated user', async () => {
      const user = { id: 'user-1', email: 'test@example.com' };
      mockUserRepo.findOneOrFail.mockResolvedValue(user);

      const result = await resolver.me(ctx);

      expect(mockUserRepo.findOneOrFail).toHaveBeenCalledWith({ where: { id: 'user-1' } });
      expect(result).toEqual(user);
    });
  });

  describe('users', () => {
    it('returns all users for admin', async () => {
      const users = [{ id: 'u1' }, { id: 'u2' }];
      mockUserRepo.find.mockResolvedValue(users);

      const result = await resolver.users();

      expect(mockUserRepo.find).toHaveBeenCalled();
      expect(result).toEqual(users);
    });
  });

  describe('user', () => {
    it('loads a user via DataLoader', async () => {
      const user = { id: 'u1', email: 'a@b.com' };
      ctx.loaders.userLoader.load.mockResolvedValue(user);

      const result = await resolver.user('u1', ctx);

      expect(ctx.loaders.userLoader.load).toHaveBeenCalledWith('u1');
      expect(result).toEqual(user);
    });
  });
});
