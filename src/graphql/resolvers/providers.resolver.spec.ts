import { Test } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { ProvidersResolver } from './providers.resolver';
import { UsersService } from '../../users/users.service';
import { GqlAuthGuard } from '../guards/gql-auth.guard';

const mockProvider = {
  id: 'u-1', email: 'dr@test.com', firstName: 'House', lastName: 'MD',
  role: 'physician', createdAt: new Date(),
};

const mockUsersService = {
  findOne: jest.fn().mockResolvedValue(mockProvider),
  findAll: jest.fn().mockResolvedValue([mockProvider]),
};

describe('ProvidersResolver', () => {
  let resolver: ProvidersResolver;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ProvidersResolver,
        { provide: UsersService, useValue: mockUsersService },
      ],
    })
      .overrideGuard(GqlAuthGuard)
      .useValue({ canActivate: (_ctx: ExecutionContext) => true })
      .compile();
    resolver = module.get(ProvidersResolver);
  });

  it('provider returns single provider by id', async () => {
    const result = await resolver.provider('u-1');
    expect(mockUsersService.findOne).toHaveBeenCalledWith('u-1');
    expect(result).toEqual(mockProvider);
  });

  it('providers returns all providers', async () => {
    const result = await resolver.providers();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toEqual(mockProvider);
  });
});
