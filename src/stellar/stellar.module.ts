import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { StellarController } from './controllers/stellar.controller';
import { StellarFeeService } from './services/stellar-fee.service';
import { StellarCacheService } from './services/stellar-cache.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
  ],
  controllers: [StellarController],
  providers: [StellarFeeService, StellarCacheService],
  exports: [StellarFeeService],
})
export class StellarModule {}
