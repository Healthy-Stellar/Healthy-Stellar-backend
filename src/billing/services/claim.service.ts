import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between } from 'typeorm';
import { InsuranceClaim } from '../entities/insurance-claim.entity';
import { Insurance } from '../entities/insurance.entity';
import { Billing } from '../entities/billing.entity';
import {
  CreateClaimDto,
  UpdateClaimDto,
  SubmitClaimDto,
  ClaimSearchDto,
  ProcessERADto,
} from '../dto/claim.dto';
import { ClaimStatus, ClaimType } from '../../common/enums';
import { v4 as uuidv4 } from 'uuid';

/**
 * Result returned by a clearinghouse/payer integration adapter after
 * submitting an EDI 837 payload for adjudication.
 */
export interface ClearinghouseSubmissionResult {
  accepted: boolean;
  clearinghouseClaimId?: string;
  rejectionCode?: string;
  rejectionReason?: string;
  rawResponse?: string;
}

/**
 * Configurable adapter contract for a real clearinghouse/payer integration.
 * Implementations post the EDI 837 payload and return the accept/reject
 * decision. The default adapter is selected via the CLEARINGHOUSE_ENDPOINT
 * environment variable; when unset, submissions are left PENDING for
 * asynchronous adjudication (e.g. via processERA/handleAdjudicationWebhook)
 * rather than being fabricated by a timer.
 */
export interface ClearinghouseAdapter {
  submitClaim(
    edi837: string,
    claim: InsuranceClaim,
  ): Promise<ClearinghouseSubmissionResult>;
}

@Injectable()
export class ClaimService {
  private logger = new Logger(ClaimService.name);
  private readonly clearinghouseAdapter: ClearinghouseAdapter;

  constructor(
    @InjectRepository(InsuranceClaim)
    private readonly claimRepository: Repository<InsuranceClaim>,
    @InjectRepository(Insurance)
    private readonly insuranceRepository: Repository<Insurance>,
    @InjectRepository(Billing)
    private readonly billingRepository: Repository<Billing>,
  ) {
    this.clearinghouseAdapter = this.createClearinghouseAdapter();
  }

