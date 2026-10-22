import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlag } from './feature-flag.entity';
import { FeatureFlagService } from './feature-flag.service';
import { FeatureFlagGuard } from './feature-flag.guard';
import { FeatureFlagController } from './feature-flag.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FeatureFlag])],
  controllers: [FeatureFlagController],
  providers: [FeatureFlagService, FeatureFlagGuard],
  exports: [FeatureFlagService, FeatureFlagGuard],
})
export class FeatureFlagModule {}
