import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportFormat, ReportStatus } from './entities/report-job.entity';

describe('ReportsController', () => {
    let controller: ReportsController;
    let reportsService: jest.Mocked<Partial<ReportsService>>;

    beforeEach(async () => {
        reportsService = {
            requestReport: jest.fn(),
            getJobStatus: jest.fn(),
            downloadReport: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [ReportsController],
            providers: [
                {
                    provide: ReportsService,
                    useValue: reportsService,
                },
            ],
        }).compile();

        controller = module.get<ReportsController>(ReportsController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('generateReport', () => {
        it('should queue report generation', async () => {
            const mockReq: any = { user: { id: 'patient-123' } };
            const expectedResponse = { jobId: 'job-1', estimatedTime: '2-5 minutes' };

            reportsService.requestReport.mockResolvedValue(expectedResponse as any);

            const result = await controller.generateReport(mockReq, ReportFormat.PDF);

            expect(reportsService.requestReport).toHaveBeenCalledWith('patient-123', ReportFormat.PDF);
            expect(result).toEqual(expectedResponse);
        });
    });

    describe('getJobStatus', () => {
        it('should return job status', async () => {
            const mockReq: any = { user: { id: 'patient-123' } };
            const expectedResponse = { status: ReportStatus.COMPLETED, downloadUrl: 'http://link' };

            reportsService.getJobStatus.mockResolvedValue(expectedResponse as any);

            const result = await controller.getJobStatus(mockReq, 'job-1');

            expect(reportsService.getJobStatus).toHaveBeenCalledWith('job-1', 'patient-123');
            expect(result).toEqual(expectedResponse);
        });
    });
});
