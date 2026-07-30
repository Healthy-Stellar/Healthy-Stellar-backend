 main
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RunbookMapping } from '../entities/runbook-mapping.entity';
import { IncidentType } from '../../healthcare-monitoring/entities/healthcare-incident.entity';
import { CreateRunbookMappingDto, UpdateRunbookMappingDto } from '../dto/runbook-mapping.dto';

export interface ResolvedRunbook {
  runbookId: string;
  runbookTitle: string;
  runbookUrl: string;
  steps: string[];
  isFallback: boolean;
}

const GENERIC_RUNBOOK: ResolvedRunbook = {
  runbookId: 'RUNBOOK-GENERIC',
  runbookTitle: 'General Incident Response Runbook',
  runbookUrl: 'https://docs.internal/runbooks/generic-incident-response',
  steps: [
    '1. Acknowledge the incident and assign an owner.',
    '2. Assess severity and impact scope.',
    '3. Notify relevant stakeholders and on-call team.',
    '4. Contain the issue to prevent further impact.',
    '5. Investigate root cause.',
    '6. Apply corrective actions and verify resolution.',
    '7. Document findings and close the incident.',
  ],
  isFallback: true,
};

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RunbookMapping } from '../entities/runbook-mapping.entity';
import { IncidentType } from '../../healthcare-monitoring/entities/healthcare-incident.entity';
import { CreateRunbookMappingDto, UpdateRunbookMappingDto } from '../dto/runbook-mapping.dto';

export interface ResolvedRunbook {
  runbookId: string;
  runbookTitle: string;
  runbookUrl: string;
  steps: string[];
  isFallback: boolean;
}

/** Extend AuditEventDto locally to carry runbook-specific metadata */
type RunbookAuditEvent = AuditEventDto & { metadata?: Record<string, any> };
main

@Injectable()
export class RunbookService {
  private readonly logger = new Logger(RunbookService.name);

  constructor(
 main
    @InjectRepository(RunbookMapping)
    private readonly runbookRepo: Repository<RunbookMapping>,
  ) {}

  async resolveForCategory(incidentCategory: IncidentType): Promise<ResolvedRunbook> {
    const mapping = await this.runbookRepo.findOne({
      where: { incidentCategory, isActive: true },
    });

    if (!mapping) {
      this.logger.warn(
        `No runbook mapping found for category "${incidentCategory}", using generic fallback.`,
      );
      return GENERIC_RUNBOOK;
    }

    return {
      runbookId: mapping.runbookId,
      runbookTitle: mapping.runbookTitle,
      runbookUrl: mapping.runbookUrl,
      steps: mapping.steps ?? [],
      isFallback: false,
    };
  }

  async create(dto: CreateRunbookMappingDto): Promise<RunbookMapping> {
    const mapping = this.runbookRepo.create(dto);
    return this.runbookRepo.save(mapping);
  }

  async findAll(): Promise<RunbookMapping[]> {
    return this.runbookRepo.find({ order: { incidentCategory: 'ASC' } });
  }

  async findOne(id: string): Promise<RunbookMapping> {
    const mapping = await this.runbookRepo.findOne({ where: { id } });
    if (!mapping) throw new NotFoundException(`RunbookMapping ${id} not found`);
    return mapping;
  }

  async update(id: string, dto: UpdateRunbookMappingDto): Promise<RunbookMapping> {
    const mapping = await this.findOne(id);
    Object.assign(mapping, dto);
    return this.runbookRepo.save(mapping);
  }

  async remove(id: string): Promise<void> {
    const mapping = await this.findOne(id);
    await this.runbookRepo.remove(mapping);

    @InjectRepository(Runbook)
    private readonly runbookRepo: Repository<Runbook>,
    @InjectRepository(RunbookExecution)
    private readonly executionRepo: Repository<RunbookExecution>,
    private readonly auditService: AuditService,
  ) {}

