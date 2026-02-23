/**
 * Tenant Configuration System - Usage Examples
 * 
 * This file demonstrates various ways to use the tenant configuration system
 * in your NestJS services and controllers.
 */

import { Injectable, Controller, Get, UseGuards, Param } from '@nestjs/common';
import { TenantConfigService } from '../services/tenant-config.service';
import { RequireFeature } from '../decorators/require-feature.decorator';
import { FeatureFlagGuard } from '../guards/feature-flag.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SUPPORTED_CONFIG_KEYS } from '../constants/config-keys.constant';

// ============================================================================
// Example 1: Basic Configuration Access in a Service
// ============================================================================

@Injectable()
export class MedicalRecordService {
  constructor(private readonly tenantConfigService: TenantConfigService) {}

  async uploadMedicalRecord(tenantId: string, file: Express.Multer.File) {
    // Get the maximum allowed file size for this tenant
    const maxSizeMB = await this.tenantConfigService.get<number>(
      tenantId,
      SUPPORTED_CONFIG_KEYS.MAX_RECORD_SIZE_MB,
    );

    const fileSizeMB = file.size / (1024 * 1024);

    if (fileSizeMB > maxSizeMB) {
      throw new Error(
        `File size ${fileSizeMB.toFixed(2)}MB exceeds maximum allowed size of ${maxSizeMB}MB`,
      );
    }

    // Get allowed record types
    const allowedTypes = await this.tenantConfigService.get<string[]>(
      tenantId,
      SUPPORTED_CONFIG_KEYS.ALLOWED_RECORD_TYPES,
    );

    // Validate record type
    const recordType = file.mimetype;
    if (!allowedTypes.includes(recordType)) {
      throw new Error(`Record type ${recordType} is not allowed for this tenant`);
    }

    // Process upload...
    return { success: true, message: 'Record uploaded successfully' };
  }
}

// ============================================================================
// Example 2: Feature Flag Guard on Controller Endpoints
// ============================================================================

@Controller('fhir')
@UseGuards(JwtAuthGuard, FeatureFlagGuard)
export class FhirExportController {
  /**
   * This endpoint is only accessible if FHIR export is enabled for the tenant
   * The FeatureFlagGuard automatically checks the feature flag
   */
  @Get('export/:patientId')
  @RequireFeature(SUPPORTED_CONFIG_KEYS.FHIR_EXPORT_ENABLED)
  async exportPatientData(@Param('patientId') patientId: string) {
    // This code only runs if fhir_export_enabled is true
    return {
      message: 'Exporting patient data in FHIR format',
      patientId,
    };
  }

  /**
   * Multiple feature flags can be checked by using the guard multiple times
   * or by checking programmatically in the service
   */
  @Get('import/:patientId')
  @RequireFeature(SUPPORTED_CONFIG_KEYS.FHIR_EXPORT_ENABLED)
  async importPatientData(@Param('patientId') patientId: string) {
    return {
      message: 'Importing patient data from FHIR format',
      patientId,
    };
  }
}

// ============================================================================
// Example 3: Programmatic Feature Flag Checking
// ============================================================================

@Injectable()
export class EmergencyAccessService {
  constructor(private readonly tenantConfigService: TenantConfigService) {}

  async grantEmergencyAccess(
    tenantId: string,
    userId: string,
    patientId: string,
  ) {
    // Check if emergency access is enabled for this tenant
    const isEnabled = await this.tenantConfigService.isFeatureEnabled(
      tenantId,
      SUPPORTED_CONFIG_KEYS.EMERGENCY_ACCESS_ENABLED,
    );

    if (!isEnabled) {
      throw new Error('Emergency access is not enabled for your organization');
    }

    // Grant temporary access with audit logging
    console.log(`Granting emergency access to user ${userId} for patient ${patientId}`);
    
    return {
      granted: true,
      expiresIn: '1 hour',
      message: 'Emergency access granted',
    };
  }
}

// ============================================================================
// Example 4: Multiple Configuration Values
// ============================================================================

@Injectable()
export class AuditService {
  constructor(private readonly tenantConfigService: TenantConfigService) {}

