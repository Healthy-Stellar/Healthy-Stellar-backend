import { Injectable, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as argon2 from 'argon2';

/**
 * HIPAA-compliant password policies for healthcare systems
 * Reference: HIPAA Security Rule § 164.312(a)(2)(i)
 */
export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
  maxConsecutiveIdentical: number;
  maxRepeatedCharacters: number;
  expirationDays: number;
  historyCount: number;
  lockoutThreshold: number;
  lockoutDurationMinutes: number;
}

@Injectable()
export class PasswordValidationService {
  private readonly healthcarePolicy: PasswordPolicy = {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: true,
    maxConsecutiveIdentical: 2,
    maxRepeatedCharacters: 3,
    expirationDays: 90, // HIPAA requirement
    historyCount: 12, // Cannot reuse last 12 passwords
    lockoutThreshold: 5,
    lockoutDurationMinutes: 30,
  };

  /**
   * Validate password against healthcare security standards
   */
  validatePassword(password: string, userId?: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < this.healthcarePolicy.minLength) {
      errors.push(`Password must be at least ${this.healthcarePolicy.minLength} characters long`);
    }

    if (this.healthcarePolicy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (this.healthcarePolicy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (this.healthcarePolicy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (
      this.healthcarePolicy.requireSymbols &&
      !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    ) {
      errors.push('Password must contain at least one special character (!@#$%^&*)');
    }

    if (this.containsConsecutiveIdentical(password)) {
      errors.push(
        `Password cannot contain more than ${this.healthcarePolicy.maxConsecutiveIdentical} consecutive identical characters`,
      );
    }

    if (this.containsTooManyRepeatedCharacters(password)) {
      errors.push(
        `Password cannot contain more than ${this.healthcarePolicy.maxRepeatedCharacters} of the same character`,
      );
    }

    // Check against common patterns
    if (this.containsCommonPatterns(password)) {
      errors.push('Password contains common or predictable patterns');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Hash password using Argon2 (more secure than bcrypt for healthcare)
   */
  async hashPassword(password: string): Promise<string> {
    try {
      // Argon2 with high time cost for healthcare compliance
      return await argon2.hash(password, {
        timeCost: 3,
        memoryCost: 65536, // 64MB
        parallelism: 4,
        type: argon2.argon2id,
      });
    } catch (error) {
      throw new BadRequestException('Password hashing failed');
    }
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if password contains consecutive identical characters
   */
  private containsConsecutiveIdentical(password: string): boolean {
    const threshold = this.healthcarePolicy.maxConsecutiveIdentical + 1;
    const pattern = new RegExp(`(.)\\1{${threshold - 1},}`);
    return pattern.test(password);
  }

  /**
   * Check if password contains too many of same character
   */
  private containsTooManyRepeatedCharacters(password: string): boolean {
    const charCounts: Record<string, number> = {};
    for (const char of password.toLowerCase()) {
      charCounts[char] = (charCounts[char] || 0) + 1;
    }

    return Object.values(charCounts).some(
      (count) => count > this.healthcarePolicy.maxRepeatedCharacters,
    );
  }

  /**
   * Check against common patterns and dictionary words
   */
  private containsCommonPatterns(password: string): boolean {
    const commonPatterns = [
      'password',
      'admin',
      'user',
      'test',
      '123456',
      'qwerty',
      'abc123',
      'letmein',
      'welcome',
      'monkey',
      '1qaz2wsx',
    ];

    const lowerPassword = password.toLowerCase();
    return commonPatterns.some((pattern) => lowerPassword.includes(pattern));
  }

  /**
   * Get password policy details
   */
  getPolicy(): PasswordPolicy {
    return { ...this.healthcarePolicy };
  }

  /**
   * Check if password has expired
   */
  isPasswordExpired(lastPasswordChangeAt: Date): boolean {
    const expirationTime = this.healthcarePolicy.expirationDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const passwordAge = now - lastPasswordChangeAt.getTime();
    return passwordAge > expirationTime;
  }
}
