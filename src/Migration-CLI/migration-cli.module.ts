import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MigrationHistory } from './entities/migration-history.entity';
import { MigrationCliService } from './migration-cli.service';
import { SafetyChecksService } from './safety-checks.service';
import { DryRunService } from './dry-run.service';
import { BackupService } from './backup.service';
import { SlackNotifierService } from './slack-notifier.service';

@Module({
  imports: [TypeOrmModule.forFeature([MigrationHistory])],
  providers: [
    MigrationCliService,
    SafetyChecksService,
    DryRunService,
    BackupService,
    SlackNotifierService,
  ],
  exports: [MigrationCliService],
})
export class MigrationCliModule {}
