import { Test, TestingModule } from '@nestjs/testing';
import { GdprController } from '../controllers/gdpr.controller';
import { GdprService } from '../services/gdpr.service';
import { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GdprRequestType, GdprRequestStatus } from '../entities/gdpr-request.entity';

describe('GdprController', () => {
    let controller: GdprController;
    let service: GdprService;

    const mockGdprService = {
        createExportRequest: jest.fn().mockResolvedValue({ id: '1', type: GdprRequestType.EXPORT, status: GdprRequestStatus.PENDING }),
        createErasureRequest: jest.fn().mockResolvedValue({ id: '2', type: GdprRequestType.ERASURE, status: GdprRequestStatus.PENDING }),
        getRequestsByUser: jest.fn().mockResolvedValue([{ id: '1' }]),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [GdprController],
            providers: [
                {
                    provide: GdprService,
                    useValue: mockGdprService,
                },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({
                canActivate: (context: ExecutionContext) => true,
            })
            .compile();

        controller = module.get<GdprController>(GdprController);
        service = module.get<GdprService>(GdprService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('requestDataExport', () => {
        it('should call gdprService.createExportRequest', async () => {
            const req = { user: { id: 'user1' } };
            const res = await controller.requestDataExport(req);
            expect(mockGdprService.createExportRequest).toHaveBeenCalledWith('user1');
            expect(res.id).toEqual('1');
        });
    });

    describe('requestErasure', () => {
        it('should call gdprService.createErasureRequest', async () => {
            const req = { user: { id: 'user1' } };
            const res = await controller.requestErasure(req);
            expect(mockGdprService.createErasureRequest).toHaveBeenCalledWith('user1');
            expect(res.id).toEqual('2');
        });
    });

    describe('getRequests', () => {
        it('should return list of requests for the user', async () => {
            const req = { user: { id: 'user1' } };
            const res = await controller.getRequests(req);
            expect(mockGdprService.getRequestsByUser).toHaveBeenCalledWith('user1');
            expect(res.length).toBe(1);
        });
    });
});
