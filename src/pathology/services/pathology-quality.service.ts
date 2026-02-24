import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { QualityControlLog, DiscrepancySeverity } from '../entities/quality-control.entity';
import { CreateQualityControlDto } from '../dto/create-quality-control.dto';

@Injectable()
export class PathologyQualityService {
  private readonly logger = new Logger(PathologyQualityService.name);

  constructor(
    @InjectRepository(QualityControlLog)
    private qcRepository: Repository<QualityControlLog>,
  ) {}

  async create(createDto: CreateQualityControlDto, userId: string): Promise<QualityControlLog> {
    const qcLog = this.qcRepository.create({
      ...createDto,
      reviewDate: createDto.reviewDate ? new Date(createDto.reviewDate) : new Date(),
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.qcRepository.save(qcLog);
    this.logger.log(`Quality control log created: ${saved.id}`);

    return saved;
  }

  async findOne(id: string): Promise<QualityControlLog> {
    const qcLog = await this.qcRepository.findOne({
      where: { id },
      relations: ['pathologyCase'],
    });

    if (!qcLog) {
      throw new NotFoundException(`Quality control log with ID ${id} not found`);
    }

    return qcLog;
  }

  async findByCase(caseId: string): Promise<QualityControlLog[]> {
    return this.qcRepository.find({
      where: { pathologyCaseId: caseId },
      order: { reviewDate: 'DESC' },
    });
  }

  async resolveDiscrepancy(
    id: string,
    resolutionNotes: string,
    userId: string,
  ): Promise<QualityControlLog> {
    const qcLog = await this.findOne(id);

    qcLog.resolutionDate = new Date();
    qcLog.resolutionNotes = resolutionNotes;
    qcLog.followUpRequired = false;
    qcLog.updatedBy = userId;

    return this.qcRepository.save(qcLog);
  }

  async getQAMetrics(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalReviews: number;
    discrepancyRate: number;
    criticalDiscrepancies: number;
    averageResolutionTime: number;
    educationalCases: number;
  }> {
    const reviews = await this.qcRepository.find({
      where: {
        reviewDate: Between(startDate, endDate),
      },
    });

    const totalReviews = reviews.length;
    const discrepancies = reviews.filter((r) => r.severity !== DiscrepancySeverity.NONE);
    const criticalDiscrepancies = reviews.filter(
      (r) => r.severity === DiscrepancySeverity.CRITICAL,
    ).length;
    const educationalCases = reviews.filter((r) => r.educationalValue).length;

    const resolvedDiscrepancies = discrepancies.filter((r) => r.resolutionDate);
    const resolutionTimes = resolvedDiscrepancies.map((r) => {
      const reviewTime = new Date(r.reviewDate).getTime();
      const resolutionTime = new Date(r.resolutionDate).getTime();
      return (resolutionTime - reviewTime) / (1000 * 60 * 60 * 24); // days
    });

    const averageResolutionTime =
      resolutionTimes.length > 0
        ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
        : 0;

    return {
      totalReviews,
      discrepancyRate: totalReviews > 0 ? (discrepancies.length / totalReviews) * 100 : 0,
      criticalDiscrepancies,
      averageResolutionTime,
      educationalCases,
    };
  }
}
