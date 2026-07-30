import { Injectable } from '@nestjs/common';
import { Diagnosis } from '../../diagnosis/entities/diagnosis.entity';
import { FhirMappingException } from '../exceptions/fhir-mapping.exception';

@Injectable()
export class ConditionMapper {
  toFhir(diag: Diagnosis): fhir4.Condition {
    const errors = [];

    if (!diag.id) errors.push({ field: 'id', message: 'Diagnosis ID is required' });
    if (!diag.patientId) errors.push({ field: 'patientId', message: 'Patient ID is required' });

    if (errors.length > 0) {
      throw new FhirMappingException('Condition', errors);
    }

    return {
      resourceType: 'Condition',
      id: diag.id,
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: diag.status === 'confirmed' ? 'active' : 'resolved',
            display: diag.status === 'confirmed' ? 'Active' : 'Resolved',
          },
        ],
      },
      code: {
        coding: [
          {
            system: 'http://hl7.org/fhir/sid/icd-10',
            code: diag.icd10Code?.code || 'unknown',
            display: diag.icd10Code?.description || 'unknown',
          },
        ],
        text: diag.icd10Code?.description || undefined,
      },
      subject: {
        reference: `Patient/${diag.patientId}`,
      },
      onsetDateTime: diag.onsetDate?.toISOString() || diag.diagnosisDate?.toISOString(),
      recordedDate: diag.diagnosisDate?.toISOString(),
    };
  }

  fromFhir(cond: fhir4.Condition): Partial<Diagnosis> {
    const errors = [];

    if (!cond.id) errors.push({ field: 'id', message: 'Condition ID is required' });
    if (!cond.subject?.reference) errors.push({ field: 'subject', message: 'Subject reference is required' });

    if (errors.length > 0) {
      throw new FhirMappingException('Condition', errors);
    }

    const patientId = cond.subject.reference.replace('Patient/', '');
    const isActive = cond.clinicalStatus?.coding?.[0]?.code === 'active';

    return {
      id: cond.id,
      status: isActive ? 'confirmed' : 'ruled_out',
      patientId,
      diagnosisDate: cond.recordedDate ? new Date(cond.recordedDate) : new Date(),
      onsetDate: cond.onsetDateTime ? new Date(cond.onsetDateTime) : undefined,
    } as any;
  }
}
