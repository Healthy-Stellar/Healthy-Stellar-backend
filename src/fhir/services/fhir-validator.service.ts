import { Injectable, Logger } from '@nestjs/common';
import { FhirMappingException } from '../exceptions/fhir-mapping.exception';

@Injectable()
export class FhirValidatorService {
  private readonly logger = new Logger(FhirValidatorService.name);

  validateResource(resource: any): void {
    const errors = [];

    if (!resource.resourceType) {
      errors.push({ field: 'resourceType', message: 'Resource type is required' });
    }

    if (!resource.id) {
      errors.push({ field: 'id', message: 'Resource ID is required' });
    }

    switch (resource.resourceType) {
      case 'Patient':
        this.validatePatient(resource, errors);
        break;
      case 'DocumentReference':
        this.validateDocumentReference(resource, errors);
        break;
      case 'Provenance':
        this.validateProvenance(resource, errors);
        break;
      case 'Consent':
        this.validateConsent(resource, errors);
        break;
      case 'Observation':
        this.validateObservation(resource, errors);
        break;
      case 'MedicationAdministration':
        this.validateMedicationAdministration(resource, errors);
        break;
      case 'Encounter':
        this.validateEncounter(resource, errors);
        break;
      case 'DiagnosticReport':
        this.validateDiagnosticReport(resource, errors);
        break;
      case 'Condition':
        this.validateCondition(resource, errors);
        break;
      case 'Procedure':
        this.validateProcedure(resource, errors);
        break;
    }

    if (errors.length > 0) {
      throw new FhirMappingException(resource.resourceType, errors);
    }

    this.logger.log(`Validated ${resource.resourceType}/${resource.id}`);
  }

  private validatePatient(patient: fhir4.Patient, errors: any[]): void {
    if (!patient.name || patient.name.length === 0) {
      errors.push({ field: 'name', message: 'Patient name is required' });
    }
  }

  private validateDocumentReference(doc: fhir4.DocumentReference, errors: any[]): void {
    if (!doc.status) {
      errors.push({ field: 'status', message: 'Document status is required' });
    }
    if (!doc.subject) {
      errors.push({ field: 'subject', message: 'Document subject is required' });
    }
  }

  private validateProvenance(provenance: fhir4.Provenance, errors: any[]): void {
    if (!provenance.target || provenance.target.length === 0) {
      errors.push({ field: 'target', message: 'Provenance target is required' });
    }
    if (!provenance.recorded) {
      errors.push({ field: 'recorded', message: 'Recorded timestamp is required' });
    }
  }

  private validateConsent(consent: fhir4.Consent, errors: any[]): void {
    if (!consent.status) {
      errors.push({ field: 'status', message: 'Consent status is required' });
    }
    if (!consent.patient) {
      errors.push({ field: 'patient', message: 'Patient reference is required' });
    }
  }

  private validateObservation(obs: fhir4.Observation, errors: any[]): void {
    if (!obs.status) {
      errors.push({ field: 'status', message: 'Observation status is required' });
    }
    if (!obs.code) {
      errors.push({ field: 'code', message: 'Observation code is required' });
    }
    if (!obs.subject) {
      errors.push({ field: 'subject', message: 'Observation subject is required' });
    }
  }

  private validateMedicationAdministration(med: fhir4.MedicationAdministration, errors: any[]): void {
    if (!med.status) {
      errors.push({ field: 'status', message: 'Medication status is required' });
    }
    if (!med.medicationCodeableConcept && !med.medicationReference) {
      errors.push({ field: 'medication', message: 'Medication code or reference is required' });
    }
    if (!med.subject) {
      errors.push({ field: 'subject', message: 'Medication subject is required' });
    }
  }

  private validateEncounter(enc: fhir4.Encounter, errors: any[]): void {
    if (!enc.status) {
      errors.push({ field: 'status', message: 'Encounter status is required' });
    }
    if (!enc.class) {
      errors.push({ field: 'class', message: 'Encounter class is required' });
    }
    if (!enc.subject) {
      errors.push({ field: 'subject', message: 'Encounter subject is required' });
    }
  }

  private validateDiagnosticReport(report: fhir4.DiagnosticReport, errors: any[]): void {
    if (!report.status) {
      errors.push({ field: 'status', message: 'Report status is required' });
    }
    if (!report.code) {
      errors.push({ field: 'code', message: 'Report code is required' });
    }
    if (!report.subject) {
      errors.push({ field: 'subject', message: 'Report subject is required' });
    }
  }

  private validateCondition(cond: fhir4.Condition, errors: any[]): void {
    if (!cond.clinicalStatus) {
      errors.push({ field: 'clinicalStatus', message: 'Condition clinicalStatus is required' });
    }
    if (!cond.code) {
      errors.push({ field: 'code', message: 'Condition code is required' });
    }
    if (!cond.subject) {
      errors.push({ field: 'subject', message: 'Condition subject is required' });
    }
  }

  private validateProcedure(proc: fhir4.Procedure, errors: any[]): void {
    if (!proc.status) {
      errors.push({ field: 'status', message: 'Procedure status is required' });
    }
    if (!proc.code) {
      errors.push({ field: 'code', message: 'Procedure code is required' });
    }
    if (!proc.subject) {
      errors.push({ field: 'subject', message: 'Procedure subject is required' });
    }
  }
}
