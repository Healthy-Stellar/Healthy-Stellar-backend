import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { PasswordValidationService } from './password-validation.service';
import { AuthTokenService } from './auth-token.service';
import { MfaService } from './mfa.service';
import { SessionManagementService } from './session-management.service';
import { RefreshTokenStoreService } from './refresh-token-store.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { RegisterDto, LoginDto, ChangePasswordDto } from '../dto/auth.dto';

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    mfaEnabled: boolean;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  mfaRequired?: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private passwordValidationService: PasswordValidationService,
    private authTokenService: AuthTokenService,
    private mfaService: MfaService,
    private sessionManagementService: SessionManagementService,
    private refreshTokenStore: RefreshTokenStoreService,
    private auditLogService: AuditLogService,
  ) {}

  /**
   * Register new user (healthcare staff)
   */
  async register(
    registerDto: RegisterDto,
    role: UserRole = UserRole.PATIENT,
    ipAddress: string,
    userAgent: string,
  ): Promise<AuthResponse> {
    // Validate email uniqueness
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      await this.auditLogService.log({
        actorAddress: registerDto.email,
        action: 'USER_CREATED',
        ipAddress,
        metadata: { reason: 'Email already exists', success: false },
      });
      throw new ConflictException('Email already registered');
    }

    // Validate password
    const passwordValidation = this.passwordValidationService.validatePassword(
      registerDto.password,
    );
    if (!passwordValidation.isValid) {
      throw new BadRequestException({
        message: 'Password does not meet security requirements',
        errors: passwordValidation.errors,
      });
    }

    // Hash password
    const hashedPassword = await this.passwordValidationService.hashPassword(registerDto.password);

    // Create user
    const user = this.userRepository.create({
      email: registerDto.email,
      passwordHash: hashedPassword,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      role,
      isActive: true,
      lastPasswordChangeAt: new Date(),
      mfaEnabled: false,
      requiresPasswordChange: false,
    });

    const savedUser = await this.userRepository.save(user);

    // Log user creation
    await this.auditLogService.log({
      actorAddress: savedUser.id,
      action: 'USER_CREATED',
      targetAddress: savedUser.id,
      ipAddress,
      metadata: { email: savedUser.email, role: savedUser.role, success: true },
    });

    // For healthcare staff, require MFA setup
    if (role !== UserRole.PATIENT) {
      savedUser.requiresPasswordChange = false; // Password was just set
      await this.userRepository.save(savedUser);
    }

    // Create session
    const sessionId = this.generateSessionId();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    const refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const tokens = this.authTokenService.generateTokenPair(user, sessionId);

    await this.sessionManagementService.createSession(
      savedUser.id,
      tokens.accessToken,
      tokens.refreshToken,
      expiresAt,
      refreshTokenExpiresAt,
      ipAddress,
      userAgent,
    );
    await this.refreshTokenStore.store(sessionId, tokens.refreshToken);

    return {
      user: this.formatUser(savedUser),
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      },
    };
  }

  /**
   * Login user
   */
  async login(loginDto: LoginDto, ipAddress: string, userAgent: string): Promise<AuthResponse> {
    const { email, password } = loginDto;

    // Find user
    const user = await this.userRepository.findOne({ where: { email } });

    if (
      !user ||
      !(await this.passwordValidationService.verifyPassword(password, user.passwordHash))
    ) {
      // Increment failed login attempts
      if (user) {
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

        // Lock account after 5 failed attempts
        if (user.failedLoginAttempts >= 5) {
          user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
          await this.auditLogService.log({
            actorAddress: user.id,
            action: 'ACCOUNT_LOCKED',
            ipAddress,
            metadata: { reason: 'Too many failed login attempts', success: false },
          });
        }

        await this.userRepository.save(user);
      }

      await this.auditLogService.log({
        actorAddress: email,
        action: 'LOGIN_FAILED',
        ipAddress,
        metadata: { reason: 'Invalid credentials', success: false },
      });

      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.auditLogService.log({
        actorAddress: user.id,
        action: 'LOGIN_FAILED',
        ipAddress,
        metadata: { reason: 'Account is locked', success: false },
      });
      throw new UnauthorizedException('Account is locked. Try again later');
    }

    // Check if user is active
    if (!user.isActive) {
      await this.auditLogService.log({
        actorAddress: user.id,
        action: 'LOGIN_FAILED',
        ipAddress,
        metadata: { reason: 'User account is inactive', success: false },
      });
      throw new UnauthorizedException('User account is inactive');
    }

    // Check if password has expired (HIPAA requirement)
    if (
      user.lastPasswordChangeAt &&
      this.passwordValidationService.isPasswordExpired(user.lastPasswordChangeAt)
    ) {
      user.requiresPasswordChange = true;
      await this.userRepository.save(user);
    }

    const mfaEnabled = await this.mfaService.isMfaEnabled(user.id);
    const isClinicalRole = this.isClinicalRole(user.role);

    if (isClinicalRole && !mfaEnabled) {
      await this.auditLogService.log({
        actorAddress: user.id,
        action: 'LOGIN_FAILED',
        ipAddress,
        metadata: { reason: 'MFA required but not enabled', success: false },
      });

      throw new BadRequestException({
        message: 'MFA setup required for healthcare staff',
        mfaRequired: true,
        requiresMfaSetup: true,
      });
    }

    // Reset failed login attempts
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    // Create session
    const sessionId = this.generateSessionId();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    const refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const tokens = this.authTokenService.generateTokenPair(user, sessionId, !mfaEnabled);

    await this.sessionManagementService.createSession(
      user.id,
      tokens.accessToken,
      tokens.refreshToken,
      expiresAt,
      refreshTokenExpiresAt,
      ipAddress,
      userAgent,
    );
    await this.refreshTokenStore.store(sessionId, tokens.refreshToken);

    // Tamper-evident audit log
    this.auditLogService.log({
      actorAddress: user.id,
      action: 'LOGIN',
      ipAddress,
      metadata: { email: user.email, success: true },
    }).catch(() => {});

    return {
      user: this.formatUser(user),
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      },
      mfaRequired: mfaEnabled,
    };
  }

  private isClinicalRole(role: UserRole): boolean {
    return [
      UserRole.PHYSICIAN,
      'nurse',
      'pharmacist',
      'lab_technician',
      'lab technician',
      'medical_records',
    ].includes(role as UserRole | string);
  }

  /**
   * Change password
   */
  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
    ipAddress: string,
  ): Promise<void> {
    const { currentPassword, newPassword, confirmPassword } = changePasswordDto;

    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isValid = await this.passwordValidationService.verifyPassword(
      currentPassword,
      user.passwordHash,
    );
    if (!isValid) {
      await this.auditLogService.log({
        actorAddress: userId,
        action: 'PASSWORD_CHANGE',
        ipAddress,
        metadata: { reason: 'Invalid current password', severity: 'MEDIUM', success: false },
      });
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Validate new password
    const passwordValidation = this.passwordValidationService.validatePassword(newPassword, userId);
    if (!passwordValidation.isValid) {
      throw new BadRequestException({
        message: 'New password does not meet security requirements',
        errors: passwordValidation.errors,
      });
    }

    // Hash and save new password
    const hashedPassword = await this.passwordValidationService.hashPassword(newPassword);
    user.passwordHash = hashedPassword;
    user.lastPasswordChangeAt = new Date();
    user.requiresPasswordChange = false;

    await this.userRepository.save(user);

    await this.auditLogService.log({
      actorAddress: userId,
      action: 'PASSWORD_CHANGE',
      ipAddress,
      metadata: { success: true },
    });
  }

  /**
   * Logout user
   */
  async logout(userId: string, sessionId: string, ipAddress: string): Promise<void> {
    if (sessionId) {
      await this.sessionManagementService.revokeSession(sessionId);
      await this.refreshTokenStore.revokeSession(sessionId);
    }

    await this.auditLogService.log({
      actorAddress: userId,
      action: 'LOGOUT',
      ipAddress,
      metadata: { sessionId, success: true },
    });
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id: userId } });
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updates: Partial<User>): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Only allow certain fields to be updated
    const allowedFields = ['firstName', 'lastName', 'specialization', 'licenseNumber', 'npi'];
    const safeUpdates: Partial<User> = {};

    for (const field of allowedFields) {
      if (field in updates) {
        safeUpdates[field] = updates[field];
      }
    }

    Object.assign(user, safeUpdates);
    return this.userRepository.save(user);
  }

  /**
   * Format user for response
   */
  private formatUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      mfaEnabled: user.mfaEnabled,
    };
  }

  /**
   * Request a password reset. Always returns silently to prevent user enumeration.
   * Returns the raw token so callers can send it via email.
   */
  async forgotPassword(email: string): Promise<{ token: string } | null> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) return null;

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await this.userRepository.update(user.id, {
      passwordResetToken: token,
      passwordResetTokenExpiresAt: expiresAt,
    });

    await this.auditLogService.log({
      actorAddress: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      metadata: { email: user.email, success: true },
    });

    return { token };
  }

  /**
   * Consume a reset token and set a new password. Token is invalidated atomically on use.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordResetToken')
      .where('user.passwordResetToken = :token', { token })
      .getOne();

    if (!user || !user.passwordResetToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (!user.passwordResetTokenExpiresAt || user.passwordResetTokenExpiresAt < new Date()) {
      throw new BadRequestException('Reset token has expired');
    }

    const passwordValidation = this.passwordValidationService.validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      throw new BadRequestException({
        message: 'Password does not meet security requirements',
        errors: passwordValidation.errors,
      });
    }

    const hashedPassword = await this.passwordValidationService.hashPassword(newPassword);

    await this.userRepository.update(user.id, {
      passwordHash: hashedPassword,
      passwordResetToken: null,
      passwordResetTokenExpiresAt: null,
      lastPasswordChangeAt: new Date(),
      requiresPasswordChange: false,
    });

    await this.auditLogService.log({
      actorAddress: user.id,
      action: 'PASSWORD_RESET_COMPLETED',
      metadata: { email: user.email, success: true },
    });
  }

  private generateSessionId(): string {
    return randomBytes(16).toString('hex');
  }
}
