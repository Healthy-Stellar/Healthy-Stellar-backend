import { Injectable } from '@nestjs/common';
import { ParsedRecord } from './parsed-record.interface';
import { RecordType } from '../../records/dto/create-record.dto';

export interface CsvColumnMap {
  patientId: string;
  recordType: string;
  description?: string;
}

const DEFAULT_MAP: CsvColumnMap = {
  patientId: 'patientId',
  recordType: 'recordType',
  description: 'description',
};

@Injectable()
export class CsvParser {
  /** Parse CSV text into ParsedRecord[]. Column names are configurable. */
  parse(csv: string, columnMap: CsvColumnMap = DEFAULT_MAP): ParsedRecord[] {
    const lines = csv.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim());
    const idx = (col: string) => headers.indexOf(col);

    const pidIdx = idx(columnMap.patientId);
    const rtIdx = idx(columnMap.recordType);
    const descIdx = columnMap.description ? idx(columnMap.description) : -1;

    return lines.slice(1).map((line) => {
      const cols = line.split(',').map((c) => c.trim());
      const rawType = cols[rtIdx] ?? '';
      return {
        patientId: cols[pidIdx] ?? 'unknown',
        recordType: this._mapType(rawType),
        description: descIdx >= 0 ? cols[descIdx] : undefined,
        rawPayload: line,
      };
    });
  }

  private _mapType(raw: string): RecordType {
    const t = raw.toUpperCase().replace(/[^A-Z_]/g, '_');
    return (RecordType as any)[t] ?? RecordType.MEDICAL_REPORT;
  }
}
