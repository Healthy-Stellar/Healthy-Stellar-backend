import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LabReportTemplate, ReportType } from '../entities/lab-report-template.entity';
import { LabReport, ReportStatus } from '../entities/lab-report.entity';
import { CreateLabReportTemplateDto } from '../dto/create-lab-report-template.dto';

@Injectable()
export class LabReportService {
  constructor(
    @InjectRepository(LabReportTemplate)
    private templateRepository: Repository<LabReportTemplate>,
    @InjectRepository(LabReport)
    private reportRepository: Repository<LabReport>,
  ) {}

  async createTemplate(createTemplateDto: CreateLabReportTemplateDto): Promise<LabReportTemplate> {
    const template = this.templateRepository.create(createTemplateDto);
    return this.templateRepository.save(template);
  }

  async findAllTemplates(): Promise<LabReportTemplate[]> {
    return this.templateRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findTemplatesByType(type: ReportType): Promise<LabReportTemplate[]> {
    return this.templateRepository.find({
      where: { type, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async generateReport(
    templateId: string,
    labOrderId: string,
    generatedBy: string,
    parameters?: any,
  ): Promise<LabReport> {
    const template = await this.templateRepository.findOne({ where: { id: templateId } });

    if (!template) {
      throw new NotFoundException(`Template with ID ${templateId} not found`);
    }

    const report = this.reportRepository.create({
      templateId,
      labOrderId,
      title: `${template.name} - ${new Date().toISOString()}`,
      generatedBy,
      parameters,
      status: ReportStatus.GENERATING,
    });

    const savedReport = await this.reportRepository.save(report);

    // Simulate report generation process
    setTimeout(async () => {
      try {
        const generatedFilePath = await this.processReportGeneration(
          template,
          savedReport,
          parameters,
        );

        savedReport.status = ReportStatus.COMPLETED;
        savedReport.filePath = generatedFilePath;
        savedReport.generatedAt = new Date();
        savedReport.fileSize = Math.floor(Math.random() * 1000000); // Simulate file size

        await this.reportRepository.save(savedReport);
      } catch (error) {
        savedReport.status = ReportStatus.FAILED;
        await this.reportRepository.save(savedReport);
      }
    }, 1000);

    return savedReport;
  }

  private async processReportGeneration(
    template: LabReportTemplate,
    report: LabReport,
    parameters: any,
  ): Promise<string> {
    // Simulate report generation logic
    // In a real implementation, this would:
    // 1. Fetch lab data based on parameters
    // 2. Apply template formatting
    // 3. Generate PDF/HTML/XML based on template format
    // 4. Save file to storage
    // 5. Return file path

    const fileName = `report_${report.id}.${template.format.toLowerCase()}`;
    const filePath = `/reports/${fileName}`;

    return filePath;
  }

  async findAllReports(): Promise<LabReport[]> {
    return this.reportRepository.find({
      relations: ['template', 'labOrder'],
      order: { createdAt: 'DESC' },
    });
  }

  async findReportsByStatus(status: ReportStatus): Promise<LabReport[]> {
    return this.reportRepository.find({
      where: { status },
      relations: ['template', 'labOrder'],
      order: { createdAt: 'DESC' },
    });
  }

  async findReportsByLabOrder(labOrderId: string): Promise<LabReport[]> {
    return this.reportRepository.find({
      where: { labOrderId },
      relations: ['template'],
      order: { createdAt: 'DESC' },
    });
  }

  async sendReport(reportId: string, sentTo: string): Promise<LabReport> {
    const report = await this.reportRepository.findOne({ where: { id: reportId } });

    if (!report) {
      throw new NotFoundException(`Report with ID ${reportId} not found`);
    }

    if (report.status !== ReportStatus.COMPLETED) {
      throw new Error('Report is not ready to be sent');
    }

    report.sentTo = sentTo;
    report.sentAt = new Date();
    report.status = ReportStatus.SENT;

    return this.reportRepository.save(report);
  }
}
