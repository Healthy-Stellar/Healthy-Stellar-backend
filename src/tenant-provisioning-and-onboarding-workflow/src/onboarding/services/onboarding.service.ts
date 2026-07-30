import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import * as crypto from 'crypto';
import * as StellarSDK from 'stellar-sdk';
import {
  OnboardingSession,
  OnboardingSessionStatus,
  OnboardingStep,
} from '../entities/onboarding-session.entity';
import {
  ConfigureHospitalDto,
  OnboardingStatusResponseDto,
  RegisterHospitalDto,
  VerifyEmailDto,
} from '../dto/onboarding.dto';
import { ProvisioningService } from '../../tenants/services/provisioning.service';
import { EmailService } from '../../tenants/services/email.service';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    @InjectRepository(OnboardingSession)
    private readonly sessionRepo: Repository<OnboardingSession>,
    private readonly provisioningService: ProvisioningService,
    private readonly emailService: EmailService,
  ) {}

  async register(dto: RegisterHospitalDto): Promise<OnboardingStatusResponseDto> {
    const existing = await this.sessionRepo.findOne({
      where: { adminEmail: dto.adminEmail },
    });
    if (existing && existing.status === OnboardingSessionStatus.ACTIVE) {
      throw new BadRequestException(
        `An active onboarding session already exists for ${dto.adminEmail}`,
      );
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');

    const session = this.sessionRepo.create({
      hospitalName: dto.hospitalName,
      adminEmail: dto.adminEmail,
      plan: dto.plan,
      dataResidencyRegion: dto.dataResidencyRegion,
      currentStep: OnboardingStep.REGISTRATION,
      status: OnboardingSessionStatus.ACTIVE,
      verificationToken,
    });

    const saved = await this.sessionRepo.save(session);
    this.logger.log(`[onboarding] Registered session=${saved.id} hospital=${dto.hospitalName}`);

    await this.emailService.sendWelcomeEmail(
      dto.hospitalName,
      dto.adminEmail,
      dto.adminEmail,
      `${process.env.APP_URL ?? 'http://localhost:3000'}/onboarding/${saved.id}/verify?token=${verificationToken}`,
    );

    return OnboardingStatusResponseDto.from(saved);
  }

  async verify(sessionId: string, dto: VerifyEmailDto): Promise<OnboardingStatusResponseDto> {
    const session = await this.findActiveSession(sessionId);

    if (session.currentStep !== OnboardingStep.REGISTRATION) {
      throw new BadRequestException('Session is not in the REGISTRATION step');
    }

    if (session.verificationToken !== dto.token) {
      throw new BadRequestException('Invalid verification token');
    }

    session.verifiedAt = new Date();
    session.currentStep = OnboardingStep.VERIFICATION;
    const saved = await this.sessionRepo.save(session);
    this.logger.log(`[onboarding] Verified session=${sessionId}`);

    return OnboardingStatusResponseDto.from(saved);
  }

  async configure(
    sessionId: string,
    dto: ConfigureHospitalDto,
  ): Promise<OnboardingStatusResponseDto> {
    const session = await this.findActiveSession(sessionId);

    if (session.currentStep !== OnboardingStep.VERIFICATION) {
      throw new BadRequestException('Email must be verified before configuration');
    }

    session.currentStep = OnboardingStep.CONFIGURATION;
    const saved = await this.sessionRepo.save(session);
    this.logger.log(`[onboarding] Configured session=${sessionId}`);

    return OnboardingStatusResponseDto.from(saved);
  }

  async activate(sessionId: string): Promise<OnboardingStatusResponseDto> {
    const session = await this.findActiveSession(sessionId);

    if (session.currentStep !== OnboardingStep.CONFIGURATION) {
      throw new BadRequestException('Hospital must be configured before activation');
    }

    try {
      session.currentStep = OnboardingStep.ACTIVATION;
      await this.sessionRepo.save(session);

      // Generate Stellar keypair and fund via friendbot on testnet
      const keypair = StellarSDK.Keypair.random();
      session.stellarPublicKey = keypair.publicKey();
      session.stellarSecretKey = keypair.secret();

      await this.fundViaFriendbot(keypair.publicKey());
      this.logger.log(
        `[onboarding] Funded Stellar account ${keypair.publicKey()} for session=${sessionId}`,
      );

      // Provision the tenant
      const tenant = await this.provisioningService.provisionTenant({
        name: session.hospitalName,
        adminEmail: session.adminEmail,
        adminFirstName: session.adminEmail.split('@')[0],
        adminLastName: 'Admin',
      });

      session.tenantId = tenant.id;
      session.currentStep = OnboardingStep.COMPLETED;
      session.status = OnboardingSessionStatus.COMPLETED;
      const saved = await this.sessionRepo.save(session);

      this.logger.log(
        `[onboarding] Activated session=${sessionId} tenantId=${tenant.id}`,
      );

      return OnboardingStatusResponseDto.from(saved);
    } catch (err) {
      session.status = OnboardingSessionStatus.FAILED;
      session.provisioningError = err instanceof Error ? err.message : String(err);
      await this.sessionRepo.save(session);
      this.logger.error(`[onboarding] Activation failed session=${sessionId}: ${session.provisioningError}`);
      throw err;
    }
  }

  async getStatus(sessionId: string): Promise<OnboardingStatusResponseDto> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException(`Onboarding session ${sessionId} not found`);
    return OnboardingStatusResponseDto.from(session);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async findActiveSession(sessionId: string): Promise<OnboardingSession> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException(`Onboarding session ${sessionId} not found`);
    if (session.status !== OnboardingSessionStatus.ACTIVE) {
      throw new BadRequestException(`Session ${sessionId} is ${session.status}`);
    }
    return session;
  }

  private async fundViaFriendbot(publicKey: string): Promise<void> {
    const network = process.env.STELLAR_NETWORK ?? 'testnet';
    if (network !== 'testnet') {
      this.logger.warn('[onboarding] Skipping friendbot funding — not on testnet');
      return;
    }
    try {
      await axios.get(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`);
    } catch (err: any) {
      // 400 = already funded; that's fine
      if (err?.response?.status !== 400) throw err;
    }
  }
}
