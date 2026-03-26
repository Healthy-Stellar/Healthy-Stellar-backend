import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import { MedicalHistory } from '../../medical-records/entities/medical-history.entity';
import { AccessGrant } from '../../access-control/entities/access-grant.entity';
import {
    TimelineEvent,
    TimelineEventType,
    PatientTimelineResponse,
} from '../dto/patient-timeline.dto';

@Injectable()
export class PatientTimelineService {
    private readonly logger = new Logger(PatientTimelineService.name);

    constructor(
        @InjectRepository(Patient)
        private readonly patientRepo: Repository<Patient>,
        @InjectRepository(MedicalHistory)
        private readonly medicalHistoryRepo: Repository<MedicalHistory>,
        @InjectRepository(AccessGrant)
        private readonly accessGrantRepo: Repository<AccessGrant>,
    ) { }

    async getTimeline(
        patientAddress: string,
        page: number = 1,
        limit: number = 20,
    ): Promise<PatientTimelineResponse> {
        // Verify patient exists
        const patient = await this.patientRepo.findOne({
            where: { stellarAddress: patientAddress },
        });

        if (!patient) {
            throw new NotFoundException(`Patient with address ${patientAddress} not found`);
        }

        const patientId = patient.id;

        // Fetch all events from different sources
        const [medicalEvents, accessEvents] = await Promise.all([
            this.getMedicalRecordEvents(patientId),
            this.getAccessControlEvents(patientId),
        ]);

        // Combine and sort events by timestamp descending
        const allEvents = [...medicalEvents, ...accessEvents].sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );

        // Apply pagination
        const total = allEvents.length;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedEvents = allEvents.slice(startIndex, endIndex);

        const totalPages = Math.ceil(total / limit);

        return {
            data: paginatedEvents,
            total,
            page,
            limit,
            totalPages,
        };
    }

    private async getMedicalRecordEvents(patientId: string): Promise<TimelineEvent[]> {
        const histories = await this.medicalHistoryRepo.find({
            where: { patientId },
            order: { eventDate: 'DESC' },
        });

        const eventTypeMap: Record<string, TimelineEventType> = {
            created: TimelineEventType.RECORD_CREATED,
            updated: TimelineEventType.RECORD_UPDATED,
            viewed: TimelineEventType.RECORD_CREATED,
            shared: TimelineEventType.RECORD_CREATED,
            consent_granted: TimelineEventType.RECORD_CREATED,
            consent_revoked: TimelineEventType.RECORD_CREATED,
            archived: TimelineEventType.RECORD_CREATED,
            restored: TimelineEventType.RECORD_UPDATED,
            deleted: TimelineEventType.RECORD_CREATED,
        };

        return histories.map((history) => ({
            id: history.id,
            eventType: eventTypeMap[history.eventType] || TimelineEventType.RECORD_CREATED,
            timestamp: history.eventDate,
            description: history.eventDescription,
            performedBy: history.performedBy,
            performedByName: history.performedByName,
            metadata: history.eventData,
            resourceId: history.medicalRecordId,
            resourceType: 'MedicalRecord',
        }));
    }

    private async getAccessControlEvents(patientId: string): Promise<TimelineEvent[]> {
        const grants = await this.accessGrantRepo.find({
            where: { patientId },
            order: { createdAt: 'DESC' },
        });

        const events: TimelineEvent[] = [];

        for (const grant of grants) {
            // Add GRANT event
            events.push({
                id: `${grant.id}-grant`,
                eventType: TimelineEventType.ACCESS_GRANTED,
                timestamp: grant.createdAt,
                description: `Access granted to ${grant.granteeId}`,
                performedBy: patientId,
                performedByName: undefined,
                metadata: {
                    grantId: grant.id,
                    granteeId: grant.granteeId,
                    accessLevel: grant.accessLevel,
                    recordIds: grant.recordIds,
                    isEmergency: grant.isEmergency,
                },
                resourceId: grant.id,
                resourceType: 'AccessGrant',
            });

            // Add REVOKE event if applicable
            if (grant.status === 'REVOKED' && grant.revokedAt) {
                events.push({
                    id: `${grant.id}-revoke`,
                    eventType: TimelineEventType.ACCESS_REVOKED,
                    timestamp: grant.revokedAt,
                    description: `Access revoked from ${grant.granteeId}`,
                    performedBy: grant.revokedBy,
                    performedByName: undefined,
                    metadata: {
                        grantId: grant.id,
                        granteeId: grant.granteeId,
                        revocationReason: grant.revocationReason,
                    },
                    resourceId: grant.id,
                    resourceType: 'AccessGrant',
                });
            }
        }

        return events;
    }
}
