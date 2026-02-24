import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LabResult, ResultStatus } from '../entities/lab-result.entity';
import { LabResultValue, AbnormalFlag } from '../entities/lab-result-value.entity';
import { LabOrderItem, OrderItemStatus } from '../entities/lab-order-item.entity';
import { LabTestParameter } from '../entities/lab-test-parameter.entity';
import { CreateLabResultDto } from '../dto/create-lab-result.dto';
import { CriticalAlertsService } from './critical-alerts.service';

@Injectable()
export class LabResultsService {
  private readonly logger = new Logger(LabResultsService.name);

  constructor(
    @InjectRepository(LabResult)
    private labResultRepository: Repository<LabResult>,
    @InjectRepository(LabResultValue)
    private resultValueRepository: Repository<LabResultValue>,
    @InjectRepository(LabOrderItem)
    private orderItemRepository: Repository<LabOrderItem>,
    @InjectRepository(LabTestParameter)
    private parameterRepository: Repository<LabTestParameter>,
    private criticalAlertsService: CriticalAlertsService,
  ) {}

  async create(createDto: CreateLabResultDto, userId: string): Promise<LabResult> {
    this.logger.log(`Creating lab result for order item: ${createDto.orderItemId}`);

    // Verify order item exists
    const orderItem = await this.orderItemRepository.findOne({
      where: { id: createDto.orderItemId },
      relations: ['labOrder', 'labTest', 'labTest.parameters'],
    });

    if (!orderItem) {
      throw new NotFoundException(`Order item with ID ${createDto.orderItemId} not found`);
    }

    // Check if result already exists
    const existing = await this.labResultRepository.findOne({
      where: { orderItemId: createDto.orderItemId },
    });

    if (existing) {
      throw new BadRequestException(
        `Result already exists for order item ${createDto.orderItemId}`,
      );
    }

    const labResult = this.labResultRepository.create({
      ...createDto,
      performedDate: createDto.performedDate ? new Date(createDto.performedDate) : new Date(),
      status: createDto.status || ResultStatus.PRELIMINARY,
      createdBy: userId,
      updatedBy: userId,
    });

    // Process result values
    let hasCriticalValues = false;
    const resultValues: LabResultValue[] = [];

    for (const valueDto of createDto.values) {
      const parameter = await this.parameterRepository.findOne({
        where: { id: valueDto.parameterId },
      });

      if (!parameter) {
        throw new NotFoundException(`Parameter with ID ${valueDto.parameterId} not found`);
      }

      const resultValue = this.resultValueRepository.create({
        ...valueDto,
        createdBy: userId,
        updatedBy: userId,
      });

      // Determine abnormal flag
      if (valueDto.numericValue !== undefined && valueDto.numericValue !== null) {
        resultValue.abnormalFlag = this.determineAbnormalFlag(valueDto.numericValue, parameter);

        // Check for critical values
        if (
          resultValue.abnormalFlag === AbnormalFlag.CRITICAL_LOW ||
          resultValue.abnormalFlag === AbnormalFlag.CRITICAL_HIGH
        ) {
          hasCriticalValues = true;
        }

        // Set reference range
        resultValue.referenceRange = this.formatReferenceRange(parameter);
      }

      resultValues.push(resultValue);
    }

    labResult.values = resultValues;
    labResult.hasCriticalValues = hasCriticalValues;

    const saved = await this.labResultRepository.save(labResult);
    this.logger.log(`Lab result created: ${saved.id}`);

    // Update order item status
    orderItem.status = OrderItemStatus.COMPLETED;
    await this.orderItemRepository.save(orderItem);

    // Create critical value alerts if needed
    if (hasCriticalValues) {
      await this.createCriticalAlerts(saved, orderItem.labOrder.orderingProviderId);
    }

    return this.findOne(saved.id);
  }