  async resolveForCategory(incidentCategory: IncidentType): Promise<ResolvedRunbook> {
    const mapping = await this.runbookRepo.findOne({
      where: { incidentCategory, isActive: true },
    });

    if (!mapping) {
      this.logger.warn(
        `No runbook mapping found for category "${incidentCategory}", using generic fallback.`,
      );
      return GENERIC_RUNBOOK;
    }

    return {
      runbookId: mapping.runbookId,
      runbookTitle: mapping.runbookTitle,
      runbookUrl: mapping.runbookUrl,
      steps: mapping.steps ?? [],
      isFallback: false,
    };
  }

  async create(dto: CreateRunbookMappingDto): Promise<RunbookMapping> {
    const mapping = this.runbookRepo.create(dto);
    return this.runbookRepo.save(mapping);
  }

  async findAll(): Promise<RunbookMapping[]> {
    return this.runbookRepo.find({ order: { incidentCategory: 'ASC' } });
  }

  async findOne(id: string): Promise<RunbookMapping> {
    const mapping = await this.runbookRepo.findOne({ where: { id } });
    if (!mapping) throw new NotFoundException(`RunbookMapping ${id} not found`);
    return mapping;
  }

  async update(id: string, dto: UpdateRunbookMappingDto): Promise<RunbookMapping> {
    const mapping = await this.findOne(id);
    Object.assign(mapping, dto);
    return this.runbookRepo.save(mapping);
  }

  async remove(id: string): Promise<void> {
    const mapping = await this.findOne(id);
    await this.runbookRepo.remove(mapping);

    @InjectRepository(Runbook)
    private readonly runbookRepo: Repository<Runbook>,
    @InjectRepository(RunbookExecution)
    private readonly executionRepo: Repository<RunbookExecution>,
    private readonly auditService: AuditService,
  ) {}

  async resolveForCategory(incidentCategory: IncidentType): Promise<ResolvedRunbook> {
    const mapping = await this.runbookRepo.findOne({
      where: { incidentCategory, isActive: true },
    });

    if (!mapping) {
      this.logger.warn(
        `No runbook mapping found for category "${incidentCategory}", using generic fallback.`,
      );
      return GENERIC_RUNBOOK;
    }

    return {
      runbookId: mapping.runbookId,
      runbookTitle: mapping.runbookTitle,
      runbookUrl: mapping.runbookUrl,
      steps: mapping.steps ?? [],
      isFallback: false,
    };
  }

  async create(dto: CreateRunbookMappingDto): Promise<RunbookMapping> {
    const mapping = this.runbookRepo.create(dto);
    return this.runbookRepo.save(mapping);
  }

  async findAll(): Promise<RunbookMapping[]> {
    return this.runbookRepo.find({ order: { incidentCategory: 'ASC' } });
  }

  async findOne(id: string): Promise<RunbookMapping> {
    const mapping = await this.runbookRepo.findOne({ where: { id } });
    if (!mapping) throw new NotFoundException(`RunbookMapping ${id} not found`);
    return mapping;
  }

  async update(id: string, dto: UpdateRunbookMappingDto): Promise<RunbookMapping> {
    const mapping = await this.findOne(id);
    Object.assign(mapping, dto);
    return this.runbookRepo.save(mapping);
  }

  async getExecution(executionId: string): Promise<RunbookExecution> {
    return this.findExecution(executionId);
  }

  async getActiveExecutions(): Promise<RunbookExecution[]> {
    return this.executionRepo.find({
      where: [
        { status: ExecutionStatus.PENDING_APPROVAL },
        { status: ExecutionStatus.APPROVED },
        { status: ExecutionStatus.IN_PROGRESS },
      ],
      relations: ['runbook'],
      order: { createdAt: 'DESC' },
    });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async findExecution(id: string): Promise<RunbookExecution> {
    const execution = await this.executionRepo.findOne({ where: { id } });
    if (!execution) throw new NotFoundException(`Execution ${id} not found`);
    return execution;
 main
  }
}
