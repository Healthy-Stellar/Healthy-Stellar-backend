import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Patient } from './entities/patient.entity';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: jest.Mocked<Repository<User>>;

  const buildQueryBuilderMock = () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
      getOne: jest.fn(),
    };
    return qb;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Patient),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    usersRepository = module.get(getRepositoryToken(User));
  });

  it('findAll should load users with patient profile via QueryBuilder join', async () => {
    const qb = buildQueryBuilderMock();
    const rows = [{ id: 'u1' }, { id: 'u2' }] as User[];
    qb.getMany.mockResolvedValue(rows);
    usersRepository.createQueryBuilder.mockReturnValue(qb as any);

    const result = await service.findAll();

    expect(usersRepository.createQueryBuilder).toHaveBeenCalledWith('user');
    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('user.patientProfile', 'patientProfile');
    expect(qb.getMany).toHaveBeenCalledTimes(1);
    expect(result).toEqual(rows);
  });

  it('findOne should load user with patient profile via QueryBuilder join', async () => {
    const qb = buildQueryBuilderMock();
    const row = { id: 'u1' } as User;
    qb.getOne.mockResolvedValue(row);
    usersRepository.createQueryBuilder.mockReturnValue(qb as any);

    const result = await service.findOne('u1');

    expect(usersRepository.createQueryBuilder).toHaveBeenCalledWith('user');
    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('user.patientProfile', 'patientProfile');
    expect(qb.where).toHaveBeenCalledWith('user.id = :id', { id: 'u1' });
    expect(qb.getOne).toHaveBeenCalledTimes(1);
    expect(result).toEqual(row);
  });

  it('findOne should throw NotFoundException when user is missing', async () => {
    const qb = buildQueryBuilderMock();
    qb.getOne.mockResolvedValue(null);
    usersRepository.createQueryBuilder.mockReturnValue(qb as any);

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });
});
