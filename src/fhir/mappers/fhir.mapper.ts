import { Patient } from '../../patients/entities/patient.entity';
import { MedicalRecord } from '../../medical-records/entities/medical-record.entity';
import { MedicalRecordConsent } from '../../medical-records/entities/medical-record-consent.entity';
import { MedicalHistory } from '../../medical-records/entities/medical-history.entity';
import { FhirPatient, FhirDocumentReference, FhirConsent, FhirProvenance } from '../dto/fhir-resources.dto';

export class FhirMapper {
  static toPatient(patient: Patient): FhirPatient {
    return {
      resourceType: 'Patient',
      id: patient.id,
      meta: { lastUpdated: patient.updatedAt?.toISOString() },
      identifier: [{ system: 'urn:mrn', value: patient.mrn }],
      name: [{ family: patient.lastName, given: [patient.firstName, patient.middleName].filter(Boolean) }],
      gender: patient.sex,
      birthDate: patient.dateOfBirth,
      telecom: [
        patient.phone && { system: 'phone', value: patient.phone },
        patient.email && { system: 'email', value: patient.email }
      ].filter(Boolean),
      address: patient.address ? [{ text: typeof patient.address === 'string' ? patient.address : JSON.stringify(patient.address) }] : undefined
    };
  }

  static toDocumentReference(record: MedicalRecord): FhirDocumentReference {
    return {
      resourceType: 'DocumentReference',
      id: record.id,
      meta: { versionId: record.version?.toString(), lastUpdated: record.updatedAt?.toISOString() },
      status: record.status === 'active' ? 'current' : 'superseded',
      type: { coding: [{ system: 'http://loinc.org', code: '34133-9', display: record.recordType }] },
      subject: { reference: `Patient/${record.patientId}` },
      date: record.recordDate?.toISOString(),
      author: record.providerId ? [{ reference: `Practitioner/${record.providerId}` }] : undefined,
      description: record.description,
      content: [{ attachment: { contentType: 'application/json', data: Buffer.from(JSON.stringify(record.metadata || {})).toString('base64') } }]
    };
  }

  static toConsent(consent: MedicalRecordConsent): FhirConsent {
    const statusMap = { pending: 'proposed', granted: 'active', revoked: 'inactive', expired: 'inactive' };
    return {
      resourceType: 'Consent',
      id: consent.id,
      meta: { lastUpdated: consent.updatedAt?.toISOString() },
      status: statusMap[consent.status] as any,
      scope: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'patient-privacy' }] },
      category: [{ coding: [{ system: 'http://loinc.org', code: '59284-0' }] }],
      patient: { reference: `Patient/${consent.patientId}` },
      dateTime: consent.grantedAt?.toISOString(),
      provision: {
        type: consent.status === 'granted' ? 'permit' : 'deny',
        period: { start: consent.grantedAt?.toISOString(), end: consent.expiresAt?.toISOString() },
        actor: consent.sharedWithUserId ? [{ reference: { reference: `Practitioner/${consent.sharedWithUserId}` } }] : undefined
      }
    };
  }

  static toProvenance(history: MedicalHistory[]): FhirProvenance[] {
    return history.map(h => ({
      resourceType: 'Provenance',
      id: h.id,
      meta: { lastUpdated: h.createdAt?.toISOString() },
      target: [{ reference: `DocumentReference/${h.medicalRecordId}` }],
      recorded: h.createdAt?.toISOString(),
      agent: [{ who: { reference: `Practitioner/${h.performedBy || 'unknown'}` } }],
      activity: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-DataOperation', code: h.eventType, display: h.eventType }] }
    }));
  }
}
