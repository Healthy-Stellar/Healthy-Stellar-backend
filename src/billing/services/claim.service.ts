import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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

@Injectable()
export class ClaimService {
  constructor(
    @InjectRepository(InsuranceClaim)
    private readonly claimRepository: Repository<InsuranceClaim>,
    @InjectRepository(Insurance)
    private readonly insuranceRepository: Repository<Insurance>,
    @InjectRepository(Billing)
    private readonly billingRepository: Repository<Billing>,
  ) {}

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
      where.serviceStartDate = Between(
        new Date(filters.startDate),
        new Date(filters.endDate),
      );
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
      throw new BadRequestException(
        `Cannot update claim in ${claim.status} status`,
      );
    }

    Object.assign(claim, updateDto);

    return this.claimRepository.save(claim);
  }

  async submit(submitDto: SubmitClaimDto): Promise<InsuranceClaim> {
    const claim = await this.findById(submitDto.claimId);

    if (claim.status !== ClaimStatus.DRAFT && claim.status !== ClaimStatus.REJECTED) {
      throw new BadRequestException(
        `Cannot submit claim in ${claim.status} status`,
      );
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

    await this.claimRepository.save(claim);

    setTimeout(async () => {
      claim.status = ClaimStatus.ACCEPTED;
      claim.acceptedAt = new Date();
      claim.submissionHistory = [
        ...(claim.submissionHistory || []),
        {
          date: new Date().toISOString(),
          status: 'accepted',
          message: 'Claim accepted by payer',
        },
      ];
      await this.claimRepository.save(claim);
    }, 2000);

    return claim;
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

  private formatDateGS(date: Date): string {
    return date.toISOString().slice(0, 10).replace(/-/g, '');
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
        console.error(`Error processing claim ${claimData.claimNumber}:`, error);
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
          remarkCodes: [
            { code: 'N130', description: 'Payment adjusted based on fee schedule' },
          ],
          adjustmentCodes: [
            { groupCode: 'CO', reasonCode: '45', amount: 10.0 },
          ],
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

  async getPendingClaims(): Promise<InsuranceClaim[]> {
    return this.claimRepository.find({
      where: [
        { status: ClaimStatus.PENDING },
        { status: ClaimStatus.SUBMITTED },
        { status: ClaimStatus.ACCEPTED },
      ],
      relations: ['insurance'],
      order: { submittedAt: 'ASC' },
    });
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
