import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './entities/tenant.entity';
import { TenantService } from './services/tenant.service';
import { TenantController } from './controllers/tenant.controller';
import { TenantContext } from './context/tenant.context';
import { TenantInterceptor } from './interceptors/tenant.interceptor';
import { TenantGuard } from './guards/tenant.guard';
import { DataResidencyModule } from '../data-residency/data-residency.module';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Tenant]), DataResidencyModule],
  controllers: [TenantController],
  providers: [TenantService, TenantContext, TenantInterceptor, TenantGuard],
  exports: [TenantService, TenantContext, TenantInterceptor, TenantGuard],
})
export class TenantModule {}
