import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { PathologyCase, CaseStatus } from '../entities/pathology-case.entity';
import { CreatePathologyCaseDto } from '../dto/create-pathology-case.dto';
import { UpdatePathologyCaseDto } from '../dto/update-pathology-case.dto';
import { SearchPathologyDto } from '../dto/search-pathology.dto';

@Injectable()
export class PathologyCaseService {
  private readonly logger = new Logger(PathologyCaseService.name);

  constructor(
    @InjectRepository(PathologyCase)
    private caseRepository: Repository<PathologyCase>,
  ) {}

  async create(createDto: CreatePathologyCaseDto, userId: string): Promise<PathologyCase> {
    this.logger.log(`Creating pathology case for patient: ${createDto.patientId}`);

    const caseNumber = await this.generateCaseNumber();

    const pathologyCase = this.caseRepository.create({
      ...createDto,
      caseNumber,
      caseDate: createDto.caseDate ? new Date(createDto.caseDate) : new Date(),
      receivedDate: new Date(),
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.caseRepository.save(pathologyCase);
    this.logger.log(`Pathology case created: ${saved.id} (${saved.caseNumber})`);

    return this.findOne(saved.id);
  }

  async findAll(searchDto: SearchPathologyDto): Promise<{
    data: PathologyCase[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = searchDto.page || 1;
    const limit = searchDto.limit || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.caseRepository
      .createQueryBuilder('case')
      .leftJoinAndSelect('case.specimens', 'specimens')
      .leftJoinAndSelect('case.histologySlides', 'histologySlides')
      .leftJoinAndSelect('case.cytologySlides', 'cytologySlides')
      .leftJoinAndSelect('case.reports', 'reports')
      .orderBy('case.caseDate', 'DESC')
      .skip(skip)
      .take(limit);

    if (searchDto.caseNumber) {
      queryBuilder.andWhere('case.caseNumber ILIKE :caseNumber', {
        caseNumber: `%${searchDto.caseNumber}%`,
      });
    }

    if (searchDto.patientId) {
      queryBuilder.andWhere('case.patientId = :patientId', {
        patientId: searchDto.patientId,
      });
    }

    if (searchDto.patientName) {
      queryBuilder.andWhere('case.patientName ILIKE :patientName', {
        patientName: `%${searchDto.patientName}%`,
      });
    }

    if (searchDto.orderingPhysicianId) {
      queryBuilder.andWhere('case.orderingPhysicianId = :physicianId', {
        physicianId: searchDto.orderingPhysicianId,
      });
    }

    if (searchDto.pathologistId) {
      queryBuilder.andWhere('case.pathologistId = :pathologistId', {
        pathologistId: searchDto.pathologistId,
      });
    }

    if (searchDto.caseType) {
      queryBuilder.andWhere('case.caseType = :caseType', {
        caseType: searchDto.caseType,
      });
    }

    if (searchDto.status) {
      queryBuilder.andWhere('case.status = :status', {
        status: searchDto.status,
      });
    }

    if (searchDto.priority) {
      queryBuilder.andWhere('case.priority = :priority', {
        priority: searchDto.priority,
      });
    }

    if (searchDto.startDate && searchDto.endDate) {
      queryBuilder.andWhere('case.caseDate BETWEEN :startDate AND :endDate', {
        startDate: new Date(searchDto.startDate),
        endDate: new Date(searchDto.endDate),
      });
    }

    if (searchDto.departmentId) {
      queryBuilder.andWhere('case.departmentId = :departmentId', {
        departmentId: searchDto.departmentId,
      });
    }

    if (searchDto.diagnosis) {
      queryBuilder.andWhere('case.diagnosis ILIKE :diagnosis', {
        diagnosis: `%${searchDto.diagnosis}%`,
      });
    }

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<PathologyCase> {
    const pathologyCase = await this.caseRepository.findOne({
      where: { id },
      relations: [
        'specimens',
        'histologySlides',
        'cytologySlides',
        'digitalImages',
        'reports',
        'molecularTests',
        'geneticTests',
        'qualityControlLogs',
      ],
    });

    if (!pathologyCase) {
      throw new NotFoundException(`Pathology case with ID ${id} not found`);
    }

    return pathologyCase;
  }

  async findByPatient(patientId: string): Promise<PathologyCase[]> {
    return this.caseRepository.find({
      where: { patientId },
      relations: ['specimens', 'reports'],
      order: { caseDate: 'DESC' },
    });
  }

  async update(
    id: string,
    updateDto: UpdatePathologyCaseDto,
    userId: string,
  ): Promise<PathologyCase> {
    const pathologyCase = await this.findOne(id);

    if (updateDto.status) {
      this.validateStatusTransition(pathologyCase.status, updateDto.status);
    }

    Object.assign(pathologyCase, updateDto);
    pathologyCase.updatedBy = userId;

    // Update timestamps based on status
    if (updateDto.status === CaseStatus.ACCESSIONING && !pathologyCase.accessionedDate) {
      pathologyCase.accessionedDate = new Date();
    }
    if (updateDto.status === CaseStatus.GROSSING && !pathologyCase.grossingDate) {
      pathologyCase.grossingDate = new Date();
    }
    if (updateDto.status === CaseStatus.DIAGNOSIS && !pathologyCase.diagnosisDate) {
      pathologyCase.diagnosisDate = new Date();
    }
    if (updateDto.status === CaseStatus.FINALIZED && !pathologyCase.finalizedDate) {
      pathologyCase.finalizedDate = new Date();
      this.calculateTurnaroundTime(pathologyCase);
    }

    const saved = await this.caseRepository.save(pathologyCase);
    this.logger.log(`Pathology case updated: ${saved.id}`);

    return this.findOne(saved.id);
  }

  async assignPathologist(
    id: string,
    pathologistId: string,
    pathologistName: string,
    userId: string,
  ): Promise<PathologyCase> {
    const pathologyCase = await this.findOne(id);

    pathologyCase.pathologistId = pathologistId;
    pathologyCase.pathologistName = pathologistName;
    pathologyCase.updatedBy = userId;

    const saved = await this.caseRepository.save(pathologyCase);
    this.logger.log(`Pathologist assigned to case: ${saved.id}`);

    return this.findOne(saved.id);
  }

  async requestConsultation(
    id: string,
    consultationNotes: string,
    userId: string,
  ): Promise<PathologyCase> {
    const pathologyCase = await this.findOne(id);

    pathologyCase.consultationRequested = true;
    pathologyCase.consultationNotes = consultationNotes;
    pathologyCase.updatedBy = userId;

    const saved = await this.caseRepository.save(pathologyCase);
    this.logger.log(`Consultation requested for case: ${saved.id}`);

    return this.findOne(saved.id);
  }

  async delete(id: string): Promise<void> {
    const pathologyCase = await this.findOne(id);
    await this.caseRepository.remove(pathologyCase);
    this.logger.log(`Pathology case deleted: ${id}`);
  }

  private validateStatusTransition(currentStatus: CaseStatus, newStatus: CaseStatus): void {
    const validTransitions: Record<CaseStatus, CaseStatus[]> = {
      [CaseStatus.RECEIVED]: [CaseStatus.ACCESSIONING],
      [CaseStatus.ACCESSIONING]: [CaseStatus.GROSSING],
      [CaseStatus.GROSSING]: [CaseStatus.PROCESSING],
      [CaseStatus.PROCESSING]: [CaseStatus.EMBEDDING],
      [CaseStatus.EMBEDDING]: [CaseStatus.CUTTING],
      [CaseStatus.CUTTING]: [CaseStatus.STAINING],
      [CaseStatus.STAINING]: [CaseStatus.MICROSCOPY],
      [CaseStatus.MICROSCOPY]: [CaseStatus.DIAGNOSIS],
      [CaseStatus.DIAGNOSIS]: [CaseStatus.PEER_REVIEW, CaseStatus.FINALIZED],
      [CaseStatus.PEER_REVIEW]: [CaseStatus.FINALIZED],
      [CaseStatus.FINALIZED]: [CaseStatus.AMENDED],
      [CaseStatus.AMENDED]: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  private calculateTurnaroundTime(pathologyCase: PathologyCase): void {
    if (pathologyCase.receivedDate && pathologyCase.finalizedDate) {
      const diffMs = pathologyCase.finalizedDate.getTime() - pathologyCase.receivedDate.getTime();
      pathologyCase.turnaroundTimeHours = Math.round(diffMs / (1000 * 60 * 60));
    }
  }

  private async generateCaseNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    const count = await this.caseRepository.count({
      where: {
        caseDate: Between(startOfDay, endOfDay),
      },
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `PATH-${year}${month}${day}-${sequence}`;
  }
}
