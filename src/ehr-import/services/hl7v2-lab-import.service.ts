import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LabResult } from '../../laboratory/entities/lab-result.entity';
import { Hl7v2OruParser } from '../parsers/hl7v2-oru.parser';
import { mapLoincToTestCode } from '../parsers/loinc-test-code.map';

@Injectable()
export class Hl7v2LabImportService {
  private readonly logger = new Logger(Hl7v2LabImportService.name);

  constructor(
    @InjectRepository(LabResult)
    private readonly labResultRepo: Repository<LabResult>,
    private readonly parser: Hl7v2OruParser,
  ) {}

  async importRaw(raw: string): Promise<{ created: LabResult[] }> {
    const messages = this.parser.parse(raw);
    const created: LabResult[] = [];

    for (const message of messages) {
      for (const order of message.orders) {
        const orderId = order.fillerOrderNumber || order.placerOrderNumber || 'unknown';

        for (const result of order.results) {
          const entity = this.labResultRepo.create({
            orderId,
            testId: result.loincCode,
            testCode: mapLoincToTestCode(result.loincCode),
            testName: result.observationText || result.loincCode,
            result: result.value,
            unit: result.units ?? '',
            referenceRange: result.referenceRange,
            flag: this.mapAbnormalFlag(result.abnormalFlag),
            status: this.mapResultStatus(result.resultStatus),
            performedBy: order.orderingProvider || 'unknown',
            performedAt: result.observedAt ?? order.observationDateTime ?? new Date(),
          });
          created.push(await this.labResultRepo.save(entity));
        }
      }
    }

    this.logger.log(`Imported ${created.length} lab result(s) from HL7 v2 ORU^R01 message(s)`);
    return { created };
  }

  private mapAbnormalFlag(flag?: string): string {
    if (!flag) return 'normal';
    return ['H', 'HH', 'L', 'LL', 'A', 'AA'].includes(flag.toUpperCase()) ? 'abnormal' : 'normal';
  }

  private mapResultStatus(status?: string): string {
    switch (status?.toUpperCase()) {
      case 'P':
        return 'preliminary';
      case 'C':
        return 'corrected';
      case 'F':
      default:
        return 'final';
    }
  }
}
