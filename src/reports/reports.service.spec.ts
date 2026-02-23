import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReportJob, ReportFormat, ReportStatus } from './entities/report-job.entity';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/services/notifications.service';
import { EntityManager } from 'typeorm';

jest.mock('ipfs-http-client', () => ({
    create: jest.fn().mockReturnValue({
        add: jest.fn().mockResolvedValue({ path: 'mock-hash' }),
        cat: jest.fn(),
    }),
}), { virtual: true });

describe('ReportsService', () => {
    let service: ReportsService;
    let mockReportJobRepo;
    let mockEntityManager;
    let mockConfigService;
    let mockNotificationsService;

    beforeEach(async () => {
        mockReportJobRepo = {
            create: jest.fn().mockImplementation(dto => ({ id: 'mock-job-id', ...dto })),
            save: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
            findOne: jest.fn(),
            update: jest.fn(),
        };

        mockEntityManager = {
            findOne: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
        };

        mockConfigService = {
            get: jest.fn().mockReturnValue('http://localhost:3000'),
        };

        mockNotificationsService = {
            sendEmail: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ReportsService,
                {
                    provide: getRepositoryToken(ReportJob),
                    useValue: mockReportJobRepo,
                },
                {
                    provide: EntityManager,
                    useValue: mockEntityManager,
                },
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
                {
                    provide: NotificationsService,
                    useValue: mockNotificationsService,
                },
            ],
        }).compile();

        service = module.get<ReportsService>(ReportsService);

        // Silence the background logger during tests
        jest.spyOn(service['logger'], 'error').mockImplementation(() => { });
        jest.spyOn(service['logger'], 'log').mockImplementation(() => { });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('requestReport', () => {
        it('should create and save a new PENDING job', async () => {
            const result = await service.requestReport('patient-123', ReportFormat.CSV);

            expect(mockReportJobRepo.create).toHaveBeenCalledWith({
                patientId: 'patient-123',
                format: ReportFormat.CSV,
                status: ReportStatus.PENDING,
            });
            expect(mockReportJobRepo.save).toHaveBeenCalled();
            expect(result).toHaveProperty('jobId', 'mock-job-id');
            expect(result).toHaveProperty('estimatedTime');
        });
    });

    describe('getJobStatus', () => {
        it('should return not found if job does not exist', async () => {
            mockReportJobRepo.findOne.mockResolvedValue(null);
            await expect(service.getJobStatus('job-1', 'patient-123')).rejects.toThrow('Report job not found');
        });

        it('should return status only if not completed', async () => {
            mockReportJobRepo.findOne.mockResolvedValue({ id: 'job-1', status: ReportStatus.PROCESSING });
            const result = await service.getJobStatus('job-1', 'patient-123');
            expect(result).toEqual({ status: ReportStatus.PROCESSING });
        });

        it('should return download url if completed and not expired', async () => {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 1); // future

            mockReportJobRepo.findOne.mockResolvedValue({
                id: 'job-1',
                status: ReportStatus.COMPLETED,
                downloadToken: 'xyz-token',
                expiresAt,
            });

            const result = await service.getJobStatus('job-1', 'patient-123');
            expect(result).toHaveProperty('status', ReportStatus.COMPLETED);
            expect(result).toHaveProperty('downloadUrl');
            expect(result.downloadUrl).toContain('token=xyz-token');
        });

        it('should throw error if completed but expired', async () => {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() - 1); // past

            mockReportJobRepo.findOne.mockResolvedValue({
                id: 'job-1',
                status: ReportStatus.COMPLETED,
                downloadToken: 'xyz-token',
                expiresAt,
            });

            await expect(service.getJobStatus('job-1', 'patient-123')).rejects.toThrow('Download link has expired');
        });
    });
});
