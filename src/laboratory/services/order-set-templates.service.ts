import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderSetTemplate } from '../entities/order-set-template.entity';
import { OrderSetTemplateItem } from '../entities/order-set-template-item.entity';
import { LabOrder } from '../entities/lab-order.entity';
import { LabOrderItem } from '../entities/lab-order-item.entity';
import { LabTest } from '../entities/lab-test.entity';
import {
  CreateOrderSetTemplateDto,
  UpdateOrderSetTemplateDto,
} from '../dto/create-order-set-template.dto';
import { OrderFromTemplateDto } from '../dto/order-from-template.dto';
import { Between } from 'typeorm';

const STARTER_TEMPLATES = [
  {
    name: 'Complete Blood Count (CBC)',
    description: 'Standard CBC panel: WBC, RBC, Hemoglobin, Hematocrit, Platelet count, MCV, MCH, MCHC',
    isSystemTemplate: true,
    testCodes: ['CBC-WBC', 'CBC-RBC', 'CBC-HGB', 'CBC-HCT', 'CBC-PLT', 'CBC-MCV', 'CBC-MCH', 'CBC-MCHC'],
  },
  {
    name: 'Basic Metabolic Panel (BMP)',
    description: 'Glucose, calcium, sodium, potassium, CO2, chloride, BUN, creatinine',
    isSystemTemplate: true,
    testCodes: ['BMP-GLU', 'BMP-CA', 'BMP-NA', 'BMP-K', 'BMP-CO2', 'BMP-CL', 'BMP-BUN', 'BMP-CR'],
  },
  {
    name: 'Lipid Panel',
    description: 'Total cholesterol, HDL, LDL, triglycerides',
    isSystemTemplate: true,
    testCodes: ['LIPID-TC', 'LIPID-HDL', 'LIPID-LDL', 'LIPID-TG'],
  },
];

@Injectable()
export class OrderSetTemplatesService implements OnModuleInit {
  private readonly logger = new Logger(OrderSetTemplatesService.name);

  constructor(
    @InjectRepository(OrderSetTemplate)
    private templateRepository: Repository<OrderSetTemplate>,
    @InjectRepository(OrderSetTemplateItem)
    private templateItemRepository: Repository<OrderSetTemplateItem>,
    @InjectRepository(LabOrder)
    private labOrderRepository: Repository<LabOrder>,
    @InjectRepository(LabOrderItem)
    private orderItemRepository: Repository<LabOrderItem>,
    @InjectRepository(LabTest)
    private labTestRepository: Repository<LabTest>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedStarterTemplates();
  }

  private async seedStarterTemplates(): Promise<void> {
    for (const seed of STARTER_TEMPLATES) {
      const existing = await this.templateRepository.findOne({
        where: { name: seed.name, isSystemTemplate: true },
      });
      if (existing) continue;

      const tests = await this.labTestRepository.find({
        where: seed.testCodes.map((code) => ({ testCode: code })),
      });

      if (tests.length === 0) {
        this.logger.debug(`Skipping seeding "${seed.name}" — no matching lab tests found`);
        continue;
      }

      const template = this.templateRepository.create({
        name: seed.name,
        description: seed.description,
        isSystemTemplate: true,
        isActive: true,
        items: tests.map((t) =>
          this.templateItemRepository.create({ labTestId: t.id }),
        ),
      });

      await this.templateRepository.save(template);
      this.logger.log(`Seeded system order-set template: ${seed.name}`);
    }
  }

  async create(dto: CreateOrderSetTemplateDto, userId: string): Promise<OrderSetTemplate> {
    const items = dto.items.map((itemDto) =>
      this.templateItemRepository.create({
        labTestId: itemDto.labTestId,
        notes: itemDto.notes,
      }),
    );

    const template = this.templateRepository.create({
      name: dto.name,
      description: dto.description,
      tenantId: dto.tenantId,
      departmentId: dto.departmentId,
      isActive: true,
      isSystemTemplate: false,
      createdBy: userId,
      items,
    });

    const saved = await this.templateRepository.save(template);
    this.logger.log(`Created order-set template: ${saved.id} (${saved.name})`);
    return saved;
  }

  async findAll(filters?: {
    tenantId?: string;
    departmentId?: string;
    includeSystem?: boolean;
  }): Promise<OrderSetTemplate[]> {
    const qb = this.templateRepository
      .createQueryBuilder('template')
      .leftJoinAndSelect('template.items', 'items')
      .where('template.isActive = true');

    if (filters?.tenantId) {
      qb.andWhere(
        '(template.tenantId = :tenantId OR template.tenantId IS NULL)',
        { tenantId: filters.tenantId },
      );
    }

    if (filters?.departmentId) {
      qb.andWhere(
        '(template.departmentId = :departmentId OR template.departmentId IS NULL)',
        { departmentId: filters.departmentId },
      );
    }

    if (filters?.includeSystem === false) {
      qb.andWhere('template.isSystemTemplate = false');
    }

    return qb.orderBy('template.name', 'ASC').getMany();
  }

  async findOne(id: string): Promise<OrderSetTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id },
      relations: ['items'],
    });

    if (!template) {
      throw new NotFoundException(`Order-set template ${id} not found`);
    }

    return template;
  }

  async update(
    id: string,
    dto: UpdateOrderSetTemplateDto,
  ): Promise<OrderSetTemplate> {
    const template = await this.findOne(id);

    if (template.isSystemTemplate) {
      throw new BadRequestException('System templates cannot be edited');
    }

    if (dto.name !== undefined) template.name = dto.name;
    if (dto.description !== undefined) template.description = dto.description;
    if (dto.departmentId !== undefined) template.departmentId = dto.departmentId;

    if (dto.items !== undefined) {
      await this.templateItemRepository.delete({ templateId: id });
      template.items = dto.items.map((itemDto) =>
        this.templateItemRepository.create({
          templateId: id,
          labTestId: itemDto.labTestId,
          notes: itemDto.notes,
        }),
      );
    }

    return this.templateRepository.save(template);
  }

  async orderFromTemplate(
    dto: OrderFromTemplateDto,
    userId: string,
  ): Promise<LabOrder> {
    const template = await this.findOne(dto.templateId);

    if (!template.isActive) {
      throw new BadRequestException(`Template "${template.name}" is not active`);
    }

    if (template.items.length === 0) {
      throw new BadRequestException(`Template "${template.name}" has no tests`);
    }

    const orderNumber = await this.generateOrderNumber();

    const orderItems = template.items.map((item) =>
      this.orderItemRepository.create({
        labTestId: item.labTestId,
        notes: item.notes,
      }),
    );

    const labOrder = this.labOrderRepository.create({
      orderNumber,
      patientId: dto.patientId,
      providerId: dto.orderingProviderId,
      priority: dto.priority ?? 'routine',
      orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
      clinicalInfo: dto.clinicalIndication,
      notes: dto.encounterId
        ? `encounterId:${dto.encounterId}`
        : undefined,
      tests: template.items.map((item) => ({
        testId: item.labTestId,
        testCode: '',
        testName: '',
        sourceTemplateName: template.name,
      })),
      items: orderItems,
    } as any);

    const saved = await this.labOrderRepository.save(labOrder);
    this.logger.log(
      `Lab order ${saved.orderNumber} created from template "${template.name}" (${template.items.length} tests)`,
    );

    return saved;
  }

  private async generateOrderNumber(): Promise<string> {
    const date = new Date();
    const prefix = `LAB-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const count = await this.labOrderRepository.count({
      where: { orderDate: Between(startOfDay, endOfDay) },
    });

    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }
}
