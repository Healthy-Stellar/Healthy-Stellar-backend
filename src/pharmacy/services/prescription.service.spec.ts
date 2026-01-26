import { Test, TestingModule } from '@nestjs/testing';
import { PrescriptionService } from './prescription.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Prescription } from '../entities/prescription.entity';

describe('PrescriptionService', () => {
  let service: PrescriptionService;
  let mockPrescriptionRepository;

  beforeEach(async () => {
    mockPrescriptionRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrescriptionService,
        {
          provide: getRepositoryToken(Prescription),
          useValue: mockPrescriptionRepository,
        },
        // Mock other dependencies
      ],
    }).compile();

    service = module.get<PrescriptionService>(PrescriptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Add more tests...
});