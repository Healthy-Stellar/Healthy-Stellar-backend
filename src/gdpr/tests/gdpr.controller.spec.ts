import { Test, TestingModule } from '@nestjs/testing';
import { GdprController } from '../controllers/gdpr.controller';
import { GdprService } from '../services/gdpr.service';
import { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ThrottlerBehindProxyGuard } from '../../common/throttler/throttler-behind-proxy.guard';
import { GdprRequestType, GdprRequestStatus, GdprRequest } from '../entities/gdpr-request.entity';
import { CreateErasureRequestDto } from '../dto/create-erasure-request.dto';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('GdprController', () => {
  let controller: GdprController;
  let service: GdprService;

  const mockGdprService = {
    createExportRequest: jest.fn().mockResolvedValue({
      id: '1',
      type: GdprRequestType.EXPORT,
      status: GdprRequestStatus.PENDING,
    }),
    createErasureRequest: jest.fn().mockResolvedValue({
      id: '2',
      type: GdprRequestType.ERASURE,
      status: GdprRequestStatus.PENDING,
    }),
    getRequestsByUser: jest.fn().mockResolvedValue([{ id: '1' }]),
  };

  const mockGdprRequestRepository = {
    findOne: jest.fn().mockResolvedValue(null),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GdprController],
      providers: [
        {
          provide: GdprService,
          useValue: mockGdprService,
        },
        {
          provide: getRepositoryToken(GdprRequest),
          useValue: mockGdprRequestRepository,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => true,
      })
      .overrideGuard(ThrottlerBehindProxyGuard)
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
      const payload: CreateErasureRequestDto = {
        patientId: 'patient-1',
        requestorIdentity: 'operator-1',
      };
      const res = await controller.requestErasure(req, payload);
      expect(mockGdprService.createErasureRequest).toHaveBeenCalledWith('user1', payload);
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
