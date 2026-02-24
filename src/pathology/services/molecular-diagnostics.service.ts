import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MolecularTest, TestStatus } from '../entities/molecular-test.entity';
import {
  CreateMolecularTestDto,
  UpdateMolecularTestResultDto,
} from '../dto/create-molecular-test.dto';

@Injectable()
export class MolecularDiagnosticsService {
  private readonly logger = new Logger(MolecularDiagnosticsService.name);

  constructor(
    @InjectRepository(MolecularTest)
    private testRepository: Repository<MolecularTest>,
  ) {}

  async create(createDto: CreateMolecularTestDto, userId: string): Promise<MolecularTest> {
    const testNumber = await this.generateTestNumber();

    const test = this.testRepository.create({
      ...createDto,
      testNumber,
      orderedDate: createDto.orderedDate ? new Date(createDto.orderedDate) : new Date(),
      status: TestStatus.ORDERED,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.testRepository.save(test);
    this.logger.log(`Molecular test created: ${saved.id} (${saved.testNumber})`);

    return saved;
  }

  async findOne(id: string): Promise<MolecularTest> {
    const test = await this.testRepository.findOne({
      where: { id },
      relations: ['pathologyCase'],
    });

    if (!test) {
      throw new NotFoundException(`Molecular test with ID ${id} not found`);
    }

    return test;
  }

  async findByCase(caseId: string): Promise<MolecularTest[]> {
    return this.testRepository.find({
      where: { pathologyCaseId: caseId },
      order: { orderedDate: 'DESC' },
    });
  }

  async updateResult(
    id: string,
    resultDto: UpdateMolecularTestResultDto,
    userId: string,
  ): Promise<MolecularTest> {
    const test = await this.findOne(id);

    Object.assign(test, resultDto);
    test.status = TestStatus.COMPLETED;
    test.completedDate = new Date();
    test.updatedBy = userId;

    const saved = await this.testRepository.save(test);
    this.logger.log(`Molecular test result updated: ${saved.id}`);

    return saved;
  }

  async updateStatus(id: string, status: TestStatus, userId: string): Promise<MolecularTest> {
    const test = await this.findOne(id);

    test.status = status;
    test.updatedBy = userId;

    if (status === TestStatus.COMPLETED) {
      test.completedDate = new Date();
    }

    return this.testRepository.save(test);
  }

  private async generateTestNumber(): Promise<string> {
    const count = await this.testRepository.count();
    const sequence = String(count + 1).padStart(5, '0');
    return `MOL-${sequence}`;
  }
}
