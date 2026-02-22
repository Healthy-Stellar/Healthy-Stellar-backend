import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  HttpStatus,
  HttpCode,
  Logger,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { Queue } from "bull";
import { InjectQueue } from "@nestjs/bull";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import {
  CreateTenantDto,
  ProvisioningStatusDto,
  TenantResponseDto,
} from "../dto/tenant.dto";
import { Tenant } from "../entities/tenant.entity";
import { ProvisioningService } from "../services/provisioning.service";
import { ProvisioningJobData } from "../processors/provisioning.processor";

@Controller("admin/tenants")
export class TenantsController {
  private readonly logger = new Logger(TenantsController.name);

  constructor(
    @InjectQueue("provisioning")
    private provisioningQueue: Queue<ProvisioningJobData>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    private provisioningService: ProvisioningService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async createTenant(@Body() createTenantDto: CreateTenantDto) {
    this.logger.log(
      `Received request to provision tenant: ${createTenantDto.name}`,
    );

    try {
      // Validate that schema name can be generated
      const schemaName = this.generateSchemaName(createTenantDto.name);
      if (!this.isValidSchemaName(schemaName)) {
        throw new BadRequestException(
          `Invalid tenant name: ${createTenantDto.name}`,
        );
      }

      // Queue the provisioning job
      const job = await this.provisioningQueue.add(
        {
          tenantName: createTenantDto.name,
          adminEmail: createTenantDto.adminEmail,
          adminFirstName: createTenantDto.adminFirstName,
          adminLastName: createTenantDto.adminLastName,
        } as ProvisioningJobData,
        {
          attempts: 1, // No automatic retries
          backoff: {
            type: "exponential",
            delay: 5000,
          },
          removeOnComplete: false, // Keep job history
          removeOnFail: false,
        },
      );

      this.logger.log(`Provisioning job queued with ID: ${job.id}`);

      return {
        jobId: job.id,
        status: "queued",
        message: `Tenant provisioning for ${createTenantDto.name} has been queued`,
      };
    } catch (error) {
      this.logger.error(`Failed to queue provisioning job: ${error.message}`);
      throw error;
    }
  }

  @Get(":id/provisioning-status")
  async getProvisioningStatus(
    @Param("id") tenantId: string,
  ): Promise<ProvisioningStatusDto> {
    this.logger.log(`Retrieving provisioning status for tenant: ${tenantId}`);

    try {
      const status =
        await this.provisioningService.getProvisioningStatus(tenantId);

      if (!status) {
        throw new NotFoundException(`Tenant not found: ${tenantId}`);
      }

      return status;
    } catch (error) {
      this.logger.error(`Failed to get provisioning status: ${error.message}`);
      throw error;
    }
  }

  @Get(":id")
  async getTenant(@Param("id") tenantId: string): Promise<TenantResponseDto> {
    this.logger.log(`Retrieving tenant: ${tenantId}`);

    try {
      const tenant = await this.tenantRepository.findOne({
        where: { id: tenantId },
      });

      if (!tenant) {
        throw new NotFoundException(`Tenant not found: ${tenantId}`);
      }

      return {
        id: tenant.id,
        name: tenant.name,
        schemaName: tenant.schemaName,
        status: tenant.status,
        adminEmail: tenant.adminEmail,
        sorobanContractId: tenant.sorobanContractId,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
      };
    } catch (error) {
      this.logger.error(`Failed to get tenant: ${error.message}`);
      throw error;
    }
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  async deleteTenant(@Param("id") tenantId: string) {
    this.logger.log(`Received request to deprovision tenant: ${tenantId}`);

    try {
      await this.provisioningService.deprovisionTenant(tenantId);

      return {
        status: "archived",
        message: `Tenant ${tenantId} has been archived`,
      };
    } catch (error) {
      this.logger.error(`Failed to deprovision tenant: ${error.message}`);
      throw error;
    }
  }

  @Get()
  async listTenants() {
    this.logger.log("Listing all tenants");

    try {
      const tenants = await this.tenantRepository.find({
        order: { createdAt: "DESC" },
      });

      return {
        total: tenants.length,
        tenants: tenants.map((tenant) => ({
          id: tenant.id,
          name: tenant.name,
          status: tenant.status,
          adminEmail: tenant.adminEmail,
          createdAt: tenant.createdAt,
        })),
      };
    } catch (error) {
      this.logger.error(`Failed to list tenants: ${error.message}`);
      throw error;
    }
  }

  private generateSchemaName(tenantName: string): string {
    let schemaName = tenantName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

    if (!schemaName || !/^[a-z]/.test(schemaName)) {
      schemaName = `tenant_${schemaName}`;
    }

    return `${schemaName}_${Date.now()}`;
  }

  private isValidSchemaName(name: string): boolean {
    return /^[a-z_][a-z0-9_]*$/.test(name);
  }
}
