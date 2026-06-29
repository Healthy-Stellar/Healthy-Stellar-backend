import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';

const OLD_SECRET_TTL_MS = 60 * 60 * 1000; // 1 hour

interface SecretSlot {
  version: string;
  secret: string;
  activatedAt: Date;
  /** Non-null only for retired slots — the time after which verify() rejects this slot. */
  expiresAt?: Date;
}

interface DbCredentialSlot {
  version: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  activatedAt: Date;
  expiresAt?: Date;
}

export interface RotationAuditEvent {
  type: 'jwt' | 'database';
  newVersion: string;
  previousVersion: string | null;
  rotatedAt: Date;
}

/**
 * Manages runtime rotation of JWT signing secrets and database credentials
 * without a process restart (zero-downtime).
 *
 * JWT rotation model:
 *   1. New secret becomes active immediately for signing.
 *   2. Previous secret is kept for 1 hour so in-flight tokens remain verifiable.
 *   3. After 1 hour the old slot is evicted on the next verify call.
 *
 * Database rotation model:
 *   1. Primary credentials are the active pool config.
 *   2. Secondary credentials are retained for 1 hour during drain.
 */
@Injectable()
export class SecretRotationService implements OnModuleInit {
  private readonly logger = new Logger(SecretRotationService.name);

  /** Ordered newest-first; max 2 entries (active + previous). */
  private slots: SecretSlot[] = [];

  /** Database credential slots — primary (index 0) and optional secondary. */
  private dbSlots: DbCredentialSlot[] = [];

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onModuleInit(): void {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    const version = this.config.get<string>('JWT_SECRET_VERSION', 'v1');
    this.slots = [{ version, secret, activatedAt: new Date() }];
    this.logger.log(`SecretRotationService initialised — active JWT secret version: ${version}`);
  }

  // ── JWT API ────────────────────────────────────────────────────────────────

  /** Active secret used for signing new tokens. */
  get activeSecret(): string {
    return this.slots[0].secret;
  }

  /** Active version label. */
  get activeVersion(): string {
    return this.slots[0].version;
  }

  rotateJwtSecret(newSecret: string, newVersion: string): void {
    if (!newSecret || newSecret.length < 32) {
      throw new Error('JWT secret must be at least 32 characters');
    }
    if (this.slots.some((s) => s.version === newVersion)) {
      throw new Error(`Secret version "${newVersion}" is already loaded`);
    }

    const previousVersion = this.slots[0]?.version ?? null;
    const expiry = new Date(Date.now() + OLD_SECRET_TTL_MS);

    this.slots = [
      { version: newVersion, secret: newSecret, activatedAt: new Date() },
      { ...this.slots[0], expiresAt: expiry },
    ];

    this.logger.log(
      `JWT secret rotated — new active version: ${newVersion}, ` +
        `previous version ${this.slots[1].version} expires at ${expiry.toISOString()}`,
    );

    this.emitRotationAuditEvent({ type: 'jwt', newVersion, previousVersion, rotatedAt: new Date() });
  }

  sign(payload: object, options?: Parameters<JwtService['sign']>[1]): string {
    return this.jwtService.sign(payload, {
      ...options,
      secret: this.activeSecret,
    });
  }

  verify<T extends object = Record<string, unknown>>(
    token: string,
    options?: Parameters<JwtService['verify']>[1],
  ): T | null {
    this.pruneExpiredSlots();
    for (const slot of this.slots) {
      try {
        return this.jwtService.verify<T>(token, { ...options, secret: slot.secret });
      } catch {
        // try next slot
      }
    }
    return null;
  }

  status(): Array<{ version: string; activatedAt: Date; active: boolean; expiresAt?: Date }> {
    this.pruneExpiredSlots();
    return this.slots.map((s, i) => ({
      version: s.version,
      activatedAt: s.activatedAt,
      active: i === 0,
      expiresAt: s.expiresAt,
    }));
  }

  // ── Database credential API ───────────────────────────────────────────────

  /** Currently active DB credentials. */
  get activeDbCredentials(): DbCredentialSlot | null {
    return this.dbSlots[0] ?? null;
  }

  /** All live DB credential slots (primary + optional secondary during drain). */
  get allDbCredentials(): DbCredentialSlot[] {
    this.pruneExpiredDbSlots();
    return this.dbSlots;
  }

  rotateDatabaseCredentials(
    newCreds: Omit<DbCredentialSlot, 'activatedAt' | 'expiresAt'>,
  ): void {
    if (!newCreds.username || !newCreds.password) {
      throw new Error('Database username and password are required');
    }
    if (this.dbSlots.some((s) => s.version === newCreds.version)) {
      throw new Error(`DB credential version "${newCreds.version}" is already loaded`);
    }

    const previousVersion = this.dbSlots[0]?.version ?? null;
    const expiry = new Date(Date.now() + OLD_SECRET_TTL_MS);

    const previous = this.dbSlots[0]
      ? { ...this.dbSlots[0], expiresAt: expiry }
      : undefined;

    this.dbSlots = [
      { ...newCreds, activatedAt: new Date() },
      ...(previous ? [previous] : []),
    ];

    this.logger.log(
      `DB credentials rotated — new active version: ${newCreds.version}` +
        (previousVersion ? `, previous version ${previousVersion} retained for drain window` : ''),
    );

    this.emitRotationAuditEvent({
      type: 'database',
      newVersion: newCreds.version,
      previousVersion,
      rotatedAt: new Date(),
    });
  }

  dbRotationStatus(): Array<{ version: string; host: string; activatedAt: Date; active: boolean; expiresAt?: Date }> {
    this.pruneExpiredDbSlots();
    return this.dbSlots.map((s, i) => ({
      version: s.version,
      host: s.host,
      activatedAt: s.activatedAt,
      active: i === 0,
      expiresAt: s.expiresAt,
    }));
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private pruneExpiredSlots(): void {
    const now = Date.now();
    this.slots = this.slots.filter((s, i) => i === 0 || !s.expiresAt || s.expiresAt.getTime() > now);
  }

  private pruneExpiredDbSlots(): void {
    const now = Date.now();
    this.dbSlots = this.dbSlots.filter((s, i) => i === 0 || !s.expiresAt || s.expiresAt.getTime() > now);
  }

  private emitRotationAuditEvent(event: RotationAuditEvent): void {
    this.eventEmitter.emit('secrets.rotated', event);
    this.logger.log(
      `[audit] secrets.rotated type=${event.type} newVersion=${event.newVersion} previousVersion=${event.previousVersion ?? 'none'}`,
    );
  }
}