  async getAuditSettings(tenantId: string) {
    // Get multiple configuration values at once
    const configs = await this.tenantConfigService.getMultiple(tenantId, [
      SUPPORTED_CONFIG_KEYS.AUDIT_RETENTION_DAYS,
      SUPPORTED_CONFIG_KEYS.MEDICAL_RECORD_RETENTION_DAYS,
      SUPPORTED_CONFIG_KEYS.BACKUP_RETENTION_DAYS,
    ]);

    return {
      auditRetentionDays: configs[SUPPORTED_CONFIG_KEYS.AUDIT_RETENTION_DAYS],
      medicalRecordRetentionDays: configs[SUPPORTED_CONFIG_KEYS.MEDICAL_RECORD_RETENTION_DAYS],
      backupRetentionDays: configs[SUPPORTED_CONFIG_KEYS.BACKUP_RETENTION_DAYS],
    };
  }

  async cleanupOldAuditLogs(tenantId: string) {
    const retentionDays = await this.tenantConfigService.get<number>(
      tenantId,
      SUPPORTED_CONFIG_KEYS.AUDIT_RETENTION_DAYS,
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    console.log(`Cleaning up audit logs older than ${cutoffDate.toISOString()}`);
    
    // Perform cleanup...
    return { deleted: 0, cutoffDate };
  }
}

// ============================================================================
// Example 5: Security Settings
// ============================================================================

@Injectable()
export class SessionManagementService {
  constructor(private readonly tenantConfigService: TenantConfigService) {}

  async createSession(tenantId: string, userId: string) {
    // Get session timeout from tenant config
    const timeoutMinutes = await this.tenantConfigService.get<number>(
      tenantId,
      SUPPORTED_CONFIG_KEYS.SESSION_TIMEOUT_MINUTES,
    );

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + timeoutMinutes);

    return {
      sessionId: 'session-id',
      userId,
      expiresAt,
      timeoutMinutes,
    };
  }

  async validateLoginAttempt(tenantId: string, failedAttempts: number) {
    const maxAttempts = await this.tenantConfigService.get<number>(
      tenantId,
      SUPPORTED_CONFIG_KEYS.MAX_LOGIN_ATTEMPTS,
    );

    if (failedAttempts >= maxAttempts) {
      throw new Error('Account locked due to too many failed login attempts');
    }

    return { remainingAttempts: maxAttempts - failedAttempts };
  }
}

// ============================================================================
// Example 6: Integration Feature Flags
// ============================================================================

@Injectable()
export class IntegrationService {
  constructor(private readonly tenantConfigService: TenantConfigService) {}

  async getEnabledIntegrations(tenantId: string) {
    const integrations = {
      hl7: await this.tenantConfigService.isFeatureEnabled(
        tenantId,
        SUPPORTED_CONFIG_KEYS.HL7_INTEGRATION_ENABLED,
      ),
      dicom: await this.tenantConfigService.isFeatureEnabled(
        tenantId,
        SUPPORTED_CONFIG_KEYS.DICOM_INTEGRATION_ENABLED,
      ),
      lab: await this.tenantConfigService.isFeatureEnabled(
        tenantId,
        SUPPORTED_CONFIG_KEYS.LAB_INTEGRATION_ENABLED,
      ),
      imaging: await this.tenantConfigService.isFeatureEnabled(
        tenantId,
        SUPPORTED_CONFIG_KEYS.IMAGING_INTEGRATION_ENABLED,
      ),
      billing: await this.tenantConfigService.isFeatureEnabled(
        tenantId,
        SUPPORTED_CONFIG_KEYS.BILLING_INTEGRATION_ENABLED,
      ),
    };

    return integrations;
  }

  async sendToHL7(tenantId: string, data: any) {
    const isEnabled = await this.tenantConfigService.isFeatureEnabled(
      tenantId,
      SUPPORTED_CONFIG_KEYS.HL7_INTEGRATION_ENABLED,
    );

    if (!isEnabled) {
      console.log('HL7 integration is disabled, skipping...');
      return { skipped: true };
    }

    // Send to HL7 system...
    return { sent: true };
  }
}

// ============================================================================
// Example 7: Conditional Feature Rendering
// ============================================================================

@Controller('features')
@UseGuards(JwtAuthGuard)
export class FeatureDiscoveryController {
  constructor(private readonly tenantConfigService: TenantConfigService) {}

