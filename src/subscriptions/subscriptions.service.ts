import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { PubSubService, SUBSCRIPTION_EVENTS } from '../pubsub/pubsub.service';
import { RedisStreamService } from '../pubsub/redis-stream.service';
import { RecordAccessedEvent } from './dto/record-accessed.event';
import { AccessGrantedEvent } from './dto/access-granted.event';
import { AccessRevokedEvent } from './dto/access-revoked.event';
import { RecordUploadedEvent } from './dto/record-uploaded.event';
import { JobStatusEvent } from './dto/job-status.event';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly pubSub: PubSubService,
    private readonly streamService: RedisStreamService,
  ) {}

  assertPatientAccess(requestedPatientId: string, contextPatientId: string): void {
    if (requestedPatientId !== contextPatientId) {
      throw new ForbiddenException(
        'FORBIDDEN: You can only subscribe to events for your own patient record.',
      );
    }
  }

  getRecordAccessedIterator(patientId: string): AsyncIterator<RecordAccessedEvent> {
    return this.pubSub.asyncIterator<RecordAccessedEvent>(
      `${SUBSCRIPTION_EVENTS.RECORD_ACCESSED}:${patientId}`,
    );
  }

  getAccessGrantedIterator(patientId: string): AsyncIterator<AccessGrantedEvent> {
    return this.pubSub.asyncIterator<AccessGrantedEvent>(
      `${SUBSCRIPTION_EVENTS.ACCESS_GRANTED}:${patientId}`,
    );
  }

  getAccessRevokedIterator(patientId: string): AsyncIterator<AccessRevokedEvent> {
    return this.pubSub.asyncIterator<AccessRevokedEvent>(
      `${SUBSCRIPTION_EVENTS.ACCESS_REVOKED}:${patientId}`,
    );
  }

  getRecordUploadedIterator(patientId: string): AsyncIterator<RecordUploadedEvent> {
    return this.pubSub.asyncIterator<RecordUploadedEvent>(
      `${SUBSCRIPTION_EVENTS.RECORD_UPLOADED}:${patientId}`,
    );
  }

  getJobStatusIterator(jobId: string): AsyncIterator<JobStatusEvent> {
    return this.pubSub.asyncIterator<JobStatusEvent>(
      `${SUBSCRIPTION_EVENTS.JOB_STATUS_UPDATED}:${jobId}`,
    );
  }

  async publishRecordAccessed(event: RecordAccessedEvent): Promise<void> {
    const topic = `${SUBSCRIPTION_EVENTS.RECORD_ACCESSED}:${event.patientId}`;
    await Promise.all([
      this.pubSub.publish(topic, { recordAccessed: event }),
      this.streamService.appendEvent(SUBSCRIPTION_EVENTS.RECORD_ACCESSED, event.patientId, {
        payload: JSON.stringify(event),
      }),
    ]);
  }

  async publishAccessGranted(event: AccessGrantedEvent): Promise<void> {
    const topic = `${SUBSCRIPTION_EVENTS.ACCESS_GRANTED}:${event.patientId}`;
    await Promise.all([
      this.pubSub.publish(topic, { accessGranted: event }),
      this.streamService.appendEvent(SUBSCRIPTION_EVENTS.ACCESS_GRANTED, event.patientId, {
        payload: JSON.stringify(event),
      }),
    ]);
  }

  async publishAccessRevoked(event: AccessRevokedEvent): Promise<void> {
    const topic = `${SUBSCRIPTION_EVENTS.ACCESS_REVOKED}:${event.patientId}`;
    await Promise.all([
      this.pubSub.publish(topic, { accessRevoked: event }),
      this.streamService.appendEvent(SUBSCRIPTION_EVENTS.ACCESS_REVOKED, event.patientId, {
        payload: JSON.stringify(event),
      }),
    ]);
  }

  async publishRecordUploaded(event: RecordUploadedEvent): Promise<void> {
    const topic = `${SUBSCRIPTION_EVENTS.RECORD_UPLOADED}:${event.patientId}`;
    await Promise.all([
      this.pubSub.publish(topic, { recordUploaded: event }),
      this.streamService.appendEvent(SUBSCRIPTION_EVENTS.RECORD_UPLOADED, event.patientId, {
        payload: JSON.stringify(event),
      }),
    ]);
  }

  async publishJobStatusUpdated(event: JobStatusEvent): Promise<void> {
    const topic = `${SUBSCRIPTION_EVENTS.JOB_STATUS_UPDATED}:${event.jobId}`;
    await Promise.all([
      this.pubSub.publish(topic, { jobStatusUpdated: event }),
      this.streamService.appendEvent(SUBSCRIPTION_EVENTS.JOB_STATUS_UPDATED, event.jobId, {
        payload: JSON.stringify(event),
      }),
    ]);
  }

  async replayMissedEvents(
    topic: string,
    entityId: string,
    lastEventId: string | null,
  ): Promise<Array<{ id: string; payload: Record<string, unknown> }>> {
    const raw = await this.streamService.replayEvents(topic, entityId, lastEventId);
    return raw.map(({ id, data }) => ({
      id,
      payload: JSON.parse(data.payload),
    }));
  }
}
