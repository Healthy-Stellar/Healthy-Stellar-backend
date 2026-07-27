import { Controller, Get, Post, Body, Param, Patch, Query } from '@nestjs/common';
import { PurchaseOrderService } from '../services/purchase-order.service';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('pharmacy/purchase-orders')
export class PurchaseOrderController {
  constructor(private purchaseOrderService: PurchaseOrderService) {}

  @Post()
  async create(@Body() createDto: any) {
    return await this.purchaseOrderService.create(createDto);
  }

  @Get()
  async findAll(@Query() pagination: PaginationDto) {
    return await this.purchaseOrderService.findAll(pagination);
  }

  @Get('pending')
  async getPendingOrders(@Query() pagination: PaginationDto) {
    return await this.purchaseOrderService.getPendingOrders(pagination);
  }

  @Get('supplier/:supplierId')
  async getOrdersBySupplier(
    @Param('supplierId') supplierId: string,
    @Query() pagination: PaginationDto,
  ) {
    return await this.purchaseOrderService.getOrdersBySupplier(supplierId, pagination);
  }

  @Get('drug/:drugId/open')
  async getOpenOrdersForDrug(
    @Param('drugId') drugId: string,
    @Query() pagination: PaginationDto,
  ) {
    return await this.purchaseOrderService.getOpenOrdersForDrug(drugId, pagination);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.purchaseOrderService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateDto: any) {
    return await this.purchaseOrderService.update(id, updateDto);
  }

  @Post(':id/approve')
  async approveOrder(@Param('id') id: string, @Body('approvedBy') approvedBy: string) {
    return await this.purchaseOrderService.approveOrder(id, approvedBy);
  }

  @Post(':id/mark-ordered')
  async markAsOrdered(@Param('id') id: string) {
    return await this.purchaseOrderService.markAsOrdered(id);
  }

  @Post(':id/receive')
  async receiveOrder(@Param('id') id: string, @Body('receivedItems') receivedItems: any[]) {
    return await this.purchaseOrderService.receiveOrder(id, receivedItems);
  }
}
