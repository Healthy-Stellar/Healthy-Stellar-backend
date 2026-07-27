import { Controller, Get, Param, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { AuditChainService } from './audit-chain.service';
import { AuditVerifyResponseDto } from './dto/audit-verify.dto';

@ApiTags('Audit Chain')
@Controller('audit')
export class AuditChainController {
  private readonly logger = new Logger(AuditChainController.name);

  constructor(private readonly auditChainService: AuditChainService) {}

  @Get('verify/:from/:to')
  @ApiOperation({ summary: 'Verify hash chain integrity for a range of audit log entries' })
  @ApiParam({ name: 'from', description: 'Starting entry UUID' })
  @ApiParam({ name: 'to', description: 'Ending entry UUID' })
  async verifyChain(
    @Param('from') from: string,
    @Param('to') to: string,
  ): Promise<AuditVerifyResponseDto> {
    this.logger.log(`Verifying chain from ${from} to ${to}`);
    const result = await this.auditChainService.verifyChain(from, to);
    return {
      valid: result.valid,
      fromId: result.fromId,
      toId: result.toId,
      totalEntries: result.totalEntries,
      stellarTxId: result.stellarTxId,
      error: result.error,
    };
  }
}
