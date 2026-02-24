import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeneticTest } from '../entities/genetic-test.entity';
import { CreateGeneticTestDto, UpdateGeneticTestResultDto } from '../dto/create-genetic-test.dto';

@Injectable()
export class GeneticTestingService {
  private readonly logger = new Logger(GeneticTestingService.name);

  constructor(
    @InjectRepository(GeneticTest)
    private testRepository: Repository<GeneticTest>,
  ) {}

  async create(createDto: CreateGeneticTestDto, userId: string): Promise<GeneticTest> {
    const testNumber = await this.generateTestNumber();

    const test = this.testRepository.create({
      ...createDto,
      testNumber,
      orderedDate: createDto.orderedDate ? new Date(createDto.orderedDate) : new Date(),
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.testRepository.save(test);
    this.logger.log(`Genetic test created: ${saved.id} (${saved.testNumber})`);

    return saved;
  }

  async findOne(id: string): Promise<GeneticTest> {
    const test = await this.testRepository.findOne({
      where: { id },
      relations: ['pathologyCase'],
    });

    if (!test) {
      throw new NotFoundException(`Genetic test with ID ${id} not found`);
    }

    return test;
  }

  async findByCase(caseId: string): Promise<GeneticTest[]> {
    return this.testRepository.find({
      where: { pathologyCaseId: caseId },
      order: { orderedDate: 'DESC' },
    });
  }

  async updateResult(
    id: string,
    resultDto: UpdateGeneticTestResultDto,
    userId: string,
  ): Promise<GeneticTest> {
    const test = await this.findOne(id);

    Object.assign(test, resultDto);
    test.completedDate = new Date();
    test.updatedBy = userId;

    const saved = await this.testRepository.save(test);
    this.logger.log(`Genetic test result updated: ${saved.id}`);

    return saved;
  }

  private async generateTestNumber(): Promise<string> {
    const count = await this.testRepository.count();
    const sequence = String(count + 1).padStart(5, '0');
    return `GEN-${sequence}`;
  }
}
