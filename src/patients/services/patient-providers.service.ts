import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GrantStatus } from '../../access-control/entities/access-grant.entity';

export interface ProviderSummary {
  providerId: string;
  stellarAddress: string | null;
  name: string;
  specialization: string | null;
  firstInteractionAt: Date;
  recordCount: number;
}

export interface PaginatedProviders {
  data: ProviderSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface PatientProvidersQueryDto {
  page?: number;
  limit?: number;
}

@Injectable()
export class PatientProvidersService {
  constructor(private readonly dataSource: DataSource) {}

  async getProvidersForPatient(
    patientId: string,
    query: PatientProvidersQueryDto,
  ): Promise<PaginatedProviders> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const raw: Array<{
      provider_id: string;
      first_interaction_at: Date;
      record_count: string;
    }> = await this.dataSource.query(
      `
      SELECT
        provider_id,
        MIN(first_interaction_at) AS first_interaction_at,
        SUM(record_count)::int    AS record_count
      FROM (
        SELECT
          "createdBy"        AS provider_id,
          MIN("createdAt")   AS first_interaction_at,
          COUNT(*)           AS record_count
        FROM medical_records
        WHERE "patientId" = $1
          AND "createdBy" IS NOT NULL
        GROUP BY "createdBy"

        UNION ALL

        SELECT
          "granteeId"        AS provider_id,
          MIN("createdAt")   AS first_interaction_at,
          0                  AS record_count
        FROM access_grants
        WHERE "patientId" = $1
          AND status = $2
          AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
        GROUP BY "granteeId"
      ) combined
      GROUP BY provider_id
      ORDER BY first_interaction_at DESC
      LIMIT $3 OFFSET $4
      `,
      [patientId, GrantStatus.ACTIVE, limit, offset],
    );

    const countResult: Array<{ total: string }> = await this.dataSource.query(
      `
      SELECT COUNT(DISTINCT provider_id)::int AS total
      FROM (
        SELECT "createdBy" AS provider_id
        FROM medical_records
        WHERE "patientId" = $1 AND "createdBy" IS NOT NULL

        UNION

        SELECT "granteeId" AS provider_id
        FROM access_grants
        WHERE "patientId" = $1
          AND status = $2
          AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
      ) combined
      `,
      [patientId, GrantStatus.ACTIVE],
    );

    const total = parseInt(countResult[0]?.total ?? '0', 10);

    if (raw.length === 0) {
      return { data: [], total, page, limit };
    }

    const providerIds = raw.map((r) => r.provider_id);
    const users: Array<{
      id: string;
      firstName: string;
      lastName: string;
      specialization: string | null;
      stellarPublicKey: string | null;
    }> = await this.dataSource.query(
      `SELECT id, "firstName", "lastName", specialization, "stellarPublicKey"
       FROM users
       WHERE id = ANY($1::uuid[])`,
      [providerIds],
    );

    const userMap = new Map(users.map((u) => [u.id, u]));

    const data: ProviderSummary[] = raw.map((row) => {
      const user = userMap.get(row.provider_id);
      return {
        providerId: row.provider_id,
        stellarAddress: user?.stellarPublicKey ?? null,
        name: user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : row.provider_id,
        specialization: user?.specialization ?? null,
        firstInteractionAt: row.first_interaction_at,
        recordCount: Number(row.record_count),
      };
    });

    return { data, total, page, limit };
  }
}
