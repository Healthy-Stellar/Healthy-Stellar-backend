import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { MedicalRecordVersion } from '../medical-records/entities/medical-record-version.entity';
import { AccessGrant } from '../access-control/entities/access-grant.entity';
import { User } from '../auth/entities/user.entity';
import { Patient } from '../patients/entities/patient.entity';
import { StellarTransaction } from '../analytics/entities/stellar-transaction.entity';

export interface DriftResult {
  table: string;
  sourceCount: number;
  readModelCount: number;
  drift: number;
  checksumMatch: boolean;
  detectedAt: Date;
}

export interface ConsistencyReport {
  healthy: boolean;
  drifts: DriftResult[];
  checkedAt: Date;
}

@Injectable()
export class ConsistencyCheckerService {
  private readonly logger = new Logger(ConsistencyCheckerService.name);

  constructor(
    @InjectRepository(MedicalRecord)
    private readonly medicalRecordRepo: Repository<MedicalRecord>,
    @InjectRepository(MedicalRecordVersion)
    private readonly versionRepo: Repository<MedicalRecordVersion>,
    @InjectRepository(AccessGrant)
    private readonly accessGrantRepo: Repository<AccessGrant>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(StellarTransaction)
    private readonly stellarTxRepo: Repository<StellarTransaction>,
    private readonly dataSource: DataSource,
  ) {}

  async runFullCheck(): Promise<ConsistencyReport> {
    const checks = await Promise.allSettled([
      this.checkMedicalRecordVersionDrift(),
      this.checkOrphanedVersions(),
      this.checkAccessGrantPatientDrift(),
      this.checkStellarTxRecordDrift(),
      this.checkUserPatientDrift(),
    ]);

    const drifts: DriftResult[] = [];
    for (const result of checks) {
      if (result.status === 'fulfilled') {
        drifts.push(...result.value);
      } else {
        this.logger.error(`Consistency check failed: ${result.reason}`);
      }
    }

    const report: ConsistencyReport = {
      healthy: drifts.length === 0,
      drifts,
      checkedAt: new Date(),
    };

    if (!report.healthy) {
      this.logger.warn(
        `Projection drift detected in ${drifts.length} check(s): ${drifts.map((d) => d.table).join(' | ')}`,
      );
      drifts.forEach((d) =>
        this.logger.warn(
          `[DRIFT] ${d.table} — source=${d.sourceCount} readModel=${d.readModelCount} delta=${d.drift}`,
        ),
      );
    } else {
      this.logger.log('Consistency check passed — no projection drift detected');
    }

    return report;
  }

  /** Active medical_records must each have ≥1 version row. */
  private async checkMedicalRecordVersionDrift(): Promise<DriftResult[]> {
    const [src] = await this.dataSource.query<[{ count: string }]>(
      `SELECT COUNT(*) AS count FROM medical_records WHERE status != 'deleted'`,
    );
    const [rm] = await this.dataSource.query<[{ count: string }]>(
      `SELECT COUNT(DISTINCT "medicalRecordId") AS count FROM medical_record_versions`,
    );

    const source = parseInt(src.count, 10);
    const readModel = parseInt(rm.count, 10);
    const drift = source - readModel;
    if (drift === 0) return [];

    return [this.buildResult('medical_records → medical_record_versions', source, readModel, drift)];
  }

  /** Version rows whose parent record no longer exists. */
  private async checkOrphanedVersions(): Promise<DriftResult[]> {
    const [res] = await this.dataSource.query<[{ count: string }]>(
      `SELECT COUNT(*) AS count
       FROM medical_record_versions v
       LEFT JOIN medical_records r ON r.id = v."medicalRecordId"
       WHERE r.id IS NULL`,
    );
    const orphans = parseInt(res.count, 10);
    if (orphans === 0) return [];

    return [this.buildResult('medical_record_versions (orphaned)', 0, orphans, orphans)];
  }

  /** access_grants.patientId must reference an existing patient. */
  private async checkAccessGrantPatientDrift(): Promise<DriftResult[]> {
    const [res] = await this.dataSource.query<[{ count: string }]>(
      `SELECT COUNT(*) AS count
       FROM access_grants ag
       LEFT JOIN patients p ON p.id = ag."patientId"
       WHERE p.id IS NULL`,
    );
    const dangling = parseInt(res.count, 10);
    if (dangling === 0) return [];

    return [this.buildResult('access_grants → patients (dangling patientId)', 0, dangling, dangling)];
  }

  /** stellar_transactions for medical_record type must reference existing records. */
  private async checkStellarTxRecordDrift(): Promise<DriftResult[]> {
    const [res] = await this.dataSource.query<[{ count: string }]>(
      `SELECT COUNT(*) AS count
       FROM stellar_transactions st
       LEFT JOIN medical_records mr ON mr.id = st."relatedEntityId"
       WHERE st."relatedEntityType" = 'medical_record'
         AND mr.id IS NULL`,
    );
    const dangling = parseInt(res.count, 10);
    if (dangling === 0) return [];

    return [this.buildResult('stellar_transactions → medical_records (dangling)', 0, dangling, dangling)];
  }

  /** Patients without a linked user account. */
  private async checkUserPatientDrift(): Promise<DriftResult[]> {
    const [patientCount, userCount] = await Promise.all([
      this.patientRepo.count(),
      this.userRepo.count(),
    ]);

    const [res] = await this.dataSource.query<[{ count: string }]>(
      `SELECT COUNT(*) AS count
       FROM patients p
       LEFT JOIN users u ON u."patientProfileId" = p.id
       WHERE u.id IS NULL`,
    );
    const unlinked = parseInt(res.count, 10);
    if (unlinked === 0) return [];

    return [this.buildResult('patients → users (unlinked)', patientCount, userCount, unlinked)];
  }

  private buildResult(
    table: string,
    sourceCount: number,
    readModelCount: number,
    drift: number,
  ): DriftResult {
    return { table, sourceCount, readModelCount, drift, checksumMatch: false, detectedAt: new Date() };
  }
}
