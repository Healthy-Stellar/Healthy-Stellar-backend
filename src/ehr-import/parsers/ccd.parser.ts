import { Injectable } from '@nestjs/common';
import { parseStringPromise } from 'xml2js';
import { ParsedRecord } from './parsed-record.interface';
import { RecordType } from '../../records/dto/create-record.dto';

@Injectable()
export class CcdParser {
  /** Parse a CCD XML document into ParsedRecord[]. */
  async parse(xml: string): Promise<ParsedRecord[]> {
    const doc = await parseStringPromise(xml, { explicitArray: false });

    // Navigate CCDA structure: ClinicalDocument > recordTarget > patientRole
    const root =
      doc?.ClinicalDocument ??
      doc?.['ns0:ClinicalDocument'] ??
      doc?.['cda:ClinicalDocument'] ??
      doc;

    const patientRole =
      root?.recordTarget?.patientRole ??
      root?.['cda:recordTarget']?.['cda:patientRole'];

    const patientId: string =
      patientRole?.id?.['$']?.extension ??
      patientRole?.id?.extension ??
      'unknown';

    const title: string = root?.title?._ ?? root?.title ?? 'CCD Document';

    return [
      {
        patientId,
        recordType: RecordType.MEDICAL_REPORT,
        description: String(title),
        rawPayload: xml,
      },
    ];
  }
}
