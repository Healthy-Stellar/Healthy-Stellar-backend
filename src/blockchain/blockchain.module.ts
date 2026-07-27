import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StellarContractService } from './stellar-contract.service';

@Module({
  imports: [ConfigModule],
  providers: [StellarContractService],
  exports: [StellarContractService],
})
export class BlockchainModule {}
