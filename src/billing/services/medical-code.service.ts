import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { MedicalCode } from '../entities/medical-code.entity';
import {
  CreateMedicalCodeDto,
  UpdateMedicalCodeDto,
  SearchMedicalCodeDto,
} from '../dto/medical-code.dto';
import { CodeType } from '../../common/enums';

@Injectable()
export class MedicalCodeService {
  constructor(
    @InjectRepository(MedicalCode)
    private readonly medicalCodeRepository: Repository<MedicalCode>,
  ) {}

  async create(createDto: CreateMedicalCodeDto): Promise<MedicalCode> {
    const existing = await this.medicalCodeRepository.findOne({
      where: { code: createDto.code, codeType: createDto.codeType },
    });

    if (existing) {
      throw new ConflictException(
        `Medical code ${createDto.code} of type ${createDto.codeType} already exists`,
      );
    }

    const medicalCode = this.medicalCodeRepository.create({
      ...createDto,
      effectiveDate: createDto.effectiveDate
        ? new Date(createDto.effectiveDate)
        : undefined,
      terminationDate: createDto.terminationDate
        ? new Date(createDto.terminationDate)
        : undefined,
    });

    return this.medicalCodeRepository.save(medicalCode);
  }

  async findById(id: string): Promise<MedicalCode> {
    const medicalCode = await this.medicalCodeRepository.findOne({
      where: { id },
    });

    if (!medicalCode) {
      throw new NotFoundException(`Medical code with ID ${id} not found`);
    }

    return medicalCode;
  }

  async findByCode(code: string, codeType: CodeType): Promise<MedicalCode | null> {
    return this.medicalCodeRepository.findOne({
      where: { code, codeType, isActive: true },
    });
  }

  async search(searchDto: SearchMedicalCodeDto): Promise<{
    data: MedicalCode[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, ...filters } = searchDto;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<MedicalCode> = {};

    if (filters.code) {
      where.code = Like(`%${filters.code}%`);
    }

    if (filters.codeType) {
      where.codeType = filters.codeType;
    }

    if (filters.description) {
      where.description = Like(`%${filters.description}%`);
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const [data, total] = await this.medicalCodeRepository.findAndCount({
      where,
      skip,
      take: limit,
      order: { code: 'ASC' },
    });

    return { data, total, page, limit };
  }

  async update(id: string, updateDto: UpdateMedicalCodeDto): Promise<MedicalCode> {
    const medicalCode = await this.findById(id);

    Object.assign(medicalCode, {
      ...updateDto,
      effectiveDate: updateDto.effectiveDate
        ? new Date(updateDto.effectiveDate)
        : medicalCode.effectiveDate,
      terminationDate: updateDto.terminationDate
        ? new Date(updateDto.terminationDate)
        : medicalCode.terminationDate,
    });

    return this.medicalCodeRepository.save(medicalCode);
  }

  async delete(id: string): Promise<void> {
    const medicalCode = await this.findById(id);
    await this.medicalCodeRepository.remove(medicalCode);
  }

  async deactivate(id: string): Promise<MedicalCode> {
    const medicalCode = await this.findById(id);
    medicalCode.isActive = false;
    return this.medicalCodeRepository.save(medicalCode);
  }

  async bulkCreate(codes: CreateMedicalCodeDto[]): Promise<MedicalCode[]> {
    const medicalCodes = codes.map((dto) =>
      this.medicalCodeRepository.create({
        ...dto,
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : undefined,
        terminationDate: dto.terminationDate
          ? new Date(dto.terminationDate)
          : undefined,
      }),
    );

    return this.medicalCodeRepository.save(medicalCodes);
  }

  async validateCodes(
    codes: Array<{ code: string; codeType: CodeType }>,
  ): Promise<{ valid: boolean; invalidCodes: string[] }> {
    const invalidCodes: string[] = [];

    for (const { code, codeType } of codes) {
      const found = await this.findByCode(code, codeType);
      if (!found) {
        invalidCodes.push(`${codeType}:${code}`);
      }
    }

    return {
      valid: invalidCodes.length === 0,
      invalidCodes,
    };
  }

  async getCPTCodesByCategory(category: string): Promise<MedicalCode[]> {
    return this.medicalCodeRepository.find({
      where: {
        codeType: CodeType.CPT,
        category,
        isActive: true,
      },
      order: { code: 'ASC' },
    });
  }

  async getICD10CodesByCategory(category: string): Promise<MedicalCode[]> {
    return this.medicalCodeRepository.find({
      where: {
        codeType: CodeType.ICD10_CM,
        category,
        isActive: true,
      },
      order: { code: 'ASC' },
    });
  }
}
