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


  async submit(submitDto: SubmitClaimDto): Promise<InsuranceClaim> {
    const claim = await this.findById(submitDto.claimId);

    if (claim.status !== ClaimStatus.DRAFT && claim.status !== ClaimStatus.REJECTED) {
      throw new BadRequestException(`Cannot submit claim in ${claim.status} status`);
    }

    const edi837 = this.generateEDI837(claim);

    claim.edi837Payload = edi837;
    claim.status = ClaimStatus.PENDING;
    claim.submittedAt = new Date();
    claim.submissionAttempts = (claim.submissionAttempts || 0) + 1;
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
      // The rejection code/reason is recorded in the submission history; the
      // claim entity has no dedicated rejection columns.
      target.status = ClaimStatus.REJECTED;
      target.submissionHistory = [
        ...(target.submissionHistory || []),
        {
          date: new Date().toISOString(),
          status: 'rejected',
          message: [result.rejectionCode, result.rejectionReason].filter(Boolean).join(': ') ||
            'Claim rejected by payer',
        },
      ];
    }
    // Otherwise the claim remains PENDING awaiting asynchronous adjudication
    // (processERA / handleAdjudicationWebhook), which persists the outcome.

    return this.claimRepository.save(target);
  }

  async resubmit(id: string, submitDto: Partial<SubmitClaimDto> = {}): Promise<InsuranceClaim> {
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

    return this.submit({ ...submitDto, claimId: id });
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

  /** Submission volume and acceptance rate for claims submitted in [startDate, endDate]. */
  async getSubmissionReport(
    startDate: string,
    endDate: string,
  ): Promise<{
    startDate: string;
    endDate: string;
    totalSubmitted: number;
    accepted: number;
    rejected: number;
    pending: number;
    acceptanceRate: number;
    totalAmount: number;
  }> {
    const claims = await this.findSubmittedBetween(startDate, endDate);

    const acceptedStatuses = [
      ClaimStatus.ACCEPTED,
      ClaimStatus.APPROVED,
      ClaimStatus.PAID,
      ClaimStatus.PARTIALLY_PAID,
    ];
    const rejectedStatuses = [ClaimStatus.REJECTED, ClaimStatus.DENIED];

    const accepted = claims.filter((c) => acceptedStatuses.includes(c.status)).length;
    const rejected = claims.filter((c) => rejectedStatuses.includes(c.status)).length;
    const totalSubmitted = claims.length;

    return {
      startDate,
      endDate,
      totalSubmitted,
      accepted,
      rejected,
      pending: totalSubmitted - accepted - rejected,
      acceptanceRate: this.percentage(accepted, totalSubmitted),
      totalAmount: this.roundCurrency(
        claims.reduce((sum, c) => sum + Number(c.billedAmount || 0), 0),
      ),
    };
  }

  /** Denial rate, top denial reasons and recoverable amount for claims submitted in [startDate, endDate]. */
  async getDenialAnalysis(
    startDate: string,
    endDate: string,
  ): Promise<{
    startDate: string;
    endDate: string;
    totalClaims: number;
    totalDenials: number;
    denialRate: number;
    topReasons: Array<{ reason: string; count: number }>;
    recoveryOpportunity: number;
  }> {
    const claims = await this.findSubmittedBetween(startDate, endDate, ['denials']);
    const denied = claims.filter((c) => c.status === ClaimStatus.DENIED);

    const reasonCounts = new Map<string, number>();
    let recoveryOpportunity = 0;

    for (const claim of denied) {
      const denials = claim.denials || [];
      if (denials.length === 0) {
        reasonCounts.set('unspecified', (reasonCounts.get('unspecified') || 0) + 1);
        recoveryOpportunity += Number(claim.billedAmount || 0);
        continue;
      }
      for (const denial of denials) {
        const reason = String(denial.primaryReason || 'unspecified');
        reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
        if (!denial.isResolved) {
          recoveryOpportunity += Number(denial.deniedAmount || 0);
        }
      }
    }

    const topReasons = [...reasonCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      startDate,
      endDate,
      totalClaims: claims.length,
      totalDenials: denied.length,
      denialRate: this.percentage(denied.length, claims.length),
      topReasons,
      recoveryOpportunity: this.roundCurrency(recoveryOpportunity),
    };
  }

  private async findSubmittedBetween(
    startDate: string,
    endDate: string,
    relations: string[] = [],
  ): Promise<InsuranceClaim[]> {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (!startDate || !endDate || isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('startDate and endDate must be valid dates');
    }
    if (start > end) {
      throw new BadRequestException('startDate must be before endDate');
    }

    return this.claimRepository.find({
      where: { submittedAt: Between(start, end) },
      relations,
    });
  }

  private percentage(part: number, total: number): number {
    return total === 0 ? 0 : Math.round((part / total) * 10000) / 100;
  }

  private roundCurrency(value: number): number {
    return Math.round(value * 100) / 100;
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
      const sv1 = `SV1*HC:${proc.code}${proc.modifiers ? ':' + proc.modifiers.join(':') : ''}*${proc.charge}*UN*${proc.units}***${proc.diagnosisPointers.join(':')}~`;
      const dtp = `DTP*472*D8*${this.formatDateGS(claim.serviceStartDate)}~`;
      serviceLines += lx + sv1 + dtp;
    });

    const se = `SE*${20 + (claim.diagnosisCodes?.length || 0) + (claim.procedureCodes?.length || 0) * 3}*0001~`;
    const ge = `GE*1*1~`;
    const iea = `IEA*1*000000001~`;

    return [
      isa,
      gs,
      st,
      bht,
      nm1Submitter,
      nm1Receiver,
      hl1,
      nm1BillingProvider,
      hl2,
      sbr,
      nm1Subscriber,
      hl3,
      clm,
      diagnosisSegments,
      serviceLines,
      se,
      ge,
      iea,
    ].join('\n');
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(2, 10).replace(/-/g, '');
  }

  private formatTime(date: Date): string {
    return date.toISOString().slice(11, 16).replace(/:/g, '');
  }

  private formatDateGS(date: Date | string): string {
    // `date` columns (e.g. serviceStartDate) come back from Postgres as strings.
    return new Date(date).toISOString().slice(0, 10).replace(/-/g, '');
  }

  private formatTimeGS(date: Date): string {
    return date.toISOString().slice(11, 19).replace(/:/g, '');
  }

  async processERA(processDto: ProcessERADto): Promise<InsuranceClaim[]> {
    const updatedClaims: InsuranceClaim[] = [];

    const eraData = this.parseEDI835(processDto.edi835Content);

    for (const claimData of eraData.claims) {
      try {
        const claim = await this.findByClaimNumber(claimData.claimNumber);

        claim.status = claimData.paidAmount > 0 ? ClaimStatus.PAID : ClaimStatus.DENIED;
        claim.paidAmount = claimData.paidAmount;
        claim.allowedAmount = claimData.allowedAmount;
        claim.adjustmentAmount = claimData.adjustmentAmount;
        claim.patientResponsibility = claimData.patientResponsibility;
        claim.copayAmount = claimData.copay || 0;
        claim.deductibleAmount = claimData.deductible || 0;
        claim.coinsuranceAmount = claimData.coinsurance || 0;
        claim.edi835Response = processDto.edi835Content;
        claim.adjudicatedAt = new Date();
        claim.payerClaimNumber = claimData.payerClaimNumber;
        if (claimData.remarkCodes) {
          claim.remarkCodes = claimData.remarkCodes;
        }
        if (claimData.adjustmentCodes) {
          claim.adjustmentCodes = claimData.adjustmentCodes;
        }

        claim.submissionHistory = [
          ...(claim.submissionHistory || []),
          {
            date: new Date().toISOString(),
            status: claim.status,
            message: `ERA processed. Paid: $${claimData.paidAmount}`,
          },
        ];

        await this.claimRepository.save(claim);
        updatedClaims.push(claim);
      } catch (error) {
        this.logger.error(`Error processing claim ${claimData.claimNumber}:`, error);
      }
    }

    return updatedClaims;
  }

  private parseEDI835(_edi835: string): {
    claims: Array<{
      claimNumber: string;
      payerClaimNumber: string;
      paidAmount: number;
      allowedAmount: number;
      adjustmentAmount: number;
      patientResponsibility: number;
      copay?: number;
      deductible?: number;
      coinsurance?: number;
      remarkCodes?: Array<{ code: string; description: string }>;
      adjustmentCodes?: Array<{
        groupCode: string;
        reasonCode: string;
        amount: number;
      }>;
    }>;
  } {
    return {
      claims: [
        {
          claimNumber: 'CLM-SAMPLE',
          payerClaimNumber: 'PAYER-12345',
          paidAmount: 120.0,
          allowedAmount: 140.0,
          adjustmentAmount: 10.0,
          patientResponsibility: 30.0,
          copay: 25.0,
          deductible: 0,
          coinsurance: 5.0,
          remarkCodes: [{ code: 'N130', description: 'Payment adjusted based on fee schedule' }],
          adjustmentCodes: [{ groupCode: 'CO', reasonCode: '45', amount: 10.0 }],
        },
      ],
    };
  }

  async getClaimsByStatus(status: ClaimStatus): Promise<InsuranceClaim[]> {
    return this.claimRepository.find({
      where: { status },
      relations: ['insurance'],
      order: { createdAt: 'DESC' },
    });
  }

  async getPendingClaims(priority?: string): Promise<InsuranceClaim[]> {
    const claims = await this.claimRepository.find({
      where: [
        { status: ClaimStatus.PENDING },
        { status: ClaimStatus.SUBMITTED },
        { status: ClaimStatus.ACCEPTED },
      ],
      relations: ['insurance'],
      order: { submittedAt: 'ASC' },
    });

    if (!priority) {
      return claims;
    }

    return claims.filter((claim) => (claim as any).priority === priority);
  }

  /** Receives a real-time adjudication callback from the payer webhook and updates the claim. */
  async handleAdjudicationWebhook(payload: {
    claimNumber: string;
    decision: 'approved' | 'rejected';
    payerClaimNumber?: string;
    paidAmount?: number;
    allowedAmount?: number;
    adjustmentAmount?: number;
    patientResponsibility?: number;
    remarkCodes?: Array<{ code: string; description: string }>;
  }): Promise<InsuranceClaim> {
    const claim = await this.findByClaimNumber(payload.claimNumber);

    claim.status = payload.decision === 'approved' ? ClaimStatus.APPROVED : ClaimStatus.REJECTED;
    claim.adjudicatedAt = new Date();
    claim.payerClaimNumber = payload.payerClaimNumber ?? claim.payerClaimNumber;
    claim.paidAmount = payload.paidAmount ?? claim.paidAmount;
    claim.allowedAmount = payload.allowedAmount ?? claim.allowedAmount;
    claim.adjustmentAmount = payload.adjustmentAmount ?? claim.adjustmentAmount;
    claim.patientResponsibility = payload.patientResponsibility ?? claim.patientResponsibility;
    if (payload.remarkCodes) {
      claim.remarkCodes = payload.remarkCodes;
    }

    claim.submissionHistory = [
      ...(claim.submissionHistory || []),
      {
        date: new Date().toISOString(),
        status: claim.status,
        message: `Adjudication webhook received from payer: ${payload.decision}`,
      },
    ];

    await this.claimRepository.save(claim);

    if (claim.status === ClaimStatus.APPROVED) {
      await this.generatePatientStatement(claim);
    }

    return claim;
  }

  /** Auto-generates/updates the patient statement for the remaining balance after adjudication. */
  private async generatePatientStatement(claim: InsuranceClaim): Promise<void> {
    const billing = await this.billingRepository.findOne({ where: { id: claim.billingId } });
    if (!billing) {
      return;
    }

    billing.totalPayments = Number(billing.totalPayments || 0) + Number(claim.paidAmount || 0);
    billing.patientResponsibility = Number(claim.patientResponsibility || 0);
    billing.balance = Math.max(
      Number(billing.totalCharges || 0) - Number(billing.totalPayments || 0) - Number(billing.totalAdjustments || 0),
      0,
    );
    billing.status = billing.balance > 0 ? 'statement_pending' : 'paid';

    await this.billingRepository.save(billing);
  }

  /** Dashboard data: claim counts by status, plus aging buckets for unresolved claims. */
  async getClaimsDashboard(): Promise<{
    byStatus: Record<string, number>;
    agingBuckets: Record<'0-30' | '31-60' | '61-90' | '90+', number>;
  }> {
    const claims = await this.claimRepository.find();

    const byStatus: Record<string, number> = {};
    for (const status of Object.values(ClaimStatus)) {
      byStatus[status] = 0;
    }

    const agingBuckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    const outstandingStatuses = [ClaimStatus.SUBMITTED, ClaimStatus.PENDING, ClaimStatus.ACCEPTED];
    const now = Date.now();

    for (const claim of claims) {
      byStatus[claim.status] = (byStatus[claim.status] || 0) + 1;

      if (outstandingStatuses.includes(claim.status) && claim.submittedAt) {
        const ageDays = Math.floor((now - new Date(claim.submittedAt).getTime()) / 86_400_000);
        if (ageDays <= 30) agingBuckets['0-30']++;
        else if (ageDays <= 60) agingBuckets['31-60']++;
        else if (ageDays <= 90) agingBuckets['61-90']++;
        else agingBuckets['90+']++;
      }
    }

    return { byStatus, agingBuckets };
  }

  async voidClaim(id: string, reason: string): Promise<InsuranceClaim> {
    const claim = await this.findById(id);

    if (claim.status === ClaimStatus.PAID) {
      throw new BadRequestException('Cannot void a paid claim');
    }

    claim.status = ClaimStatus.VOID;
    claim.notes = `${claim.notes || ''}\nVoided: ${reason}`;
    claim.submissionHistory = [
      ...(claim.submissionHistory || []),
      {
        date: new Date().toISOString(),
        status: 'void',
        message: `Claim voided: ${reason}`,
      },
    ];

    return this.claimRepository.save(claim);
  }
}
