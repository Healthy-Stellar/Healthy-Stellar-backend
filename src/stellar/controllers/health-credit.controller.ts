import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { HealthCreditContractService } from '../services/health-credit-contract.service';

class MintDto {
  toAccountId: string;
  amount: string; // bigint as string to survive JSON serialisation
}

class TransferDto {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
}

class BurnDto {
  fromAccountId: string;
  amount: string;
}

@ApiTags('Stellar - Health Credits')
@Controller('stellar/credits')
export class HealthCreditController {
  constructor(private readonly creditService: HealthCreditContractService) {}

  @Get(':accountId')
  @ApiParam({ name: 'accountId', description: 'Stellar public key of the account' })
  @ApiOperation({ summary: 'Get health credit token balance for an account' })
  getBalance(@Param('accountId') accountId: string) {
    return this.creditService.getBalance(accountId);
  }

  @Post('mint')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mint health credits to a recipient account' })
  mint(@Body() dto: MintDto) {
    return this.creditService.mint(dto.toAccountId, BigInt(dto.amount));
  }

  @Post('transfer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transfer health credits between accounts' })
  transfer(@Body() dto: TransferDto) {
    return this.creditService.transfer(dto.fromAccountId, dto.toAccountId, BigInt(dto.amount));
  }

  @Post('burn')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Burn (redeem) health credits from an account' })
  burn(@Body() dto: BurnDto) {
    return this.creditService.burn(dto.fromAccountId, BigInt(dto.amount));
  }
}
