import { DomainEvent } from './domain-events';

export interface MedicalRecordState {
  id: string;
  patientId: string;
  cid: string;
  recordType: string;
  stellarTxHash: string | null;
  accessGrants: string[];
  isDeleted: boolean;
  version: number;
}

/**
 * Aggregate root for a medical record.
 * Reconstructs current state by replaying domain events in order.
 */
export class MedicalRecordAggregate {
  private _state: MedicalRecordState = {
    id: '',
    patientId: '',
    cid: '',
    recordType: '',
    stellarTxHash: null,
    accessGrants: [],
    isDeleted: false,
    version: 0,
  };

  get state(): Readonly<MedicalRecordState> {
    return this._state;
  }

  /** Replay an ordered list of domain events to rebuild current state. */
  static rehydrate(aggregateId: string, events: DomainEvent[]): MedicalRecordAggregate {
    const aggregate = new MedicalRecordAggregate();
    aggregate._state.id = aggregateId;
    for (const event of events) {
      aggregate.apply(event);
    }
    return aggregate;
  }

  /** Apply a single event to the current state (pure — no side effects). */
  apply(event: DomainEvent): void {
    switch (event.eventType) {
      case 'RecordUploaded': {
        const p = event.payload as { patientId: string; cid: string; recordType: string };
        this._state = {
          ...this._state,
          id: event.aggregateId,
          patientId: p.patientId,
          cid: p.cid,
          recordType: p.recordType,
          isDeleted: false,
        };
        break;
      }

      case 'AccessGranted': {
        const p = event.payload as { grantedTo: string };
        if (!this._state.accessGrants.includes(p.grantedTo)) {
          this._state = {
            ...this._state,
            accessGrants: [...this._state.accessGrants, p.grantedTo],
          };
        }
        break;
      }

      case 'AccessRevoked': {
        const p = event.payload as { revokedFrom: string };
        this._state = {
          ...this._state,
          accessGrants: this._state.accessGrants.filter((g) => g !== p.revokedFrom),
        };
        break;
      }

      case 'RecordAmended': {
        const p = event.payload as { changes: Record<string, unknown> };
        this._state = { ...this._state, ...(p.changes as Partial<MedicalRecordState>) };
        break;
      }

      case 'EmergencyAccessCreated': {
        const p = event.payload as { accessedBy: string };
        if (!this._state.accessGrants.includes(p.accessedBy)) {
          this._state = {
            ...this._state,
            accessGrants: [...this._state.accessGrants, p.accessedBy],
          };
        }
        break;
      }

      case 'RecordDeleted': {
        this._state = { ...this._state, isDeleted: true };
        break;
      }
    }

    this._state = { ...this._state, version: this._state.version + 1 };
  }
}
