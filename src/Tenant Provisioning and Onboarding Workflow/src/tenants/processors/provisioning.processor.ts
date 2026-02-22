import { Process, Processor } from "@nestjs/bull";
import { Job } from "bull";
import { Logger } from "@nestjs/common";
import { ProvisioningService } from "./provisioning.service";

export interface ProvisioningJobData {
  tenantName: string;
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
  jobId?: string;
}

@Processor("provisioning")
export class ProvisioningProcessor {
  private readonly logger = new Logger(ProvisioningProcessor.name);

  constructor(private provisioningService: ProvisioningService) {}

  @Process()
  async handleProvisioning(job: Job<ProvisioningJobData>) {
    this.logger.log(
      `Processing provisioning job ${job.id} for tenant: ${job.data.tenantName}`,
    );

    try {
      // Update job progress
      await job.progress(10);

      // Run the provisioning
      const tenant = await this.provisioningService.provisionTenant({
        name: job.data.tenantName,
        adminEmail: job.data.adminEmail,
        adminFirstName: job.data.adminFirstName,
        adminLastName: job.data.adminLastName,
      });

      await job.progress(100);
      this.logger.log(`Provisioning job ${job.id} completed successfully`);

      return {
        success: true,
        tenantId: tenant.id,
        message: `Tenant ${job.data.tenantName} provisioned successfully`,
      };
    } catch (error) {
      this.logger.error(
        `Provisioning job ${job.id} failed: ${error.message}`,
        error.stack,
      );

      // Don't retry by default - we want to inspect the error
      throw error;
    }
  }
}
