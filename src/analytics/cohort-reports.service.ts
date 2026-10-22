import { Injectable } from '@nestjs/common';
import { ReadReplicaService } from '../database/read-replica.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { ReadmissionRateRowDto } from './dto/readmission-rate-response.dto';
import { LengthOfStayRowDto } from './dto/length-of-stay-response.dto';

interface ReadmissionRawRow {
  icd10Category: string;
  indexEpisodeCount: string;
  readmissionCount: string;
}

interface LengthOfStayRawRow {
  wardId: string;
  wardName: string;
  month: string;
  stayCount: string;
  avgLengthOfStayDays: string | null;
}

const READMISSION_WINDOW_DAYS = 30;

/**
 * Built-in cohort reports for issue #685:
 *  - 30-day readmission rate per ICD-10 category
 *  - average length of stay per ward per month
 *
 * Both run against the analytics read-replica connection (ReadReplicaService)
 * rather than the primary database.
 *
 * Readmission methodology (documented limitation): this codebase does not
 * have an admission-episode history table — `patients.admissionDate` /
 * `dischargeDate` only track the patient's single most recent stay. The
 * `diagnoses` table, however, does record a timestamped clinical event
 * (`diagnosisDate`) per patient per ICD-10 code, and a patient can have many
 * diagnosis rows over time. We treat each diagnosis as an "episode" of that
 * ICD-10 category, and count an episode as a 30-day readmission when the
 * same patient has another diagnosis in the same category within 30 days
 * of a prior one. This is a reasonable proxy given the available data, but
 * it is not equivalent to true admission-level readmission tracking — see
 * the PR description for the recommended follow-up (an admissions/episodes
 * table keyed by patient + ward + admission/discharge timestamps).
 */
@Injectable()
export class CohortReportsService {
  constructor(private readonly readReplicaService: ReadReplicaService) {}

  async getReadmissionRateReport(
    query: ReportQueryDto,
  ): Promise<{ rows: ReadmissionRateRowDto[]; total: number }> {
    const dataSource = this.readReplicaService.getDataSource();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const params: Record<string, unknown> = { windowDays: READMISSION_WINDOW_DAYS };
    const dateFilters: string[] = [];
    if (query.from) {
      dateFilters.push('d."diagnosisDate" >= :from');
      params.from = query.from;
    }
    if (query.to) {
      dateFilters.push('d."diagnosisDate" <= :to');
      params.to = query.to;
    }
    const dateFilterSql = dateFilters.length ? `AND ${dateFilters.join(' AND ')}` : '';

    // Episodes: every diagnosis row, tagged with its ICD-10 category and
    // whether another diagnosis in the same category for the same patient
    // occurred within the readmission window after it.
    const sql = `
      WITH episodes AS (
        SELECT
          d.id AS diagnosis_id,
          d."patientId" AS patient_id,
          COALESCE(mc.category, mc.code) AS icd10_category,
          d."diagnosisDate" AS diagnosis_date,
          LEAD(d."diagnosisDate") OVER (
            PARTITION BY d."patientId", COALESCE(mc.category, mc.code)
            ORDER BY d."diagnosisDate"
          ) AS next_diagnosis_date
        FROM diagnoses d
        INNER JOIN medical_codes mc ON mc.id = d."icd10CodeId"
        WHERE mc."codeType" = 'ICD10-CM' ${dateFilterSql}
      ),
      aggregated AS (
        SELECT
          icd10_category,
          COUNT(*) AS index_episode_count,
          COUNT(*) FILTER (
            WHERE next_diagnosis_date IS NOT NULL
              AND next_diagnosis_date <= diagnosis_date + (:windowDays || ' days')::interval
          ) AS readmission_count
        FROM episodes
        GROUP BY icd10_category
      )
      SELECT
        icd10_category AS "icd10Category",
        index_episode_count AS "indexEpisodeCount",
        readmission_count AS "readmissionCount"
      FROM aggregated
      ORDER BY icd10_category ASC
      LIMIT :limit OFFSET :offset
    `;

    const countSql = `
      WITH episodes AS (
        SELECT COALESCE(mc.category, mc.code) AS icd10_category
        FROM diagnoses d
        INNER JOIN medical_codes mc ON mc.id = d."icd10CodeId"
        WHERE mc."codeType" = 'ICD10-CM' ${dateFilterSql}
      )
      SELECT COUNT(DISTINCT icd10_category) AS total FROM episodes
    `;

    const [rawRows, countResult] = await Promise.all([
      this.runNamedQuery<ReadmissionRawRow>(dataSource, sql, {
        ...params,
        limit,
        offset: (page - 1) * limit,
      }),
      this.runNamedQuery<{ total: string }>(dataSource, countSql, params),
    ]);

    const total = parseInt(countResult?.[0]?.total ?? '0', 10);

    const rows: ReadmissionRateRowDto[] = rawRows.map((row) => {
      const indexEpisodeCount = parseInt(row.indexEpisodeCount, 10);
      const readmissionCount = parseInt(row.readmissionCount, 10);
      return {
        icd10Category: row.icd10Category,
        indexEpisodeCount,
        readmissionCount,
        readmissionRatePercent:
          indexEpisodeCount > 0 ? Math.round((readmissionCount / indexEpisodeCount) * 10000) / 100 : 0,
      };
    });

    return { rows, total };
  }

