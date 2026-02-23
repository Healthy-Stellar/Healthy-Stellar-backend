import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Record } from '../entities/record.entity';
import { CreateRecordDto } from '../dto/create-record.dto';
import { IpfsService } from './ipfs.service';
import { StellarService } from './stellar.service';

@Injectable()
export class RecordsService {
  constructor(
    @InjectRepository(Record)
    private recordRepository: Repository<Record>,
    private ipfsService: IpfsService,
    private stellarService: StellarService,
  ) {}

  async uploadRecord(
    dto: CreateRecordDto,
    encryptedBuffer: Buffer,
  ): Promise<{ recordId: string; cid: string; stellarTxHash: string }> {
    const cid = await this.ipfsService.upload(encryptedBuffer);
    const stellarTxHash = await this.stellarService.anchorCid(
      dto.patientId,
      cid,
    );

    const record = this.recordRepository.create({
      patientId: dto.patientId,
      cid,
      stellarTxHash,
      recordType: dto.recordType,
      description: dto.description,
    });

    const savedRecord = await this.recordRepository.save(record);

    return {
      recordId: savedRecord.id,
      cid: savedRecord.cid,
      stellarTxHash: savedRecord.stellarTxHash,
    };
  }
}
