import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { ProvisioningLog } from "./provisioning-log.entity";

export enum TenantStatus {
  PENDING = "PENDING",
  PROVISIONING = "PROVISIONING",
  ACTIVE = "ACTIVE",
  FAILED = "FAILED",
  ARCHIVED = "ARCHIVED",
}

@Entity("tenants", { schema: "public" })
export class Tenant {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true, length: 255 })
  name: string;

  @Column({ unique: true, length: 255 })
  schemaName: string;

  @Column({
    type: "enum",
    enum: TenantStatus,
    default: TenantStatus.PENDING,
  })
  status: TenantStatus;

  @Column({ nullable: true })
  adminEmail: string;

  @Column({ nullable: true })
  adminFirstName: string;

  @Column({ nullable: true })
  adminLastName: string;

  @Column({ nullable: true })
  sorobanContractId: string;

  @Column({ nullable: true, length: 500 })
  provisioningError: string;

  @OneToMany(() => ProvisioningLog, (log) => log.tenant, { cascade: true })
  provisioningLogs: ProvisioningLog[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  archivedAt: Date;
}
