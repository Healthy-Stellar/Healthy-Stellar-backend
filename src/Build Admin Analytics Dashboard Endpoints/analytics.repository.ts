import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  OverviewMetrics,
  DailyActivityPoint,
  TopProvider,
} from './dto/activity-query.dto';

@Injectable()
export class AnalyticsRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Runs five COUNT queries in parallel against indexed columns.
   * All counts run at the DB level — no in-memory aggregation.
   */
  async getOverview(): Promise<OverviewMetrics> {
    const [
      [{ total_users }],
      [{ total_records }],
      [{ total_grants }],
      [{ active_grants }],
      [{ stellar_txns }],
    ] = await Promise.all([
      this.dataSource.query<[{ total_users: string }]>(
        `SELECT COUNT(*)::int AS total_users FROM users`,
      ),
      this.dataSource.query<[{ total_records: string }]>(
        `SELECT COUNT(*)::int AS total_records FROM records`,
      ),
      this.dataSource.query<[{ total_grants: string }]>(
        `SELECT COUNT(*)::int AS total_grants FROM access_grants`,
      ),
      this.dataSource.query<[{ active_grants: string }]>(
        `SELECT COUNT(*)::int AS active_grants
         FROM access_grants
         WHERE status = 'active'
           AND (expires_at IS NULL OR expires_at > NOW())`,
      ),
      this.dataSource.query<[{ stellar_txns: string }]>(
        `SELECT COUNT(*)::int AS stellar_txns FROM stellar_transactions`,
      ),
    ]);

    return {
      totalUsers: Number(total_users),
      totalRecords: Number(total_records),
      totalAccessGrants: Number(total_grants),
      activeGrants: Number(active_grants),
      stellarTransactions: Number(stellar_txns),
    };
  }

  /**
   * Uses date_trunc + GROUP BY to produce a daily time-series entirely in Postgres.
   * Generates a complete date spine via generate_series so days with zero events
   * are included (no gaps). Two CTEs are UNION-joined in one round-trip.
   */
  async getDailyActivity(
    from: Date,
    to: Date,
  ): Promise<DailyActivityPoint[]> {
    const rows = await this.dataSource.query<
      Array<{ day: string; record_uploads: string; access_events: string }>
    >(
      `
      WITH date_spine AS (
        SELECT generate_series(
          date_trunc('day', $1::timestamptz),
          date_trunc('day', $2::timestamptz),
          '1 day'::interval
        ) AS day
      ),
      uploads AS (
        SELECT date_trunc('day', created_at) AS day, COUNT(*)::int AS cnt
        FROM records
        WHERE created_at BETWEEN $1 AND $2
        GROUP BY 1
      ),
      accesses AS (
        SELECT date_trunc('day', accessed_at) AS day, COUNT(*)::int AS cnt
        FROM access_events
        WHERE accessed_at BETWEEN $1 AND $2
        GROUP BY 1
      )
      SELECT
        to_char(ds.day, 'YYYY-MM-DD')           AS day,
        COALESCE(u.cnt, 0)                       AS record_uploads,
        COALESCE(a.cnt, 0)                       AS access_events
      FROM date_spine ds
      LEFT JOIN uploads  u ON u.day  = ds.day
      LEFT JOIN accesses a ON a.day  = ds.day
      ORDER BY ds.day
      `,
      [from.toISOString(), to.toISOString()],
    );

    return rows.map((r) => ({
      date: r.day,
      recordUploads: Number(r.record_uploads),
      accessEvents: Number(r.access_events),
    }));
  }

  /**
   * Aggregates active grants per provider entirely in SQL.
   * Joined to users to surface a human-readable name.
   */
  async getTopProviders(limit = 10): Promise<TopProvider[]> {
    const rows = await this.dataSource.query<
      Array<{
        provider_id: string;
        provider_name: string;
        active_grant_count: string;
      }>
    >(
      `
      SELECT
        ag.provider_id,
        u.name            AS provider_name,
        COUNT(*)::int     AS active_grant_count
      FROM access_grants ag
      JOIN users u ON u.id = ag.provider_id
      WHERE ag.status = 'active'
        AND (ag.expires_at IS NULL OR ag.expires_at > NOW())
      GROUP BY ag.provider_id, u.name
      ORDER BY active_grant_count DESC
      LIMIT $1
      `,
      [limit],
    );

    return rows.map((r) => ({
      providerId: r.provider_id,
      providerName: r.provider_name,
      activeGrantCount: Number(r.active_grant_count),
    }));
  }
}
