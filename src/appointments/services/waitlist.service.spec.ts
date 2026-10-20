import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { WaitlistService } from './waitlist.service';
import { AppointmentWaitlist, WaitlistStatus } from '../entities/appointment-waitlist.entity';
import { Appointment, AppointmentStatus, AppointmentType, MedicalPriority } from '../entities/appointment.entity';
import { TenantContext } from '../../common/context/tenant.context';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
});

const makeAppointment = (overrides: Partial<Appointment> = {}): Appointment =>
  ({
    id: 'appt-1',
    tenantId: 'tenant-1',
    doctorId: 'doc-1',
    patientId: 'patient-1',
    appointmentDate: new Date('2026-08-10T09:00:00Z'),
    status: AppointmentStatus.CANCELLED,
    type: AppointmentType.ROUTINE,
    priority: MedicalPriority.NORMAL,
    duration: 30,
    ...overrides,
  } as Appointment);

describe('WaitlistService', () => {
  let service: WaitlistService;
  let repo: ReturnType<typeof mockRepo>;
  let appointmentRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaitlistService,
        { provide: getRepositoryToken(AppointmentWaitlist), useFactory: mockRepo },
        { provide: getRepositoryToken(Appointment), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(WaitlistService);
    repo = module.get(getRepositoryToken(AppointmentWaitlist));
    appointmentRepo = module.get(getRepositoryToken(Appointment));

    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('join', () => {
    it('creates a WAITING entry scoped to the current tenant', async () => {
      const entry: Partial<AppointmentWaitlist> = {
        id: 'wl-1',
        tenantId: 'tenant-1',
        patientId: 'p1',
        doctorId: 'doc-1',
        status: WaitlistStatus.WAITING,
        responseWindowMinutes: 30,
      };
      repo.create.mockReturnValue(entry);
      repo.save.mockResolvedValue(entry);

      const result = await service.join('p1', {
        doctorId: 'doc-1',
        preferredDateStart: '2026-08-01T00:00:00Z',
        preferredDateEnd: '2026-08-31T00:00:00Z',
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          patientId: 'p1',
          doctorId: 'doc-1',
          status: WaitlistStatus.WAITING,
        }),
      );
      expect(result.status).toBe(WaitlistStatus.WAITING);
    });
  });

  describe('leave', () => {
    it('sets status to CANCELLED', async () => {
      const entry = { id: 'wl-1', tenantId: 'tenant-1', patientId: 'p1', status: WaitlistStatus.WAITING };
      repo.findOne.mockResolvedValue(entry);
      repo.save.mockResolvedValue({ ...entry, status: WaitlistStatus.CANCELLED });

      await service.leave('p1', 'wl-1');

      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-1' }) }),
      );
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ status: WaitlistStatus.CANCELLED }));
    });

    it('throws NotFoundException when entry not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.leave('p1', 'wl-missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('notifyNextEligible', () => {
    it('notifies the earliest waiting patient and returns the entry', async () => {
      const candidate: Partial<AppointmentWaitlist> = {
        id: 'wl-2',
        tenantId: 'tenant-1',
        patientId: 'p2',
        doctorId: 'doc-1',
        status: WaitlistStatus.WAITING,
        preferredDateStart: new Date('2026-08-01T00:00:00Z'),
        preferredDateEnd: new Date('2026-08-31T00:00:00Z'),
        responseWindowMinutes: 30,
      };
      // No stale NOTIFIED entries
      repo.find
        .mockResolvedValueOnce([]) // expireStaleOffers: NOTIFIED entries
        .mockResolvedValueOnce([candidate]); // eligible candidates
      repo.save.mockResolvedValue({ ...candidate, status: WaitlistStatus.NOTIFIED, offeredAppointmentId: 'appt-1' });

      const result = await service.notifyNextEligible(makeAppointment());

      expect(result).not.toBeNull();
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: WaitlistStatus.NOTIFIED, offeredAppointmentId: 'appt-1' }),
      );
    });

    it('scopes candidate lookup to the appointment tenant', async () => {
      repo.find.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await service.notifyNextEligible(makeAppointment({ tenantId: 'tenant-1' }));

      // Both the stale-offer scan and the candidate lookup must be tenant-scoped.
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-1' }) }),
      );
    });

    it('returns null when no candidates are waiting', async () => {
      repo.find
        .mockResolvedValueOnce([]) // stale check
        .mockResolvedValueOnce([]); // no candidates

      const result = await service.notifyNextEligible(makeAppointment());
      expect(result).toBeNull();
    });

    it('expires stale NOTIFIED entries before searching candidates', async () => {
      const stale: Partial<AppointmentWaitlist> = {
        id: 'wl-stale',
        tenantId: 'tenant-1',
        status: WaitlistStatus.NOTIFIED,
        notifiedAt: new Date(Date.now() - 2 * 60 * 60_000), // 2 hours ago
        responseWindowMinutes: 30,
      };
      repo.find
        .mockResolvedValueOnce([stale]) // stale entries
        .mockResolvedValueOnce([]); // no new candidates
      repo.save.mockResolvedValue({ ...stale, status: WaitlistStatus.EXPIRED });

      await service.notifyNextEligible(makeAppointment());

      expect(repo.save).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ status: WaitlistStatus.EXPIRED })]),
      );
    });
  });

  describe('expireStaleOffers', () => {
    it('returns the expired entries so the caller can re-offer their slots', async () => {
      const stale: Partial<AppointmentWaitlist> = {
        id: 'wl-stale',
        tenantId: 'tenant-1',
        status: WaitlistStatus.NOTIFIED,
        offeredAppointmentId: 'appt-1',
        notifiedAt: new Date(Date.now() - 2 * 60 * 60_000),
        responseWindowMinutes: 30,
      };
      repo.find.mockResolvedValueOnce([stale]);
      repo.save.mockImplementation(async (entities) => entities);

      const expired = await service.expireStaleOffers();

      expect(expired).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'wl-stale', status: WaitlistStatus.EXPIRED }),
        ]),
      );
    });

    it('cascades an expired offer to the second candidate for the same slot', async () => {
      const stale: Partial<AppointmentWaitlist> = {
        id: 'wl-first',
        tenantId: 'tenant-1',
        patientId: 'p1',
        doctorId: 'doc-1',
        status: WaitlistStatus.NOTIFIED,
        offeredAppointmentId: 'appt-1',
        notifiedAt: new Date(Date.now() - 2 * 60 * 60_000),
        responseWindowMinutes: 30,
      };
      const second: Partial<AppointmentWaitlist> = {
        id: 'wl-second',
        tenantId: 'tenant-1',
        patientId: 'p2',
        doctorId: 'doc-1',
        status: WaitlistStatus.WAITING,
        preferredDateStart: new Date('2026-08-01T00:00:00Z'),
        preferredDateEnd: new Date('2026-08-31T00:00:00Z'),
        responseWindowMinutes: 30,
      };

      // expireStaleOffers: stale NOTIFIED entries
      repo.find.mockResolvedValueOnce([stale]);
      // notifyNextEligible: no further stale entries, then the second candidate
      repo.find.mockResolvedValueOnce([]).mockResolvedValueOnce([second]);
      repo.save.mockImplementation(async (entity) => entity);

      const slot = makeAppointment({
        id: 'appt-1',
        status: AppointmentStatus.CANCELLED,
        appointmentDate: new Date('2026-08-10T09:00:00Z'),
      });
      appointmentRepo.findOne.mockResolvedValue(slot);

      const expired = await service.expireStaleOffers();
      expect(expired).toHaveLength(1);

      const offered = await service.notifyNextEligible(slot);

      expect(offered).not.toBeNull();
      expect(offered?.id).toBe('wl-second');
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'wl-second', status: WaitlistStatus.NOTIFIED, offeredAppointmentId: 'appt-1' }),
      );
    });

    it('skips re-offering a slot that has been booked by other means', async () => {
      const stale: Partial<AppointmentWaitlist> = {
        id: 'wl-stale',
        tenantId: 'tenant-1',
        status: WaitlistStatus.NOTIFIED,
        offeredAppointmentId: 'appt-1',
        notifiedAt: new Date(Date.now() - 2 * 60 * 60_000),
        responseWindowMinutes: 30,
      };
      repo.find.mockResolvedValueOnce([stale]);
      repo.save.mockImplementation(async (entities) => entities);

      // The slot has since been booked by another patient.
      appointmentRepo.findOne.mockResolvedValue(
        makeAppointment({ id: 'appt-1', status: AppointmentStatus.SCHEDULED }),
      );

      const expired = await service.expireStaleOffers();
      expect(expired).toHaveLength(1);

      const offered = await service.notifyNextEligible(
        makeAppointment({ id: 'appt-1', status: AppointmentStatus.SCHEDULED }),
      );

      expect(offered).toBeNull();
    });
  });

  describe('acceptOffer', () => {
    it('accepts offer, books the appointment for the freed slot, and returns the updated entry', async () => {
      const waitlistEntry: Partial<AppointmentWaitlist> = {
        id: 'wl-1',
        tenantId: 'tenant-1',
        patientId: 'patient-1',
        doctorId: 'doc-1',
        status: WaitlistStatus.NOTIFIED,
        offeredAppointmentId: 'appt-cancelled-1',
        notifiedAt: new Date(),
        responseWindowMinutes: 30,
        preferredDateStart: new Date('2026-08-10T09:00:00Z'),
      };

      const cancelledAppointment = makeAppointment({
        id: 'appt-cancelled-1',
        tenantId: 'tenant-1',
        doctorId: 'doc-1',
        appointmentDate: new Date('2026-08-10T09:00:00Z'),
        startTime: new Date('2026-08-10T09:00:00Z'),
        endTime: new Date('2026-08-10T09:30:00Z'),
        duration: 30,
      });

      repo.findOne.mockResolvedValue(waitlistEntry);
      repo.save.mockImplementation(async (entity) => entity);

      appointmentRepo.findOne.mockResolvedValue(cancelledAppointment);
      appointmentRepo.create.mockImplementation((dto) => ({ id: 'new-appt-1', ...dto }));
      appointmentRepo.save.mockImplementation(async (entity) => entity);

      const result = await service.acceptOffer('patient-1', 'wl-1');

      expect(result.status).toBe(WaitlistStatus.ACCEPTED);
      expect(appointmentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          patientId: 'patient-1',
          doctorId: 'doc-1',
          status: AppointmentStatus.SCHEDULED,
        }),
      );
      expect(appointmentRepo.save).toHaveBeenCalled();
    });

    it('throws NotFoundException when no active notified offer exists', async () => {
      repo.find.mockResolvedValue([]);
      repo.findOne.mockResolvedValue(null);

      await expect(service.acceptOffer('patient-1', 'wl-missing')).rejects.toThrow(NotFoundException);
    });
  });
});
