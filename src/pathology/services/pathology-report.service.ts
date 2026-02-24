import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PathologyReport, ReportStatus, ReportType } from '../entities/pathology-report.entity';
import { CreatePathologyReportDto } from '../dto/create-pathology-report.dto';

@Injectable()
export class PathologyReportService {
  private readonly logger = new Logger(PathologyReportService.name);

  constructor(
    @InjectRepository(PathologyReport)
    private reportRepository: Repository<PathologyReport>,
  ) {}

  async create(createDto: CreatePathologyReportDto, userId: string): Promise<PathologyReport> {
    const reportNumber = await this.generateReportNumber();

    const report = this.reportRepository.create({
      ...createDto,
      reportNumber,
      reportDate: createDto.reportDate ? new Date(createDto.reportDate) : new Date(),
      status: ReportStatus.DRAFT,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.reportRepository.save(report);
    this.logger.log(`Pathology report created: ${saved.id} (${saved.reportNumber})`);

    return this.findOne(saved.id);
  }

  async findOne(id: string): Promise<PathologyReport> {
    const report = await this.reportRepository.findOne({
      where: { id },
      relations: ['pathologyCase', 'template'],
    });

    if (!report) {
      throw new NotFoundException(`Pathology report with ID ${id} not found`);
    }

    return report;
  }

  async findByCase(caseId: string): Promise<PathologyReport[]> {
    return this.reportRepository.find({
      where: { pathologyCaseId: caseId },
      order: { reportDate: 'DESC' },
    });
  }

  async finalize(id: string, signature: string, userId: string): Promise<PathologyReport> {
    const report = await this.findOne(id);

    if (report.status === ReportStatus.SIGNED) {
      throw new BadRequestException('Report is already signed');
    }

    report.status = ReportStatus.SIGNED;
    report.pathologistSignature = signature;
    report.signedDate = new Date();
    report.updatedBy = userId;

    const saved = await this.reportRepository.save(report);
    this.logger.log(`Pathology report finalized: ${saved.id}`);

    return saved;
  }

  async amend(
    id: string,
    reason: string,
    changes: string,
    userId: string,
  ): Promise<PathologyReport> {
    const report = await this.findOne(id);

    if (report.status !== ReportStatus.SIGNED) {
      throw new BadRequestException('Only signed reports can be amended');
    }

    if (!report.amendmentHistory) {
      report.amendmentHistory = [];
    }

    report.amendmentHistory.push({
      date: new Date(),
      reason,
      changes,
      amendedBy: userId,
    });

    report.reportType = ReportType.AMENDED;
    report.updatedBy = userId;

    const saved = await this.reportRepository.save(report);
    this.logger.log(`Pathology report amended: ${saved.id}`);

    return saved;
  }

  async addAddendum(id: string, addendumText: string, userId: string): Promise<PathologyReport> {
    const report = await this.findOne(id);

    report.comment = report.comment
      ? `${report.comment}\n\nADDENDUM (${new Date().toISOString()}):\n${addendumText}`
      : `ADDENDUM (${new Date().toISOString()}):\n${addendumText}`;

    report.reportType = ReportType.ADDENDUM;
    report.updatedBy = userId;

    return this.reportRepository.save(report);
  }

  private async generateReportNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const count = await this.reportRepository.count();
    const sequence = String(count + 1).padStart(5, '0');

    return `REP-${year}${month}-${sequence}`;
  }
}
