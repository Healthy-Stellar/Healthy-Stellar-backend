import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ControlledSubstanceLog } from '../entities/controlled-substance-log.entity';

@Injectable()
export class ControlledSubstanceService {
  constructor(
    @InjectRepository(ControlledSubstanceLog)
    private logRepository: Repository<ControlledSubstanceLog>,
  ) {}

  async logDispensing(
    drugId: string,
    prescriptionId: string,
    quantity: number,
    patientName: string,
    prescriberName: string,
    prescriberDEA: string,
    pharmacistLicense: string,
    pharmacistName?: string
  ): Promise<ControlledSubstanceLog> {
    const runningBalance = await this.getRunningBalance(drugId);

    const log = this.logRepository.create({
      drugId,
      prescriptionId,
      transactionType: 'dispensed',
      quantity,
      runningBalance: runningBalance - quantity,
      patientName,
      prescriberName,
      prescriberDEA,
      pharmacistName: pharmacistName || 'Unknown',
      pharmacistLicense
    });

    return await this.logRepository.save(log);
  }

  async logReceipt(
    drugId: string,
    quantity: number,
    pharmacistLicense: string,
    pharmacistName: string,
    notes?: string
  ): Promise<ControlledSubstanceLog> {
    const runningBalance = await this.getRunningBalance(drugId);

    const log = this.logRepository.create({
      drugId,
      transactionType: 'received',
      quantity,
      runningBalance: runningBalance + quantity,
      patientName: 'N/A',
      prescriberName: 'N/A',
      prescriberDEA: 'N/A',
      pharmacistName,
      pharmacistLicense,
      notes
    });

    return await this.logRepository.save(log);
  }

  async logWaste(
    drugId: string,
    quantity: number,
    pharmacistLicense: string,
    pharmacistName: string,
    witnessName: string,
    reason: string
  ): Promise<ControlledSubstanceLog> {
    const runningBalance = await this.getRunningBalance(drugId);

    const log = this.logRepository.create({
      drugId,
      transactionType: 'wasted',
      quantity,
      runningBalance: runningBalance - quantity,
      patientName: 'N/A',
      prescriberName: 'N/A',
      prescriberDEA: 'N/A',
      pharmacistName,
      pharmacistLicense,
      witnessName,
      notes: `Wasted: ${reason}`
    });

    return await this.logRepository.save(log);
  }

  async getRunningBalance(drugId: string): Promise<number> {
    const latestLog = await this.logRepository.findOne({
      where: { drugId },
      order: { transactionDate: 'DESC' }
    });

    return latestLog ? latestLog.runningBalance : 0;
  }

  async getLogsByDrug(drugId: string, startDate?: Date, endDate?: Date): Promise<ControlledSubstanceLog[]> {
    const query: any = { drugId };

    if (startDate && endDate) {
      query.transactionDate = Between(startDate, endDate);
    }

    return await this.logRepository.find({
      where: query,
      relations: ['drug', 'prescription'],
      order: { transactionDate: 'DESC' }
    });
  }

  async generateReport(startDate: Date, endDate: Date): Promise<any> {
    const logs = await this.logRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.drug', 'drug')
      .where('log.transactionDate BETWEEN :start AND :end', { start: startDate, end: endDate })
      .orderBy('drug.controlledSubstanceSchedule', 'ASC')
      .addOrderBy('drug.genericName', 'ASC')
      .addOrderBy('log.transactionDate', 'ASC')
      .getMany();

    // Group by drug and schedule
    const report = logs.reduce((acc, log) => {
      const key = `${log.drug.controlledSubstanceSchedule}-${log.drug.genericName}`;
      if (!acc[key]) {
        acc[key] = {
          drug: log.drug,
          schedule: log.drug.controlledSubstanceSchedule,
          transactions: [],
          totalDispensed: 0,
          totalReceived: 0,
          totalWasted: 0
        };
      }

      acc[key].transactions.push(log);

      if (log.transactionType === 'dispensed') {
        acc[key].totalDispensed += log.quantity;
      } else if (log.transactionType === 'received') {
        acc[key].totalReceived += log.quantity;
      } else if (log.transactionType === 'wasted') {
        acc[key].totalWasted += log.quantity;
      }

      return acc;
    }, {});

    return Object.values(report);
  }
}