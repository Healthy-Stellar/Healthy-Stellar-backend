import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../patients/entities/patient.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { MedicalRecordConsent } from '../medical-records/entities/medical-record-consent.entity';
import { MedicalHistory } from '../medical-records/entities/medical-history.entity';
import { FhirMapper } from './mappers/fhir.mapper';
import { FhirCapabilityStatement } from './dto/fhir-resources.dto';

const PROVENANCE_SUPPORTED_TYPES = ['DocumentReference', 'Patient', 'Consent'] as const;
type ProvenanceSupportedType = (typeof PROVENANCE_SUPPORTED_TYPES)[number];

function parseFhirReference(ref: string): { resourceType: string; resourceId: string } {
  const parts = ref.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new BadRequestException(
      `Invalid FHIR reference "${ref}". Expected format: ResourceType/id`,
    );
  }
  return { resourceType: parts[0], resourceId: parts[1] };
}

@Injectable()
export class FhirService {
  constructor(
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
    @InjectRepository(MedicalRecord) private recordRepo: Repository<MedicalRecord>,
    @InjectRepository(MedicalRecordConsent) private consentRepo: Repository<MedicalRecordConsent>,
    @InjectRepository(MedicalHistory) private historyRepo: Repository<MedicalHistory>,
  ) {}

  getCapabilityStatement(): FhirCapabilityStatement {
    return {
      resourceType: 'CapabilityStatement',
      status: 'active',
      date: new Date().toISOString(),
      kind: 'instance',
      fhirVersion: '4.0.1',
      format: ['application/fhir+json'],
      rest: [
        {
          mode: 'server',
          resource: [
            {
              type: 'Patient',
              interaction: [{ code: 'read' }, { code: 'search-type' }],
              operation: [{ name: 'provenance', definition: 'OperationDefinition/provenance' }],
            },
            {
              type: 'DocumentReference',
              interaction: [{ code: 'read' }, { code: 'search-type' }],
              operation: [{ name: 'provenance', definition: 'OperationDefinition/provenance' }],
            },
            {
              type: 'Consent',
              interaction: [{ code: 'read' }],
              operation: [{ name: 'provenance', definition: 'OperationDefinition/provenance' }],
            },
            { type: 'Provenance', interaction: [{ code: 'search-type' }] },
          ],
        },
      ],
    };
  }

  async getPatient(id: string) {
    const patient = await this.patientRepo.findOne({ where: { id } });
    if (!patient) throw new NotFoundException('Patient not found');
    return FhirMapper.toPatient(patient);
  }

  async getPatientDocuments(patientId: string) {
    const records = await this.recordRepo.find({ where: { patientId } });
    return {
      resourceType: 'Bundle',
      type: 'searchset',
      entry: records.map((r) => ({ resource: FhirMapper.toDocumentReference(r) })),
    };
  }

  async getDocumentReference(id: string) {
    const record = await this.recordRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('DocumentReference not found');
    return FhirMapper.toDocumentReference(record);
  }

  async getConsent(id: string) {
    const consent = await this.consentRepo.findOne({ where: { id } });
    if (!consent) throw new NotFoundException('Consent not found');
    return FhirMapper.toConsent(consent);
  }

  async getProvenance(target: string) {
    const { resourceType, resourceId } = parseFhirReference(target);

    if (!(PROVENANCE_SUPPORTED_TYPES as readonly string[]).includes(resourceType)) {
      throw new NotFoundException(
        `Provenance is not supported for resource type "${resourceType}". ` +
          `Supported types: ${PROVENANCE_SUPPORTED_TYPES.join(', ')}`,
      );
    }

    // Verify the referenced resource exists before querying history
    const repoMap: Record<ProvenanceSupportedType, () => Promise<boolean>> = {
      DocumentReference: () =>
        this.recordRepo.existsBy({ id: resourceId }),
      Patient: () =>
        this.patientRepo.existsBy({ id: resourceId }),
      Consent: () =>
        this.consentRepo.existsBy({ id: resourceId }),
    };

    const exists = await repoMap[resourceType as ProvenanceSupportedType]();
    if (!exists) throw new NotFoundException(`${resourceType}/${resourceId} not found`);

    const history = await this.historyRepo.find({ where: { medicalRecordId: resourceId } });
    return {
      resourceType: 'Bundle',
      type: 'searchset',
      entry: FhirMapper.toProvenance(history).map((p) => ({ resource: p })),
    };
  }
}
