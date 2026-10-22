// Factory mock must appear before any other imports so Jest hoists it above the real modules
jest.mock('./reports.service', () => ({
  ReportsService: jest.fn().mockImplementation(() => ({
    requestReport: jest.fn().mockResolvedValue({ jobId: 'job-1' }),
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReportScheduleService } from './report-schedule.service';
import { ReportSchedule, ReportFrequency } from './entities/report-schedule.entity';
import { ReportFormat } from './entities/report-job.entity';
import { ReportsService } from './reports.service';

const mockScheduleRepo = () => ({
  create: jest.fn((dto) => ({ ...dto, id: 'schedule-1', unsubscribeToken: 'tok-1' })),
  save: jest.fn((e) => Promise.resolve(e)),
  find: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
});

describe('ReportScheduleService', () => {
  let service: ReportScheduleService;
  let scheduleRepo: ReturnType<typeof mockScheduleRepo>;
  let reportsService: jest.Mocked<ReportsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportScheduleService,
        { provide: getRepositoryToken(ReportSchedule), useFactory: mockScheduleRepo },
        {
          provide: ReportsService,
          useValue: { requestReport: jest.fn().mockResolvedValue({ jobId: 'job-1' }) },
        },
      ],
    }).compile();

    service = module.get(ReportScheduleService);
    scheduleRepo = module.get(getRepositoryToken(ReportSchedule));
    reportsService = module.get(ReportsService) as jest.Mocked<ReportsService>;
  });

  describe('isDue', () => {
    const baseSchedule: ReportSchedule = {
      id: 's1',
      reportType: 'summary',
      format: ReportFormat.PDF,
      recipients: ['admin@example.com'],
      isActive: true,
      unsubscribeToken: 'tok',
      dayOfWeek: null,
      dayOfMonth: null,
      frequency: ReportFrequency.DAILY,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('daily schedule is always due', () => {
      expect(service.isDue({ ...baseSchedule, frequency: ReportFrequency.DAILY }, 3, 15)).toBe(true);
    });

    it('weekly schedule is due on the configured day of week', () => {
      const schedule = { ...baseSchedule, frequency: ReportFrequency.WEEKLY, dayOfWeek: 1 };
      expect(service.isDue(schedule, 1, 15)).toBe(true);
      expect(service.isDue(schedule, 2, 15)).toBe(false);
    });

    it('monthly schedule is due on the configured day of month', () => {
      const schedule = { ...baseSchedule, frequency: ReportFrequency.MONTHLY, dayOfMonth: 15 };
      expect(service.isDue(schedule, 3, 15)).toBe(true);
      expect(service.isDue(schedule, 3, 16)).toBe(false);
    });
  });

  describe('evaluateSchedules', () => {
    it('triggers report generation for a weekly schedule on the correct day', async () => {
      const weeklySchedule: ReportSchedule = {
        id: 'sched-weekly',
        reportType: 'department-summary',
        frequency: ReportFrequency.WEEKLY,
        dayOfWeek: 3, // Wednesday
        dayOfMonth: null,
        recipients: ['dept-head@example.com', 'coo@example.com'],
        format: ReportFormat.PDF,
        isActive: true,
        unsubscribeToken: 'tok-weekly',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      scheduleRepo.find.mockResolvedValue([weeklySchedule]);

      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-07T06:00:00Z')); // Wednesday

      await service.evaluateSchedules();

      expect(reportsService.requestReport).toHaveBeenCalledTimes(2);
      expect(reportsService.requestReport).toHaveBeenCalledWith('dept-head@example.com', ReportFormat.PDF);
      expect(reportsService.requestReport).toHaveBeenCalledWith('coo@example.com', ReportFormat.PDF);

      jest.useRealTimers();
    });

    it('does NOT trigger when the weekly schedule day does not match', async () => {
      const thursdaySchedule: ReportSchedule = {
        id: 'sched-thu',
        reportType: 'weekly-summary',
        frequency: ReportFrequency.WEEKLY,
        dayOfWeek: 4, // Thursday
        dayOfMonth: null,
        recipients: ['manager@example.com'],
        format: ReportFormat.PDF,
        isActive: true,
        unsubscribeToken: 'tok-thu',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      scheduleRepo.find.mockResolvedValue([thursdaySchedule]);

      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-07T06:00:00Z')); // Wednesday

      await service.evaluateSchedules();

      expect(reportsService.requestReport).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('unsubscribe', () => {
    it('removes a recipient and saves the updated schedule', async () => {
      const schedule: ReportSchedule = {
        id: 's1',
        reportType: 'summary',
        frequency: ReportFrequency.WEEKLY,
        dayOfWeek: 1,
        dayOfMonth: null,
        recipients: ['a@example.com', 'b@example.com'],
        format: ReportFormat.PDF,
        isActive: true,
        unsubscribeToken: 'tok-abc',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      scheduleRepo.findOne.mockResolvedValue(schedule);

      const result = await service.unsubscribe('tok-abc', 'a@example.com');

      expect(schedule.recipients).toEqual(['b@example.com']);
      expect(scheduleRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ recipients: ['b@example.com'] }),
      );
      expect(result.message).toContain('a@example.com');
    });

    it('marks schedule inactive when the last recipient unsubscribes', async () => {
      const schedule: ReportSchedule = {
        id: 's1',
        reportType: 'summary',
        frequency: ReportFrequency.WEEKLY,
        dayOfWeek: 1,
        dayOfMonth: null,
        recipients: ['solo@example.com'],
        format: ReportFormat.PDF,
        isActive: true,
        unsubscribeToken: 'tok-solo',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      scheduleRepo.findOne.mockResolvedValue(schedule);

      await service.unsubscribe('tok-solo', 'solo@example.com');

      expect(schedule.isActive).toBe(false);
    });
  });
});
