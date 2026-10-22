import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectEntityManager } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { InfectionCase, InfectionStatus } from './entities/infection-case.entity';
import { IsolationPrecaution, PrecautionType } from './entities/isolation-precaution.entity';
import { AntibioticResistance } from './entities/antibiotic-resistance.entity';
import { InfectionControlPolicy } from './entities/infection-control-policy.entity';
import { OutbreakIncident } from './entities/outbreak-incident.entity';
import { HandHygieneAudit } from './entities/hand-hygiene-audit.entity';
import { CreateInfectionCaseDto } from './dto/create-infection-case.dto';
import { UpdateInfectionCaseDto } from './dto/update-infection-case.dto';
import { CreateIsolationPrecautionDto } from './dto/create-isolation-precaution.dto';
import { UpdateIsolationPrecautionDto } from './dto/update-isolation-precaution.dto';
import { CreateAntibioticResistanceDto } from './dto/create-antibiotic-resistance.dto';
import { CreateInfectionControlPolicyDto } from './dto/create-infection-control-policy.dto';
import { UpdateInfectionControlPolicyDto } from './dto/update-infection-control-policy.dto';
import { CreateOutbreakIncidentDto } from './dto/create-outbreak-incident.dto';
import { UpdateOutbreakIncidentDto } from './dto/update-outbreak-incident.dto';
import { CreateHandHygieneAuditDto } from './dto/create-hand-hygiene-audit.dto';
import { NotificationsService } from '../notifications/services/notifications.service';

