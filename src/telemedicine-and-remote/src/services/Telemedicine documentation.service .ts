import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TelemedicineDocument,
  DocumentType,
  DocumentStatus,
} from '../entities/telemedicine-document.entity';
import * as crypto from 'crypto';

export interface CreateDocumentDto {
  patientId: string;
  providerId: string;
  virtualVisitId?: string;
  documentType: DocumentType;
  title: string;
  content: string;
  soapNote?: any;
  diagnoses?: any[];
  procedures?: any[];
}

export interface SignDocumentDto {
  documentId: string;
  providerId: string;
  signature: string;
}

@Injectable()
export class TelemedicineDocumentationService {
  constructor(
    @InjectRepository(TelemedicineDocument)
    private documentRepository: Repository<TelemedicineDocument>,
  ) {}

  async createDocument(dto: CreateDocumentDto): Promise<TelemedicineDocument> {
    // Validate SOAP note structure if provided
    if (dto.soapNote) {
      this.validateSoapNote(dto.soapNote);
    }

    const document = this.documentRepository.create({
      ...dto,
      status: DocumentStatus.DRAFT,
      meetsHipaaStandards: true,
      meetsClinicalStandards: this.validateClinicalStandards(dto),
      qualityMetrics: this.calculateQualityMetrics(dto),
      auditTrail: [
        {
          action: 'CREATED',
          performedBy: dto.providerId,
          timestamp: new Date(),
        },
      ],
    });

    return this.documentRepository.save(document);
  }

  async signDocument(dto: SignDocumentDto): Promise<TelemedicineDocument> {
    const document = await this.findOne(dto.documentId);

    if (document.providerId !== dto.providerId) {
      throw new BadRequestException('Only the authoring provider can sign this document');
    }

    if (document.status === DocumentStatus.SIGNED) {
      throw new BadRequestException('Document is already signed');
    }

    // Generate electronic signature hash
    const signatureHash = this.generateElectronicSignature(dto.signature, document);

    document.status = DocumentStatus.SIGNED;
    document.isSigned = true;
    document.electronicSignature = signatureHash;
    document.signedAt = new Date();
    document.signedBy = dto.providerId;

    this.addAuditEntry(document, 'SIGNED', dto.providerId);

    return this.documentRepository.save(document);
  }

  async amendDocument(
    documentId: string,
    providerId: string,
    amendmentReason: string,
    newContent: string,
  ): Promise<TelemedicineDocument> {
    const originalDocument = await this.findOne(documentId);

    if (!originalDocument.isSigned) {
      throw new BadRequestException('Only signed documents can be amended');
    }

    // Create amendment
    const amendment = this.documentRepository.create({
      ...originalDocument,
      id: undefined, // New ID
      content: newContent,
      status: DocumentStatus.AMENDED,
      isAmended: true,
      amendmentReason,
      amendedBy: providerId,
      amendedAt: new Date(),
      originalDocumentId: documentId,
      isSigned: false,
      electronicSignature: null,
      signedAt: null,
      signedBy: null,
      auditTrail: [
        {
          action: 'AMENDED',
          performedBy: providerId,
          timestamp: new Date(),
          changes: { reason: amendmentReason },
        },
      ],
    });

    return this.documentRepository.save(amendment);
  }

  async createClinicalNote(
    virtualVisitId: string,
    providerId: string,
    soapNote: any,
  ): Promise<TelemedicineDocument> {
    return this.createDocument({
      patientId: soapNote.patientId,
      providerId,
      virtualVisitId,
      documentType: DocumentType.CLINICAL_NOTE,
      title: `Clinical Note - ${new Date().toLocaleDateString()}`,
      content: this.formatSoapNoteAsText(soapNote),
      soapNote,
    });
  }

  async shareWithPatient(documentId: string): Promise<TelemedicineDocument> {
    const document = await this.findOne(documentId);

    if (!document.isSigned) {
      throw new BadRequestException('Only signed documents can be shared with patients');
    }

    document.sharedWithPatient = true;
    document.sharedAt = new Date();

    this.addAuditEntry(document, 'SHARED_WITH_PATIENT', document.providerId);

    return this.documentRepository.save(document);
  }

  async markAsViewedByPatient(documentId: string): Promise<TelemedicineDocument> {
    const document = await this.findOne(documentId);

    document.patientViewed = true;
    document.patientViewedAt = new Date();

    this.addAuditEntry(document, 'VIEWED_BY_PATIENT', document.patientId);

    return this.documentRepository.save(document);
  }

  async getPatientDocuments(
    patientId: string,
    documentType?: DocumentType,
  ): Promise<TelemedicineDocument[]> {
    const whereClause: any = { patientId, deletedAt: null };

    if (documentType) {
      whereClause.documentType = documentType;
    }

    return this.documentRepository.find({
      where: whereClause,
      order: { createdAt: 'DESC' },
    });
  }

  async getVisitDocuments(virtualVisitId: string): Promise<TelemedicineDocument[]> {
    return this.documentRepository.find({
      where: { virtualVisitId, deletedAt: null },
      order: { createdAt: 'ASC' },
    });
  }

