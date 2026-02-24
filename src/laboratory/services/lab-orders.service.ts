import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { LabOrder, OrderStatus } from '../entities/lab-order.entity';
import { LabOrderItem, OrderItemStatus } from '../entities/lab-order-item.entity';
import { CreateLabOrderDto } from '../dto/create-lab-order.dto';
import { UpdateLabOrderDto } from '../dto/update-lab-order.dto';
import { SearchLabOrdersDto } from '../dto/search-lab-orders.dto';

@Injectable()
export class LabOrdersService {
  private readonly logger = new Logger(LabOrdersService.name);

  constructor(
    @InjectRepository(LabOrder)
    private labOrderRepository: Repository<LabOrder>,
    @InjectRepository(LabOrderItem)
    private orderItemRepository: Repository<LabOrderItem>,
  ) {}

  async create(createDto: CreateLabOrderDto, userId: string): Promise<LabOrder> {
    this.logger.log(`Creating lab order for patient: ${createDto.patientId}`);

    // Generate unique order number
    const orderNumber = await this.generateOrderNumber();

    const labOrder = this.labOrderRepository.create({
      ...createDto,
      orderNumber,
      orderDate: createDto.orderDate ? new Date(createDto.orderDate) : new Date(),
      createdBy: userId,
      updatedBy: userId,
    });

    // Create order items
    if (createDto.items && createDto.items.length > 0) {
      labOrder.items = createDto.items.map((itemDto) =>
        this.orderItemRepository.create({
          ...itemDto,
          createdBy: userId,
          updatedBy: userId,
        }),
      );
    }

    const saved = await this.labOrderRepository.save(labOrder);
    this.logger.log(`Lab order created: ${saved.id} (${saved.orderNumber})`);

    return this.findOne(saved.id);
  }

