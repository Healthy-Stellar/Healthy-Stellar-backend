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
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MultiSigTransactionService } from '../services/multi-sig-transaction.service';
import {
  CreateMultiSigPaymentDto,
  ApproveRejectDto,
  MultiSigTransactionResponse,
} from '../interfaces/multi-sig.interface';
import { API_BEARER_AUTH_SCHEME } from '../../common/constants/swagger.constants';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/entities/user.entity';
import { JwtPayload } from '../../auth/services/auth-token.service';

type AuthenticatedRequest = { user: Pick<JwtPayload, 'userId' | 'organizationId'> };

@ApiTags('Stellar – Multi-Signature Payments')
@ApiBearerAuth(API_BEARER_AUTH_SCHEME)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stellar/multi-sig')
export class MultiSigController {
  constructor(
    private readonly multiSigService: MultiSigTransactionService,
  ) {}

  @Post('payments')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ADMIN, UserRole.BILLING_STAFF)
  @ApiOperation({ summary: 'Create a multi-signature payment request' })
  async createPayment(
    @Body() dto: CreateMultiSigPaymentDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<MultiSigTransactionResponse> {
    return this.multiSigService.createMultiSigPayment(
      dto,
      req.user.userId,
      this.getTenantId(req.user),
    );
  }

  @Post('payments/:id/approve')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.BILLING_STAFF)
  @ApiOperation({ summary: 'Approve a pending multi-sig payment' })
  async approvePayment(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<MultiSigTransactionResponse> {
    return this.multiSigService.approveTransaction(
      id,
      this.getTenantId(req.user),
      req.user.userId,
    );
  }

  @Post('payments/:id/reject')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.BILLING_STAFF)
  @ApiOperation({ summary: 'Reject a pending multi-sig payment' })
  async rejectPayment(
    @Param('id') id: string,
    @Body() dto: ApproveRejectDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<MultiSigTransactionResponse> {
    return this.multiSigService.rejectTransaction(
      id,
      this.getTenantId(req.user),
      req.user.userId,
      dto.reason,
    );
  }

  @Post('payments/sweep')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Sweep approved multi-sig payments to execute on-chain' })
  async sweepApprovedPayments(): Promise<{ processed: number }> {
    const processed = await this.multiSigService.sweepApprovedTransactions();
    return { processed };
  }

  @Get('payments/:id')
  @Roles(UserRole.ADMIN, UserRole.BILLING_STAFF)
  @ApiOperation({ summary: 'Get multi-sig payment status' })
  async getPaymentStatus(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<MultiSigTransactionResponse> {
    return this.multiSigService.getTransactionStatus(id, this.getTenantId(req.user));
  }

  @Get('payments')
  @Roles(UserRole.ADMIN, UserRole.BILLING_STAFF)
  @ApiOperation({ summary: 'List pending multi-sig payments for tenant' })
  async listPending(
    @Req() req: AuthenticatedRequest,
  ): Promise<MultiSigTransactionResponse[]> {
    return this.multiSigService.listPendingTransactions(this.getTenantId(req.user));
  }

  private getTenantId(user: JwtPayload): string {
    if (!user.organizationId) {
      throw new ForbiddenException('Authenticated user has no organization');
    }
    return user.organizationId;
  }
}
