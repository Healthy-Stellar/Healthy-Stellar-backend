import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProviderPatientRelationship } from './entities/provider-patient-relationship.entity';
import { CarePlanHandoff } from './entities/care-plan-handoff.entity';
import { ProviderPatientRelationshipService } from './services/provider-patient-relationship.service';
import { ProviderPatientRelationshipController } from './controllers/provider-patient-relationship.controller';
import { HandoffService } from './services/handoff.service';
import { HandoffController } from './controllers/handoff.controller';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProviderPatientRelationship, CarePlanHandoff]),
    AuthModule,
    NotificationsModule,
  ],
  controllers: [ProviderPatientRelationshipController, HandoffController],
  providers: [ProviderPatientRelationshipService, HandoffService],
  exports: [ProviderPatientRelationshipService, HandoffService],
})
export class ProviderPatientModule {}
