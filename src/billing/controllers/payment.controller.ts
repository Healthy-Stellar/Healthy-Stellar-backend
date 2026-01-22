import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { PaymentService } from '../services/payment.service';
import {
  CreatePaymentDto,
  UpdatePaymentDto,
  RefundPaymentDto,
  PaymentSearchDto,
} from '../dto/payment.dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new payment' })
  @ApiResponse({ status: 201, description: 'Payment created and processed' })
  async create(@Body() createDto: CreatePaymentDto) {
    return this.paymentService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Search payments' })
  @ApiResponse({ status: 200, description: 'Payments retrieved successfully' })
  async search(@Query() searchDto: PaymentSearchDto) {
    return this.paymentService.search(searchDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment by ID' })
  @ApiParam({ name: 'id', description: 'Payment ID' })
  @ApiResponse({ status: 200, description: 'Payment retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async findById(@Param('id') id: string) {
    return this.paymentService.findById(id);
  }

  @Get('number/:paymentNumber')
  @ApiOperation({ summary: 'Get payment by payment number' })
  @ApiParam({ name: 'paymentNumber', description: 'Payment number' })
  @ApiResponse({ status: 200, description: 'Payment retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async findByPaymentNumber(@Param('paymentNumber') paymentNumber: string) {
    return this.paymentService.findByPaymentNumber(paymentNumber);
  }

  @Get('billing/:billingId')
  @ApiOperation({ summary: 'Get payments for a billing' })
  @ApiParam({ name: 'billingId', description: 'Billing ID' })
  @ApiResponse({ status: 200, description: 'Payments retrieved successfully' })
  async getPaymentsByBilling(@Param('billingId') billingId: string) {
    return this.paymentService.getPaymentsByBilling(billingId);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get payments for a patient' })
  @ApiParam({ name: 'patientId', description: 'Patient ID' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiResponse({ status: 200, description: 'Payments retrieved successfully' })
  async getPaymentsByPatient(
    @Param('patientId') patientId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const options: { startDate?: Date; endDate?: Date } = {};
    if (startDate) options.startDate = new Date(startDate);
    if (endDate) options.endDate = new Date(endDate);
    return this.paymentService.getPaymentsByPatient(patientId, options);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update payment' })
  @ApiParam({ name: 'id', description: 'Payment ID' })
  @ApiResponse({ status: 200, description: 'Payment updated successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async update(@Param('id') id: string, @Body() updateDto: UpdatePaymentDto) {
    return this.paymentService.update(id, updateDto);
  }

  @Post(':id/process')
  @ApiOperation({ summary: 'Process a pending payment' })
  @ApiParam({ name: 'id', description: 'Payment ID' })
  @ApiResponse({ status: 200, description: 'Payment processed successfully' })
  async processPayment(@Param('id') id: string) {
    return this.paymentService.processPayment(id);
  }

  @Post('refund')
  @ApiOperation({ summary: 'Refund a payment' })
  @ApiResponse({ status: 200, description: 'Refund processed successfully' })
  async refund(@Body() refundDto: RefundPaymentDto) {
    return this.paymentService.refund(refundDto);
  }

  @Get('reports/daily')
  @ApiOperation({ summary: 'Get daily payment summary' })
  @ApiQuery({ name: 'date', required: false, description: 'Date (defaults to today)' })
  @ApiResponse({ status: 200, description: 'Daily summary retrieved' })
  async getDailyPaymentSummary(@Query('date') date?: string) {
    const reportDate = date ? new Date(date) : new Date();
    return this.paymentService.getDailyPaymentSummary(reportDate);
  }
}
