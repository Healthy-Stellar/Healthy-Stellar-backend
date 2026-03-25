import { Injectable } from '@nestjs/common';
import { TracingService } from '../../common/services/tracing.service';
import { FhirMapper } from '../mappers/fhir.mapper';
import { Patient } from '../../patients/entities/patient.entity';
import { MedicalRecord } from '../../medical-records/entities/medical-record.entity';
import { MedicalRecordConsent } from '../../medical-records/entities/medical-record-consent.entity';
import { MedicalHistory } from '../../medical-records/entities/medical-history.entity';
import { FhirPatient, FhirDocumentReference, FhirConsent, FhirProvenance } from '../dto/fhir-resources.dto';

@Injectable()
export class FhirMapperService {
  constructor(private readonly tracingService: TracingService) {}

  async toPatient(patient: Patient): Promise<FhirPatient> {
    return this.tracingService.withSpan(
      'fhir.mapper.toPatient',
      async (span) => {
        span.setAttribute('fhir.resource_type', 'Patient');
        span.setAttribute('fhir.patient_id', patient.id);
        
        const result = FhirMapper.toPatient(patient);
        this.tracingService.addEvent('fhir.mapping.complete');
        return result;
      },
    );
  }

  async toDocumentReference(record: MedicalRecord): Promise<FhirDocumentReference> {
    return this.tracingService.withSpan(
      'fhir.mapper.toDocumentReference',
      async (span) => {
        span.setAttribute('fhir.resource_type', 'DocumentReference');
        span.setAttribute('fhir.record_id', record.id);
        span.setAttribute('fhir.record_type', record.recordType);
        
        const result = FhirMapper.toDocumentReference(record);
        this.tracingService.addEvent('fhir.mapping.complete');
        return result;
      },
    );
  }

  async toConsent(consent: MedicalRecordConsent): Promise<FhirConsent> {
    return this.tracingService.withSpan(
      'fhir.mapper.toConsent',
      async (span) => {
        span.setAttribute('fhir.resource_type', 'Consent');
        span.setAttribute('fhir.consent_id', consent.id);
        span.setAttribute('fhir.consent_status', consent.status);
        
        const result = FhirMapper.toConsent(consent);
        this.tracingService.addEvent('fhir.mapping.complete');
        return result;
      },
    );
  }

  async toProvenance(history: MedicalHistory[]): Promise<FhirProvenance[]> {
    return this.tracingService.withSpan(
      'fhir.mapper.toProvenance',
      async (span) => {
        span.setAttribute('fhir.resource_type', 'Provenance');
        span.setAttribute('fhir.history_count', history.length);
        
        const result = FhirMapper.toProvenance(history);
        this.tracingService.addEvent('fhir.mapping.complete', {
          'fhir.provenance_count': result.length,
        });
        return result;
      },
    );
  }
}
