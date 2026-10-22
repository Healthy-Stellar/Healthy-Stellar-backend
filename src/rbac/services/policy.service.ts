import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, FindOneOptions } from 'typeorm';
import {
  Policy,
  PolicyEffect,
  PolicyCondition,
  PolicySubject,
  PolicyResource,
  PolicyAction,
} from './entities/access-policy.entity';

export interface CreatePolicyDto {
  name: string;
  description?: string;
  effect: PolicyEffect;
  subjects?: PolicySubject[];
  resources?: PolicyResource[];
  actions?: PolicyAction[];
  conditions?: PolicyCondition[];
  priority?: number;
  category?: string;
  metadata?: Record<string, any>;
}

export interface UpdatePolicyDto extends Partial<CreatePolicyDto> {
  isActive?: boolean;
}

@Injectable()
export class PolicyService {
  private logger = new Logger(PolicyService.name);

  constructor(
    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,
  ) {}

  async create(createPolicyDto: CreatePolicyDto): Promise<Policy> {
    // Check if policy with this name already exists
    const existing = await this.policyRepository.findOne({
      where: { name: createPolicyDto.name },
    });

    if (existing) {
      throw new ConflictException(`Policy with name '${createPolicyDto.name}' already exists`);
    }

    const policy = this.policyRepository.create({
      ...createPolicyDto,
      priority: createPolicyDto.priority ?? 0,
      isActive: true,
    });

    return this.policyRepository.save(policy);
  }

  async findAll(options?: FindManyOptions<Policy>): Promise<Policy[]> {
    return this.policyRepository.find({
      order: { priority: 'DESC', createdAt: 'DESC' },
      ...options,
    });
  }

  async findOne(id: string, options?: FindOneOptions<Policy>): Promise<Policy> {
    const policy = await this.policyRepository.findOne({
      where: { id },
      ...options,
    });

    if (!policy) {
      throw new NotFoundException(`Policy with ID ${id} not found`);
    }

    return policy;
  }

  async findByName(name: string): Promise<Policy | null> {
    return this.policyRepository.findOne({ where: { name } });
  }

  async findActivePolicies(category?: string): Promise<Policy[]> {
    const where: any = { isActive: true };
    if (category) {
      where.category = category;
    }

    return this.policyRepository.find({
      where,
      order: { priority: 'DESC', createdAt: 'DESC' },
    });
  }

  async update(id: string, updatePolicyDto: UpdatePolicyDto): Promise<Policy> {
    const policy = await this.findOne(id);

    // Check name uniqueness if name is being updated
    if (updatePolicyDto.name && updatePolicyDto.name !== policy.name) {
      const existing = await this.findByName(updatePolicyDto.name);
      if (existing) {
        throw new ConflictException(`Policy with name '${updatePolicyDto.name}' already exists`);
      }
    }

    Object.assign(policy, updatePolicyDto);
    return this.policyRepository.save(policy);
  }

  async remove(id: string): Promise<void> {
    const policy = await this.findOne(id);
    await this.policyRepository.remove(policy);
  }

  async activate(id: string): Promise<Policy> {
    return this.update(id, { isActive: true });
  }

  async deactivate(id: string): Promise<Policy> {
    return this.update(id, { isActive: false });
  }

  /**
   * Bulk operations for policy management
   */
  async createBulk(policies: CreatePolicyDto[]): Promise<Policy[]> {
    const createdPolicies: Policy[] = [];

    for (const policyDto of policies) {
      try {
        const policy = await this.create(policyDto);
        createdPolicies.push(policy);
      } catch (error) {
        // Log error but continue with other policies
        this.logger.error(`Failed to create policy '${policyDto.name}':`, error.message);
      }
    }

    return createdPolicies;
  }

  async deactivateByCategory(category: string): Promise<number> {
    const result = await this.policyRepository.update({ category }, { isActive: false });
    return result.affected || 0;
  }

  /**
   * Policy validation helpers
   */
  validatePolicyStructure(policy: Partial<CreatePolicyDto>): string[] {
    const errors: string[] = [];

    if (!policy.name || policy.name.trim().length === 0) {
      errors.push('Policy name is required');
    }

    if (!policy.effect || !Object.values(PolicyEffect).includes(policy.effect)) {
      errors.push('Valid policy effect is required (allow or deny)');
    }

    // Validate conditions structure if provided
    if (policy.conditions) {
      for (let i = 0; i < policy.conditions.length; i++) {
        const condition = policy.conditions[i];
        if (!condition.type || !condition.operator) {
          errors.push(`Condition ${i} is missing required fields (type, operator)`);
        }
      }
    }

    return errors;
  }
}
