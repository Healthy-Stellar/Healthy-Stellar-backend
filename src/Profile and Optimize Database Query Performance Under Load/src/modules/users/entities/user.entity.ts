import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from "typeorm";
import { Record } from "../../records/entities/record.entity";
import { AuditLog } from "../../audit-log/entities/audit-log.entity";

/**
 * User Entity
 *
 * Indexed on email for quick lookups
 * Eager loading disabled to prevent cascading N+1 issues
 */
@Entity("users")
@Index(["email"], { name: "idx_users_email", unique: true })
@Index(["status"], { name: "idx_users_status" })
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255, unique: true })
  email: string;

  @Column({ type: "varchar", length: 100 })
  firstName: string;

  @Column({ type: "varchar", length: 100 })
  lastName: string;

  @Column({ type: "varchar", length: 50, default: "active" })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations - lazy loaded to prevent cascading N+1 queries
  @OneToMany(() => Record, (record) => record.owner)
  records: Record[];

  @OneToMany(() => AuditLog, (log) => log.user)
  auditLogs: AuditLog[];
}
