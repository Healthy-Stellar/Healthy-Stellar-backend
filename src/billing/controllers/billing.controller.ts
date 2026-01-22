import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { BillingService } from '../services/billing.service';
import {
  CreateBillingDto,
  UpdateBillingDto,
  AddLineItemDto,
  UpdateLineItemDto,
} from '../dto/billing.dto';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new billing record' })
  @ApiResponse({ status: 201, description: 'Billing record created successfully' })
  async create(@Body() createDto: CreateBillingDto) {
    return this.billingService.create(createDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get billing by ID' })
  @ApiParam({ name: 'id', description: 'Billing ID' })
  @ApiResponse({ status: 200, description: 'Billing retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Billing not found' })
  async findById(@Param('id') id: string) {
    return this.billingService.findById(id);
  }

  @Get('invoice/:invoiceNumber')
  @ApiOperation({ summary: 'Get billing by invoice number' })
  @ApiParam({ name: 'invoiceNumber', description: 'Invoice number' })
  @ApiResponse({ status: 200, description: 'Billing retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Billing not found' })
  async findByInvoiceNumber(@Param('invoiceNumber') invoiceNumber: string) {
    return this.billingService.findByInvoiceNumber(invoiceNumber);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get all billings for a patient' })
  @ApiParam({ name: 'patientId', description: 'Patient ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Billings retrieved successfully' })
  async findByPatientId(
    @Param('patientId') patientId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.billingService.findByPatientId(patientId, { page, limit });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update billing record' })
  @ApiParam({ name: 'id', description: 'Billing ID' })
  @ApiResponse({ status: 200, description: 'Billing updated successfully' })
  @ApiResponse({ status: 404, description: 'Billing not found' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateBillingDto) {
    return this.billingService.update(id, updateDto);
  }

  @Post(':id/line-items')
  @ApiOperation({ summary: 'Add a line item to billing' })
  @ApiParam({ name: 'id', description: 'Billing ID' })
  @ApiResponse({ status: 201, description: 'Line item added successfully' })
  async addLineItem(@Param('id') id: string, @Body() lineItemDto: AddLineItemDto) {
    return this.billingService.addLineItem(id, lineItemDto);
  }

  @Put('line-items/:lineItemId')
  @ApiOperation({ summary: 'Update a line item' })
  @ApiParam({ name: 'lineItemId', description: 'Line item ID' })
  @ApiResponse({ status: 200, description: 'Line item updated successfully' })
  async updateLineItem(
    @Param('lineItemId') lineItemId: string,
    @Body() updateDto: UpdateLineItemDto,
  ) {
    return this.billingService.updateLineItem(lineItemId, updateDto);
  }

  @Delete('line-items/:lineItemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a line item' })
  @ApiParam({ name: 'lineItemId', description: 'Line item ID' })
  @ApiResponse({ status: 204, description: 'Line item removed successfully' })
  async removeLineItem(@Param('lineItemId') lineItemId: string) {
    return this.billingService.removeLineItem(lineItemId);
  }

  @Post(':id/recalculate')
  @ApiOperation({ summary: 'Recalculate billing totals' })
  @ApiParam({ name: 'id', description: 'Billing ID' })
  @ApiResponse({ status: 200, description: 'Totals recalculated successfully' })
  async recalculateTotals(@Param('id') id: string) {
    return this.billingService.recalculateTotals(id);
  }

  @Get('outstanding/list')
  @ApiOperation({ summary: 'Get outstanding balances' })
  @ApiQuery({ name: 'minBalance', required: false, type: Number })
  @ApiQuery({ name: 'maxDays', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Outstanding balances retrieved' })
  async getOutstandingBalances(
    @Query('minBalance') minBalance?: number,
    @Query('maxDays') maxDays?: number,
  ) {
    return this.billingService.getOutstandingBalances({ minBalance, maxDays });
  }

  @Put(':id/collections')
  @ApiOperation({ summary: 'Mark billing as sent to collections' })
  @ApiParam({ name: 'id', description: 'Billing ID' })
  @ApiResponse({ status: 200, description: 'Billing marked for collections' })
  async markAsSentToCollections(@Param('id') id: string) {
    return this.billingService.markAsSentToCollections(id);
  }

  @Get('reports/aging')
  @ApiOperation({ summary: 'Get A/R aging report' })
  @ApiResponse({ status: 200, description: 'Aging report retrieved' })
  async getAgingReport() {
    return this.billingService.getAgingReport();
  }
}
