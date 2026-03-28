import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProviderPatientRelationship } from './entities/provider-patient-relationship.entity';
import { ProviderPatientRelationshipService } from './services/provider-patient-relationship.service';
import { ProviderPatientRelationshipController } from './controllers/provider-patient-relationship.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([ProviderPatientRelationship]), AuthModule],
  controllers: [ProviderPatientRelationshipController],
  providers: [ProviderPatientRelationshipService],
  exports: [ProviderPatientRelationshipService],
})
export class ProviderPatientModule {}
