import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ALLOWED_BED_STATUS_TRANSITIONS, BedOccupancyService } from './bed-occupancy.service';
import { Bed } from './entities/bed.entity';
import { Room } from './entities/room.entity';
import { Ward } from './entities/ward.entity';
import { BedStatus } from './bed-status.enum';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

const makeWard = (o: Partial<Ward> = {}): Ward =>
  ({ id: 'w1', tenantId: TENANT_A, name: 'Ward A', isActive: true, wardManagerId: null, ...o }) as Ward;

const makeRoom = (o: Partial<Room> = {}): Room =>
  ({ id: 'r1', tenantId: TENANT_A, wardId: 'w1', roomNumber: '101', isActive: true, ...o }) as Room;

const makeBed = (o: Partial<Bed> = {}): Bed =>
  ({
    id: 'b1',
    tenantId: TENANT_A,
    bedNumber: '1A',
    status: BedStatus.AVAILABLE,
    roomId: 'r1',
    patientId: null,
    assignedAt: null,
    features: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...o,
  }) as Bed;

interface BuildModuleOptions {
  dbType?: string;
  lockAcquired?: boolean;
}

function matchesWhere(record: Record<string, any> | null, where: Record<string, any> | undefined): boolean {
  if (!record) return false;
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true;
    if (value && typeof value === 'object' && value._type === 'in') {
      return Array.isArray(value._value) && value._value.includes(record[key]);
    }
    return record[key] === value;
  });
}

function buildModule(
  bedRecord: Bed | null = makeBed(),
  roomRecord: Room | null = makeRoom(),
  wardRecord: Ward | null = makeWard(),
  occupiedBedOrOptions: Bed | null | BuildModuleOptions = null,
  maybeOptions: BuildModuleOptions = {},
) {
  const isOptionsArg =
    occupiedBedOrOptions !== null &&
    !('bedNumber' in occupiedBedOrOptions) &&
    ('dbType' in occupiedBedOrOptions || 'lockAcquired' in occupiedBedOrOptions);

  const occupiedBedRecord: Bed | null = isOptionsArg
    ? null
    : (occupiedBedOrOptions as Bed | null);
  const options: BuildModuleOptions = isOptionsArg
    ? (occupiedBedOrOptions as BuildModuleOptions)
    : maybeOptions;

  let currentBed = bedRecord ? { ...bedRecord } : null;
  let lastWhereClause = '';
  let lastWhereParams: Record<string, any> = {};

  const queryBuilder = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockImplementation((clause: string, params: Record<string, any> = {}) => {
      lastWhereClause = clause;
      lastWhereParams = { ...params };
      return queryBuilder;
    }),
    andWhere: jest.fn().mockImplementation((clause: string, params: Record<string, any> = {}) => {
      lastWhereClause += ` AND ${clause}`;
      lastWhereParams = { ...lastWhereParams, ...params };
      return queryBuilder;
    }),
    getOne: jest.fn().mockImplementation(async () => {
      const candidate = lastWhereClause.includes('bed.patientId')
        ? occupiedBedRecord
        : currentBed;
      if (!candidate) return null;
      if (lastWhereParams.id && candidate.id !== lastWhereParams.id) return null;
      if (lastWhereParams.tenantId && candidate.tenantId !== lastWhereParams.tenantId) return null;
      if (lastWhereParams.patientId && candidate.patientId !== lastWhereParams.patientId) return null;
      return { ...candidate };
    }),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([
      { status: BedStatus.AVAILABLE, count: '5' },
      { status: BedStatus.OCCUPIED, count: '3' },
    ]),
  };

  const mockEntityManager = {
    connection: {
      options: { type: options.dbType ?? 'better-sqlite3' },
    },
    query: jest.fn().mockImplementation(async () => [{ acquired: options.lockAcquired ?? true }]),
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    save: jest.fn().mockImplementation(async (_targetOrEntity: any, entity?: any) => {
      const saved = entity !== undefined ? entity : _targetOrEntity;
      currentBed = { ...saved };
      return saved;
    }),
  };

  const bedRepo = {
    create: jest.fn().mockImplementation((d) => ({ ...d })),
    save: jest.fn().mockImplementation(async (r) => {
      currentBed = { ...r };
      return r;
    }),
    find: jest.fn().mockImplementation(async (opts?: any) =>
      currentBed && matchesWhere(currentBed, opts?.where) ? [{ ...currentBed }] : [],
    ),
    findOne: jest.fn().mockImplementation(async (opts?: any) => {
      if (opts?.where?.patientId) {
        return matchesWhere(occupiedBedRecord, opts.where) ? occupiedBedRecord : null;
      }
      return currentBed && matchesWhere(currentBed, opts?.where) ? { ...currentBed } : null;
    }),
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    manager: {
      transaction: jest.fn().mockImplementation(async (cb) => cb(mockEntityManager)),
    },
  };

  const roomRepo = {
    create: jest.fn().mockImplementation((d) => ({ ...d })),
    save: jest.fn().mockImplementation(async (r) => r),
    find: jest.fn().mockImplementation(async (opts?: any) =>
      roomRecord && matchesWhere(roomRecord, opts?.where) ? [roomRecord] : [],
    ),
    findOne: jest.fn().mockImplementation(async (opts?: any) =>
      roomRecord && matchesWhere(roomRecord, opts?.where) ? roomRecord : null,
    ),
  };

  const wardRepo = {
    create: jest.fn().mockImplementation((d) => ({ ...d })),
    save: jest.fn().mockImplementation(async (r) => r),
    find: jest.fn().mockImplementation(async (opts?: any) =>
      wardRecord && matchesWhere(wardRecord, opts?.where) ? [wardRecord] : [],
    ),
    findOne: jest.fn().mockImplementation(async (opts?: any) =>
      wardRecord && matchesWhere(wardRecord, opts?.where) ? wardRecord : null,
    ),
  };

  return {
    compile: () =>
      Test.createTestingModule({
        providers: [
          BedOccupancyService,
          { provide: getRepositoryToken(Bed), useValue: bedRepo },
          { provide: getRepositoryToken(Room), useValue: roomRepo },
          { provide: getRepositoryToken(Ward), useValue: wardRepo },
        ],
      }).compile(),
    mockEntityManager,
    queryBuilder,
    bedRepo,
    roomRepo,
    wardRepo,
  };
}

