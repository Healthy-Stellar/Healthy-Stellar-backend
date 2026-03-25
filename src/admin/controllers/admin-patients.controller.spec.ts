import { Test, TestingModule } from '@nestjs/testing';
import { AdminPatientsController } from './admin-patients.controller';
import { PatientsService } from '../../patients/patients.service';
import { AdminMergePatientsDto } from '../../patients/dto/admin-merge-patients.dto';

describe('AdminPatientsController', () => {
  let controller: AdminPatientsController;
  let patientsService: PatientsService;

  const mockPatientsService = {
    adminMergePatients: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminPatientsController],
      providers: [
        {
          provide: PatientsService,
          useValue: mockPatientsService,
        },
      ],
    }).compile();

    controller = module.get<AdminPatientsController>(AdminPatientsController);
    patientsService = module.get<PatientsService>(PatientsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('mergePatients', () => {
    it('should call patientService.adminMergePatients with the correct DTO and admin ID', async () => {
      const mergeDto: AdminMergePatientsDto = {
        primaryAddress: 'primary-uuid',
        secondaryAddress: 'secondary-uuid',
        reason: 'Duplicate record',
      };

      const req: any = {
        user: { id: 'admin-uuid' },
      };

      const expectedResult = { id: 'primary-uuid', firstName: 'John' };
      mockPatientsService.adminMergePatients.mockResolvedValue(expectedResult);

      const result = await controller.mergePatients(mergeDto, req);

      expect(patientsService.adminMergePatients).toHaveBeenCalledWith(mergeDto, 'admin-uuid');
      expect(result).toEqual(expectedResult);
    });
  });
});
