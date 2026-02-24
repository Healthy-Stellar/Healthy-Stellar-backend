import { Controller, Get, Post, Body, Param, Patch, Query } from '@nestjs/common';
import { PurchaseOrderService } from '../services/purchase-order.service';

@Controller('pharmacy/purchase-orders')
export class PurchaseOrderController {
  constructor(private purchaseOrderService: PurchaseOrderService) {}

  @Post()
  async create(@Body() createDto: any) {
    return await this.purchaseOrderService.create(createDto);
  }

  @Get()
  async findAll() {
    return await this.purchaseOrderService.findAll();
  }

  @Get('pending')
  async getPendingOrders() {
    return await this.purchaseOrderService.getPendingOrders();
  }

  @Get('supplier/:supplierId')
  async getOrdersBySupplier(@Param('supplierId') supplierId: string) {
    return await this.purchaseOrderService.getOrdersBySupplier(supplierId);
  }

  @Get('drug/:drugId/open')
  async getOpenOrdersForDrug(@Param('drugId') drugId: string) {
    return await this.purchaseOrderService.getOpenOrdersForDrug(drugId);
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
