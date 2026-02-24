import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { PasswordValidationService } from './password-validation.service';
import { AuthTokenService } from './auth-token.service';
import { MfaService } from './mfa.service';
import { SessionManagementService } from './session-management.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuditAction } from '../../common/audit/audit-log.entity';
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
    private auditService: AuditService,
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
      await this.auditService.logAuthenticationEvent('USER_CREATED', false, {
        email: registerDto.email,
        reason: 'Email already exists',
        ipAddress,
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
    await this.auditService.logAuthenticationEvent(AuditAction.USER_CREATED, true, {
      userId: savedUser.id,
      email: savedUser.email,
      role: savedUser.role,
      ipAddress,
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
          await this.auditService.logAuthenticationEvent('ACCOUNT_LOCKED', false, {
            userId: user.id,
            reason: 'Too many failed login attempts',
            ipAddress,
          });
        }

        await this.userRepository.save(user);
      }

      await this.auditService.logAuthenticationEvent('LOGIN_FAILED', false, {
        email,
        reason: 'Invalid credentials',
        ipAddress,
      });

      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.auditService.logAuthenticationEvent('LOGIN_FAILED', false, {
        userId: user.id,
        reason: 'Account is locked',
        ipAddress,
      });
      throw new UnauthorizedException('Account is locked. Try again later');
    }

    // Check if user is active
    if (!user.isActive) {
      await this.auditService.logAuthenticationEvent('LOGIN_FAILED', false, {
        userId: user.id,
        reason: 'User account is inactive',
        ipAddress,
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

    // Check if MFA is enabled
    const mfaEnabled = await this.mfaService.isMfaEnabled(user.id);

    // If healthcare staff and MFA not enabled, require it
    if (user.role !== UserRole.PATIENT && !mfaEnabled) {
      await this.auditService.logAuthenticationEvent('LOGIN_FAILED', false, {
        userId: user.id,
        reason: 'MFA required but not enabled',
        ipAddress,
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

    await this.auditService.logAuthenticationEvent('LOGIN', true, {
      userId: user.id,
      email: user.email,
      ipAddress,
    });

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
      await this.auditService.logAuthenticationEvent('PASSWORD_CHANGE', false, {
        userId,
        reason: 'Invalid current password',
        ipAddress,
        severity: 'MEDIUM',
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

    await this.auditService.logAuthenticationEvent('PASSWORD_CHANGE', true, {
      userId,
      ipAddress,
    });
  }

  /**
   * Logout user
   */
  async logout(userId: string, sessionId: string, ipAddress: string): Promise<void> {
    if (sessionId) {
      await this.sessionManagementService.revokeSession(sessionId);
    }

    await this.auditService.logAuthenticationEvent('LOGOUT', true, {
      userId,
      sessionId,
      ipAddress,
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
   * Generate session ID
   */
  private generateSessionId(): string {
    return (
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
  }
}
