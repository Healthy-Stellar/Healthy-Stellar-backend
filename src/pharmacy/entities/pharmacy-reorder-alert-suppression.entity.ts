import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';


/**
 * Stores suppression state so we don't spam the manager with repeated reorder alerts
 * for the same drug while stock remains below threshold.
 */
@Entity('pharmacy_reorder_alert_suppressions')
@Index(['drugId'], { unique: true })
export class PharmacyReorderAlertSuppression {
    @PrimaryGeneratedColumn('uuid')

    id: string;

    @Column({ type: 'uuid' })
    drugId: string;

    /**
     * Last time we emitted an alert while the drug was below threshold.
     */
    @Column({ type: 'timestamp', nullable: true })
    lastAlertedAt: Date | null;

    /**
     * When true, alerts are suppressed until the drug is replenished above threshold.
     */
    @Column({ default: true })
    isSuppressed: boolean;

    @CreateDateColumn()
    createdAt: Date;
}

