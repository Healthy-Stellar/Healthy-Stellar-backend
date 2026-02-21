import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { AuditLog } from "../../audit-log/entities/audit-log.entity";

/**
 * Record Entity
 *
 * Performance optimization applied:
 * - Indexed on ownerId for fast user-specific queries
 * - Composite index on (status, createdAt) for filtered list queries
 * - Index on status column for quick status filtering
 * - Relation eager loading or lazy loading based on usage pattern
 */
@Entity("records")
@Index(["ownerId"], { name: "idx_records_owner_id" })
@Index(["status"], { name: "idx_records_status" })
@Index(["status", "createdAt"], {
  name: "idx_records_status_created",
  order: { createdAt: "DESC" },
})
@Index(["createdAt"], { name: "idx_records_created_at", order: "DESC" })
export class Record {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  ownerId: string;

  @Column({ type: "varchar", length: 255 })
  title: string;

  @Column({ type: "text" })
  description: string;

  @Column({ type: "varchar", length: 50, default: "active" })
  status: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  category: string;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, any>;

  @Column({ type: "integer", default: 0 })
  viewCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationship - lazy loaded to prevent unnecessary N+1 on list queries
  @ManyToOne(() => User, (user) => user.records)
  @JoinColumn({ name: "ownerId" })
  owner: User;
}
