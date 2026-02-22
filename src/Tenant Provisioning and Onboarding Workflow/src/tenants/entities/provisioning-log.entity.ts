import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Tenant } from "./tenant.entity";

export enum ProvisioningStep {
  CREATE_TENANT_RECORD = "CREATE_TENANT_RECORD",
  CREATE_SCHEMA = "CREATE_SCHEMA",
  RUN_MIGRATIONS = "RUN_MIGRATIONS",
  SEED_ROLES_AND_USER = "SEED_ROLES_AND_USER",
  DEPLOY_SOROBAN_CONTRACT = "DEPLOY_SOROBAN_CONTRACT",
  STORE_CONTRACT_ADDRESS = "STORE_CONTRACT_ADDRESS",
  SEND_WELCOME_EMAIL = "SEND_WELCOME_EMAIL",
}

export enum ProvisioningStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  ROLLED_BACK = "ROLLED_BACK",
}

@Entity("provisioning_logs")
export class ProvisioningLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    type: "enum",
    enum: ProvisioningStep,
  })
  step: ProvisioningStep;

  @Column({
    type: "enum",
    enum: ProvisioningStatus,
    default: ProvisioningStatus.PENDING,
  })
  status: ProvisioningStatus;

  @Column({ nullable: true, type: "text" })
  result: string;

  @Column({ nullable: true, type: "text" })
  error: string;

  @Column({ nullable: true, type: "integer" })
  durationMs: number;

  @ManyToOne(() => Tenant, (tenant) => tenant.provisioningLogs, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "tenantId" })
  tenant: Tenant;

  @Column()
  tenantId: string;

  @CreateDateColumn()
  createdAt: Date;
}
