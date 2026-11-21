import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLabResultDto } from './dto/create-lab-result.dto';
import { CorrectLabResultDto } from './dto/correct-lab-result.dto';
import { LabResultStatus, AbnormalFlag } from '@prisma/client';

@Injectable()
export class LabResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateLabResultDto, userId: string) {
    const labResult = await this.prisma.labResult.create({
      data: {
        patientId: dto.patientId,
        orderedById: userId,
        status: LabResultStatus.PENDING,
        values: {
          create: dto.values.map((valueDto) => ({
            ...valueDto,
            abnormalFlag: this.determineAbnormalFlag(valueDto),
          })),
        },
      },
      include: { values: true },
    });

    const hasCriticalValues = labResult.values.some(
      (value) => value.abnormalFlag === AbnormalFlag.CRITICAL,
    );

    if (hasCriticalValues) {
      await this.prisma.labResult.update({
        where: { id: labResult.id },
        data: { hasCriticalValues: true },
      });
      await this.createCriticalAlerts(labResult);
      this.eventEmitter.emit('CRITICAL_VALUE_DETECTED', {
        labResultId: labResult.id,
        patientId: labResult.patientId,
      });
    }

    return labResult;
  }

  async correct(id: string, dto: CorrectLabResultDto, userId: string) {
    const labResult = await this.prisma.labResult.findUnique({
      where: { id },
      include: { values: true },
    });

    if (!labResult) {
      throw new NotFoundException(`Lab result ${id} not found`);
    }

    if (labResult.status === LabResultStatus.FINAL) {
      throw new BadRequestException('Cannot correct a finalized lab result');
    }

    for (const valueDto of dto.values) {
      const existingValue = labResult.values.find(
        (value) => value.id === valueDto.id,
      );

      if (!existingValue) {
        throw new NotFoundException(`Lab value ${valueDto.id} not found`);
      }

      await this.prisma.labResultValue.update({
        where: { id: existingValue.id },
        data: {
          ...valueDto,
          abnormalFlag: this.determineAbnormalFlag({
            ...existingValue,
            ...valueDto,
          }),
        },
      });
    }

    const updated = await this.prisma.labResult.findUnique({
      where: { id },
      include: { values: true },
    });

    const hasCriticalValues = updated.values.some(
      (value) => value.abnormalFlag === AbnormalFlag.CRITICAL,
    );

    if (hasCriticalValues !== updated.hasCriticalValues) {
      await this.prisma.labResult.update({
        where: { id },
        data: { hasCriticalValues },
      });
    }

    if (hasCriticalValues) {
      await this.createCriticalAlerts(updated);
      this.eventEmitter.emit('CRITICAL_VALUE_DETECTED', {
        labResultId: updated.id,
        patientId: updated.patientId,
      });
    }

    return updated;
  }

  private determineAbnormalFlag(value: {
    value: number;
    referenceLow?: number | null;
    referenceHigh?: number | null;
    criticalLow?: number | null;
    criticalHigh?: number | null;
  }): AbnormalFlag {
    if (value.criticalLow != null && value.value <= value.criticalLow) {
      return AbnormalFlag.CRITICAL;
    }
    if (value.criticalHigh != null && value.value >= value.criticalHigh) {
      return AbnormalFlag.CRITICAL;
    }
    if (value.referenceLow != null && value.value < value.referenceLow) {
      return AbnormalFlag.LOW;
    }
    if (value.referenceHigh != null && value.value > value.referenceHigh) {
      return AbnormalFlag.HIGH;
    }
    return AbnormalFlag.NORMAL;
  }

  private async createCriticalAlerts(labResult: {
    id: string;
    patientId: string;
    values: { id: string; abnormalFlag: AbnormalFlag }[];
  }) {
    const criticalValues = labResult.values.filter(
      (value) => value.abnormalFlag === AbnormalFlag.CRITICAL,
    );

    for (const value of criticalValues) {
      await this.prisma.criticalValueAlert.create({
        data: {
          labResultId: labResult.id,
          labResultValueId: value.id,
          patientId: labResult.patientId,
        },
      });
    }
  }
}
