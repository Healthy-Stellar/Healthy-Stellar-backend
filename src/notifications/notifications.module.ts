import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService, MAILER_SERVICE } from './services/notifications.service';
import { NotificationQueueService } from './services/notification-queue.service';
import { NotificationPreferencesService } from './services/notification-preferences.service';
import { OnChainEventListenerService } from './services/on-chain-event-listener.service';
import { NotificationTemplateService } from './services/notification-template.service';
import { NotificationPreference } from './entities/notification-preference.entity';
import { AuthModule } from '../auth/auth.module';
import { I18nAppModule } from '../i18n/i18n.module';
import { PubSubModule } from '../pubsub/pubsub.module';

function buildMailerProvider() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MailerService } = require('@nestjs-modules/mailer');
    return {
      provide: MAILER_SERVICE,
      useExisting: MailerService,
    };
  } catch {
    return null;
  }
}

const mailerProvider = buildMailerProvider();

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    I18nAppModule,
    PubSubModule,
    TypeOrmModule.forFeature([NotificationPreference]),
  ],
  providers: [
    NotificationsService,
    NotificationQueueService,
    NotificationPreferencesService,
    OnChainEventListenerService,
    NotificationTemplateService,
    ...(mailerProvider ? [mailerProvider] : []),
  ],
  exports: [
    NotificationsService,
    NotificationPreferencesService,
    OnChainEventListenerService,
    NotificationTemplateService,
  ],
})
export class NotificationsModule {}