  async findOne(id: string): Promise<LabResult> {
    const labResult = await this.labResultRepository.findOne({
      where: { id },
      relations: [
        'orderItem',
        'orderItem.labOrder',
        'orderItem.labTest',
        'values',
        'values.parameter',
        'values.criticalAlerts',
      ],
    });

    if (!labResult) {
      throw new NotFoundException(`Lab result with ID ${id} not found`);
    }

    return labResult;
  }

  async findByOrderItem(orderItemId: string): Promise<LabResult | null> {
    return this.labResultRepository.findOne({
      where: { orderItemId },
      relations: ['values', 'values.parameter', 'values.criticalAlerts'],
    });
  }

  async verify(id: string, userId: string, verifierName?: string): Promise<LabResult> {
    const labResult = await this.findOne(id);

    if (labResult.status === ResultStatus.CANCELLED) {
      throw new BadRequestException('Cannot verify a cancelled result');
    }

    labResult.status = ResultStatus.FINAL;
    labResult.verifiedBy = userId;
    labResult.verifiedByName = verifierName;
    labResult.verifiedDate = new Date();
    labResult.updatedBy = userId;

    const saved = await this.labResultRepository.save(labResult);
    this.logger.log(`Lab result verified: ${saved.id}`);

    return this.findOne(saved.id);
  }

  async correct(
    id: string,
    correctionReason: string,
    newValues: any[],
    userId: string,
  ): Promise<LabResult> {
    const labResult = await this.findOne(id);

    labResult.status = ResultStatus.CORRECTED;
    labResult.correctionReason = correctionReason;
    labResult.correctedBy = userId;
    labResult.correctedDate = new Date();
    labResult.updatedBy = userId;

    // Update values
    // In a real implementation, you might want to keep history of corrections
    for (const valueDto of newValues) {
      const existingValue = labResult.values.find((v) => v.parameterId === valueDto.parameterId);

      if (existingValue) {
        Object.assign(existingValue, valueDto);
        existingValue.updatedBy = userId;
      }
    }

    const saved = await this.labResultRepository.save(labResult);
    this.logger.log(`Lab result corrected: ${saved.id}`);

    return this.findOne(saved.id);
  }

  private determineAbnormalFlag(value: number, parameter: LabTestParameter): AbnormalFlag {
    if (parameter.criticalLow !== null && value < parameter.criticalLow) {
      return AbnormalFlag.CRITICAL_LOW;
    }
    if (parameter.criticalHigh !== null && value > parameter.criticalHigh) {
      return AbnormalFlag.CRITICAL_HIGH;
    }
    if (parameter.normalRangeLow !== null && value < parameter.normalRangeLow) {
      return AbnormalFlag.LOW;
    }
    if (parameter.normalRangeHigh !== null && value > parameter.normalRangeHigh) {
      return AbnormalFlag.HIGH;
    }
    return AbnormalFlag.NORMAL;
  }

  private formatReferenceRange(parameter: LabTestParameter): string {
    if (parameter.normalRangeLow !== null && parameter.normalRangeHigh !== null) {
      return `${parameter.normalRangeLow}-${parameter.normalRangeHigh} ${parameter.unit || ''}`.trim();
    }
    if (parameter.normalRangeLow !== null) {
      return `> ${parameter.normalRangeLow} ${parameter.unit || ''}`.trim();
    }
    if (parameter.normalRangeHigh !== null) {
      return `< ${parameter.normalRangeHigh} ${parameter.unit || ''}`.trim();
    }
    return '';
  }

  private async createCriticalAlerts(labResult: LabResult, providerId: string): Promise<void> {
    for (const value of labResult.values) {
      if (
        value.abnormalFlag === AbnormalFlag.CRITICAL_LOW ||
        value.abnormalFlag === AbnormalFlag.CRITICAL_HIGH
      ) {
        await this.criticalAlertsService.create({
          resultValueId: value.id,
          notifiedTo: providerId,
        });
      }
    }
  }
}
