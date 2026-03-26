import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LedgerReconciliationService } from './ledger-reconciliation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('admin/reconciliation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/reconciliation')
export class ReconciliationController {
  constructor(private readonly reconciliation: LedgerReconciliationService) {}

  @Get('latest')
  @ApiOperation({ summary: 'Get the most recent reconciliation run summary' })
  async getLatest() {
    return this.reconciliation.getLatestRun();
  }

  @Post('trigger')
  @ApiOperation({ summary: 'Manually trigger a reconciliation run' })
  async trigger() {
    return this.reconciliation.run();
  }
}
