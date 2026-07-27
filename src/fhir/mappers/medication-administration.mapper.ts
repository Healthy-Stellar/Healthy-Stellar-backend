import { Injectable } from '@nestjs/common';
import { MedicationAdministrationRecord } from '../../medication-administration/entities/medication-administration-record.entity';
import { FhirMappingException } from '../exceptions/fhir-mapping.exception';

@Injectable()
export class MedicationAdministrationMapper {
  toFhir(mar: MedicationAdministrationRecord): fhir4.MedicationAdministration {
    const errors = [];

    if (!mar.id) errors.push({ field: 'id', message: 'Record ID is required' });
    if (!mar.patientId) errors.push({ field: 'patientId', message: 'Patient ID is required' });
    if (!mar.medicationName) errors.push({ field: 'medicationName', message: 'Medication name is required' });

    if (errors.length > 0) {
      throw new FhirMappingException('MedicationAdministration', errors);
    }

    return {
      resourceType: 'MedicationAdministration',
      id: mar.id,
      status: mar.status === 'administered' ? 'completed' : mar.status === 'missed' ? 'stopped' : 'on-hold',
      medicationCodeableConcept: {
        coding: [
          {
            system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
            code: mar.medicationBarcode || 'unknown',
            display: mar.medicationName,
          },
        ],
        text: mar.medicationName,
      },
      subject: {
        reference: `Patient/${mar.patientId}`,
      },
      effectiveDateTime: mar.administrationTime?.toISOString() || mar.scheduledTime?.toISOString(),
      dosage: {
        text: mar.dosage,
        route: mar.route
          ? {
              coding: [
                {
                  system: 'http://snomed.info/sct',
                  display: mar.route,
                },
              ],
            }
          : undefined,
      },
      performer: mar.nurseId
        ? [
            {
              actor: {
                reference: `Practitioner/${mar.nurseId}`,
                display: mar.nurseName || undefined,
              },
            },
          ]
        : undefined,
    };
  }

  fromFhir(med: fhir4.MedicationAdministration): Partial<MedicationAdministrationRecord> {
    const errors = [];

    if (!med.id) errors.push({ field: 'id', message: 'MedicationAdministration ID is required' });
    if (!med.subject?.reference) errors.push({ field: 'subject', message: 'Subject reference is required' });

    if (errors.length > 0) {
      throw new FhirMappingException('MedicationAdministration', errors);
    }

    const patientId = med.subject.reference.replace('Patient/', '');
    const medicationBarcode = med.medicationCodeableConcept?.coding?.[0]?.code || '';
    const medicationName = med.medicationCodeableConcept?.coding?.[0]?.display || med.medicationCodeableConcept?.text || '';
    const nurseId = med.performer?.[0]?.actor?.reference?.replace('Practitioner/', '') || '';
    const nurseName = med.performer?.[0]?.actor?.display || '';

    return {
      id: med.id,
      status: med.status === 'completed' ? 'administered' : med.status === 'stopped' ? 'missed' : 'scheduled',
      medicationBarcode,
      medicationName,
      patientId,
      nurseId,
      nurseName,
      administrationTime: med.effectiveDateTime ? new Date(med.effectiveDateTime) : undefined,
      dosage: med.dosage?.text || '',
      route: med.dosage?.route?.coding?.[0]?.display as any,
    } as any;
  }
}
