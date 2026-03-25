import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AwsKmsService } from './services/aws-kms.service';
import { CircuitBreakerModule } from '../common/circuit-breaker/circuit-breaker.module';
import { CommonModule } from '../common/common.module';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [
    ConfigModule,
    CircuitBreakerModule,
    CommonModule,
    TenantModule,
  ],
  providers: [
    {
      provide: 'KeyManagementService',
      useClass: AwsKmsService,
    },
  ],
  exports: ['KeyManagementService'],
})
export class KeyManagementModule {}