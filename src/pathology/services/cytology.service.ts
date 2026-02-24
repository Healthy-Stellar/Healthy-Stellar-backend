import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CytologySlide } from '../entities/cytology-slide.entity';
import { CreateCytologySlideDto } from '../dto/create-cytology-slide.dto';

@Injectable()
export class CytologyService {
  private readonly logger = new Logger(CytologyService.name);

  constructor(
    @InjectRepository(CytologySlide)
    private slideRepository: Repository<CytologySlide>,
  ) {}

  async create(createDto: CreateCytologySlideDto, userId: string): Promise<CytologySlide> {
    const slideNumber = await this.generateSlideNumber(createDto.pathologyCaseId);

    const slide = this.slideRepository.create({
      ...createDto,
      slideNumber,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.slideRepository.save(slide);
    this.logger.log(`Cytology slide created: ${saved.id} (${saved.slideNumber})`);

    return saved;
  }

  async findOne(id: string): Promise<CytologySlide> {
    const slide = await this.slideRepository.findOne({
      where: { id },
      relations: ['pathologyCase', 'digitalImages'],
    });

    if (!slide) {
      throw new NotFoundException(`Cytology slide with ID ${id} not found`);
    }

    return slide;
  }

  async findByCase(caseId: string): Promise<CytologySlide[]> {
    return this.slideRepository.find({
      where: { pathologyCaseId: caseId },
      relations: ['digitalImages'],
      order: { slideNumber: 'ASC' },
    });
  }

  async screenSlide(
    id: string,
    cytotechId: string,
    cytotechName: string,
    findings: string,
    userId: string,
  ): Promise<CytologySlide> {
    const slide = await this.findOne(id);

    slide.screeningCytotechId = cytotechId;
    slide.screeningCytotechName = cytotechName;
    slide.screeningDate = new Date();
    slide.findings = findings;
    slide.updatedBy = userId;

    return this.slideRepository.save(slide);
  }

  async pathologistReview(
    id: string,
    pathologistId: string,
    pathologistName: string,
    interpretation: string,
    recommendation: string,
    userId: string,
  ): Promise<CytologySlide> {
    const slide = await this.findOne(id);

    slide.reviewingPathologistId = pathologistId;
    slide.reviewingPathologistName = pathologistName;
    slide.reviewDate = new Date();
    slide.interpretation = interpretation;
    slide.recommendation = recommendation;
    slide.updatedBy = userId;

    return this.slideRepository.save(slide);
  }

  private async generateSlideNumber(caseId: string): Promise<string> {
    const count = await this.slideRepository.count({
      where: { pathologyCaseId: caseId },
    });

    return `SLIDE-C-${count + 1}`;
  }
}
