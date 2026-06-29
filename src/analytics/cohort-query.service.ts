import { Injectable, Logger } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { ReadReplicaService } from '../database/read-replica.service';
import { Patient } from '../patients/entities/patient.entity';
import { CohortQueryDto } from './dto/cohort-query.dto';
import { CohortPatientSummaryDto, CohortStatisticsDto } from './dto/cohort-response.dto';

interface CohortRow {
  patientId: string;
  dateOfBirth: string;
  admissionDate: string | null;
  dischargeDate: string | null;
  isAdmitted: boolean;
  wardId: string | null;
}

export interface CohortQueryResult {
  rows: CohortPatientSummaryDto[];
  total: number;
  statistics: CohortStatisticsDto;
}

/**
 * Builds and executes the cohort query described in issue #685:
 * filter patients by diagnosis code, admission date range, age range
 * (derived from date of birth) and ward, then return matching patient IDs
 * plus summary statistics.
 *
 * All cohort queries run against the analytics read-replica connection
 * (see ReadReplicaService) rather than the primary database, since these
 * are aggregate/scan-heavy queries that should not contend with OLTP
 * traffic.
 *
 * Data-model note: "ward" reflects the patient's *current* bed/room/ward
 * assignment (beds.patientId -> rooms.wardId -> wards), since this
 * codebase does not yet track historical ward assignments per stay.
 * "Diagnosis code" matches against medical_codes.code via diagnoses.icd10CodeId.
 */
@Injectable()
export class CohortQueryService {
  private readonly logger = new Logger(CohortQueryService.name);

  constructor(private readonly readReplicaService: ReadReplicaService) {}

  /**
   * Builds the base TypeORM query for the cohort, applying every filter in
   * CohortQueryDto. Exposed separately from `run()` so reports can reuse
   * the same filter-building logic against their own base queries.
   */
  buildQuery(filters: CohortQueryDto): SelectQueryBuilder<Patient> {
    const dataSource = this.readReplicaService.getDataSource();
    const qb = dataSource
      .createQueryBuilder()
      .select('patient.id', 'patientId')
      .addSelect('patient.dateOfBirth', 'dateOfBirth')
      .addSelect('patient.admissionDate', 'admissionDate')
      .addSelect('patient.dischargeDate', 'dischargeDate')
      .addSelect('patient.isAdmitted', 'isAdmitted')
      .addSelect('bed.roomId', 'roomId')
      .addSelect('room.wardId', 'wardId')
      .from(Patient, 'patient')
      .leftJoin('beds', 'bed', 'bed."patientId" = patient.id AND bed."isActive" = true')
      .leftJoin('rooms', 'room', 'room.id = bed."roomId"')
      .where('patient."isActive" = true');

    if (filters.diagnosisCodes?.length) {
      qb.andWhere(
        `patient.id IN (
          SELECT d."patientId" FROM diagnoses d
          INNER JOIN medical_codes mc ON mc.id = d."icd10CodeId"
          WHERE mc.code IN (:...diagnosisCodes)
        )`,
        { diagnosisCodes: filters.diagnosisCodes },
      );
    }

    if (filters.admissionDateFrom) {
      qb.andWhere('patient."admissionDate" >= :admissionDateFrom', {
        admissionDateFrom: filters.admissionDateFrom,
      });
    }

    if (filters.admissionDateTo) {
      qb.andWhere('patient."admissionDate" <= :admissionDateTo', {
        admissionDateTo: filters.admissionDateTo,
      });
    }

    if (filters.minAge !== undefined) {
      // age >= minAge  <=>  dateOfBirth <= today - minAge years
      qb.andWhere(`patient."dateOfBirth" <= (CURRENT_DATE - (:minAge || ' years')::interval)`, {
        minAge: filters.minAge,
      });
    }

    if (filters.maxAge !== undefined) {
      // age <= maxAge  <=>  dateOfBirth > today - (maxAge + 1) years
      qb.andWhere(`patient."dateOfBirth" > (CURRENT_DATE - (:maxAgeExclusive || ' years')::interval)`, {
        maxAgeExclusive: filters.maxAge + 1,
      });
    }

    if (filters.wardIds?.length) {
      qb.andWhere('room."wardId" IN (:...wardIds)', { wardIds: filters.wardIds });
    }

    return qb;
  }

  async run(filters: CohortQueryDto): Promise<CohortQueryResult> {
    const qb = this.buildQuery(filters);

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const total = await qb.getCount();

    const rawRows: CohortRow[] = await qb
      .orderBy('patient.id', 'ASC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany();

    const rows = rawRows.map((row) => this.toSummaryDto(row));
    const statistics = await this.computeStatistics(filters);

    return { rows, total, statistics };
  }

  /**
   * Aggregate statistics (count, avg length of stay, avg age, currently-admitted
   * count) computed across the *full* matching cohort, independent of pagination.
   */
  private async computeStatistics(filters: CohortQueryDto): Promise<CohortStatisticsDto> {
    const qb = this.buildQuery(filters);

    const statsRow = await qb
      .select('COUNT(*)', 'count')
      .addSelect(
        `AVG(EXTRACT(EPOCH FROM (patient."dischargeDate"::timestamp - patient."admissionDate"::timestamp)) / 86400)`,
        'avgLengthOfStayDays',
      )
      .addSelect(
        `AVG(EXTRACT(YEAR FROM AGE(CURRENT_DATE, patient."dateOfBirth"::date)))`,
        'avgAgeYears',
      )
      .addSelect(`COUNT(*) FILTER (WHERE patient."isAdmitted" = true)`, 'currentlyAdmittedCount')
      .getRawOne<{
        count: string;
        avgLengthOfStayDays: string | null;
        avgAgeYears: string | null;
        currentlyAdmittedCount: string;
      }>();

    return {
      count: parseInt(statsRow?.count ?? '0', 10),
      averageLengthOfStayDays:
        statsRow?.avgLengthOfStayDays != null ? Math.round(Number(statsRow.avgLengthOfStayDays) * 100) / 100 : null,
      averageAgeYears:
        statsRow?.avgAgeYears != null ? Math.round(Number(statsRow.avgAgeYears) * 100) / 100 : null,
      currentlyAdmittedCount: parseInt(statsRow?.currentlyAdmittedCount ?? '0', 10),
    };
  }

  private toSummaryDto(row: CohortRow): CohortPatientSummaryDto {
    const ageYears = row.dateOfBirth ? this.computeAge(row.dateOfBirth) : null;
    const lengthOfStayDays =
      row.admissionDate && row.dischargeDate
        ? this.diffInDays(row.admissionDate, row.dischargeDate)
        : null;

    return {
      patientId: row.patientId,
      ageYears,
      admissionDate: row.admissionDate ?? null,
      dischargeDate: row.dischargeDate ?? null,
      lengthOfStayDays,
      wardId: row.wardId ?? null,
    };
  }

  private computeAge(dateOfBirth: string): number {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  }

  private diffInDays(from: string, to: string): number {
    const ms = new Date(to).getTime() - new Date(from).getTime();
    return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
  }
}
