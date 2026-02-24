import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PathologySpecimen } from '../entities/pathology-specimen.entity';
import { CreateSpecimenDto } from '../dto/create-specimen.dto';

@Injectable()
export class SpecimenProcessingService {
  private readonly logger = new Logger(SpecimenProcessingService.name);

  constructor(
    @InjectRepository(PathologySpecimen)
    private specimenRepository: Repository<PathologySpecimen>,
  ) {}

  async create(createDto: CreateSpecimenDto, userId: string): Promise<PathologySpecimen> {
    const specimenNumber = await this.generateSpecimenNumber(createDto.pathologyCaseId);

    const specimen = this.specimenRepository.create({
      ...createDto,
      specimenNumber,
      receivedDate: new Date(),
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.specimenRepository.save(specimen);
    this.logger.log(`Specimen created: ${saved.id} (${saved.specimenNumber})`);

    return saved;
  }

  async findOne(id: string): Promise<PathologySpecimen> {
    const specimen = await this.specimenRepository.findOne({
      where: { id },
      relations: ['pathologyCase'],
    });

    if (!specimen) {
      throw new NotFoundException(`Specimen with ID ${id} not found`);
    }

    return specimen;
  }

  async findByCase(caseId: string): Promise<PathologySpecimen[]> {
    return this.specimenRepository.find({
      where: { pathologyCaseId: caseId },
      order: { specimenNumber: 'ASC' },
    });
  }

  async updateProcessing(
    id: string,
    data: {
      processingProtocol?: string;
      numberOfBlocks?: number;
      numberOfSlides?: number;
      processingTechnician?: string;
      processingStartTime?: Date;
      processingEndTime?: Date;
      notes?: string;
    },
    userId: string,
  ): Promise<PathologySpecimen> {
    const specimen = await this.findOne(id);

    Object.assign(specimen, data);
    specimen.updatedBy = userId;

    return this.specimenRepository.save(specimen);
  }

  private async generateSpecimenNumber(caseId: string): Promise<string> {
    const count = await this.specimenRepository.count({
      where: { pathologyCaseId: caseId },
    });

    return `SPEC-${count + 1}`;
  }
}
