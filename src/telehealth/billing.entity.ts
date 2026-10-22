import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

/**
 * Coerces a TypeORM `decimal`/`numeric` column value to a number.
 *
 * The Postgres driver returns `decimal`/`numeric` columns as JavaScript
 * strings by default (to avoid float precision loss). Performing arithmetic
 * directly on those strings causes string concatenation instead of numeric
 * addition, silently corrupting balances. This transformer normalizes the
 * value to a number on read and back to a string on write.
 */
const decimalTransformer = {
  to(value: number | string | null | undefined): string | null | undefined {
    if (value === null || value === undefined) {
      return value;
    }
    return String(value);
  },
  from(value: string | number | null | undefined): number | null | undefined {
    if (value === null || value === undefined) {
      return value;
    }
    return typeof value === 'number' ? value : parseFloat(value);
  },
};

@Entity('telehealth_billing')
export class TelehealthBilling {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  patientId: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  providerId?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, transformer: decimalTransformer })
  totalAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, transformer: decimalTransformer })
  amountPaid: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, transformer: decimalTransformer })
  balanceDue: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
