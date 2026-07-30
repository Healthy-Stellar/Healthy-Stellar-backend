import { BadRequestException, Injectable } from '@nestjs/common';

const FIELD_SEP = '|';
const COMPONENT_SEP = '^';

export interface ParsedHl7LabResult {
  loincCode: string;
  observationText?: string;
  value: string;
  units?: string;
  referenceRange?: string;
  abnormalFlag?: string;
  resultStatus?: string;
  observedAt?: Date;
}

export interface ParsedHl7LabOrder {
  placerOrderNumber?: string;
  fillerOrderNumber?: string;
  orderingProvider?: string;
  observationDateTime?: Date;
  results: ParsedHl7LabResult[];
}

export interface ParsedHl7Message {
  messageType: string;
  patientId: string;
  orders: ParsedHl7LabOrder[];
}

/**
 * Parses raw, pipe-delimited HL7 v2 ORU^R01 (lab result) messages.
 * Validates that MSH, PID, OBR, and OBX segments are all present before
 * extracting structured lab results, grouping OBX segments under the
 * nearest preceding OBR (one order per OBR, one or more results per order).
 */
@Injectable()
export class Hl7v2OruParser {
  parse(raw: string): ParsedHl7Message[] {
    const messages = raw
      .split(/(?=MSH\|)/)
      .map((m) => m.trim())
      .filter(Boolean);

    if (messages.length === 0) {
      throw new BadRequestException(
        'No HL7 message found (expected a segment starting with "MSH|")',
      );
    }

    return messages.map((m) => this.parseMessage(m));
  }

  private parseMessage(raw: string): ParsedHl7Message {
    const segments = raw
      .split(/\r\n|\r|\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    const msh = segments.find((s) => s.startsWith('MSH|'));
    if (!msh) {
      throw new BadRequestException('Missing required MSH segment');
    }

    const pid = segments.find((s) => s.startsWith('PID|'));
    if (!pid) {
      throw new BadRequestException('Missing required PID segment');
    }

    if (!segments.some((s) => s.startsWith('OBR|'))) {
      throw new BadRequestException('Missing required OBR segment');
    }

    if (!segments.some((s) => s.startsWith('OBX|'))) {
      throw new BadRequestException('Missing required OBX segment');
    }

    const mshFields = msh.split(FIELD_SEP);
    const messageType = mshFields[8] ?? '';
    if (!messageType.toUpperCase().startsWith('ORU')) {
      throw new BadRequestException(
        `Unsupported HL7 message type "${messageType}" — only ORU (Observation Result) messages are supported`,
      );
    }

    const pidFields = pid.split(FIELD_SEP);
    const patientId = this.firstComponent(pidFields[3]) ?? 'unknown';

    const orders: ParsedHl7LabOrder[] = [];
    let currentOrder: ParsedHl7LabOrder | null = null;

    for (const segment of segments) {
      if (segment.startsWith('OBR|')) {
        const fields = segment.split(FIELD_SEP);
        currentOrder = {
          placerOrderNumber: fields[2] || undefined,
          fillerOrderNumber: fields[3] || undefined,
          orderingProvider: this.firstComponent(fields[16]),
          observationDateTime: this.parseHl7DateTime(fields[7]),
          results: [],
        };
        orders.push(currentOrder);
      } else if (segment.startsWith('OBX|')) {
        if (!currentOrder) {
          throw new BadRequestException('OBX segment found before any OBR segment');
        }
        currentOrder.results.push(this.parseObx(segment));
      }
    }

    return { messageType, patientId, orders };
  }

  private parseObx(segment: string): ParsedHl7LabResult {
    const fields = segment.split(FIELD_SEP);
    const observationId = fields[3] ?? '';
    const components = observationId.split(COMPONENT_SEP);
    const loincCode = components[0]?.trim();

    if (!loincCode) {
      throw new BadRequestException('OBX-3 (Observation Identifier) is missing a code');
    }

    return {
      loincCode,
      observationText: components[1]?.trim() || undefined,
      value: fields[5] ?? '',
      units: fields[6] || undefined,
      referenceRange: fields[7] || undefined,
      abnormalFlag: fields[8] || undefined,
      resultStatus: fields[11] || undefined,
      observedAt: this.parseHl7DateTime(fields[14]),
    };
  }

  private firstComponent(field?: string): string | undefined {
    if (!field) return undefined;
    return field.split(COMPONENT_SEP)[0]?.trim() || undefined;
  }

  /** Parses HL7 TS values (e.g. 20240115143000) into a UTC Date. */
  private parseHl7DateTime(value?: string): Date | undefined {
    if (!value) return undefined;
    const match = /^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/.exec(value);
    if (!match) return undefined;
    const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
    return new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
      ),
    );
  }
}
