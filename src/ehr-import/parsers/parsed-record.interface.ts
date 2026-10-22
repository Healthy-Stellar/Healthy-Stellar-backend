import { RecordType } from '../../records/dto/create-record.dto';

export interface ParsedRecord {
  patientId: string;
  recordType: RecordType;
  description?: string;
  rawPayload: string;
  /** Source system identifier used to build the deduplication fingerprint */
  sourceSystemId?: string;
  /** ISO date string (YYYY-MM-DD) used in the fingerprint */
  recordDate?: string;
}
