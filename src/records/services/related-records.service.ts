import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { Record as MedicalRecord } from '../entities/record.entity';
import { RecordType } from '../dto/create-record.dto';
import { RelatedRecordDto } from '../dto/related-record.dto';
import { AccessControlService } from '../../access-control/services/access-control.service';

/** Types that are clinically related to each other */
const RELATED_TYPES: Partial<{ [K in RecordType]: RecordType[] }> = {
  [RecordType.LAB_RESULT]: [RecordType.CONSULTATION, RecordType.MEDICAL_REPORT],
  [RecordType.CONSULTATION]: [RecordType.LAB_RESULT, RecordType.PRESCRIPTION, RecordType.MEDICAL_REPORT],
  [RecordType.PRESCRIPTION]: [RecordType.CONSULTATION, RecordType.MEDICAL_REPORT],
  [RecordType.IMAGING]: [RecordType.CONSULTATION, RecordType.MEDICAL_REPORT],
  [RecordType.MEDICAL_REPORT]: [RecordType.LAB_RESULT, RecordType.CONSULTATION, RecordType.PRESCRIPTION, RecordType.IMAGING],
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_RESULTS = 10;

// Scoring weights
const SCORE_SAME_TYPE = 3;
const SCORE_SAME_PROVIDER = 2;
const SCORE_WITHIN_30_DAYS = 1;

export interface ScoredRecord {
  record: MedicalRecord;
  score: number;
  reasons: string[];
}

@Injectable()
export class RelatedRecordsService {
  constructor(
    @InjectRepository(MedicalRecord)
    private readonly recordRepo: Repository<MedicalRecord>,
    private readonly accessControlService: AccessControlService,
  ) {}

  async findRelated(recordId: string, requesterId: string): Promise<RelatedRecordDto[]> {
    // 1. Load the source record
    const source = await this.recordRepo.findOne({ where: { id: recordId } });
    if (!source) {
      throw new NotFoundException(`Record ${recordId} not found`);
    }

    // 2. Verify requester has access to the source record
    const hasAccess = await this.canAccess(requesterId, source);
    if (!hasAccess) {
      throw new ForbiddenException(`Access denied to record ${recordId}`);
    }

    // 3. Fetch candidate records for the same patient (excluding the source)
    const candidates = await this.recordRepo.find({
      where: { patientId: source.patientId, id: Not(recordId) },
      order: { createdAt: 'DESC' },
    });

    // 4. Score each candidate
    const scored: ScoredRecord[] = candidates
      .map((r) => this.score(source, r))
      .filter((s) => s.score > 0);

    // 5. Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // 6. Enforce access control on each candidate, take top 10
    const results: RelatedRecordDto[] = [];
    for (const { record, score, reasons } of scored) {
      if (results.length >= MAX_RESULTS) break;

      const allowed = await this.canAccess(requesterId, record);
      if (!allowed) continue;

      results.push({
        id: record.id,
        patientId: record.patientId,
        providerId: record.providerId ?? null,
        recordType: record.recordType,
        description: record.description ?? null,
        createdAt: record.createdAt,
        score,
        reasons,
      });
    }

    return results;
  }

  /**
   * Pure scoring function — no I/O, easy to unit-test.
   */
  score(source: MedicalRecord, candidate: MedicalRecord): ScoredRecord {
    let total = 0;
    const reasons: string[] = [];

    // Same type: 3 pts
    if (candidate.recordType === source.recordType) {
      total += SCORE_SAME_TYPE;
      reasons.push('same_type');
    } else {
      // Related type: 1 pt so it surfaces above completely unrelated records
      const relatedTypes = RELATED_TYPES[source.recordType] ?? [];
      if (relatedTypes.includes(candidate.recordType)) {
        reasons.push('related_type');
        total += 1;
      }
    }

    // Same provider: 2 pts (only when both records have a providerId)
    if (source.providerId && candidate.providerId && source.providerId === candidate.providerId) {
      total += SCORE_SAME_PROVIDER;
      reasons.push('same_provider');
    }

    // Within ±30 days: 1 pt
    const diff = Math.abs(candidate.createdAt.getTime() - source.createdAt.getTime());
    if (diff <= THIRTY_DAYS_MS) {
      total += SCORE_WITHIN_30_DAYS;
      reasons.push('within_30_days');
    }

    return { record: candidate, score: total, reasons };
  }

  private async canAccess(requesterId: string, record: MedicalRecord): Promise<boolean> {
    // Patient always has access to their own records
    if (record.patientId === requesterId) return true;

    // Check active access grant
    return this.accessControlService.verifyAccess(requesterId, record.id);
  }
}
