import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Logger,
    ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { LabTest, TestStatus } from '../entities/lab-test.entity';
import { LabTestParameter } from '../entities/lab-test-parameter.entity';
import { CreateLabTestDto } from '../dto/create-lab-test.dto';

@Injectable()
export class LabTestsService {
    private readonly logger = new Logger(LabTestsService.name);

    constructor(
        @InjectRepository(LabTest)
        private labTestRepository: Repository<LabTest>,
        @InjectRepository(LabTestParameter)
        private parameterRepository: Repository<LabTestParameter>,
    ) { }

    async create(
        createDto: CreateLabTestDto,
        userId: string,
    ): Promise<LabTest> {
        this.logger.log(`Creating lab test: ${createDto.testCode}`);

        // Check if test code already exists
        const existing = await this.labTestRepository.findOne({
            where: { testCode: createDto.testCode },
        });

        if (existing) {
            throw new ConflictException(
                `Lab test with code ${createDto.testCode} already exists`,
            );
        }

        const labTest = this.labTestRepository.create({
            ...createDto,
            createdBy: userId,
            updatedBy: userId,
        });

        // Create parameters if provided
        if (createDto.parameters && createDto.parameters.length > 0) {
            labTest.parameters = createDto.parameters.map((paramDto) =>
                this.parameterRepository.create({
                    ...paramDto,
                    createdBy: userId,
                    updatedBy: userId,
                }),
            );
        }

        const saved = await this.labTestRepository.save(labTest);
        this.logger.log(`Lab test created: ${saved.id}`);

        return this.findOne(saved.id);
    }

    async findAll(options?: {
        category?: string;
        status?: TestStatus;
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<{ data: LabTest[]; total: number; page: number; limit: number }> {
        const page = options?.page || 1;
        const limit = options?.limit || 20;
        const skip = (page - 1) * limit;

        const queryBuilder = this.labTestRepository
            .createQueryBuilder('test')
            .leftJoinAndSelect('test.parameters', 'parameters')
            .orderBy('test.testName', 'ASC')
            .skip(skip)
            .take(limit);

        if (options?.category) {
            queryBuilder.andWhere('test.category = :category', {
                category: options.category,
            });
        }

        if (options?.status) {
            queryBuilder.andWhere('test.status = :status', {
                status: options.status,
            });
        }

        if (options?.search) {
            queryBuilder.andWhere(
                '(test.testName ILIKE :search OR test.testCode ILIKE :search OR test.description ILIKE :search)',
                { search: `%${options.search}%` },
            );
        }

        const [data, total] = await queryBuilder.getManyAndCount();

        return { data, total, page, limit };
    }

    async findOne(id: string): Promise<LabTest> {
        const labTest = await this.labTestRepository.findOne({
            where: { id },
            relations: ['parameters'],
        });

        if (!labTest) {
            throw new NotFoundException(`Lab test with ID ${id} not found`);
        }

        return labTest;
    }

    async findByCode(testCode: string): Promise<LabTest> {
        const labTest = await this.labTestRepository.findOne({
            where: { testCode },
            relations: ['parameters'],
        });

        if (!labTest) {
            throw new NotFoundException(`Lab test with code ${testCode} not found`);
        }

        return labTest;
    }

    async update(
        id: string,
        updateDto: Partial<CreateLabTestDto>,
        userId: string,
    ): Promise<LabTest> {
        const labTest = await this.findOne(id);

        // Check for test code conflict if updating
        if (updateDto.testCode && updateDto.testCode !== labTest.testCode) {
            const existing = await this.labTestRepository.findOne({
                where: { testCode: updateDto.testCode },
            });

            if (existing) {
                throw new ConflictException(
                    `Lab test with code ${updateDto.testCode} already exists`,
                );
            }
        }

        Object.assign(labTest, updateDto);
        labTest.updatedBy = userId;

        const saved = await this.labTestRepository.save(labTest);
        this.logger.log(`Lab test updated: ${saved.id}`);

        return this.findOne(saved.id);
    }

    async activate(id: string, userId: string): Promise<LabTest> {
        const labTest = await this.findOne(id);
        labTest.status = TestStatus.ACTIVE;
        labTest.updatedBy = userId;

        await this.labTestRepository.save(labTest);
        this.logger.log(`Lab test activated: ${id}`);

        return this.findOne(id);
    }

    async deactivate(id: string, userId: string): Promise<LabTest> {
        const labTest = await this.findOne(id);
        labTest.status = TestStatus.INACTIVE;
        labTest.updatedBy = userId;

        await this.labTestRepository.save(labTest);
        this.logger.log(`Lab test deactivated: ${id}`);

        return this.findOne(id);
    }

    async addParameter(
        testId: string,
        parameterDto: any,
        userId: string,
    ): Promise<LabTestParameter> {
        const labTest = await this.findOne(testId);

        const parameter: LabTestParameter = this.parameterRepository.create({
            ...parameterDto,
            labTestId: testId,
            createdBy: userId,
            updatedBy: userId,
        } as Partial<LabTestParameter>);

        const saved = await this.parameterRepository.save(parameter);
        this.logger.log(`Parameter added to test ${testId}: ${saved.id}`);

        return saved;
    }

    async updateParameter(
        parameterId: string,
        updateDto: any,
        userId: string,
    ): Promise<LabTestParameter> {
        const parameter = await this.parameterRepository.findOne({
            where: { id: parameterId },
        });

        if (!parameter) {
            throw new NotFoundException(`Parameter with ID ${parameterId} not found`);
        }

        Object.assign(parameter, updateDto);
        parameter.updatedBy = userId;

        const saved = await this.parameterRepository.save(parameter as LabTestParameter);
        this.logger.log(`Parameter updated: ${saved.id}`);

        return saved;
    }

    async deleteParameter(parameterId: string): Promise<void> {
        const parameter = await this.parameterRepository.findOne({
            where: { id: parameterId },
        });

        if (!parameter) {
            throw new NotFoundException(`Parameter with ID ${parameterId} not found`);
        }

        await this.parameterRepository.remove(parameter);
        this.logger.log(`Parameter deleted: ${parameterId}`);
    }
}