  async findAll(searchDto: SearchLabOrdersDto): Promise<{
    data: LabOrder[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = searchDto.page || 1;
    const limit = searchDto.limit || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.labOrderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.labTest', 'labTest')
      .leftJoinAndSelect('order.specimens', 'specimens')
      .orderBy('order.orderDate', 'DESC')
      .skip(skip)
      .take(limit);

    if (searchDto.patientId) {
      queryBuilder.andWhere('order.patientId = :patientId', {
        patientId: searchDto.patientId,
      });
    }

    if (searchDto.orderingProviderId) {
      queryBuilder.andWhere('order.orderingProviderId = :providerId', {
        providerId: searchDto.orderingProviderId,
      });
    }

    if (searchDto.status) {
      queryBuilder.andWhere('order.status = :status', {
        status: searchDto.status,
      });
    }

    if (searchDto.priority) {
      queryBuilder.andWhere('order.priority = :priority', {
        priority: searchDto.priority,
      });
    }

    if (searchDto.orderNumber) {
      queryBuilder.andWhere('order.orderNumber ILIKE :orderNumber', {
        orderNumber: `%${searchDto.orderNumber}%`,
      });
    }

    if (searchDto.startDate && searchDto.endDate) {
      queryBuilder.andWhere('order.orderDate BETWEEN :startDate AND :endDate', {
        startDate: new Date(searchDto.startDate),
        endDate: new Date(searchDto.endDate),
      });
    }

    if (searchDto.departmentId) {
      queryBuilder.andWhere('order.departmentId = :departmentId', {
        departmentId: searchDto.departmentId,
      });
    }

    if (searchDto.testCategory) {
      queryBuilder.andWhere('labTest.category = :category', {
        category: searchDto.testCategory,
      });
    }

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<LabOrder> {
    const labOrder = await this.labOrderRepository.findOne({
      where: { id },
      relations: [
        'items',
        'items.labTest',
        'items.labTest.parameters',
        'items.result',
        'items.result.values',
        'specimens',
      ],
    });

    if (!labOrder) {
      throw new NotFoundException(`Lab order with ID ${id} not found`);
    }

    return labOrder;
  }

  async findByPatient(patientId: string): Promise<LabOrder[]> {
    return this.labOrderRepository.find({
      where: { patientId },
      relations: ['items', 'items.labTest', 'specimens'],
      order: { orderDate: 'DESC' },
    });
  }

  async update(id: string, updateDto: UpdateLabOrderDto, userId: string): Promise<LabOrder> {
    const labOrder = await this.findOne(id);

    // Validate status transitions
    if (updateDto.status) {
      this.validateStatusTransition(labOrder.status, updateDto.status);
    }

    Object.assign(labOrder, updateDto);
    labOrder.updatedBy = userId;

    // Update timestamps based on status
    if (updateDto.status === OrderStatus.COLLECTED && !labOrder.collectionDate) {
      labOrder.collectionDate = new Date();
    }
    if (updateDto.status === OrderStatus.COMPLETED && !labOrder.completedDate) {
      labOrder.completedDate = new Date();
    }
    if (updateDto.status === OrderStatus.VERIFIED && !labOrder.verifiedDate) {
      labOrder.verifiedDate = new Date();
    }
    if (updateDto.status === OrderStatus.CANCELLED) {
      labOrder.cancelledDate = new Date();
      labOrder.cancelledBy = updateDto.cancelledBy || userId;
    }

    const saved = await this.labOrderRepository.save(labOrder);
    this.logger.log(`Lab order updated: ${saved.id}`);

    return this.findOne(saved.id);
  }

  async cancel(id: string, reason: string, userId: string): Promise<LabOrder> {
    const labOrder = await this.findOne(id);

    if (labOrder.status === OrderStatus.COMPLETED || labOrder.status === OrderStatus.VERIFIED) {
      throw new BadRequestException('Cannot cancel a completed or verified order');
    }

    labOrder.status = OrderStatus.CANCELLED;
    labOrder.cancellationReason = reason;
    labOrder.cancelledBy = userId;
    labOrder.cancelledDate = new Date();
    labOrder.updatedBy = userId;

    // Cancel all order items
    for (const item of labOrder.items) {
      item.status = OrderItemStatus.CANCELLED;
      item.updatedBy = userId;
    }

    const saved = await this.labOrderRepository.save(labOrder);
    this.logger.log(`Lab order cancelled: ${saved.id}`);

    return this.findOne(saved.id);
  }

  async updateOrderItemStatus(
    itemId: string,
    status: OrderItemStatus,
    userId: string,
  ): Promise<LabOrderItem> {
    const item = await this.orderItemRepository.findOne({
      where: { id: itemId },
      relations: ['labOrder'],
    });

    if (!item) {
      throw new NotFoundException(`Order item with ID ${itemId} not found`);
    }

    item.status = status;
    item.updatedBy = userId;

    const saved = await this.orderItemRepository.save(item);
    this.logger.log(`Order item status updated: ${saved.id} -> ${status}`);

    // Update parent order status if all items are completed
    await this.updateOrderStatusBasedOnItems(item.labOrderId);

    return saved;
  }

  private async updateOrderStatusBasedOnItems(orderId: string): Promise<void> {
    const order = await this.findOne(orderId);
    const items = order.items;

    if (items.length === 0) return;

    const allCompleted = items.every((item) => item.status === OrderItemStatus.COMPLETED);
    const anyInProgress = items.some((item) => item.status === OrderItemStatus.IN_PROGRESS);

    if (allCompleted && order.status !== OrderStatus.COMPLETED) {
      order.status = OrderStatus.COMPLETED;
      order.completedDate = new Date();
      await this.labOrderRepository.save(order);
    } else if (anyInProgress && order.status === OrderStatus.COLLECTED) {
      order.status = OrderStatus.IN_PROGRESS;
      await this.labOrderRepository.save(order);
    }
  }

  private validateStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus): void {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.ORDERED]: [OrderStatus.COLLECTED, OrderStatus.CANCELLED],
      [OrderStatus.COLLECTED]: [OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED],
      [OrderStatus.IN_PROGRESS]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
      [OrderStatus.COMPLETED]: [OrderStatus.VERIFIED],
      [OrderStatus.VERIFIED]: [],
      [OrderStatus.CANCELLED]: [],
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  private async generateOrderNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    // Get count of orders today
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    const count = await this.labOrderRepository.count({
      where: {
        orderDate: Between(startOfDay, endOfDay),
      },
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `LAB-${year}${month}${day}-${sequence}`;
  }
}
