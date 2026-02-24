import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { BackupService } from './services/backup.service';
import { BackupController } from './controllers/backup.controller';
import { BackupVerificationService } from './services/backup-verification.service';
import { DisasterRecoveryService } from './services/disaster-recovery.service';
import { BackupMonitoringService } from './services/backup-monitoring.service';
import { BackupLog } from './entities/backup-log.entity';
import { RecoveryTest } from './entities/recovery-test.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BackupLog, RecoveryTest]), ScheduleModule.forRoot()],
  controllers: [BackupController],
  providers: [
    BackupService,
    BackupVerificationService,
    DisasterRecoveryService,
    BackupMonitoringService,
  ],
  exports: [BackupService, DisasterRecoveryService],
})
export class BackupModule {}
