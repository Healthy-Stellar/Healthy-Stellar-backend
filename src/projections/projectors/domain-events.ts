import { IEvent } from '@nestjs/cqrs';

/**
 * Emitted when a medical record is uploaded.
 */
export class RecordUploadedEvent implements IEvent {
  constructor(
    public readonly recordId: string,
    public readonly patientId: string,
    public readonly cid: string,
    public readonly recordType: string,
    public readonly uploadedBy: string,
    public readonly version: number,
    public readonly occurredAt: Date,
  ) {}
}

/**
 * Emitted when a medical record is amended.
 */
export class RecordAmendedEvent implements IEvent {
  constructor(
    public readonly recordId: string,
    public readonly newCid: string,
    public readonly newVersion: number,
    public readonly amendedBy: string,
    public readonly occurredAt: Date,
  ) {}
}

/**
 * Emitted when an access grant is created.
 */
export class AccessGrantedEvent implements IEvent {
  constructor(
    public readonly grantId: string,
    public readonly patientId: string,
    public readonly providerId: string,
    public readonly grantedBy: string,
    public readonly expiresAt: Date | null,
    public readonly version: number,
    public readonly occurredAt: Date,
  ) {}
}

/**
 * Emitted when an access grant is revoked.
 */
export class AccessRevokedEvent implements IEvent {
  constructor(
    public readonly grantId: string,
    public readonly patientId: string,
    public readonly revokedBy: string,
    public readonly version: number,
    public readonly occurredAt: Date,
  ) {}
}
