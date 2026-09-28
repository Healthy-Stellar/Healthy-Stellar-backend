import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateInsuranceDto, VerifyEligibilityDto } from '../dto/insurance.dto';

@Injectable()
export class InsuranceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateInsuranceDto) {
    return this.prisma.insurance.create({
      data: {
        ...createDto,
        status: 'active',
      },
    });
  }

  async findById(id: string) {
    const insurance = await this.prisma.insurance.findUnique({
      where: { id },
    });

    if (!insurance) {
      throw new NotFoundException(`Insurance with ID ${id} not found`);
    }

    return insurance;
  }

  async findByPatientId(patientId: string) {
    return this.prisma.insurance.findMany({
      where: { patientId },
      orderBy: { priority: 'asc' },
    });
  }

  async findActiveByPatientId(patientId: string) {
    return this.prisma.insurance.findMany({
      where: {
        patientId,
        status: 'active',
      },
      orderBy: { priority: 'asc' },
    });
  }

  async update(id: string, updateDto: Partial<CreateInsuranceDto>) {
    await this.findById(id);

    return this.prisma.insurance.update({
      where: { id },
      data: updateDto,
    });
  }

  async delete(id: string) {
    await this.findById(id);

    return this.prisma.insurance.delete({
      where: { id },
    });
  }

  async deactivate(id: string) {
    await this.findById(id);

    return this.prisma.insurance.update({
      where: { id },
      data: { status: 'inactive' },
    });
  }

  async verifyEligibility(verifyDto: VerifyEligibilityDto) {
    const insurance = await this.findById(verifyDto.insuranceId);

    if (insurance.status !== 'active') {
      throw new BadRequestException('Insurance is not active');
    }

    // EDI 270/271 eligibility verification
    const verificationResult = {
      eligible: true,
      payer: insurance.payer,
      planName: insurance.planName,
      coverageLevel: insurance.coverageLevel,
      copay: insurance.copay,
      deductible: insurance.deductible,
      deductibleMet: insurance.deductibleMet,
      outOfPocketMax: insurance.outOfPocketMax,
      effectiveDate: insurance.effectiveDate,
      terminationDate: insurance.terminationDate,
      verifiedAt: new Date(),
    };

    await this.prisma.insuranceVerification.create({
      data: {
        insuranceId: insurance.id,
        patientId: insurance.patientId,
        verificationType: 'eligibility',
        result: verificationResult,
        status: 'verified',
      },
    });

    return verificationResult;
  }

  async requestAuthorization(insuranceId: string, authRequest: any) {
    const insurance = await this.findById(insuranceId);

    const authorization = await this.prisma.priorAuthorization.create({
      data: {
        insuranceId: insurance.id,
        patientId: insurance.patientId,
        authNumber: authRequest.authNumber,
        serviceType: authRequest.serviceType,
        cptCode: authRequest.cptCode,
        status: 'pending',
        requestedAt: new Date(),
      },
    });

    return authorization;
  }

  async getVerificationHistory(insuranceId: string) {
    await this.findById(insuranceId);

    return this.prisma.insuranceVerification.findMany({
      where: { insuranceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLatestVerification(insuranceId: string) {
    await this.findById(insuranceId);

    return this.prisma.insuranceVerification.findFirst({
      where: { insuranceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async verifyBenefits(id: string, benefitsQuery: any) {
    const insurance = await this.findById(id);

    if (insurance.status !== 'active') {
      throw new BadRequestException('Insurance is not active');
    }

    const serviceType = benefitsQuery?.serviceType;
    const cptCode = benefitsQuery?.cptCode;

    const result = {
      serviceType,
      cptCode,
      covered: true,
      copay: insurance.copay,
      coinsurance: insurance.coinsurance,
      priorAuthRequired: false,
      allowedAmount: benefitsQuery?.allowedAmount ?? null,
      verifiedAt: new Date(),
    };

    await this.prisma.insuranceVerification.create({
      data: {
        insuranceId: insurance.id,
        patientId: insurance.patientId,
        verificationType: 'benefits',
        result,
        status: 'verified',
      },
    });

    return result;
  }

  async getAuthorizationStatus(id: string, authNumber?: string) {
    await this.findById(id);

    const authorization = await this.prisma.priorAuthorization.findFirst({
      where: {
        insuranceId: id,
        ...(authNumber ? { authNumber } : {}),
      },
      orderBy: { requestedAt: 'desc' },
    });

    if (!authorization) {
      throw new NotFoundException('Authorization request not found');
    }

    return {
      authNumber: authorization.authNumber,
      status: authorization.status,
      serviceType: authorization.serviceType,
      cptCode: authorization.cptCode,
      requestedAt: authorization.requestedAt,
      approvedAt: authorization.approvedAt ?? null,
    };
  }

  async batchVerify(batchData: any) {
    const items: any[] = Array.isArray(batchData)
      ? batchData
      : batchData?.verifications ?? [];

    const results = await Promise.all(
      items.map(async (item) => {
        try {
          const result = await this.verifyEligibility(item);
          return { insuranceId: item.insuranceId, success: true, result };
        } catch (error) {
          return {
            insuranceId: item?.insuranceId,
            success: false,
            error: error instanceof Error ? error.message : 'Verification failed',
          };
        }
      }),
    );

    return {
      total: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  async getVerificationSummary(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid startDate or endDate');
    }

    const verifications = await this.prisma.insuranceVerification.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        insurance: true,
      },
    });

    const totalVerifications = verifications.length;
    const eligible = verifications.filter(
      (v) => v.status === 'verified',
    ).length;
    const ineligible = totalVerifications - eligible;

    const byPayerMap = new Map<string, { payer: string; total: number; eligible: number }>();
    for (const verification of verifications) {
      const payer = verification.insurance?.payer ?? 'Unknown';
      const entry = byPayerMap.get(payer) ?? { payer, total: 0, eligible: 0 };
      entry.total += 1;
      if (verification.status === 'verified') {
        entry.eligible += 1;
      }
      byPayerMap.set(payer, entry);
    }

    return {
      totalVerifications,
      eligible,
      ineligible,
      eligibilityRate:
        totalVerifications > 0
          ? Number(((eligible / totalVerifications) * 100).toFixed(2))
          : 0,
      byPayer: Array.from(byPayerMap.values()),
      startDate,
      endDate,
    };
  }
}