@Injectable()
export class InfectionControlService {
  constructor(
    @InjectRepository(InfectionCase)
    private readonly infectionCaseRepository: Repository<InfectionCase>,
    @InjectRepository(IsolationPrecaution)
    private readonly isolationPrecautionRepository: Repository<IsolationPrecaution>,
    @InjectRepository(AntibioticResistance)
    private readonly antibioticResistanceRepository: Repository<AntibioticResistance>,
    @InjectRepository(InfectionControlPolicy)
    private readonly policyRepository: Repository<InfectionControlPolicy>,
    @InjectRepository(OutbreakIncident)
    private readonly outbreakIncidentRepository: Repository<OutbreakIncident>,
    @InjectRepository(HandHygieneAudit)
    private readonly handHygieneAuditRepository: Repository<HandHygieneAudit>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ---- Workflow Triggers ----

  private async triggerConfirmedWorkflow(infectionCase: InfectionCase): Promise<void> {
    // 1. Auto-create draft IsolationPrecaution
    const existing = await this.isolationPrecautionRepository.findOne({
      where: { patientId: infectionCase.patientId, isActive: true }
    });

    if (!existing) {
      await this.isolationPrecautionRepository.save(
        this.isolationPrecautionRepository.create({
          patientId: infectionCase.patientId,
          precautionType: PrecautionType.CONTACT,
          startDate: new Date(),
          isActive: false, // Draft status for staff to review
          reason: `Auto-drafted due to confirmed ${infectionCase.pathogen} infection`,
        })
      );
    }

    // 2. Find bed and Ward Manager via raw SQL to bypass cross-module dependency limits
    const beds = await this.entityManager.query(
      `SELECT b.id as "bedId", w."wardManagerId"
       FROM beds b
       JOIN rooms r ON b."roomId" = r.id
       JOIN wards w ON r."wardId" = w.id
       WHERE b."patientId" = $1 AND b."isActive" = true LIMIT 1`,
      [infectionCase.patientId]
    );

    if (beds.length > 0) {
      const { bedId, wardManagerId } = beds[0];

      // 3. Flag the patient's current bed by safely appending to the features array
      await this.entityManager.query(
        `UPDATE beds SET features = array_append(COALESCE(features, '{}'::text[]), 'ISOLATION_REQUIRED') WHERE id = $1`,
        [bedId]
      );

      // 4. Emit notification to Charge Nurse
      if (wardManagerId) {
        await this.notificationsService.sendProviderEmailNotification(
          wardManagerId,
          `Isolation Alert: Bed Reassignment Needed`,
          `Patient ${infectionCase.patientId} has a confirmed ${infectionCase.pathogen} infection. Please assign an isolation room.`
        );
      }
    }
  }

  // ---- Infection Cases ----

  async createInfectionCase(dto: CreateInfectionCaseDto): Promise<InfectionCase> {
    const infectionCase = this.infectionCaseRepository.create(dto);
    const saved = await this.infectionCaseRepository.save(infectionCase);
    
    if (saved.status === InfectionStatus.CONFIRMED) {
      await this.triggerConfirmedWorkflow(saved);
    }
    return saved;
  }

  async findAllInfectionCases(): Promise<InfectionCase[]> {
    return this.infectionCaseRepository.find();
  }

  async findOneInfectionCase(id: string): Promise<InfectionCase> {
    const infectionCase = await this.infectionCaseRepository.findOne({ where: { id } });
    if (!infectionCase) throw new NotFoundException(`Infection case with ID ${id} not found`);
    return infectionCase;
  }

  async updateInfectionCase(id: string, dto: UpdateInfectionCaseDto): Promise<InfectionCase> {
    const before = await this.findOneInfectionCase(id);
    await this.infectionCaseRepository.update(id, dto);
    const after = await this.findOneInfectionCase(id);

    // Trigger workflow only on transition to CONFIRMED
    if (before.status !== InfectionStatus.CONFIRMED && after.status === InfectionStatus.CONFIRMED) {
      await this.triggerConfirmedWorkflow(after);
    }
    return after;
  }

  // ---- Dashboard AC ----
  
  async getCasesMissingPrecautions(): Promise<InfectionCase[]> {
    return this.infectionCaseRepository.createQueryBuilder('case')
      .leftJoin(IsolationPrecaution, 'precaution', 'precaution."patientId" = case."patientId" AND precaution."isActive" = true')
      .where('case.status = :status', { status: InfectionStatus.CONFIRMED })
      .andWhere('precaution.id IS NULL')
      .getMany();
  }

  // Isolation Precautions
  async createIsolationPrecaution(dto: CreateIsolationPrecautionDto): Promise<IsolationPrecaution> {
    const precaution = this.isolationPrecautionRepository.create(dto);
    return this.isolationPrecautionRepository.save(precaution);
  }

  async findAllIsolationPrecautions(): Promise<IsolationPrecaution[]> {
    return this.isolationPrecautionRepository.find();
  }

  async updateIsolationPrecaution(id: string, dto: UpdateIsolationPrecautionDto): Promise<IsolationPrecaution> {
    await this.isolationPrecautionRepository.update(id, dto);
    const precaution = await this.isolationPrecautionRepository.findOne({ where: { id } });
    if (!precaution) throw new NotFoundException(`Isolation precaution with ID ${id} not found`);
    return precaution;
  }

  // Antibiotic Resistance
  async createAntibioticResistance(dto: CreateAntibioticResistanceDto): Promise<AntibioticResistance> {
    const resistance = this.antibioticResistanceRepository.create(dto);
    return this.antibioticResistanceRepository.save(resistance);
  }

  async findAllAntibioticResistance(): Promise<AntibioticResistance[]> {
    return this.antibioticResistanceRepository.find();
  }

  // Policies
  async createPolicy(dto: CreateInfectionControlPolicyDto): Promise<InfectionControlPolicy> {
    const policy = this.policyRepository.create(dto);
    return this.policyRepository.save(policy);
  }

  async findAllPolicies(): Promise<InfectionControlPolicy[]> {
    return this.policyRepository.find({ where: { isActive: true } });
  }

  async updatePolicy(id: string, dto: UpdateInfectionControlPolicyDto): Promise<InfectionControlPolicy> {
    await this.policyRepository.update(id, dto);
    const policy = await this.policyRepository.findOne({ where: { id } });
    if (!policy) throw new NotFoundException(`Policy with ID ${id} not found`);
    return policy;
  }

  // Outbreaks
  async createOutbreak(dto: CreateOutbreakIncidentDto): Promise<OutbreakIncident> {
    const outbreak = this.outbreakIncidentRepository.create(dto);
    return this.outbreakIncidentRepository.save(outbreak);
  }

  async findAllOutbreaks(): Promise<OutbreakIncident[]> {
    return this.outbreakIncidentRepository.find();
  }

  async updateOutbreak(id: string, dto: UpdateOutbreakIncidentDto): Promise<OutbreakIncident> {
    await this.outbreakIncidentRepository.update(id, dto);
    const outbreak = await this.outbreakIncidentRepository.findOne({ where: { id } });
    if (!outbreak) throw new NotFoundException(`Outbreak with ID ${id} not found`);
    return outbreak;
  }

  // Hand Hygiene
  async createHandHygieneAudit(dto: CreateHandHygieneAuditDto): Promise<HandHygieneAudit> {
    const audit = this.handHygieneAuditRepository.create(dto);
    return this.handHygieneAuditRepository.save(audit);
  }

  async findAllHandHygieneAudits(): Promise<HandHygieneAudit[]> {
    return this.handHygieneAuditRepository.find();
  }
}