  /**
   * Builds the clearinghouse adapter from configuration. When no endpoint is
   * configured, returns a no-op adapter that leaves the claim PENDING so the
   * real adjudication outcome can arrive asynchronously and be persisted.
   */
  private createClearinghouseAdapter(): ClearinghouseAdapter {
    const endpoint = process.env.CLEARINGHOUSE_ENDPOINT;
    const apiKey = process.env.CLEARINGHOUSE_API_KEY;

    if (!endpoint) {
      this.logger.warn(
        'CLEARINGHOUSE_ENDPOINT not configured; claims will remain PENDING until adjudication is received',
      );
      return {
        submitClaim: async () => ({ accepted: false }),
      };
    }

    return {
      submitClaim: async (edi837: string, claim: InsuranceClaim) => {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/edi-x12',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: edi837,
        });

        const rawResponse = await response.text();

        if (!response.ok) {
          return {
            accepted: false,
            rejectionCode: `HTTP_${response.status}`,
            rejectionReason: rawResponse || `Clearinghouse returned ${response.status}`,
            rawResponse,
          };
        }

        let parsed: any = {};
        try {
          parsed = rawResponse ? JSON.parse(rawResponse) : {};
        } catch {
          parsed = {};
        }

        const accepted =
          typeof parsed.accepted === 'boolean'
            ? parsed.accepted
            : response.ok;

        return {
          accepted,
          clearinghouseClaimId: parsed.clearinghouseClaimId,
          rejectionCode: parsed.rejectionCode,
          rejectionReason: parsed.rejectionReason,
          rawResponse,
        };
      },
    };
  }

  async create(createDto: CreateClaimDto): Promise<InsuranceClaim> {
    const insurance = await this.insuranceRepository.findOne({
      where: { id: createDto.insuranceId },
    });

    if (!insurance) {
      throw new NotFoundException(`Insurance with ID ${createDto.insuranceId} not found`);
    }

    const billing = await this.billingRepository.findOne({
      where: { id: createDto.billingId },
      relations: ['lineItems'],
    });

    if (!billing) {
      throw new NotFoundException(`Billing with ID ${createDto.billingId} not found`);
    }

    const claimNumber = `CLM-${Date.now()}-${uuidv4().substring(0, 4).toUpperCase()}`;

    const billedAmount = createDto.procedureCodes.reduce(
      (sum, proc) => sum + proc.charge * proc.units,
      0,
    );

    const timelyFilingDeadline = new Date();
    timelyFilingDeadline.setDate(timelyFilingDeadline.getDate() + 365);

    const claim = this.claimRepository.create({
      claimNumber,
      billingId: createDto.billingId,
      insuranceId: createDto.insuranceId,
      patientId: createDto.patientId,
      claimType: createDto.claimType || ClaimType.PROFESSIONAL,
      status: ClaimStatus.DRAFT,
      serviceStartDate: new Date(createDto.serviceStartDate),
      serviceEndDate: new Date(createDto.serviceEndDate),
      billedAmount,
      diagnosisCodes: createDto.diagnosisCodes,
      procedureCodes: createDto.procedureCodes,
      provider: createDto.provider,
      facility: createDto.facility,
      subscriber: createDto.subscriber,
      patient: createDto.patient || {
        name: createDto.subscriber.name,
        dob: createDto.subscriber.dob,
        gender: createDto.subscriber.gender,
        relationship: 'self',
        address: createDto.subscriber.address,
      },
      timelyFilingDeadline,
      notes: createDto.notes,
      submissionHistory: [],
    });

    return this.claimRepository.save(claim);
  }

  async findById(id: string): Promise<InsuranceClaim> {
    const claim = await this.claimRepository.findOne({
      where: { id },
      relations: ['insurance', 'denials'],
    });

    if (!claim) {
      throw new NotFoundException(`Claim with ID ${id} not found`);
    }

    return claim;
  }

  async findByClaimNumber(claimNumber: string): Promise<InsuranceClaim> {
    const claim = await this.claimRepository.findOne({
      where: { claimNumber },
      relations: ['insurance', 'denials'],
    });

    if (!claim) {
      throw new NotFoundException(`Claim with number ${claimNumber} not found`);
    }

    return claim;
  }

  async findByBillingId(billingId: string): Promise<InsuranceClaim[]> {
    return this.claimRepository.find({
      where: { billingId },
      relations: ['insurance', 'denials'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByPatientId(patientId: string, status?: ClaimStatus): Promise<InsuranceClaim[]> {
    const where: FindOptionsWhere<InsuranceClaim> = { patientId };

    if (status) {
      where.status = status;
    }

    return this.claimRepository.find({
      where,
      relations: ['insurance'],
      order: { createdAt: 'DESC' },
    });
  }

  async search(searchDto: ClaimSearchDto): Promise<{
    data: InsuranceClaim[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, ...filters } = searchDto;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<InsuranceClaim> = {};

    if (filters.patientId) {
      where.patientId = filters.patientId;
    }

    if (filters.insuranceId) {
      where.insuranceId = filters.insuranceId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.claimType) {
      where.claimType = filters.claimType;
    }

    if (filters.startDate && filters.endDate) {
      where.serviceStartDate = Between(new Date(filters.startDate), new Date(filters.endDate));
    }

    const [data, total] = await this.claimRepository.findAndCount({
      where,
      relations: ['insurance'],
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { data, total, page, limit };
  }

  async update(id: string, updateDto: UpdateClaimDto): Promise<InsuranceClaim> {
    const claim = await this.findById(id);

    if (claim.status === ClaimStatus.PAID || claim.status === ClaimStatus.VOID) {
      throw new BadRequestException(`Cannot update claim in ${claim.status} status`);
    }

    Object.assign(claim, updateDto);

    return this.claimRepository.save(claim);
  }

  async submit(id: string, submitDto: SubmitClaimDto): Promise<InsuranceClaim> {
    const claim = await this.findById(id);

    if (claim.status !== ClaimStatus.DRAFT && claim.status !== ClaimStatus.REJECTED) {
      throw new BadRequestException(`Cannot submit claim in ${claim.status} status`);
    }

    const edi837 = this.generateEDI837(claim);

    claim.edi837Payload = edi837;
    claim.status = ClaimStatus.PENDING;
    claim.submittedAt = new Date();
    claim.submissionAttempts += 1;
    claim.clearinghouseClaimId = submitDto.clearinghouseId || `CH-${uuidv4().substring(0, 8)}`;

    claim.submissionHistory = [
      ...(claim.submissionHistory || []),
      {
        date: new Date().toISOString(),
        status: 'submitted',
        message: 'Claim submitted to clearinghouse',
      },
    ];

    // Persist the PENDING submission durably before contacting the
    // clearinghouse so a process restart mid-flight leaves a recoverable
    // record rather than an in-memory-only timer.
    await this.claimRepository.save(claim);

    let result: ClearinghouseSubmissionResult;
    try {
      result = await this.clearinghouseAdapter.submitClaim(edi837, claim);
    } catch (error) {
      this.logger.error(
        `Clearinghouse submission failed for claim ${claim.claimNumber}: ${error.message}`,
      );
      result = {
        accepted: false,
        rejectionCode: 'SUBMISSION_ERROR',
        rejectionReason: error.message,
      };
    }

    // Reload to avoid clobbering concurrent updates, then persist the real
    // adjudication outcome durably.
    const persisted = await this.claimRepository.findOne({ where: { id: claim.id } });
    const target = persisted || claim;

    if (result.clearinghouseClaimId) {
      target.clearinghouseClaimId = result.clearinghouseClaimId;
    }

    if (result.accepted) {
      target.status = ClaimStatus.ACCEPTED;
      target.acceptedAt = new Date();
      target.submissionHistory = [
        ...(target.submissionHistory || []),
        {
          date: new Date().toISOString(),
          status: 'accepted',
          message: 'Claim accepted by payer',
        },
      ];
    } else if (result.rejectionCode || result.rejectionReason) {
      target.status = ClaimStatus.REJECTED;
      target.rejectedAt = new Date();
      target.rejectionReason = result.rejectionReason || result.rejectionCode;
      target.submissionHistory = [
        ...(target.submissionHistory || []),
        {
          date: new Date().toISOString(),
          status: 'rejected',
          message: result.rejectionReason || result.rejectionCode || 'Claim rejected by payer',
        },
      ];
    }
    // Otherwise the claim remains PENDING awaiting asynchronous adjudication
    // (processERA / handleAdjudicationWebhook), which persists the outcome.

    return this.claimRepository.save(target);
  }

  async resubmit(id: string, submitDto: SubmitClaimDto): Promise<InsuranceClaim> {
    const claim = await this.findById(id);

    if (claim.status !== ClaimStatus.REJECTED && claim.status !== ClaimStatus.DENIED) {
      throw new BadRequestException(`Cannot resubmit claim in ${claim.status} status`);
    }

    claim.status = ClaimStatus.DRAFT;
    claim.submissionHistory = [
      ...(claim.submissionHistory || []),
      {
        date: new Date().toISOString(),
        status: 'resubmitted',
        message: 'Claim marked for resubmission',
      },
    ];

    await this.claimRepository.save(claim);

    return this.submit(id, submitDto);
  }

  async checkStatus(id: string): Promise<InsuranceClaim> {
    const claim = await this.findById(id);

    if (!claim.clearinghouseClaimId) {
      throw new BadRequestException('Claim has not been submitted to a clearinghouse');
    }

    claim.submissionHistory = [
      ...(claim.submissionHistory || []),
      {
        date: new Date().toISOString(),
        status: 'status-checked',
        message: `Status checked: ${claim.status}`,
      },
    ];

    return this.claimRepository.save(claim);
  }

  async appeal(id: string, appealDto: Record<string, any>): Promise<InsuranceClaim> {
    const claim = await this.findById(id);

    if (claim.status !== ClaimStatus.DENIED) {
      throw new BadRequestException(`Cannot appeal claim in ${claim.status} status`);
    }

    claim.status = ClaimStatus.APPEALED;
    claim.submissionHistory = [
      ...(claim.submissionHistory || []),
      {
        date: new Date().toISOString(),
        status: 'appealed',
        message: appealDto?.reason || 'Claim appealed',
      },
    ];

    return this.claimRepository.save(claim);
  }

  async getSubmissionReport(id: string): Promise<Record<string, any>> {
    const claim = await this.findById(id);

    return {
      claimId: claim.id,
      claimNumber: claim.claimNumber,
      status: claim.status,
      submittedAt: claim.submittedAt,
      acceptedAt: claim.acceptedAt,
      submissionAttempts: claim.submissionAttempts,
      clearinghouseClaimId: claim.clearinghouseClaimId,
      submissionHistory: claim.submissionHistory || [],
    };
  }

  async getDenialAnalysis(id: string): Promise<Record<string, any>> {
    const claim = await this.findById(id);
    const denials = claim.denials || [];

    return {
      claimId: claim.id,
      claimNumber: claim.claimNumber,
      status: claim.status,
      denialCount: denials.length,
      denials,
    };
  }

  async getPendingClaims(priority?: string): Promise<InsuranceClaim[]> {
    const where: FindOptionsWhere<InsuranceClaim> = {
      status: ClaimStatus.PENDING,
    };

    const claims = await this.claimRepository.find({
      where,
      relations: ['insurance'],
      order: { submittedAt: 'ASC' },
    });

    if (!priority) {
      return claims;
    }

    return claims.filter((claim) => (claim as any).priority === priority);
  }

  private generateEDI837(claim: InsuranceClaim): string {
    const isa = `ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *${this.formatDate(new Date())}*${this.formatTime(new Date())}*^*00501*000000001*0*P*:~`;
    const gs = `GS*HC*SENDER*RECEIVER*${this.formatDateGS(new Date())}*${this.formatTimeGS(new Date())}*1*X*005010X222A1~`;
    const st = `ST*837*0001*005010X222A1~`;
    const bht = `BHT*0019*00*${claim.claimNumber}*${this.formatDateGS(new Date())}*${this.formatTimeGS(new Date())}*CH~`;

    const nm1Submitter = `NM1*41*2*${claim.provider.name}*****46*${claim.provider.taxId}~`;
    const nm1Receiver = `NM1*40*2*${claim.insurance?.payerName || 'PAYER'}*****46*${claim.insurance?.payerId || ''}~`;

    const hl1 = `HL*1**20*1~`;
    const nm1BillingProvider = `NM1*85*2*${claim.provider.name}*****XX*${claim.provider.npi}~`;

    const hl2 = `HL*2*1*22*1~`;
    const sbr = `SBR*P*18*${claim.subscriber.memberId}******CI~`;
    const nm1Subscriber = `NM1*IL*1*${claim.subscriber.name.split(' ').slice(-1)[0]}*${claim.subscriber.name.split(' ')[0]}****MI*${claim.subscriber.memberId}~`;

    const hl3 = `HL*3*2*23*0~`;
    const clm = `CLM*${claim.claimNumber}*${claim.billedAmount}***${claim.facility?.placeOfService || '11'}:B:1*Y*A*Y*Y~`;

    let diagnosisSegments = '';
    claim.diagnosisCodes?.forEach((dx, index) => {
      const qualifier = index === 0 ? 'ABK' : 'ABF';
      diagnosisSegments += `HI*${qualifier}:${dx.code}~`;
    });

    let serviceLines = '';
    claim.procedureCodes?.forEach((proc, index) => {
      const lx = `LX*${index + 1}~`;
      const sv1 = `SV1*HC:${proc.code}${proc.modifiers ? ':' + proc.modifiers.join(':') : ''}*${proc.charge}*UN*${proc.units}***${proc.diagnosis

/* … truncated 8489 chars — edit only what you need near the top … */
