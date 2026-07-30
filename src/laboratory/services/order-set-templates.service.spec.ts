import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderSetTemplatesService } from './order-set-templates.service';
import { OrderSetTemplate } from '../entities/order-set-template.entity';
import { OrderSetTemplateItem } from '../entities/order-set-template-item.entity';
import { LabOrder } from '../entities/lab-order.entity';
import { LabOrderItem } from '../entities/lab-order-item.entity';
import { LabTest } from '../entities/lab-test.entity';

const makeRepo = (overrides: Partial<any> = {}) => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  findByIds: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockImplementation((x) => x),
  save: jest.fn().mockImplementation((x) => Promise.resolve({ id: 'saved-id', ...x })),
  count: jest.fn().mockResolvedValue(0),
  delete: jest.fn().mockResolvedValue({}),
  createQueryBuilder: jest.fn().mockReturnValue({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  }),
  ...overrides,
});

describe('OrderSetTemplatesService', () => {
  let service: OrderSetTemplatesService;
  let templateRepo: ReturnType<typeof makeRepo>;
  let labOrderRepo: ReturnType<typeof makeRepo>;
  let orderItemRepo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    templateRepo = makeRepo();
    const templateItemRepo = makeRepo();
    labOrderRepo = makeRepo();
    orderItemRepo = makeRepo();
    const labTestRepo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderSetTemplatesService,
        { provide: getRepositoryToken(OrderSetTemplate), useValue: templateRepo },
        { provide: getRepositoryToken(OrderSetTemplateItem), useValue: templateItemRepo },
        { provide: getRepositoryToken(LabOrder), useValue: labOrderRepo },
        { provide: getRepositoryToken(LabOrderItem), useValue: orderItemRepo },
        { provide: getRepositoryToken(LabTest), useValue: labTestRepo },
      ],
    }).compile();

    service = module.get<OrderSetTemplatesService>(OrderSetTemplatesService);
    jest.spyOn(service, 'onModuleInit').mockResolvedValue(undefined);
  });

  describe('create', () => {
    it('creates a template with items', async () => {
      const dto = {
        name: 'CBC',
        items: [{ labTestId: 'test-1' }, { labTestId: 'test-2' }],
      };

      const result = await service.create(dto as any, 'user-1');

      expect(templateRepo.save).toHaveBeenCalled();
      expect(result).toMatchObject({ name: 'CBC' });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when template does not exist', async () => {
      templateRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('returns the template when found', async () => {
      const template = { id: 't-1', name: 'BMP', items: [] };
      templateRepo.findOne.mockResolvedValue(template);

      const result = await service.findOne('t-1');

      expect(result).toEqual(template);
    });
  });

  describe('orderFromTemplate', () => {
    it('creates a lab order expanding all template items linked to the encounter', async () => {
      const template = {
        id: 'tmpl-1',
        name: 'Lipid Panel',
        isActive: true,
        items: [
          { labTestId: 'lt-1', notes: null },
          { labTestId: 'lt-2', notes: null },
          { labTestId: 'lt-3', notes: null },
          { labTestId: 'lt-4', notes: null },
        ],
      };

      templateRepo.findOne.mockResolvedValue(template);
      labOrderRepo.count.mockResolvedValue(0);

      const dto = {
        templateId: 'tmpl-1',
        patientId: 'patient-1',
        patientName: 'John Doe',
        orderingProviderId: 'provider-1',
        orderingProviderName: 'Dr. Smith',
        encounterId: 'enc-123',
        priority: 'routine',
      };

      const result = await service.orderFromTemplate(dto as any, 'user-1');

      expect(labOrderRepo.save).toHaveBeenCalled();
      const savedOrder = labOrderRepo.save.mock.calls[0][0];
      expect(savedOrder.items).toHaveLength(4);
      expect(savedOrder.tests[0]).toMatchObject({ testId: expect.any(String) });
    });

    it('throws BadRequestException when template is inactive', async () => {
      templateRepo.findOne.mockResolvedValue({
        id: 't-2',
        name: 'Old Panel',
        isActive: false,
        items: [],
      });

      await expect(
        service.orderFromTemplate({ templateId: 't-2' } as any, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when template has no items', async () => {
      templateRepo.findOne.mockResolvedValue({
        id: 't-3',
        name: 'Empty Panel',
        isActive: true,
        items: [],
      });

      await expect(
        service.orderFromTemplate({ templateId: 't-3' } as any, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
