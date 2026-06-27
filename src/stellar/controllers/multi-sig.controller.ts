import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MultiSigTransactionService } from '../services/multi-sig-transaction.service';
import {
  CreateMultiSigPaymentDto,
  ApproveRejectDto,
  MultiSigTransactionResponse,
} from '../interfaces/multi-sig.interface';

@ApiTags('Stellar – Multi-Signature Payments')
@ApiBearerAuth()
@Controller('stellar/multi-sig')
export class MultiSigController {
  constructor(
    private readonly multiSigService: MultiSigTransactionService,
  ) {}

  @Post('payments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a multi-signature payment request' })
  async createPayment(
    @Body() dto: CreateMultiSigPaymentDto,
    @Req() req: any,
  ): Promise<MultiSigTransactionResponse> {
    const requesterId = req.user?.userId || 'system';
    return this.multiSigService.createMultiSigPayment(dto, requesterId);
  }

  @Post('payments/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a pending multi-sig payment' })
  async approvePayment(
    @Param('id') id: string,
    @Body() dto: ApproveRejectDto,
  ): Promise<MultiSigTransactionResponse> {
    return this.multiSigService.approveTransaction(id, dto);
  }

  @Post('payments/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a pending multi-sig payment' })
  async rejectPayment(
    @Param('id') id: string,
    @Body() dto: ApproveRejectDto,
  ): Promise<MultiSigTransactionResponse> {
    return this.multiSigService.rejectTransaction(id, dto);
  }

  @Get('payments/:id')
  @ApiOperation({ summary: 'Get multi-sig payment status' })
  async getPaymentStatus(
    @Param('id') id: string,
  ): Promise<MultiSigTransactionResponse> {
    return this.multiSigService.getTransactionStatus(id);
  }

  @Get('payments')
  @ApiOperation({ summary: 'List pending multi-sig payments for tenant' })
  async listPending(
    @Req() req: any,
  ): Promise<MultiSigTransactionResponse[]> {
    const tenantId = req.query?.tenantId || 'default';
    return this.multiSigService.listPendingTransactions(tenantId);
  }
}
