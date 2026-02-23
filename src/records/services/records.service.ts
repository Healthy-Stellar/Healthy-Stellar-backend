import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between } from 'typeorm';
import { Record } from '../entities/record.entity';
import { CreateRecordDto } from '../dto/create-record.dto';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { PaginatedRecordsResponseDto, PaginationMeta } from '../dto/paginated-response.dto';
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

  async findAll(query: PaginationQueryDto): Promise<PaginatedRecordsResponseDto> {
    const { page = 1, limit = 20, recordType, fromDate, toDate, sortBy = 'createdAt', order = 'desc', patientId } = query;

    // Build where clause
    const where: FindOptionsWhere<Record> = {};

    if (recordType) {
      where.recordType = recordType;
    }

    if (patientId) {
      where.patientId = patientId;
    }

    if (fromDate && toDate) {
      where.createdAt = Between(new Date(fromDate), new Date(toDate));
    } else if (fromDate) {
      where.createdAt = Between(new Date(fromDate), new Date());
    } else if (toDate) {
      where.createdAt = Between(new Date(0), new Date(toDate));
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query
    const [data, total] = await this.recordRepository.findAndCount({
      where,
      order: {
        [sortBy]: order.toUpperCase(),
      },
      take: limit,
      skip,
    });

    // Calculate metadata
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    const meta: PaginationMeta = {
      total,
      page,
      limit,
      totalPages,
      hasNextPage,
      hasPreviousPage,
    };

    return {
      data,
      meta,
    };
  }

  async findOne(id: string): Promise<Record> {
    return this.recordRepository.findOne({ where: { id } });
  }
}
