import { Injectable, BadRequestException } from '@nestjs/common';
import { parseStringPromise } from 'xml2js';
import { ParsedRecord } from './parsed-record.interface';
import { RecordType } from '../../records/dto/create-record.dto';

/** Maps a CCD section title to the closest internal RecordType. */
function classifySection(title: string): RecordType {
  const normalized = title.toLowerCase();
  if (normalized.includes('medication')) return RecordType.PRESCRIPTION;
  if (normalized.includes('result') || normalized.includes('lab')) return RecordType.LAB_RESULT;
  if (normalized.includes('imag') || normalized.includes('radiolog')) return RecordType.IMAGING;
  if (normalized.includes('problem') || normalized.includes('allerg'))
    return RecordType.MEDICAL_REPORT;
  return RecordType.MEDICAL_REPORT;
}

@Injectable()
export class CcdParser {
  /** Parse a CCD/C-CDA XML document into one ParsedRecord per clinical section. */
  async parse(xml: string): Promise<ParsedRecord[]> {
    let doc: any;
    try {
      doc = await parseStringPromise(xml, { explicitArray: false });
    } catch (err: any) {
      throw new BadRequestException(`Malformed CCD XML: ${err.message}`);
    }

    // Navigate CCDA structure: ClinicalDocument > recordTarget > patientRole
    const root =
      doc?.ClinicalDocument ??
      doc?.['ns0:ClinicalDocument'] ??
      doc?.['cda:ClinicalDocument'] ??
      doc;

    const patientRole =
      root?.recordTarget?.patientRole ?? root?.['cda:recordTarget']?.['cda:patientRole'];

    if (!root || !patientRole) {
      throw new BadRequestException(
        'Malformed CCD document: missing ClinicalDocument/recordTarget/patientRole',
      );
    }

    const patientId: string =
      patientRole?.id?.['$']?.extension ?? patientRole?.id?.extension ?? 'unknown';

    const documentTitle: string = root?.title?._ ?? root?.title ?? 'CCD Document';

    const rawSections =
      root?.component?.structuredBody?.component ??
      root?.['cda:component']?.['cda:structuredBody']?.['cda:component'];

    const sections: any[] = !rawSections
      ? []
      : Array.isArray(rawSections)
        ? rawSections
        : [rawSections];

    if (sections.length === 0) {
      // No structured sections — fall back to a single document-level record
      // rather than failing the whole import outright.
      return [
        {
          patientId,
          recordType: RecordType.MEDICAL_REPORT,
          description: String(documentTitle),
          rawPayload: xml,
        },
      ];
    }

    const records: ParsedRecord[] = [];
    for (const component of sections) {
      const section = component?.section ?? component?.['cda:section'];
      if (!section) continue; // unsupported/empty section — skip rather than fail the import

      const sectionTitle: string = section?.title?._ ?? section?.title ?? 'Section';
      const sectionText: string = section?.text?._ ?? section?.text ?? '';

      records.push({
        patientId,
        recordType: classifySection(String(sectionTitle)),
        description: `${sectionTitle}: ${sectionText}`.trim(),
        rawPayload: xml,
      });
    }

    if (records.length === 0) {
      throw new BadRequestException('CCD document contained no supported clinical sections');
    }

    return records;
  }
}
