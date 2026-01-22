import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Insurance } from '../entities/insurance.entity';
import { InsuranceVerification } from '../entities/insurance-verification.entity';
import {
  CreateInsuranceDto,
  UpdateInsuranceDto,
  VerifyInsuranceDto,
  RequestAuthorizationDto,
} from '../dto/insurance.dto';
import { VerificationStatus, AuthorizationStatus } from '../../common/enums';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class InsuranceService {
  constructor(
    @InjectRepository(Insurance)
    private readonly insuranceRepository: Repository<Insurance>,
    @InjectRepository(InsuranceVerification)
    private readonly verificationRepository: Repository<InsuranceVerification>,
  ) {}

  async create(createDto: CreateInsuranceDto): Promise<Insurance> {
    const insurance = this.insuranceRepository.create({
      ...createDto,
      effectiveDate: new Date(createDto.effectiveDate),
      terminationDate: createDto.terminationDate
        ? new Date(createDto.terminationDate)
        : undefined,
      subscriberDob: createDto.subscriberDob
        ? new Date(createDto.subscriberDob)
        : undefined,
    });

    return this.insuranceRepository.save(insurance);
  }

  async findById(id: string): Promise<Insurance> {
    const insurance = await this.insuranceRepository.findOne({
      where: { id },
      relations: ['claims', 'verifications'],
    });

    if (!insurance) {
      throw new NotFoundException(`Insurance with ID ${id} not found`);
    }

    return insurance;
  }

  async findByPatientId(patientId: string): Promise<Insurance[]> {
    return this.insuranceRepository.find({
      where: { patientId, isActive: true },
      order: { insuranceType: 'ASC' },
    });
  }

  async findActiveByPatientId(patientId: string, asOfDate?: Date): Promise<Insurance[]> {
    const checkDate = asOfDate || new Date();

    return this.insuranceRepository.find({
      where: {
        patientId,
        isActive: true,
        effectiveDate: LessThanOrEqual(checkDate),
      },
    });
  }

  async update(id: string, updateDto: UpdateInsuranceDto): Promise<Insurance> {
    const insurance = await this.findById(id);

    Object.assign(insurance, {
      ...updateDto,
      effectiveDate: updateDto.effectiveDate
        ? new Date(updateDto.effectiveDate)
        : insurance.effectiveDate,
      terminationDate: updateDto.terminationDate
        ? new Date(updateDto.terminationDate)
        : insurance.terminationDate,
      subscriberDob: updateDto.subscriberDob
        ? new Date(updateDto.subscriberDob)
        : insurance.subscriberDob,
    });

    return this.insuranceRepository.save(insurance);
  }

  async delete(id: string): Promise<void> {
    const insurance = await this.findById(id);
    await this.insuranceRepository.remove(insurance);
  }

  async deactivate(id: string): Promise<Insurance> {
    const insurance = await this.findById(id);
    insurance.isActive = false;
    return this.insuranceRepository.save(insurance);
  }

  async verifyEligibility(
    verifyDto: VerifyInsuranceDto,
  ): Promise<InsuranceVerification> {
    const insurance = await this.findById(verifyDto.insuranceId);

    const transactionId = `270-${uuidv4().substring(0, 8).toUpperCase()}`;

    const verification = this.verificationRepository.create({
      insuranceId: insurance.id,
      transactionId,
      status: VerificationStatus.PENDING,
      ediTransactionType: '270/271',
      verifiedAt: new Date(),
    });

    await this.verificationRepository.save(verification);

    const eligibilityResult = await this.performEligibilityCheck(insurance, verifyDto);

    verification.status = eligibilityResult.isEligible
      ? VerificationStatus.VERIFIED
      : VerificationStatus.FAILED;
    verification.isEligible = eligibilityResult.isEligible;
    if (eligibilityResult.coverageStartDate) {
      verification.coverageStartDate = eligibilityResult.coverageStartDate;
    }
    if (eligibilityResult.coverageEndDate) {
      verification.coverageEndDate = eligibilityResult.coverageEndDate;
    }
    if (eligibilityResult.benefitDetails) {
      verification.benefitDetails = eligibilityResult.benefitDetails;
    }
    if (eligibilityResult.serviceCoverage) {
      verification.serviceCoverage = eligibilityResult.serviceCoverage;
    }
    verification.responsePayload = JSON.stringify(eligibilityResult);
    verification.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.verificationRepository.save(verification);

    insurance.verificationStatus = verification.status;
    insurance.lastVerifiedAt = new Date();
    if (eligibilityResult.benefitDetails?.inNetwork) {
      const inNetwork = eligibilityResult.benefitDetails.inNetwork;
      if (inNetwork.deductible !== undefined) insurance.deductible = inNetwork.deductible;
      if (inNetwork.deductibleMet !== undefined) insurance.deductibleMet = inNetwork.deductibleMet;
      if (inNetwork.copay !== undefined) insurance.copay = inNetwork.copay;
      if (inNetwork.coinsurance !== undefined) insurance.coinsurancePercentage = inNetwork.coinsurance;
      if (inNetwork.outOfPocketMax !== undefined) insurance.outOfPocketMax = inNetwork.outOfPocketMax;
      if (inNetwork.outOfPocketMet !== undefined) insurance.outOfPocketMet = inNetwork.outOfPocketMet;
    }
    await this.insuranceRepository.save(insurance);

    return verification;
  }

  private async performEligibilityCheck(
    insurance: Insurance,
    _verifyDto: VerifyInsuranceDto,
  ): Promise<{
    isEligible: boolean;
    coverageStartDate?: Date;
    coverageEndDate?: Date;
    benefitDetails?: {
      inNetwork?: {
        deductible?: number;
        deductibleMet?: number;
        copay?: number;
        coinsurance?: number;
        outOfPocketMax?: number;
        outOfPocketMet?: number;
      };
      outOfNetwork?: {
        deductible?: number;
        deductibleMet?: number;
        copay?: number;
        coinsurance?: number;
        outOfPocketMax?: number;
        outOfPocketMet?: number;
      };
    };
    serviceCoverage?: Array<{
      serviceType: string;
      covered: boolean;
      requiresAuth: boolean;
      limitations?: string;
    }>;
  }> {
    const today = new Date();
    const effectiveDate = new Date(insurance.effectiveDate);
    const terminationDate = insurance.terminationDate
      ? new Date(insurance.terminationDate)
      : null;

    const isEligible =
      today >= effectiveDate && (!terminationDate || today <= terminationDate);

    return {
      isEligible,
      coverageStartDate: effectiveDate,
      coverageEndDate: terminationDate || undefined,
      benefitDetails: {
        inNetwork: {
          deductible: insurance.deductible || 1500,
          deductibleMet: insurance.deductibleMet || 500,
          copay: insurance.copay || 25,
          coinsurance: insurance.coinsurancePercentage || 20,
          outOfPocketMax: insurance.outOfPocketMax || 6000,
          outOfPocketMet: insurance.outOfPocketMet || 1000,
        },
        outOfNetwork: {
          deductible: 3000,
          deductibleMet: 0,
          copay: 50,
          coinsurance: 40,
          outOfPocketMax: 12000,
          outOfPocketMet: 0,
        },
      },
      serviceCoverage: [
        { serviceType: 'Office Visit', covered: true, requiresAuth: false },
        { serviceType: 'Preventive Care', covered: true, requiresAuth: false },
        { serviceType: 'Specialist Visit', covered: true, requiresAuth: false },
        { serviceType: 'Surgery', covered: true, requiresAuth: true },
        { serviceType: 'Imaging', covered: true, requiresAuth: true, limitations: 'Prior auth required for MRI/CT' },
        { serviceType: 'Lab Work', covered: true, requiresAuth: false },
      ],
    };
  }

  async requestAuthorization(
    authDto: RequestAuthorizationDto,
  ): Promise<InsuranceVerification> {
    const insurance = await this.findById(authDto.insuranceId);

    const transactionId = `278-${uuidv4().substring(0, 8).toUpperCase()}`;

    const verification = this.verificationRepository.create({
      insuranceId: insurance.id,
      transactionId,
      status: VerificationStatus.PENDING,
      ediTransactionType: '278',
      authorizationStatus: AuthorizationStatus.PENDING,
      verifiedAt: new Date(),
      requestPayload: JSON.stringify(authDto),
    });

    await this.verificationRepository.save(verification);

    const authResult = await this.performAuthorizationRequest(insurance, authDto);

    verification.authorizationStatus = authResult.status;
    if (authResult.authorizationNumber) {
      verification.authorizationNumber = authResult.authorizationNumber;
    }
    if (authResult.startDate) {
      verification.authorizationStartDate = authResult.startDate;
    }
    if (authResult.endDate) {
      verification.authorizationEndDate = authResult.endDate;
    }
    if (authResult.authorizedVisits !== undefined) {
      verification.authorizedVisits = authResult.authorizedVisits;
    }
    verification.usedVisits = 0;
    verification.responsePayload = JSON.stringify(authResult);
    verification.status =
      authResult.status === AuthorizationStatus.APPROVED
        ? VerificationStatus.VERIFIED
        : VerificationStatus.FAILED;

    await this.verificationRepository.save(verification);

    return verification;
  }

  private async performAuthorizationRequest(
    _insurance: Insurance,
    authDto: RequestAuthorizationDto,
  ): Promise<{
    status: AuthorizationStatus;
    authorizationNumber?: string;
    startDate?: Date;
    endDate?: Date;
    authorizedVisits?: number;
    denialReason?: string;
  }> {
    const authNumber = `AUTH-${uuidv4().substring(0, 8).toUpperCase()}`;

    return {
      status: AuthorizationStatus.APPROVED,
      authorizationNumber: authNumber,
      startDate: new Date(authDto.serviceStartDate),
      endDate: authDto.serviceEndDate
        ? new Date(authDto.serviceEndDate)
        : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      authorizedVisits: authDto.requestedVisits || 1,
    };
  }

  async getVerificationHistory(insuranceId: string): Promise<InsuranceVerification[]> {
    return this.verificationRepository.find({
      where: { insuranceId },
      order: { createdAt: 'DESC' },
    });
  }

  async getLatestVerification(
    insuranceId: string,
  ): Promise<InsuranceVerification | null> {
    return this.verificationRepository.findOne({
      where: { insuranceId },
      order: { createdAt: 'DESC' },
    });
  }
}
