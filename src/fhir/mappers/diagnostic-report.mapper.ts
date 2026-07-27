import { Injectable } from '@nestjs/common';
import { LabReport } from '../../laboratory/entities/lab-report.entity';
import { FhirMappingException } from '../exceptions/fhir-mapping.exception';

@Injectable()
export class DiagnosticReportMapper {
  toFhir(report: LabReport): fhir4.DiagnosticReport {
    const errors = [];

    if (!report.id) errors.push({ field: 'id', message: 'Report ID is required' });
    if (!report.title) errors.push({ field: 'title', message: 'Report title is required' });

    if (errors.length > 0) {
      throw new FhirMappingException('DiagnosticReport', errors);
    }

    return {
      resourceType: 'DiagnosticReport',
      id: report.id,
      status: report.status === 'completed' ? 'final' : 'registered',
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '11502-2',
            display: 'Laboratory report',
          },
        ],
        text: report.title,
      },
      subject: {
        reference: `Patient/${(report as any).patientId || 'unknown'}`,
      },
      issued: report.generatedAt?.toISOString() || report.createdAt?.toISOString(),
      performer: report.generatedBy
        ? [
            {
              reference: `Practitioner/${report.generatedBy}`,
            },
          ]
        : undefined,
      conclusion: report.notes || undefined,
    };
  }

  fromFhir(report: fhir4.DiagnosticReport): Partial<LabReport> {
    const errors = [];

    if (!report.id) errors.push({ field: 'id', message: 'DiagnosticReport ID is required' });
    if (!report.subject?.reference) errors.push({ field: 'subject', message: 'Subject reference is required' });

    if (errors.length > 0) {
      throw new FhirMappingException('DiagnosticReport', errors);
    }

    const patientId = report.subject.reference.replace('Patient/', '');
    const generatedBy = report.performer?.[0]?.reference?.replace('Practitioner/', '') || 'unknown';

    return {
      id: report.id,
      status: report.status === 'final' ? 'completed' : 'generating',
      title: report.code?.text || 'Laboratory Report',
      patientId,
      generatedAt: report.issued ? new Date(report.issued) : new Date(),
      generatedBy,
      notes: report.conclusion || '',
    } as any;
  }
}