describe('BedOccupancyService', () => {
  describe('tenant context guard', () => {
    it('throws ForbiddenException when tenantId is missing', async () => {
      const { compile } = buildModule();
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);

      await expect(svc.getWards('')).rejects.toThrow(ForbiddenException);
      await expect(svc.createWard({ name: 'Ward A' }, '')).rejects.toThrow(ForbiddenException);
      await expect(svc.getBedById('b1', '')).rejects.toThrow(ForbiddenException);
      await expect(svc.assignBed({ bedId: 'b1', patientId: 'p1' }, '')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(svc.releaseBed('b1', '')).rejects.toThrow(ForbiddenException);
      await expect(svc.getOccupancySummary('')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createWard', () => {
    it('creates and returns a ward stamped with caller tenantId', async () => {
      const { compile, wardRepo } = buildModule();
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      const result = await svc.createWard({ name: 'Ward A' }, TENANT_A);
      expect(result).toMatchObject({ name: 'Ward A', tenantId: TENANT_A });
      expect(wardRepo.create).toHaveBeenCalledWith({ name: 'Ward A', tenantId: TENANT_A });
    });

    it('overrides any client-supplied tenantId on the dto', async () => {
      const { compile } = buildModule();
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      const result = await svc.createWard(
        { name: 'Ward A', tenantId: TENANT_B } as any,
        TENANT_A,
      );
      expect(result.tenantId).toBe(TENANT_A);
    });
  });

  describe('getWards', () => {
    it('filters wards by tenantId', async () => {
      const { compile, wardRepo } = buildModule();
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);

      await expect(svc.getWards(TENANT_A)).resolves.toHaveLength(1);
      expect(wardRepo.find).toHaveBeenCalledWith({ where: { tenantId: TENANT_A, isActive: true } });
      await expect(svc.getWards(TENANT_B)).resolves.toEqual([]);
    });
  });

  describe('createRoom', () => {
    it('throws NotFoundException when ward not found', async () => {
      const { compile } = buildModule(makeBed(), makeRoom(), null);
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      await expect(svc.createRoom({ wardId: 'w1', roomNumber: '101' }, TENANT_A)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when ward belongs to another tenant', async () => {
      const { compile } = buildModule(makeBed(), makeRoom(), makeWard({ tenantId: TENANT_B }));
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      await expect(svc.createRoom({ wardId: 'w1', roomNumber: '101' }, TENANT_A)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('creates a room when ward exists in caller tenant', async () => {
      const { compile } = buildModule();
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      const result = await svc.createRoom({ wardId: 'w1', roomNumber: '101' }, TENANT_A);
      expect(result).toMatchObject({ wardId: 'w1', roomNumber: '101', tenantId: TENANT_A });
    });
  });

  describe('getRoomsByWard', () => {
    it('throws NotFoundException for a cross-tenant wardId', async () => {
      const { compile } = buildModule(makeBed(), makeRoom(), makeWard({ tenantId: TENANT_B }));
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      await expect(svc.getRoomsByWard('w1', TENANT_A)).rejects.toThrow(NotFoundException);
    });

    it('returns rooms for the caller tenant ward', async () => {
      const { compile, roomRepo } = buildModule();
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      const rooms = await svc.getRoomsByWard('w1', TENANT_A);
      expect(rooms).toHaveLength(1);
      expect(roomRepo.find).toHaveBeenCalledWith({
        where: { wardId: 'w1', tenantId: TENANT_A, isActive: true },
      });
    });
  });

  describe('createBed', () => {
    it('throws NotFoundException when room not found', async () => {
      const { compile } = buildModule(makeBed(), null);
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      await expect(svc.createBed({ bedNumber: '1A', roomId: 'r1' }, TENANT_A)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when room belongs to another tenant', async () => {
      const { compile } = buildModule(makeBed(), makeRoom({ tenantId: TENANT_B }), makeWard());
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      await expect(svc.createBed({ bedNumber: '1A', roomId: 'r1' }, TENANT_A)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('creates a bed when room exists in caller tenant', async () => {
      const { compile } = buildModule();
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      const result = await svc.createBed({ bedNumber: '1A', roomId: 'r1' }, TENANT_A);
      expect(result).toMatchObject({ bedNumber: '1A', roomId: 'r1', tenantId: TENANT_A });
    });
  });

  describe('getBeds & getBedById', () => {
    it('scopes getBeds by tenantId', async () => {
      const { compile, bedRepo } = buildModule();
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);

      await expect(svc.getBeds({}, TENANT_A)).resolves.toHaveLength(1);
      expect(bedRepo.find).toHaveBeenCalledWith({
        where: { tenantId: TENANT_A, isActive: true },
      });
      await expect(svc.getBeds({}, TENANT_B)).resolves.toEqual([]);
    });

    it('rejects cross-tenant wardId or roomId filter in getBeds', async () => {
      const { compile } = buildModule(
        makeBed({ tenantId: TENANT_B }),
        makeRoom({ tenantId: TENANT_B }),
        makeWard({ tenantId: TENANT_B }),
      );
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);

      await expect(svc.getBeds({ wardId: 'w1' }, TENANT_A)).rejects.toThrow(NotFoundException);
      await expect(svc.getBeds({ roomId: 'r1' }, TENANT_A)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException on getBedById for cross-tenant bed', async () => {
      const { compile } = buildModule(makeBed({ tenantId: TENANT_B }));
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      await expect(svc.getBedById('b1', TENANT_A)).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignBed', () => {
    it('assigns an available bed to a patient within tenant', async () => {
      const { compile, queryBuilder } = buildModule();
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      const result = await svc.assignBed({ bedId: 'b1', patientId: 'p1' }, TENANT_A);
      expect(result.status).toBe(BedStatus.OCCUPIED);
      expect(result.patientId).toBe('p1');
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('bed.tenantId = :tenantId', {
        tenantId: TENANT_A,
      });
    });

    it('throws NotFoundException when assigning a bed owned by another tenant', async () => {
      const { compile } = buildModule(makeBed({ tenantId: TENANT_B }));
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      await expect(svc.assignBed({ bedId: 'b1', patientId: 'p1' }, TENANT_A)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when bed is not available', async () => {
      const { compile } = buildModule(makeBed({ status: BedStatus.OCCUPIED }));
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      await expect(svc.assignBed({ bedId: 'b1', patientId: 'p1' }, TENANT_A)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when bed not found', async () => {
      const { compile } = buildModule(null);
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      await expect(svc.assignBed({ bedId: 'b1', patientId: 'p1' }, TENANT_A)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when the patient already occupies another bed in same tenant', async () => {
      const { compile } = buildModule(
        makeBed(),
        makeRoom(),
        makeWard(),
        makeBed({ id: 'b2', status: BedStatus.OCCUPIED, patientId: 'p1' }),
      );
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      await expect(svc.assignBed({ bedId: 'b1', patientId: 'p1' }, TENANT_A)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('releaseBed', () => {
    it('releases an occupied bed to cleaning status', async () => {
      const { compile } = buildModule(makeBed({ status: BedStatus.OCCUPIED, patientId: 'p1' }));
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      const result = await svc.releaseBed('b1', TENANT_A);
      expect(result.status).toBe(BedStatus.CLEANING);
      expect(result.patientId).toBeNull();
    });

    it('throws NotFoundException when releasing a bed owned by another tenant', async () => {
      const { compile } = buildModule(
        makeBed({ tenantId: TENANT_B, status: BedStatus.OCCUPIED, patientId: 'p1' }),
      );
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      await expect(svc.releaseBed('b1', TENANT_A)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when bed is not occupied', async () => {
      const { compile } = buildModule(makeBed({ status: BedStatus.AVAILABLE }));
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      await expect(svc.releaseBed('b1', TENANT_A)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateBedStatus', () => {
    it('throws NotFoundException when bed not found', async () => {
      const { compile } = buildModule(null);
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      await expect(
        svc.updateBedStatus('b1', { status: BedStatus.MAINTENANCE }, TENANT_A),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when updating status of a cross-tenant bed', async () => {
      const { compile } = buildModule(makeBed({ tenantId: TENANT_B }));
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      await expect(
        svc.updateBedStatus('b1', { status: BedStatus.MAINTENANCE }, TENANT_A),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects moving bed to OCCUPIED status', async () => {
      const { compile } = buildModule(makeBed({ status: BedStatus.AVAILABLE }));
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      await expect(
        svc.updateBedStatus('b1', { status: BedStatus.OCCUPIED }, TENANT_A),
      ).rejects.toThrow(
        new BadRequestException(
          'Cannot transition to OCCUPIED status via updateBedStatus; use assignBed instead',
        ),
      );
    });

    it('rejects status update when bed is currently OCCUPIED', async () => {
      const { compile } = buildModule(
        makeBed({ status: BedStatus.OCCUPIED, patientId: 'patient-1' }),
      );
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      await expect(
        svc.updateBedStatus('b1', { status: BedStatus.AVAILABLE }, TENANT_A),
      ).rejects.toThrow(
        new BadRequestException('Bed b1 is currently occupied and must be released via releaseBed'),
      );
    });

    it('rejects status update when bed has a patient assigned', async () => {
      const { compile } = buildModule(
        makeBed({ status: BedStatus.CLEANING, patientId: 'patient-1' }),
      );
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      await expect(
        svc.updateBedStatus('b1', { status: BedStatus.AVAILABLE }, TENANT_A),
      ).rejects.toThrow(
        new BadRequestException('Bed b1 is currently occupied and must be released via releaseBed'),
      );
    });

    it('allows valid transition: AVAILABLE -> MAINTENANCE', async () => {
      const { compile } = buildModule(makeBed({ status: BedStatus.AVAILABLE }));
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      const result = await svc.updateBedStatus('b1', { status: BedStatus.MAINTENANCE }, TENANT_A);
      expect(result.status).toBe(BedStatus.MAINTENANCE);
    });

    it('allows valid transition: AVAILABLE -> CLEANING', async () => {
      const { compile } = buildModule(makeBed({ status: BedStatus.AVAILABLE }));
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      const result = await svc.updateBedStatus('b1', { status: BedStatus.CLEANING }, TENANT_A);
      expect(result.status).toBe(BedStatus.CLEANING);
    });

    it('allows valid transition: AVAILABLE -> RESERVED', async () => {
      const { compile } = buildModule(makeBed({ status: BedStatus.AVAILABLE }));
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      const result = await svc.updateBedStatus('b1', { status: BedStatus.RESERVED }, TENANT_A);
      expect(result.status).toBe(BedStatus.RESERVED);
    });

    it('allows valid transition: CLEANING -> AVAILABLE', async () => {
      const { compile } = buildModule(makeBed({ status: BedStatus.CLEANING }));
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      const result = await svc.updateBedStatus('b1', { status: BedStatus.AVAILABLE }, TENANT_A);
      expect(result.status).toBe(BedStatus.AVAILABLE);
    });

    it('allows valid transition: CLEANING -> MAINTENANCE', async () => {
      const { compile } = buildModule(makeBed({ status: BedStatus.CLEANING }));
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      const result = await svc.updateBedStatus('b1', { status: BedStatus.MAINTENANCE }, TENANT_A);
      expect(result.status).toBe(BedStatus.MAINTENANCE);
    });

    it('allows valid transition: MAINTENANCE -> AVAILABLE', async () => {
      const { compile } = buildModule(makeBed({ status: BedStatus.MAINTENANCE }));
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      const result = await svc.updateBedStatus('b1', { status: BedStatus.AVAILABLE }, TENANT_A);
      expect(result.status).toBe(BedStatus.AVAILABLE);
    });

    it('allows valid transition: MAINTENANCE -> CLEANING', async () => {
      const { compile } = buildModule(makeBed({ status: BedStatus.MAINTENANCE }));
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      const result = await svc.updateBedStatus('b1', { status: BedStatus.CLEANING }, TENANT_A);
      expect(result.status).toBe(BedStatus.CLEANING);
    });

    it('allows valid transition: RESERVED -> AVAILABLE', async () => {
      const { compile } = buildModule(makeBed({ status: BedStatus.RESERVED }));
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      const result = await svc.updateBedStatus('b1', { status: BedStatus.AVAILABLE }, TENANT_A);
      expect(result.status).toBe(BedStatus.AVAILABLE);
    });

    it('rejects invalid transition: CLEANING -> RESERVED', async () => {
      const { compile } = buildModule(makeBed({ status: BedStatus.CLEANING }));
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      await expect(
        svc.updateBedStatus('b1', { status: BedStatus.RESERVED }, TENANT_A),
      ).rejects.toThrow(
        new BadRequestException('Invalid bed status transition from cleaning to reserved'),
      );
    });

    it('rejects invalid transition: MAINTENANCE -> RESERVED', async () => {
      const { compile } = buildModule(makeBed({ status: BedStatus.MAINTENANCE }));
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      await expect(
        svc.updateBedStatus('b1', { status: BedStatus.RESERVED }, TENANT_A),
      ).rejects.toThrow(
        new BadRequestException('Invalid bed status transition from maintenance to reserved'),
      );
    });

    it('rejects self-transition (e.g. AVAILABLE -> AVAILABLE)', async () => {
      const { compile } = buildModule(makeBed({ status: BedStatus.AVAILABLE }));
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      await expect(
        svc.updateBedStatus('b1', { status: BedStatus.AVAILABLE }, TENANT_A),
      ).rejects.toThrow(
        new BadRequestException('Invalid bed status transition from available to available'),
      );
    });

    it('takes the same advisory lock as assignBed and throws ConflictException when lock is busy', async () => {
      const { compile } = buildModule(makeBed(), makeRoom(), makeWard(), {
        dbType: 'postgres',
        lockAcquired: false,
      });
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      await expect(
        svc.updateBedStatus('b1', { status: BedStatus.MAINTENANCE }, TENANT_A),
      ).rejects.toThrow(ConflictException);
    });

    it('takes advisory lock and executes transactional update when lock is free in postgres', async () => {
      const { compile, mockEntityManager } = buildModule(makeBed(), makeRoom(), makeWard(), {
        dbType: 'postgres',
        lockAcquired: true,
      });
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      const result = await svc.updateBedStatus('b1', { status: BedStatus.MAINTENANCE }, TENANT_A);

      expect(mockEntityManager.query).toHaveBeenCalledWith(
        'SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired',
        ['bed_occupancy:bed:b1'],
      );
      expect(result.status).toBe(BedStatus.MAINTENANCE);
    });
  });

  describe('getOccupancySummary', () => {
    it('returns status counts and total scoped to tenantId', async () => {
      const { compile, queryBuilder } = buildModule();
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      const summary = await svc.getOccupancySummary(TENANT_A);
      expect(summary[BedStatus.AVAILABLE]).toBe(5);
      expect(summary[BedStatus.OCCUPIED]).toBe(3);
      expect(summary.total).toBe(8);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('bed.tenantId = :tenantId', {
        tenantId: TENANT_A,
      });
    });

    it('throws NotFoundException when wardId belongs to another tenant', async () => {
      const { compile } = buildModule(makeBed(), makeRoom(), makeWard({ tenantId: TENANT_B }));
      const mod = await compile();
      const svc = mod.get(BedOccupancyService);
      await expect(svc.getOccupancySummary(TENANT_A, 'w1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('ALLOWED_BED_STATUS_TRANSITIONS', () => {
    it('disallows direct transitions from OCCUPIED', () => {
      expect(ALLOWED_BED_STATUS_TRANSITIONS[BedStatus.OCCUPIED]).toEqual([]);
    });
  });
});
