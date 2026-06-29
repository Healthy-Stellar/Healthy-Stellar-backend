import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { MedicalStaffService } from './medical-staff.service';
import { Doctor, SpecializationType, StaffStatus, LicenseStatus } from './entities/doctor.entity';
import { Department } from './entities/department.entity';
import { Specialty } from './entities/specialty.entity';
import { Schedule } from './entities/schedule.entity';
import { PerformanceMetric } from './entities/performance-metric.entity';
import { ContinuingEducation } from './entities/continuing-education.entity';
import { Shift, ShiftRole } from './entities/shift.entity';
import { CreateShiftDto } from './dto/shift.dto';

const STAFF_ID = 'staff-uuid-1';
const WARD_ID = 'ward-uuid-1';

const makeDoctor = (overrides: Partial<Doctor> = {}): Doctor =>
  ({
    id: STAFF_ID,
    specializations: [SpecializationType.CARDIOLOGY],
    status: StaffStatus.ACTIVE,
    licenseStatus: LicenseStatus.ACTIVE,
    schedules: [],
    performanceMetrics: [],
    continuingEducation: [],
    specialties: [],
    ...overrides,
  }) as unknown as Doctor;

const baseShiftDto = (): CreateShiftDto => ({
  staffId: STAFF_ID,
  wardId: WARD_ID,
  role: ShiftRole.SURGEON,
  startTime: '2026-07-01T08:00:00Z',
  endTime: '2026-07-01T16:00:00Z',
});