  /**
   * Returns available features for the tenant
   * Frontend can use this to show/hide UI elements
   */
  @Get(':tenantId/available')
  async getAvailableFeatures(@Param('tenantId') tenantId: string) {
    const features = {
      telemedicine: await this.tenantConfigService.isFeatureEnabled(
        tenantId,
        SUPPORTED_CONFIG_KEYS.TELEMEDICINE_ENABLED,
      ),
      prescriptionManagement: await this.tenantConfigService.isFeatureEnabled(
        tenantId,
        SUPPORTED_CONFIG_KEYS.PRESCRIPTION_MANAGEMENT_ENABLED,
      ),
      labIntegration: await this.tenantConfigService.isFeatureEnabled(
        tenantId,
        SUPPORTED_CONFIG_KEYS.LAB_INTEGRATION_ENABLED,
      ),
      imagingIntegration: await this.tenantConfigService.isFeatureEnabled(
        tenantId,
        SUPPORTED_CONFIG_KEYS.IMAGING_INTEGRATION_ENABLED,
      ),
      fhirExport: await this.tenantConfigService.isFeatureEnabled(
        tenantId,
        SUPPORTED_CONFIG_KEYS.FHIR_EXPORT_ENABLED,
      ),
      emergencyAccess: await this.tenantConfigService.isFeatureEnabled(
        tenantId,
        SUPPORTED_CONFIG_KEYS.EMERGENCY_ACCESS_ENABLED,
      ),
    };

    return {
      tenantId,
      features,
      timestamp: new Date().toISOString(),
    };
  }
}

// ============================================================================
// Example 8: MFA Requirement Based on Tenant Config
// ============================================================================

@Injectable()
export class AuthenticationService {
  constructor(private readonly tenantConfigService: TenantConfigService) {}

  async login(tenantId: string, email: string, password: string) {
    // Validate credentials...
    const user = { id: 'user-id', email };

    // Check if MFA is required for this tenant
    const mfaRequired = await this.tenantConfigService.isFeatureEnabled(
      tenantId,
      SUPPORTED_CONFIG_KEYS.MFA_REQUIRED,
    );

    if (mfaRequired && !user['mfaEnabled']) {
      return {
        requiresMfaSetup: true,
        message: 'MFA is required for your organization. Please set up MFA.',
      };
    }

    if (mfaRequired && user['mfaEnabled']) {
      return {
        requiresMfaVerification: true,
        message: 'Please enter your MFA code',
      };
    }

    // Generate token...
    return {
      accessToken: 'jwt-token',
      user,
    };
  }
}

// ============================================================================
// Example 9: Dynamic Validation Based on Config
// ============================================================================

@Injectable()
export class DataValidationService {
  constructor(private readonly tenantConfigService: TenantConfigService) {}

  async validateMedicalRecord(tenantId: string, record: any) {
    // Get allowed record types for this tenant
    const allowedTypes = await this.tenantConfigService.get<string[]>(
      tenantId,
      SUPPORTED_CONFIG_KEYS.ALLOWED_RECORD_TYPES,
    );

    if (!allowedTypes.includes(record.type)) {
      throw new Error(
        `Record type "${record.type}" is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
      );
    }

    // Get max size
    const maxSizeMB = await this.tenantConfigService.get<number>(
      tenantId,
      SUPPORTED_CONFIG_KEYS.MAX_RECORD_SIZE_MB,
    );

    if (record.size > maxSizeMB * 1024 * 1024) {
      throw new Error(`Record size exceeds maximum of ${maxSizeMB}MB`);
    }

    return { valid: true };
  }
}

// ============================================================================
// Example 10: Scheduled Tasks with Tenant-Specific Config
// ============================================================================

@Injectable()
export class ScheduledTasksService {
  constructor(private readonly tenantConfigService: TenantConfigService) {}

  /**
   * Run cleanup tasks for all tenants based on their retention policies
   */
  async runCleanupTasks(tenantIds: string[]) {
    const results = [];

    for (const tenantId of tenantIds) {
      const retentionDays = await this.tenantConfigService.get<number>(
        tenantId,
        SUPPORTED_CONFIG_KEYS.AUDIT_RETENTION_DAYS,
      );

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      console.log(
        `Cleaning up data for tenant ${tenantId} older than ${cutoffDate.toISOString()}`,
      );

      // Perform cleanup...
      results.push({
        tenantId,
        retentionDays,
        cutoffDate,
        recordsDeleted: 0,
      });
    }

    return results;
  }
}
