import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
    Unique,
} from 'typeorm';
import { User } from './user.entity';

@Entity('provider_availability')
@Unique(['providerId'])
@Index('IDX_provider_availability_providerId', ['providerId'])
@Index('IDX_provider_availability_isAcceptingPatients', ['isAcceptingPatients'])
@Index('IDX_provider_availability_specializations', ['specializations'], { where: 'specializations IS NOT NULL' })
export class ProviderAvailability {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    providerId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'providerId' })
    provider: User;

    @Column({ type: 'boolean', default: true })
    isAcceptingPatients: boolean;

    @Column({ type: 'integer', default: 0 })
    maxPatients: number;

    @Column({ type: 'integer', default: 0 })
    currentPatients: number;

    @Column({ type: 'simple-array', nullable: true })
    specializations: string[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
