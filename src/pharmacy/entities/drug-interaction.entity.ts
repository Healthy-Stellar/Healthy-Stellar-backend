import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Drug } from './drug.entity';

@Entity('drug_interactions')
export class DrugInteraction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Drug, (drug) => drug.interactions1)
  @JoinColumn({ name: 'drug1_id' })
  drug1: Drug;

  @Column()
  drug1Id: string;

  @ManyToOne(() => Drug, (drug) => drug.interactions2)
  @JoinColumn({ name: 'drug2_id' })
  drug2: Drug;

  @Column()
  drug2Id: string;

  @Column({ type: 'enum', enum: ['minor', 'moderate', 'major', 'contraindicated'] })
  severity: string;

  @Column('text')
  description: string;

  @Column('text')
  clinicalEffects: string;

  @Column('text', { nullable: true })
  management: string;

  @Column({ nullable: true })
  mechanism: string;

  @Column({
    type: 'enum',
    enum: ['A', 'B', 'C', 'D'],
    nullable: true,
    comment: 'A=excellent, B=good, C=fair, D=poor',
  })
  evidenceLevel: string;

  @CreateDateColumn()
  createdAt: Date;
}