describe('MedicalStaffService — shift scheduling', () => {
  let service: MedicalStaffService;
  let shiftRepo: {
    createQueryBuilder: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    getOne: jest.Mock;
  };
  let doctorRepo: { findOne: jest.Mock };

  // Helper to wire a chainable QueryBuilder mock
  const makeQb = (result: Shift | null) => {
    const qb: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(result),
      getMany: jest.fn().mockResolvedValue([]),
    };
    return qb;
  };

  beforeEach(async () => {
    doctorRepo = { findOne: jest.fn() };
    shiftRepo = {
      createQueryBuilder: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      getOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedicalStaffService,
        { provide: getRepositoryToken(Doctor), useValue: doctorRepo },
        { provide: getRepositoryToken(Department), useValue: {} },
        { provide: getRepositoryToken(Specialty), useValue: {} },
        { provide: getRepositoryToken(Schedule), useValue: { createQueryBuilder: jest.fn().mockReturnValue(makeQb(null)) } },
        { provide: getRepositoryToken(PerformanceMetric), useValue: {} },
        { provide: getRepositoryToken(ContinuingEducation), useValue: {} },
        { provide: getRepositoryToken(Shift), useValue: shiftRepo },
      ],
    }).compile();

    service = module.get(MedicalStaffService);
  });

  describe('createShift — overlap detection', () => {
    it('creates shift when no overlap exists', async () => {
      const doctor = makeDoctor();
      doctorRepo.findOne.mockResolvedValue(doctor);
      shiftRepo.createQueryBuilder.mockReturnValue(makeQb(null)); // no overlap
      const savedShift = { id: 'shift-1', ...baseShiftDto() } as unknown as Shift;
      shiftRepo.create.mockReturnValue(savedShift);
      shiftRepo.save.mockResolvedValue(savedShift);

      const result = await service.createShift(baseShiftDto());
      expect(result.id).toBe('shift-1');
      expect(shiftRepo.save).toHaveBeenCalled();
    });

    it('rejects shift when same staff member already has an overlapping shift', async () => {
      const doctor = makeDoctor();
      doctorRepo.findOne.mockResolvedValue(doctor);
      const existingShift = {
        id: 'shift-existing',
        startTime: new Date('2026-07-01T06:00:00Z'),
        endTime: new Date('2026-07-01T14:00:00Z'),
      } as unknown as Shift;
      shiftRepo.createQueryBuilder.mockReturnValue(makeQb(existingShift)); // overlap found

      await expect(service.createShift(baseShiftDto())).rejects.toThrow(ConflictException);
      expect(shiftRepo.save).not.toHaveBeenCalled();
    });

    it('prevents double-booking via concurrent requests (two sequential calls, second blocked)', async () => {
      const doctor = makeDoctor();
      doctorRepo.findOne.mockResolvedValue(doctor);

      // First call: no overlap → succeeds
      const savedShift = { id: 'shift-1', startTime: new Date('2026-07-01T08:00:00Z'), endTime: new Date('2026-07-01T16:00:00Z') } as unknown as Shift;
      const qbNoOverlap = makeQb(null);
      qbNoOverlap.save = jest.fn().mockResolvedValue(savedShift);
      shiftRepo.createQueryBuilder.mockReturnValueOnce(qbNoOverlap);
      shiftRepo.create.mockReturnValue(savedShift);
      shiftRepo.save.mockResolvedValueOnce(savedShift);

      await service.createShift(baseShiftDto()); // first booking succeeds

      // Second call: overlap detected (the first shift now exists)
      const qbOverlap = makeQb(savedShift);
      shiftRepo.createQueryBuilder.mockReturnValueOnce(qbOverlap);

      await expect(service.createShift(baseShiftDto())).rejects.toThrow(ConflictException);
      expect(shiftRepo.save).toHaveBeenCalledTimes(1); // only the first save succeeded
    });
  });

  describe('createShift — qualification check', () => {
    it('rejects shift when staff lacks required qualification for the role', async () => {
      // A NURSE specialization trying to take a SURGEON shift — SURGEON requires surgical specializations
      const doctor = makeDoctor({ specializations: [] as any }); // no specializations
      doctorRepo.findOne.mockResolvedValue(doctor);
      shiftRepo.createQueryBuilder.mockReturnValue(makeQb(null));

      const dto = { ...baseShiftDto(), role: ShiftRole.SURGEON };
      await expect(service.createShift(dto)).rejects.toThrow(BadRequestException);
      expect(shiftRepo.save).not.toHaveBeenCalled();
    });

    it('allows shift when staff has a required qualification', async () => {
      const doctor = makeDoctor({ specializations: [SpecializationType.CARDIOLOGY] as any });
      doctorRepo.findOne.mockResolvedValue(doctor);
      shiftRepo.createQueryBuilder.mockReturnValue(makeQb(null));
      const savedShift = { id: 'shift-2' } as unknown as Shift;
      shiftRepo.create.mockReturnValue(savedShift);
      shiftRepo.save.mockResolvedValue(savedShift);

      const dto = { ...baseShiftDto(), role: ShiftRole.SURGEON };
      const result = await service.createShift(dto);
      expect(result.id).toBe('shift-2');
    });

    it('allows any staff for NURSE role (no qualification required)', async () => {
      const doctor = makeDoctor({ specializations: [] as any });
      doctorRepo.findOne.mockResolvedValue(doctor);
      shiftRepo.createQueryBuilder.mockReturnValue(makeQb(null));
      const savedShift = { id: 'shift-3' } as unknown as Shift;
      shiftRepo.create.mockReturnValue(savedShift);
      shiftRepo.save.mockResolvedValue(savedShift);

      const dto = { ...baseShiftDto(), role: ShiftRole.NURSE };
      const result = await service.createShift(dto);
      expect(result.id).toBe('shift-3');
    });
  });

  describe('createShift — time validation', () => {
    it('rejects shift where endTime is not after startTime', async () => {
      doctorRepo.findOne.mockResolvedValue(makeDoctor());
      const dto = { ...baseShiftDto(), startTime: '2026-07-01T16:00:00Z', endTime: '2026-07-01T08:00:00Z' };
      await expect(service.createShift(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getStaffWeeklySchedule', () => {
    it('returns shifts for the given week', async () => {
      const shifts = [{ id: 'shift-w1' }] as unknown as Shift[];
      const qb = makeQb(null);
      qb.getMany.mockResolvedValue(shifts);
      shiftRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getStaffWeeklySchedule(STAFF_ID, '2026-06-30');
      expect(result).toEqual(shifts);
    });
  });

  describe('getWardShifts', () => {
    it('returns all active shifts for a ward in the given week', async () => {
      const shifts = [{ id: 'ward-shift-1' }] as unknown as Shift[];
      const qb = makeQb(null);
      qb.getMany.mockResolvedValue(shifts);
      shiftRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getWardShifts(WARD_ID, '2026-06-30');
      expect(result).toEqual(shifts);
    });
  });
});
