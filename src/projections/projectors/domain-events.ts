/**
 * Domain-event classes consumed by the CQRS projection system.
 *
 * These events are published by the write-side aggregates and handled
 * by the projection-side event handlers (projectors) to build read models.
 */

export class RecordUploadedEvent {
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

export class RecordAmendedEvent {
  constructor(
    public readonly recordId: string,
    public readonly newVersion: number,
    public readonly newCid: string,
    public readonly amendedBy: string,
    public readonly amendmentReason: string,
    public readonly version: number,
    public readonly occurredAt: Date,
  ) {}
}

export class AccessGrantedEvent {
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

export class AccessRevokedEvent {
  constructor(
    public readonly grantId: string,
    public readonly patientId: string,
    public readonly revokedBy: string,
    public readonly version: number,
    public readonly occurredAt: Date,
  ) {}
}
