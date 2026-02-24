import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { LabAccreditation, AccreditationStatus } from '../entities/lab-accreditation.entity';
import {
  LabComplianceRecord,
  ComplianceStatus,
  ComplianceType,
} from '../entities/lab-compliance-record.entity';
import { CreateLabAccreditationDto } from '../dto/create-lab-accreditation.dto';

@Injectable()
export class LabAccreditationService {
  constructor(
    @InjectRepository(LabAccreditation)
    private accreditationRepository: Repository<LabAccreditation>,
    @InjectRepository(LabComplianceRecord)
    private complianceRepository: Repository<LabComplianceRecord>,
  ) {}

  async create(createAccreditationDto: CreateLabAccreditationDto): Promise<LabAccreditation> {
    const accreditation = this.accreditationRepository.create({
      ...createAccreditationDto,
      issuedDate: new Date(createAccreditationDto.issuedDate),
      expiryDate: new Date(createAccreditationDto.expiryDate),
      nextAssessmentDate: createAccreditationDto.nextAssessmentDate
        ? new Date(createAccreditationDto.nextAssessmentDate)
        : null,
      status: AccreditationStatus.ACTIVE,
    });

    return this.accreditationRepository.save(accreditation);
  }

  async findAll(): Promise<LabAccreditation[]> {
    return this.accreditationRepository.find({
      relations: ['complianceRecords'],
      order: { expiryDate: 'ASC' },
    });
  }

  async findOne(id: string): Promise<LabAccreditation> {
    const accreditation = await this.accreditationRepository.findOne({
      where: { id },
      relations: ['complianceRecords'],
    });

    if (!accreditation) {
      throw new NotFoundException(`Accreditation with ID ${id} not found`);
    }

    return accreditation;
  }

  async getExpiringAccreditations(daysAhead: number = 90): Promise<LabAccreditation[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return this.accreditationRepository.find({
      where: {
        expiryDate: LessThan(futureDate),
        status: AccreditationStatus.ACTIVE,
      },
      order: { expiryDate: 'ASC' },
    });
  }

  async updateStatus(id: string, status: AccreditationStatus): Promise<LabAccreditation> {
    const accreditation = await this.findOne(id);
    accreditation.status = status;
    return this.accreditationRepository.save(accreditation);
  }

  async createComplianceRecord(
    accreditationId: string,
    recordData: Partial<LabComplianceRecord>,
  ): Promise<LabComplianceRecord> {
    const accreditation = await this.findOne(accreditationId);

    const complianceRecord = this.complianceRepository.create({
      ...recordData,
      accreditationId,
      assessmentDate: recordData.assessmentDate || new Date(),
    });

    return this.complianceRepository.save(complianceRecord);
  }

  async getComplianceRecords(accreditationId: string): Promise<LabComplianceRecord[]> {
    return this.complianceRepository.find({
      where: { accreditationId },
      order: { assessmentDate: 'DESC' },
    });
  }

  async getComplianceByStatus(status: ComplianceStatus): Promise<LabComplianceRecord[]> {
    return this.complianceRepository.find({
      where: { status },
      relations: ['accreditation'],
      order: { assessmentDate: 'DESC' },
    });
  }

  async getComplianceByType(type: ComplianceType): Promise<LabComplianceRecord[]> {
    return this.complianceRepository.find({
      where: { type },
      relations: ['accreditation'],
      order: { assessmentDate: 'DESC' },
    });
  }

  async getComplianceDashboard(): Promise<any> {
    const [totalAccreditations, activeAccreditations, expiringAccreditations, complianceOverview] =
      await Promise.all([
        this.accreditationRepository.count(),
        this.accreditationRepository.count({ where: { status: AccreditationStatus.ACTIVE } }),
        this.getExpiringAccreditations(90),
        this.getComplianceOverview(),
      ]);

    return {
      accreditations: {
        total: totalAccreditations,
        active: activeAccreditations,
        expiring: expiringAccreditations.length,
      },
      compliance: complianceOverview,
      expiringAccreditations: expiringAccreditations.map((acc) => ({
        id: acc.id,
        type: acc.type,
        certificateNumber: acc.certificateNumber,
        expiryDate: acc.expiryDate,
        daysUntilExpiry: Math.ceil((acc.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      })),
    };
  }

  private async getComplianceOverview(): Promise<any> {
    const complianceRecords = await this.complianceRepository.find();

    const statusCounts = complianceRecords.reduce((acc, record) => {
      acc[record.status] = (acc[record.status] || 0) + 1;
      return acc;
    }, {});

    const typeCounts = complianceRecords.reduce((acc, record) => {
      acc[record.type] = (acc[record.type] || 0) + 1;
      return acc;
    }, {});

    const overallCompliance =
      complianceRecords.length > 0
        ? ((statusCounts[ComplianceStatus.COMPLIANT] || 0) / complianceRecords.length) * 100
        : 0;

    return {
      overallCompliance: Math.round(overallCompliance),
      statusBreakdown: statusCounts,
      typeBreakdown: typeCounts,
      totalRecords: complianceRecords.length,
    };
  }

  async scheduleAssessment(id: string, assessmentDate: Date): Promise<LabAccreditation> {
    const accreditation = await this.findOne(id);
    accreditation.nextAssessmentDate = assessmentDate;
    return this.accreditationRepository.save(accreditation);
  }
}
