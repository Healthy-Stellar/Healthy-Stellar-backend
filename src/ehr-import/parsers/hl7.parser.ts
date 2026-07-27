import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const hl7 = require('simple-hl7');
import { ParsedRecord } from './parsed-record.interface';
import { RecordType } from '../../records/dto/create-record.dto';

@Injectable()
export class Hl7Parser {
  private readonly parser = new hl7.Parser();

  parse(raw: string): ParsedRecord[] {
    // Split on MSH to handle files with multiple messages
    const messages = raw
      .split(/(?=MSH\|)/)
      .map((s) => s.trim())
      .filter(Boolean);

    return messages.map((msg) => {
      const parsed = this.parser.parse(msg);

      // PID segment field[2] component[0] = patient ID (PID-3.1)
      const pid = parsed.segments?.find((s: any) => s.name === 'PID');
      const patientId: string =
        pid?.fields?.[2]?.value?.[0]?.[0]?.value?.[0] ?? 'unknown';

      // MSH field[6] = message type (MSH-9.1)
      const msgType: string =
        parsed.header?.fields?.[6]?.value?.[0]?.[0]?.value?.[0] ?? '';

      return {
        patientId,
        recordType: this._mapMsgType(msgType),
        description: `HL7 ${msgType || 'message'}`,
        rawPayload: msg,
      };
    });
  }

  private _mapMsgType(type: string): RecordType {
    const t = type.toUpperCase();
    if (t === 'ORU' || t.includes('LAB')) return RecordType.LAB_RESULT;
    if (t === 'RDE' || t.includes('RX')) return RecordType.PRESCRIPTION;
    return RecordType.MEDICAL_REPORT;
  }
}
