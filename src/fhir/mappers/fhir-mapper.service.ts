import { Injectable } from '@nestjs/common';
import { PatientMapper } from './patient.mapper';
import { DocumentReferenceMapper } from './document-reference.mapper';
import { ProvenanceMapper } from './provenance.mapper';
import { ConsentMapper } from './consent.mapper';
import { ObservationMapper } from './observation.mapper';
import { MedicationAdministrationMapper } from './medication-administration.mapper';
import { EncounterMapper } from './encounter.mapper';
import { DiagnosticReportMapper } from './diagnostic-report.mapper';
import { ConditionMapper } from './condition.mapper';
import { ProcedureMapper } from './procedure.mapper';

@Injectable()
export class FhirMapperService {
  constructor(
    private readonly patientMapper: PatientMapper,
    private readonly documentReferenceMapper: DocumentReferenceMapper,
    private readonly provenanceMapper: ProvenanceMapper,
    private readonly consentMapper: ConsentMapper,
    private readonly observationMapper: ObservationMapper,
    private readonly medicationAdministrationMapper: MedicationAdministrationMapper,
    private readonly encounterMapper: EncounterMapper,
    private readonly diagnosticReportMapper: DiagnosticReportMapper,
    private readonly conditionMapper: ConditionMapper,
    private readonly procedureMapper: ProcedureMapper,
  ) {}

  mapPatientToFhir(user: any): fhir4.Patient {
    return this.patientMapper.toFhir(user);
  }

  mapPatientFromFhir(patient: fhir4.Patient): any {
    return this.patientMapper.fromFhir(patient);
  }

  mapDocumentReferenceToFhir(record: any): fhir4.DocumentReference {
    return this.documentReferenceMapper.toFhir(record);
  }

  mapDocumentReferenceFromFhir(doc: fhir4.DocumentReference): any {
    return this.documentReferenceMapper.fromFhir(doc);
  }

  mapProvenanceToFhir(audit: any): fhir4.Provenance {
    return this.provenanceMapper.toFhir(audit);
  }

  mapProvenanceFromFhir(provenance: fhir4.Provenance): any {
    return this.provenanceMapper.fromFhir(provenance);
  }

  mapConsentToFhir(grant: any): fhir4.Consent {
    return this.consentMapper.toFhir(grant);
  }

  mapConsentFromFhir(consent: fhir4.Consent): any {
    return this.consentMapper.fromFhir(consent);
  }

  mapObservationToFhir(result: any): fhir4.Observation {
    return this.observationMapper.toFhir(result);
  }

  mapObservationFromFhir(observation: fhir4.Observation): any {
    return this.observationMapper.fromFhir(observation);
  }

  mapMedicationAdministrationToFhir(mar: any): fhir4.MedicationAdministration {
    return this.medicationAdministrationMapper.toFhir(mar);
  }

  mapMedicationAdministrationFromFhir(med: fhir4.MedicationAdministration): any {
    return this.medicationAdministrationMapper.fromFhir(med);
  }

  mapEncounterToFhir(appt: any): fhir4.Encounter {
    return this.encounterMapper.toFhir(appt);
  }

  mapEncounterFromFhir(encounter: fhir4.Encounter): any {
    return this.encounterMapper.fromFhir(encounter);
  }

  mapDiagnosticReportToFhir(report: any): fhir4.DiagnosticReport {
    return this.diagnosticReportMapper.toFhir(report);
  }

  mapDiagnosticReportFromFhir(report: fhir4.DiagnosticReport): any {
    return this.diagnosticReportMapper.fromFhir(report);
  }

  mapConditionToFhir(diag: any): fhir4.Condition {
    return this.conditionMapper.toFhir(diag);
  }

  mapConditionFromFhir(cond: fhir4.Condition): any {
    return this.conditionMapper.fromFhir(cond);
  }

  mapProcedureToFhir(proc: any): fhir4.Procedure {
    return this.procedureMapper.toFhir(proc);
  }

  mapProcedureFromFhir(proc: fhir4.Procedure): any {
    return this.procedureMapper.fromFhir(proc);
  }
}

