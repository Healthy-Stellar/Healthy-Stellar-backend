import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Stores HTTP idempotency key → response mappings for mutating endpoints.
 * Keyed by `<tenantId>:<userId>:<Idempotency-Key header>` to prevent
 * cross-tenant/cross-user collisions.
 */
@Entity('http_idempotency_keys')
export class HttpIdempotencyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Composite key: tenantId:userId:clientKey */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 512 })
  key: string;

  /** HTTP status code of the original response */
  @Column({ type: 'int' })
  statusCode: number;

  /** Serialised response body */
  @Column({ type: 'jsonb' })
  body: Record<string, any>;

  /** Response headers to replay (content-type, location, etc.) */
  @Column({ type: 'jsonb', default: '{}' })
  headers: Record<string, string>;

  /** Request fingerprint (method + path) for mismatch detection */
  @Column({ type: 'varchar', length: 512 })
  requestFingerprint: string;

  @CreateDateColumn()
  createdAt: Date;
}
