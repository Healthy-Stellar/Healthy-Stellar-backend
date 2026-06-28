import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BedOccupancyService } from './bed-occupancy.service';
import { Bed } from './entities/bed.entity';
import { Room } from './entities/room.entity';
import { Ward } from './entities/ward.entity';
import { BedStatus } from './bed-status.enum';

const makeWard = (o: Partial<Ward> = {}): Ward =>
  ({ id: 'w1', name: 'Ward A', isActive: true, wardManagerId: null, ...o } as Ward);

const makeRoom = (o: Partial<Room> = {}): Room =>
  ({ id: 'r1', wardId: 'w1', roomNumber: '101', isActive: true, ...o } as Room);

const makeBed = (o: Partial<Bed> = {}): Bed =>
  ({
    id: 'b1',
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
  } as Bed);

function buildModule(
  bedRecord: Bed | null = makeBed(),
  roomRecord: Room | null = makeRoom(),
  wardRecord: Ward | null = makeWard(),
) {
  const bedRepo = {
    create: jest.fn().mockImplementation((d) => d),
    save: jest.fn().mockImplementation(async (r) => r),
    find: jest.fn().mockResolvedValue(bedRecord ? [bedRecord] : []),
    findOne: jest.fn().mockResolvedValue(bedRecord),
    createQueryBuilder: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { status: BedStatus.AVAILABLE, count: '5' },
        { status: BedStatus.OCCUPIED, count: '3' },
      ]),
    }),
  };

  const roomRepo = {
    create: jest.fn().mockImplementation((d) => d),
    save: jest.fn().mockImplementation(async (r) => r),
    find: jest.fn().mockResolvedValue(roomRecord ? [roomRecord] : []),
    findOne: jest.fn().mockResolvedValue(roomRecord),
  };

  const wardRepo = {
    create: jest.fn().mockImplementation((d) => d),
    save: jest.fn().mockImplementation(async (r) => r),
    find: jest.fn().mockResolvedValue(wardRecord ? [wardRecord] : []),
    findOne: jest.fn().mockResolvedValue(wardRecord),
  };

  return Test.createTestingModule({
    providers: [
      BedOccupancyService,
      { provide: getRepositoryToken(Bed), useValue: bedRepo },
      { provide: getRepositoryToken(Room), useValue: roomRepo },
      { provide: getRepositoryToken(Ward), useValue: wardRepo },
    ],
  }).compile();
}

describe('BedOccupancyService', () => {
  describe('createWard', () => {
    it('creates and returns a ward', async () => {
      const mod = await buildModule();
      const svc = mod.get(BedOccupancyService);
      const result = await svc.createWard({ name: 'Ward A' });
      expect(result).toMatchObject({ name: 'Ward A' });
    });
  });

  describe('createRoom', () => {
    it('throws NotFoundException when ward not found', async () => {
      const mod = await buildModule(makeBed(), makeRoom(), null);
      const svc = mod.get(BedOccupancyService);
      await expect(svc.createRoom({ wardId: 'w1', roomNumber: '101' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('creates a room when ward exists', async () => {
      const mod = await buildModule();
      const svc = mod.get(BedOccupancyService);
      const result = await svc.createRoom({ wardId: 'w1', roomNumber: '101' });
      expect(result).toMatchObject({ wardId: 'w1', roomNumber: '101' });
    });
  });

  describe('createBed', () => {
    it('throws NotFoundException when room not found', async () => {
      const mod = await buildModule(makeBed(), null);
      const svc = mod.get(BedOccupancyService);
      await expect(svc.createBed({ bedNumber: '1A', roomId: 'r1' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('creates a bed when room exists', async () => {
      const mod = await buildModule();
      const svc = mod.get(BedOccupancyService);
      const result = await svc.createBed({ bedNumber: '1A', roomId: 'r1' });
      expect(result).toMatchObject({ bedNumber: '1A', roomId: 'r1' });
    });
  });

  describe('assignBed', () => {
    it('assigns an available bed to a patient', async () => {
      const mod = await buildModule();
      const svc = mod.get(BedOccupancyService);
      const result = await svc.assignBed({ bedId: 'b1', patientId: 'p1' });
      expect(result.status).toBe(BedStatus.OCCUPIED);
      expect(result.patientId).toBe('p1');
    });

    it('throws BadRequestException when bed is not available', async () => {
      const mod = await buildModule(makeBed({ status: BedStatus.OCCUPIED }));
      const svc = mod.get(BedOccupancyService);
      await expect(svc.assignBed({ bedId: 'b1', patientId: 'p1' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when bed not found', async () => {
      const mod = await buildModule(null);
      const svc = mod.get(BedOccupancyService);
      await expect(svc.assignBed({ bedId: 'b1', patientId: 'p1' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('releaseBed', () => {
    it('releases an occupied bed to cleaning status', async () => {
      const mod = await buildModule(makeBed({ status: BedStatus.OCCUPIED, patientId: 'p1' }));
      const svc = mod.get(BedOccupancyService);
      const result = await svc.releaseBed('b1');
      expect(result.status).toBe(BedStatus.CLEANING);
      expect(result.patientId).toBeNull();
    });

    it('throws BadRequestException when bed is not occupied', async () => {
      const mod = await buildModule(makeBed({ status: BedStatus.AVAILABLE }));
      const svc = mod.get(BedOccupancyService);
      await expect(svc.releaseBed('b1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getOccupancySummary', () => {
    it('returns status counts and total', async () => {
      const mod = await buildModule();
      const svc = mod.get(BedOccupancyService);
      const summary = await svc.getOccupancySummary();
      expect(summary[BedStatus.AVAILABLE]).toBe(5);
      expect(summary[BedStatus.OCCUPIED]).toBe(3);
      expect(summary.total).toBe(8);
    });
  });
});
