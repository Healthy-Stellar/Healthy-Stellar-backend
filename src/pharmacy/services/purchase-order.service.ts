import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchaseOrder, PurchaseOrderStatus } from '../entities/purchase-order.entity';
import { DrugSupplierService } from './drug-supplier.service';
import { PharmacyInventoryService } from './pharmacy-inventory.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginationUtil } from '../../common/utils/pagination.util';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';

@Injectable()
export class PurchaseOrderService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private orderRepository: Repository<PurchaseOrder>,
    private supplierService: DrugSupplierService,
    private inventoryService: PharmacyInventoryService,
  ) {}

  async create(createDto: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
    // Verify supplier exists
    await this.supplierService.findOne(createDto.supplierId);

    const orderNumber = `PO-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const items = (createDto.items || []).map((item) => ({
      ...item,
      totalCost: item.totalCost ?? item.unitCost * item.quantity,
    }));
    const totalAmount =
      createDto.totalAmount ??
      items.reduce((total, item) => total + Number(item.totalCost || 0), 0);
    const order = this.orderRepository.create({
      ...createDto,
      items,
      totalAmount,
      orderNumber,
      orderDate: createDto.orderDate ? new Date(createDto.orderDate) : new Date(),
      status: createDto.status ?? PurchaseOrderStatus.DRAFT,
    });

    return this.orderRepository.save(order);
  }

  async findAll(
    paginationDto: PaginationDto = new PaginationDto(),
  ): Promise<PaginatedResponseDto<PurchaseOrder>> {
    return PaginationUtil.paginate(this.orderRepository, paginationDto, {
      relations: ['supplier'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<PurchaseOrder> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['supplier'],
    });
    if (!order) {
      throw new NotFoundException(`Purchase order with ID ${id} not found`);
    }
    return order;
  }

  async update(id: string, updateDto: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
    const order = await this.findOne(id);
    const items = updateDto.items
      ? updateDto.items.map((item) => ({
          ...item,
          totalCost: item.totalCost ?? item.unitCost * item.quantity,
        }))
      : order.items;
    const totalAmount =
      updateDto.totalAmount ??
      items.reduce((total, item) => total + Number(item.totalCost || 0), 0);
    Object.assign(order, updateDto, { items, totalAmount });
    return this.orderRepository.save(order);
  }

  async approveOrder(id: string, approvedBy: string): Promise<PurchaseOrder> {
    const order = await this.findOne(id);
    order.status = PurchaseOrderStatus.APPROVED;
    order.approvedBy = approvedBy;
    order.approvedAt = new Date();
    return this.orderRepository.save(order);
  }

  async markAsOrdered(id: string): Promise<PurchaseOrder> {
    const order = await this.findOne(id);
    order.status = PurchaseOrderStatus.ORDERED;
    return this.orderRepository.save(order);
  }

  async receiveOrder(id: string, receivedItems: any[]): Promise<PurchaseOrder> {
    const order = await this.findOne(id);

    // Update inventory for each received item
    for (const item of receivedItems) {
      await this.inventoryService.addInventoryFromPurchase({
        drugId: item.drugId,
        quantity: item.quantity,
        lotNumber: item.lotNumber,
        expirationDate: item.expirationDate,
        unitCost: item.unitCost,
        supplierId: order.supplierId,
        purchaseOrderNumber: order.orderNumber,
      });
    }

    // Update order status
    if (receivedItems.length === order.items.length) {
      order.status = PurchaseOrderStatus.RECEIVED;
    } else {
      order.status = PurchaseOrderStatus.PARTIALLY_RECEIVED;
    }

    order.actualDeliveryDate = new Date();
    return this.orderRepository.save(order);
  }

  async getPendingOrders(
    paginationDto: PaginationDto = new PaginationDto(),
  ): Promise<PaginatedResponseDto<PurchaseOrder>> {
    const query = this.orderRepository.createQueryBuilder('order')
      .leftJoinAndSelect('order.supplier', 'supplier')
      .where('order.status = :status', { status: PurchaseOrderStatus.PENDING })
      .orderBy('order.createdAt', 'ASC');

    return PaginationUtil.paginateQueryBuilder(query, paginationDto);
  }

  async getOpenOrdersForDrug(
    drugId: string,
    paginationDto: PaginationDto = new PaginationDto(),
  ): Promise<PaginatedResponseDto<PurchaseOrder>> {
    const openStatuses = [
      PurchaseOrderStatus.PENDING,
      PurchaseOrderStatus.APPROVED,
      PurchaseOrderStatus.ORDERED,
      PurchaseOrderStatus.PARTIALLY_RECEIVED,
    ];

    const orders = await this.orderRepository.find({
      relations: ['supplier'],
      order: { createdAt: 'DESC' },
    });

    const filtered = orders.filter(
      (order) =>
        openStatuses.includes(order.status) &&
        order.items.some((item) => item.drugId === drugId),
    );

    const skip = (paginationDto.page - 1) * paginationDto.pageSize;
    const pageItems = filtered.slice(skip, skip + paginationDto.pageSize);

    return PaginationUtil.createResponse(
      pageItems,
      filtered.length,
      paginationDto.page,
      paginationDto.pageSize,
    );
  }

  async getOrdersBySupplier(
    supplierId: string,
    paginationDto: PaginationDto = new PaginationDto(),
  ): Promise<PaginatedResponseDto<PurchaseOrder>> {
    const query = this.orderRepository.createQueryBuilder('order')
      .leftJoinAndSelect('order.supplier', 'supplier')
      .where('order.supplierId = :supplierId', { supplierId })
      .orderBy('order.createdAt', 'DESC');

    return PaginationUtil.paginateQueryBuilder(query, paginationDto);
  }
}
