import { Module, Logger, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { EmergencyOperationsController } from './controllers/emergency-operations.controller';
import { EmergencyOperationsService } from './services/emergency-operations.service';
import { EmergencyTriageCase } from './entities/emergency-triage.entity';
import {
  CriticalCareAlert,
  CriticalCareMonitoring,
} from './entities/critical-care-monitoring.entity';
import { EmergencyResource } from './entities/emergency-resource.entity';
import { RapidResponseEvent } from './entities/rapid-response-event.entity';
import { DisasterIncident, EmergencyChartNote } from './entities/emergency-documentation.entity';
import { QUEUE_NAMES } from '../queues/queue.constants';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmergencyTriageCase,
      CriticalCareMonitoring,
      CriticalCareAlert,
      EmergencyResource,
      RapidResponseEvent,
      EmergencyChartNote,
      DisasterIncident,
    ]),
    BullModule.registerQueue({ name: QUEUE_NAMES.PANIC_ALERTS }),
    NotificationsModule,
  ],
  controllers: [EmergencyOperationsController],
  providers: [EmergencyOperationsService],
  exports: [EmergencyOperationsService],
})
export class EmergencyOperationsModule implements OnModuleInit {
  private readonly logger = new Logger(EmergencyOperationsModule.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const smsConfigured = Boolean(
      this.configService.get<string>('SMS_PROVIDER') &&
        this.configService.get<string>('SMS_API_KEY'),
    );
    const emailConfigured = Boolean(
      this.configService.get<string>('MAILER_SERVICE') ||
        this.configService.get<string>('MAIL_HOST'),
    );

    if (smsConfigured || emailConfigured) {
      return;
    }

    const message =
      'No panic-alert delivery channel is configured (SMS_PROVIDER/SMS_API_KEY or MAILER_SERVICE/MAIL_HOST). Panic alerts will fail to dispatch.';

    if (this.configService.get<string>('NODE_ENV') === 'production') {
      this.logger.error(message);
      throw new Error(message);
    }

    this.logger.warn(message);
  }
}
