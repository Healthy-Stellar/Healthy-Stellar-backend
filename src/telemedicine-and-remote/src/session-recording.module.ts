import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionRecording } from './entity/session-recording.entity';
import { VideoConferenceSession } from './entity/Video conference session.entity';
import { SessionRecordingService } from './services/session-recording.service';
import { SessionRecordingController } from './controllers/session-recording.controller';
import { KeyManagementModule } from '../../key-management/key-management.module';

/**
 * Standalone module for telemedicine session recording storage/retrieval
 * (issue #624). Kept independent of `Telemedicine.module.ts`, whose existing
 * import paths do not resolve to files on disk and is not wired into
 * AppModule — fixing that aggregator module is unrelated, larger pre-existing
 * breakage outside this issue's scope.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([SessionRecording, VideoConferenceSession]),
    KeyManagementModule,
  ],
  controllers: [SessionRecordingController],
  providers: [SessionRecordingService],
  exports: [SessionRecordingService],
})
export class SessionRecordingModule {}
