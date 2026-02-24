import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { QualityControlLog, QCType, QCResult } from '../entities/quality-control-log.entity';
import { CreateQualityControlDto } from '../dto/create-quality-control.dto';

@Injectable()
export class QualityControlService {
  private readonly logger = new Logger(QualityControlService.name);

  constructor(
    @InjectRepository(QualityControlLog)
    private qcLogRepository: Repository<QualityControlLog>,
  ) {}

  async create(createDto: CreateQualityControlDto, userId: string): Promise<QualityControlLog> {
    this.logger.log(`Creating QC log for equipment: ${createDto.equipmentId}`);

    const qcLog = this.qcLogRepository.create({
      ...createDto,
      qcDate: createDto.qcDate ? new Date(createDto.qcDate) : new Date(),
      expirationDate: createDto.expirationDate ? new Date(createDto.expirationDate) : undefined,
      nextDueDate: createDto.nextDueDate ? new Date(createDto.nextDueDate) : undefined,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.qcLogRepository.save(qcLog);
    this.logger.log(`QC log created: ${saved.id}`);

    return this.findOne(saved.id);
  }

  async findOne(id: string): Promise<QualityControlLog> {
    const qcLog = await this.qcLogRepository.findOne({
      where: { id },
    });

    if (!qcLog) {
      throw new NotFoundException(`QC log with ID ${id} not found`);
    }

    return qcLog;
  }

  async findAll(options?: {
    equipmentId?: string;
    labTestId?: string;
    qcType?: QCType;
    qcResult?: QCResult;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: QualityControlLog[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.qcLogRepository
      .createQueryBuilder('qc')
      .orderBy('qc.qcDate', 'DESC')
      .skip(skip)
      .take(limit);

    if (options?.equipmentId) {
      queryBuilder.andWhere('qc.equipmentId = :equipmentId', {
        equipmentId: options.equipmentId,
      });
    }

    if (options?.labTestId) {
      queryBuilder.andWhere('qc.labTestId = :labTestId', {
        labTestId: options.labTestId,
      });
    }

    if (options?.qcType) {
      queryBuilder.andWhere('qc.qcType = :qcType', {
        qcType: options.qcType,
      });
    }

    if (options?.qcResult) {
      queryBuilder.andWhere('qc.qcResult = :qcResult', {
        qcResult: options.qcResult,
      });
    }

    if (options?.startDate && options?.endDate) {
      queryBuilder.andWhere('qc.qcDate BETWEEN :startDate AND :endDate', {
        startDate: new Date(options.startDate),
        endDate: new Date(options.endDate),
      });
    }

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total, page, limit };
  }

  async findByEquipment(equipmentId: string): Promise<QualityControlLog[]> {
    return this.qcLogRepository.find({
      where: { equipmentId },
      order: { qcDate: 'DESC' },
    });
  }

  async findOverdue(): Promise<QualityControlLog[]> {
    const today = new Date();

    return this.qcLogRepository.find({
      where: {
        nextDueDate: LessThan(today),
      },
      order: { nextDueDate: 'ASC' },
    });
  }

  async findFailedQC(options?: {
    startDate?: string;
    endDate?: string;
  }): Promise<QualityControlLog[]> {
    const queryBuilder = this.qcLogRepository
      .createQueryBuilder('qc')
      .where('qc.qcResult IN (:...results)', {
        results: [QCResult.FAIL, QCResult.OUT_OF_RANGE],
      })
      .orderBy('qc.qcDate', 'DESC');

    if (options?.startDate && options?.endDate) {
      queryBuilder.andWhere('qc.qcDate BETWEEN :startDate AND :endDate', {
        startDate: new Date(options.startDate),
        endDate: new Date(options.endDate),
      });
    }

    return queryBuilder.getMany();
  }

  async update(
    id: string,
    updateDto: Partial<CreateQualityControlDto>,
    userId: string,
  ): Promise<QualityControlLog> {
    const qcLog = await this.findOne(id);

    Object.assign(qcLog, updateDto);
    qcLog.updatedBy = userId;

    const saved = await this.qcLogRepository.save(qcLog);
    this.logger.log(`QC log updated: ${saved.id}`);

    return this.findOne(saved.id);
  }

  async getQCStatistics(
    equipmentId: string,
    days: number = 30,
  ): Promise<{
    totalTests: number;
    passedTests: number;
    failedTests: number;
    passRate: number;
    lastCalibration?: Date;
    nextDue?: Date;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await this.qcLogRepository.find({
      where: { equipmentId },
      order: { qcDate: 'DESC' },
    });

    const recentLogs = logs.filter((log) => log.qcDate >= startDate);

    const totalTests = recentLogs.length;
    const passedTests = recentLogs.filter(
      (log) => log.qcResult === QCResult.PASS || log.qcResult === QCResult.ACCEPTABLE,
    ).length;
    const failedTests = totalTests - passedTests;
    const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

    const lastCalibration = logs.find((log) => log.qcType === QCType.CALIBRATION)?.qcDate;

    const nextDue = logs.find((log) => log.nextDueDate)?.nextDueDate;

    return {
      totalTests,
      passedTests,
      failedTests,
      passRate: Math.round(passRate * 100) / 100,
      lastCalibration,
      nextDue,
    };
  }
}
