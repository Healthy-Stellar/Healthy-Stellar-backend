import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";

/**
 * Audit Log Entity
 *
 * Performance considerations:
 * - Indexed on userId and createdAt for fast filtering
 * - Composite index on (userId, createdAt) for sorted queries
 * - Eager loading of user relationship to prevent N+1 query issues
 */
@Entity("audit_logs")
@Index(["userId"], { name: "idx_audit_logs_user_id" })
@Index(["createdAt"], { name: "idx_audit_logs_created_at", order: "DESC" })
@Index(["userId", "createdAt"], { name: "idx_audit_logs_user_created" })
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  userId: string;

  @Column({ type: "varchar", length: 100 })
  action: string;

  @Column({ type: "varchar", length: 255 })
  resourceType: string;

  @Column({ type: "uuid", nullable: true })
  resourceId: string;

  @Column({ type: "jsonb", nullable: true })
  details: Record<string, any>;

  @Column({ type: "varchar", length: 50, nullable: true })
  ipAddress: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationship - eager loaded to prevent N+1 queries
  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: "userId" })
  user: User;
}
