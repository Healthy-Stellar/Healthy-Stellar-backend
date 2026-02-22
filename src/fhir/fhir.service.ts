import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../patients/entities/patient.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { MedicalRecordConsent } from '../medical-records/entities/medical-record-consent.entity';
import { MedicalHistory } from '../medical-records/entities/medical-history.entity';
import { FhirMapper } from './mappers/fhir.mapper';
import { FhirCapabilityStatement } from './dto/fhir-resources.dto';

@Injectable()
export class FhirService {
  constructor(
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
    @InjectRepository(MedicalRecord) private recordRepo: Repository<MedicalRecord>,
    @InjectRepository(MedicalRecordConsent) private consentRepo: Repository<MedicalRecordConsent>,
    @InjectRepository(MedicalHistory) private historyRepo: Repository<MedicalHistory>
  ) {}

  getCapabilityStatement(): FhirCapabilityStatement {
    return {
      resourceType: 'CapabilityStatement',
      status: 'active',
      date: new Date().toISOString(),
      kind: 'instance',
      fhirVersion: '4.0.1',
      format: ['application/fhir+json'],
      rest: [{
        mode: 'server',
        resource: [
          { type: 'Patient', interaction: [{ code: 'read' }, { code: 'search-type' }] },
          { type: 'DocumentReference', interaction: [{ code: 'read' }, { code: 'search-type' }] },
          { type: 'Consent', interaction: [{ code: 'read' }] },
          { type: 'Provenance', interaction: [{ code: 'search-type' }] }
        ]
      }]
    };
  }

  async getPatient(id: string) {
    const patient = await this.patientRepo.findOne({ where: { id } });
    if (!patient) throw new NotFoundException('Patient not found');
    return FhirMapper.toPatient(patient);
  }

  async getPatientDocuments(patientId: string) {
    const records = await this.recordRepo.find({ where: { patientId } });
    return { resourceType: 'Bundle', type: 'searchset', entry: records.map(r => ({ resource: FhirMapper.toDocumentReference(r) })) };
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
    const recordId = target.replace('DocumentReference/', '');
    const history = await this.historyRepo.find({ where: { medicalRecordId: recordId } });
    return { resourceType: 'Bundle', type: 'searchset', entry: FhirMapper.toProvenance(history).map(p => ({ resource: p })) };
  }
}
