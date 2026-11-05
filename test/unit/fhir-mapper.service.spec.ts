import { Test, TestingModule } from '@nestjs/testing';
import { FhirMapperService } from '../../src/fhir/mappers/fhir-mapper.service';
import { PatientMapper } from '../../src/fhir/mappers/patient.mapper';
import { DocumentReferenceMapper } from '../../src/fhir/mappers/document-reference.mapper';
import { ProvenanceMapper } from '../../src/fhir/mappers/provenance.mapper';
import { ConsentMapper } from '../../src/fhir/mappers/consent.mapper';
import { ObservationMapper } from '../../src/fhir/mappers/observation.mapper';
import { MedicationAdministrationMapper } from '../../src/fhir/mappers/medication-administration.mapper';
import { EncounterMapper } from '../../src/fhir/mappers/encounter.mapper';
import { DiagnosticReportMapper } from '../../src/fhir/mappers/diagnostic-report.mapper';
import { ConditionMapper } from '../../src/fhir/mappers/condition.mapper';
import { ProcedureMapper } from '../../src/fhir/mappers/procedure.mapper';

describe('FhirMapperService', () => {
  let service: FhirMapperService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FhirMapperService,
        PatientMapper,
        DocumentReferenceMapper,
        ProvenanceMapper,
        ConsentMapper,
        ObservationMapper,
        MedicationAdministrationMapper,
        EncounterMapper,
        DiagnosticReportMapper,
        ConditionMapper,
        ProcedureMapper,
      ],
    }).compile();

    service = module.get<FhirMapperService>(FhirMapperService);
  });

  it('should map Patient to FHIR', () => {
    const user = {
      id: '123',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      status: 'ACTIVE',
    };

    const result = service.mapPatientToFhir(user);

    expect(result.resourceType).toBe('Patient');
    expect(result.id).toBe('123');
  });

  it('should map FHIR Patient to User', () => {
    const patient: fhir4.Patient = {
      resourceType: 'Patient',
      id: '123',
      name: [{ family: 'Doe', given: ['John'] }],
    };

    const result = service.mapPatientFromFhir(patient);

    expect(result.id).toBe('123');
    expect(result.firstName).toBe('John');
  });

  it('should map DocumentReference to FHIR', () => {
    const record = {
      id: '456',
      patientId: '123',
      recordType: 'CONSULTATION',
      status: 'ACTIVE',
    };

    const result = service.mapDocumentReferenceToFhir(record);

    expect(result.resourceType).toBe('DocumentReference');
    expect(result.id).toBe('456');
  });

  it('should map Provenance to FHIR', () => {
    const audit = {
      id: '789',
      entityId: '456',
      entity: 'MedicalRecord',
      action: 'DATA_ACCESS',
      timestamp: new Date(),
    };

    const result = service.mapProvenanceToFhir(audit);

    expect(result.resourceType).toBe('Provenance');
    expect(result.id).toBe('789');
  });

  it('should map Consent to FHIR', () => {
    const grant = {
      id: '999',
      patientId: '123',
      granteeId: '789',
      recordIds: ['456'],
      accessLevel: 'READ',
      status: 'ACTIVE',
      createdAt: new Date(),
    };

    const result = service.mapConsentToFhir(grant);

    expect(result.resourceType).toBe('Consent');
    expect(result.id).toBe('999');
  });
});