  async validateDocumentCompleteness(documentId: string): Promise<{
    isComplete: boolean;
    missingFields: string[];
    completenessScore: number;
  }> {
    const document = await this.findOne(documentId);
    const missingFields: string[] = [];

    // Check required fields based on document type
    if (document.documentType === DocumentType.CLINICAL_NOTE) {
      const soap = document.soapNote;

      if (!soap?.subjective?.chiefComplaint) missingFields.push('Chief Complaint');
      if (!soap?.subjective?.historyOfPresentIllness) missingFields.push('HPI');
      if (!soap?.objective?.vitalSigns) missingFields.push('Vital Signs');
      if (!soap?.assessment?.diagnosis || soap.assessment.diagnosis.length === 0) {
        missingFields.push('Diagnosis');
      }
      if (!soap?.plan?.treatment) missingFields.push('Treatment Plan');
    }

    if (!document.isSigned) missingFields.push('Electronic Signature');

    const totalFields = document.documentType === DocumentType.CLINICAL_NOTE ? 6 : 2;
    const completenessScore = ((totalFields - missingFields.length) / totalFields) * 100;

    return {
      isComplete: missingFields.length === 0,
      missingFields,
      completenessScore: Math.round(completenessScore),
    };
  }

  async generateDocumentSummary(documentId: string): Promise<any> {
    const document = await this.findOne(documentId);

    return {
      documentId: document.id,
      documentType: document.documentType,
      title: document.title,
      createdAt: document.createdAt,
      status: document.status,
      isSigned: document.isSigned,
      signedAt: document.signedAt,
      diagnoses: document.diagnoses?.map((d) => d.description) || [],
      procedures: document.procedures?.map((p) => p.description) || [],
      keyFindings: this.extractKeyFindings(document),
      qualityScore: document.qualityMetrics?.completeness || 0,
    };
  }

  private validateSoapNote(soapNote: any): void {
    if (!soapNote.subjective && !soapNote.objective && !soapNote.assessment && !soapNote.plan) {
      throw new BadRequestException('SOAP note must contain at least one section');
    }
  }

  private validateClinicalStandards(dto: CreateDocumentDto): boolean {
    // Basic validation - in production, implement comprehensive clinical standard checks
    if (dto.documentType === DocumentType.CLINICAL_NOTE) {
      return !!dto.soapNote && !!dto.content;
    }
    return !!dto.content;
  }

  private calculateQualityMetrics(dto: CreateDocumentDto): any {
    const metrics = {
      completeness: 0,
      timeliness: true,
      accuracy: 100,
      complianceScore: 100,
    };

    // Calculate completeness
    let completedFields = 0;
    const totalFields = 4;

    if (dto.content) completedFields++;
    if (dto.soapNote) completedFields++;
    if (dto.diagnoses && dto.diagnoses.length > 0) completedFields++;
    if (dto.procedures && dto.procedures.length > 0) completedFields++;

    metrics.completeness = (completedFields / totalFields) * 100;

    return metrics;
  }

  private formatSoapNoteAsText(soapNote: any): string {
    let text = '';

    if (soapNote.subjective) {
      text += 'SUBJECTIVE:\n';
      text += `Chief Complaint: ${soapNote.subjective.chiefComplaint || 'N/A'}\n`;
      text += `HPI: ${soapNote.subjective.historyOfPresentIllness || 'N/A'}\n`;
      text += `Medications: ${soapNote.subjective.medications?.join(', ') || 'None'}\n`;
      text += `Allergies: ${soapNote.subjective.allergies?.join(', ') || 'NKDA'}\n\n`;
    }

    if (soapNote.objective) {
      text += 'OBJECTIVE:\n';
      text += `Vital Signs: ${JSON.stringify(soapNote.objective.vitalSigns || {})}\n`;
      text += `Physical Exam: ${soapNote.objective.physicalExam || 'N/A'}\n\n`;
    }

    if (soapNote.assessment) {
      text += 'ASSESSMENT:\n';
      text += `Diagnosis: ${soapNote.assessment.diagnosis?.join(', ') || 'N/A'}\n\n`;
    }

    if (soapNote.plan) {
      text += 'PLAN:\n';
      text += `Treatment: ${soapNote.plan.treatment || 'N/A'}\n`;
      text += `Follow-up: ${soapNote.plan.followUp || 'N/A'}\n`;
    }

    return text;
  }

  private generateElectronicSignature(signature: string, document: TelemedicineDocument): string {
    const dataToSign = `${document.id}${document.content}${signature}${new Date().toISOString()}`;
    return crypto.createHash('sha256').update(dataToSign).digest('hex');
  }

  private addAuditEntry(document: TelemedicineDocument, action: string, performedBy: string): void {
    const auditTrail = document.auditTrail || [];
    auditTrail.push({
      action,
      performedBy,
      timestamp: new Date(),
    });
    document.auditTrail = auditTrail;
  }

  private extractKeyFindings(document: TelemedicineDocument): string[] {
    const findings: string[] = [];

    if (document.soapNote?.assessment?.diagnosis) {
      findings.push(...document.soapNote.assessment.diagnosis);
    }

    if (document.diagnoses) {
      findings.push(...document.diagnoses.map((d) => d.description));
    }

    return [...new Set(findings)]; // Remove duplicates
  }

  async findOne(id: string): Promise<TelemedicineDocument> {
    const document = await this.documentRepository.findOne({
      where: { id, deletedAt: null },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }

    return document;
  }

  async softDelete(documentId: string, deletedBy: string): Promise<void> {
    const document = await this.findOne(documentId);

    document.deletedAt = new Date();
    document.status = DocumentStatus.DELETED;

    this.addAuditEntry(document, 'DELETED', deletedBy);

    await this.documentRepository.save(document);
  }
}
