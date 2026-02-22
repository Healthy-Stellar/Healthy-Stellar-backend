import { Injectable, Logger } from "@nestjs/common";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { Tenant, TenantStatus } from "../entities/tenant.entity";
import {
  ProvisioningLog,
  ProvisioningStep,
  ProvisioningStatus,
} from "../entities/provisioning-log.entity";
import { DatabaseService } from "./database.service";
import { SorobanService } from "./soroban.service";
import { EmailService } from "./email.service";
import * as crypto from "crypto";

@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name);

  constructor(
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    @InjectRepository(ProvisioningLog)
    private provisioningLogRepository: Repository<ProvisioningLog>,
    private databaseService: DatabaseService,
    private sorobanService: SorobanService,
    private emailService: EmailService,
  ) {}

  async provisionTenant(tenantData: {
    name: string;
    adminEmail: string;
    adminFirstName: string;
    adminLastName: string;
  }): Promise<Tenant> {
    const schemaName = this.generateSchemaName(tenantData.name);
    this.logger.log(`Starting tenant provisioning for: ${tenantData.name}`);

    let tenant: Tenant;
    try {
      // Step 1: Create Tenant Record
      await this.logStep(
        null,
        ProvisioningStep.CREATE_TENANT_RECORD,
        ProvisioningStatus.IN_PROGRESS,
      );
      tenant = this.tenantRepository.create({
        name: tenantData.name,
        schemaName,
        status: TenantStatus.PROVISIONING,
        adminEmail: tenantData.adminEmail,
        adminFirstName: tenantData.adminFirstName,
        adminLastName: tenantData.adminLastName,
      });
      tenant = await this.tenantRepository.save(tenant);
      await this.logStep(
        tenant.id,
        ProvisioningStep.CREATE_TENANT_RECORD,
        ProvisioningStatus.COMPLETED,
      );
      this.logger.log(`Tenant record created with ID: ${tenant.id}`);

      // Step 2: Create PostgreSQL Schema
      await this.logStep(
        tenant.id,
        ProvisioningStep.CREATE_SCHEMA,
        ProvisioningStatus.IN_PROGRESS,
      );
      await this.databaseService.createTenantSchema(schemaName);
      await this.logStep(
        tenant.id,
        ProvisioningStep.CREATE_SCHEMA,
        ProvisioningStatus.COMPLETED,
      );
      this.logger.log(`Schema created: ${schemaName}`);

      // Step 3: Run Migrations
      await this.logStep(
        tenant.id,
        ProvisioningStep.RUN_MIGRATIONS,
        ProvisioningStatus.IN_PROGRESS,
      );
      await this.databaseService.runTenantMigrations(schemaName);
      await this.logStep(
        tenant.id,
        ProvisioningStep.RUN_MIGRATIONS,
        ProvisioningStatus.COMPLETED,
      );
      this.logger.log(`Migrations completed for schema: ${schemaName}`);

      // Step 4: Seed Roles and Create Admin User
      await this.logStep(
        tenant.id,
        ProvisioningStep.SEED_ROLES_AND_USER,
        ProvisioningStatus.IN_PROGRESS,
      );
      await this.databaseService.seedTenantData(tenant.id, schemaName);
      const hashedPassword = this.hashPassword("DefaultPassword123!"); // Admin should change this
      const adminUserId = await this.databaseService.createAdminUser(
        schemaName,
        tenantData.adminEmail,
        tenantData.adminFirstName,
        tenantData.adminLastName,
        hashedPassword,
      );
      await this.logStep(
        tenant.id,
        ProvisioningStep.SEED_ROLES_AND_USER,
        ProvisioningStatus.COMPLETED,
        JSON.stringify({ adminUserId }),
      );
      this.logger.log(`Roles and admin user created for schema: ${schemaName}`);

      // Step 5: Deploy Soroban Contract
      await this.logStep(
        tenant.id,
        ProvisioningStep.DEPLOY_SOROBAN_CONTRACT,
        ProvisioningStatus.IN_PROGRESS,
      );
      const contractId = await this.sorobanService.deployTenantContract(
        tenant.id,
        tenantData.name,
      );
      await this.logStep(
        tenant.id,
        ProvisioningStep.DEPLOY_SOROBAN_CONTRACT,
        ProvisioningStatus.COMPLETED,
        contractId,
      );
      this.logger.log(`Soroban contract deployed: ${contractId}`);

      // Step 6: Store Contract Address
      await this.logStep(
        tenant.id,
        ProvisioningStep.STORE_CONTRACT_ADDRESS,
        ProvisioningStatus.IN_PROGRESS,
      );
      tenant.sorobanContractId = contractId;
      tenant = await this.tenantRepository.save(tenant);
      await this.logStep(
        tenant.id,
        ProvisioningStep.STORE_CONTRACT_ADDRESS,
        ProvisioningStatus.COMPLETED,
      );
      this.logger.log(`Contract address stored for tenant: ${tenant.id}`);

      // Step 7: Send Welcome Email
      await this.logStep(
        tenant.id,
        ProvisioningStep.SEND_WELCOME_EMAIL,
        ProvisioningStatus.IN_PROGRESS,
      );
      const tenantUrl = `${process.env.APP_URL}/tenant/${tenant.id}`;
      await this.emailService.sendWelcomeEmail(
        tenantData.name,
        tenantData.adminEmail,
        tenantData.adminFirstName,
        tenantUrl,
      );
      await this.logStep(
        tenant.id,
        ProvisioningStep.SEND_WELCOME_EMAIL,
        ProvisioningStatus.COMPLETED,
      );
      this.logger.log(`Welcome email sent to: ${tenantData.adminEmail}`);

      // Update tenant to ACTIVE
      tenant.status = TenantStatus.ACTIVE;
      tenant = await this.tenantRepository.save(tenant);
      this.logger.log(
        `Tenant provisioning completed successfully: ${tenant.id}`,
      );

      return tenant;
    } catch (error) {
      this.logger.error(`Tenant provisioning failed: ${error.message}`);
      await this.handleProvisioningError(tenant?.id, schemaName, error);
      throw error;
    }
  }

  private async handleProvisioningError(
    tenantId: string | null,
    schemaName: string,
    error: Error,
  ): Promise<void> {
    try {
      if (tenantId) {
        const tenant = await this.tenantRepository.findOne({
          where: { id: tenantId },
        });
        if (tenant) {
          tenant.status = TenantStatus.FAILED;
          tenant.provisioningError = error.message.substring(0, 500);
          await this.tenantRepository.save(tenant);

          // Send error email
          try {
            await this.emailService.sendProvisioningErrorEmail(
              tenant.adminEmail,
              tenant.name,
              error.message,
            );
          } catch (emailError) {
            this.logger.error(
              `Failed to send error email: ${emailError.message}`,
            );
          }
        }
      }

      // Attempt to rollback schema
      if (schemaName) {
        try {
          await this.databaseService.dropTenantSchema(schemaName);
          if (tenantId) {
            await this.logStep(
              tenantId,
              ProvisioningStep.CREATE_TENANT_RECORD,
              ProvisioningStatus.ROLLED_BACK,
              "Schema rolled back",
            );
          }
        } catch (rollbackError) {
          this.logger.error(
            `Failed to rollback schema ${schemaName}: ${rollbackError.message}`,
          );
        }
      }
    } catch (handlerError) {
      this.logger.error(`Error in error handler: ${handlerError.message}`);
    }
  }

  private async logStep(
    tenantId: string | null,
    step: ProvisioningStep,
    status: ProvisioningStatus,
    result?: string,
    error?: string,
  ): Promise<void> {
    try {
      if (!tenantId) return;

      const log = this.provisioningLogRepository.create({
        tenantId,
        step,
        status,
        result,
        error,
        durationMs: 0,
      });

      await this.provisioningLogRepository.save(log);
    } catch (err) {
      this.logger.error(`Failed to log provisioning step: ${err.message}`);
    }
  }

  async getProvisioningStatus(tenantId: string) {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
      relations: ["provisioningLogs"],
    });

    if (!tenant) {
      return null;
    }

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      overallStatus: tenant.status,
      logs: tenant.provisioningLogs || [],
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
      completedAt:
        tenant.status === TenantStatus.ACTIVE ||
        tenant.status === TenantStatus.FAILED
          ? tenant.updatedAt
          : null,
    };
  }

  async deprovisionTenant(tenantId: string): Promise<void> {
    this.logger.log(`Starting tenant deprovisioning for: ${tenantId}`);

    try {
      const tenant = await this.tenantRepository.findOne({
        where: { id: tenantId },
      });

      if (!tenant) {
        throw new Error(`Tenant not found: ${tenantId}`);
      }

      // Archive the schema (soft delete - don't actually drop it)
      tenant.status = TenantStatus.ARCHIVED;
      tenant.archivedAt = new Date();
      await this.tenantRepository.save(tenant);

      this.logger.log(`Tenant archived successfully: ${tenantId}`);
    } catch (error) {
      this.logger.error(
        `Failed to deprovision tenant ${tenantId}: ${error.message}`,
      );
      throw error;
    }
  }

  private generateSchemaName(tenantName: string): string {
    // Convert tenant name to valid PostgreSQL schema name
    // Rules: starts with letter, contains only alphanumeric and underscores, lowercase
    let schemaName = tenantName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

    if (!schemaName || !/^[a-z]/.test(schemaName)) {
      schemaName = `tenant_${schemaName}`;
    }

    // Ensure uniqueness
    return `${schemaName}_${Date.now()}`;
  }

  private hashPassword(password: string): string {
    return crypto.createHash("sha256").update(password).digest("hex");
  }
}