  async getLengthOfStayReport(
    query: ReportQueryDto,
  ): Promise<{ rows: LengthOfStayRowDto[]; total: number }> {
    const dataSource = this.readReplicaService.getDataSource();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const params: Record<string, unknown> = {};
    const dateFilters: string[] = [];
    if (query.from) {
      dateFilters.push('bed."assignedAt" >= :from');
      params.from = query.from;
    }
    if (query.to) {
      dateFilters.push('bed."assignedAt" <= :to');
      params.to = query.to;
    }
    const dateFilterSql = dateFilters.length ? `AND ${dateFilters.join(' AND ')}` : '';

    // Length of stay per ward/month, derived from bed assignment history
    // (beds.assignedAt = stay start in that ward). End of stay is the
    // patient's dischargeDate when available, otherwise "now" for
    // currently-occupied beds (an open/ongoing stay, included for
    // visibility but naturally pulls the average toward more recent dates).
    const sql = `
      WITH stays AS (
        SELECT
          w.id AS ward_id,
          w.name AS ward_name,
          to_char(bed."assignedAt", 'YYYY-MM') AS month,
          EXTRACT(
            EPOCH FROM (
              COALESCE(p."dischargeDate"::timestamp, NOW()) - bed."assignedAt"
            )
          ) / 86400 AS length_of_stay_days
        FROM beds bed
        INNER JOIN rooms r ON r.id = bed."roomId"
        INNER JOIN wards w ON w.id = r."wardId"
        LEFT JOIN patients p ON p.id = bed."patientId"
        WHERE bed."assignedAt" IS NOT NULL ${dateFilterSql}
      )
      SELECT
        ward_id AS "wardId",
        ward_name AS "wardName",
        month,
        COUNT(*) AS "stayCount",
        AVG(length_of_stay_days) AS "avgLengthOfStayDays"
      FROM stays
      GROUP BY ward_id, ward_name, month
      ORDER BY month DESC, ward_name ASC
      LIMIT :limit OFFSET :offset
    `;

    const countSql = `
      WITH stays AS (
        SELECT w.id AS ward_id, to_char(bed."assignedAt", 'YYYY-MM') AS month
        FROM beds bed
        INNER JOIN rooms r ON r.id = bed."roomId"
        INNER JOIN wards w ON w.id = r."wardId"
        WHERE bed."assignedAt" IS NOT NULL ${dateFilterSql}
      )
      SELECT COUNT(DISTINCT (ward_id, month)) AS total FROM stays
    `;

    const [rawRows, countResult] = await Promise.all([
      this.runNamedQuery<LengthOfStayRawRow>(dataSource, sql, {
        ...params,
        limit,
        offset: (page - 1) * limit,
      }),
      this.runNamedQuery<{ total: string }>(dataSource, countSql, params),
    ]);

    const total = parseInt(countResult?.[0]?.total ?? '0', 10);

    const rows: LengthOfStayRowDto[] = rawRows.map((row) => ({
      wardId: row.wardId,
      wardName: row.wardName,
      month: row.month,
      stayCount: parseInt(row.stayCount, 10),
      averageLengthOfStayDays:
        row.avgLengthOfStayDays != null ? Math.round(Number(row.avgLengthOfStayDays) * 100) / 100 : 0,
    }));

    return { rows, total };
  }

  /**
   * Executes a query written with `:namedParam` placeholders against a raw
   * Postgres connection, converting both the SQL text (to `$1, $2, ...`)
   * and the params object (to a positionally-ordered array) consistently.
   */
  private async runNamedQuery<T>(
    dataSource: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
    sql: string,
    params: Record<string, unknown>,
  ): Promise<T[]> {
    const order: string[] = [];
    const positionalSql = sql.replace(/:(\w+)/g, (_match, name: string) => {
      let index = order.indexOf(name);
      if (index === -1) {
        order.push(name);
        index = order.length - 1;
      }
      return `$${index + 1}`;
    });
    const values = order.map((name) => params[name]);
    return dataSource.query(positionalSql, values) as Promise<T[]>;
  }
}
