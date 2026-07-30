import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { WaitlistService } from './waitlist.service';
import { AppointmentWaitlist, WaitlistStatus } from '../entities/appointment-waitlist.entity';
import { Appointment, AppointmentStatus, AppointmentType, MedicalPriority } from '../entities/appointment.entity';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
});

const makeAppointment = (overrides: Partial<Appointment> = {}): Appointment =>
  ({
    id: 'appt-1',
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaitlistService,
        { provide: getRepositoryToken(AppointmentWaitlist), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(WaitlistService);
    repo = module.get(getRepositoryToken(AppointmentWaitlist));
  });

  describe('join', () => {
    it('creates a WAITING entry', async () => {
      const entry: Partial<AppointmentWaitlist> = {
        id: 'wl-1',
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
        expect.objectContaining({ patientId: 'p1', doctorId: 'doc-1', status: WaitlistStatus.WAITING }),
      );
      expect(result.status).toBe(WaitlistStatus.WAITING);
    });
  });

  describe('leave', () => {
    it('sets status to CANCELLED', async () => {
      const entry = { id: 'wl-1', patientId: 'p1', status: WaitlistStatus.WAITING };
      repo.findOne.mockResolvedValue(entry);
      repo.save.mockResolvedValue({ ...entry, status: WaitlistStatus.CANCELLED });

      await service.leave('p1', 'wl-1');

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
});
