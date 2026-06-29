import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';

export enum InstrumentStatus {
  AVAILABLE = 'available',
  IN_USE = 'in-use',
  STERILISING = 'sterilising',
  RETIRED = 'retired',
}

@Entity('surgical_instruments')
@Index(['status'])
@Index(['barcode'], { unique: true })
export class SurgicalInstrument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  barcode: string;

  @Column({ type: 'enum', enum: InstrumentStatus, default: InstrumentStatus.AVAILABLE })
  status: InstrumentStatus;

  @Column('timestamp', { nullable: true })
  sterileUntil: Date | null;

  @Column('text', { nullable: true })
  notes: string;

  @OneToMany(() => InstrumentSetItem, (item) => item.instrument)
  setItems: InstrumentSetItem[];

  @OneToMany(() => SterilisationRecord, (r) => r.instrument)
  sterilisationRecords: SterilisationRecord[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('instrument_sets')
@Index(['surgicalCaseId'])
export class InstrumentSet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  surgicalCaseId: string;

  @Column('int', { nullable: true })
  preOpCount: number | null;

  @Column('int', { nullable: true })
  postOpCount: number | null;

  @Column({ default: false })
  countVerified: boolean;

  @Column({ default: false })
  countMismatchAlert: boolean;

  @Column('text', { nullable: true })
  mismatchNotes: string;

  @Column({ nullable: true })
  verifiedByNurseId: string;

  @OneToMany(() => InstrumentSetItem, (item) => item.instrumentSet)
  items: InstrumentSetItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('instrument_set_items')
export class InstrumentSetItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  instrumentSetId: string;

  @ManyToOne(() => InstrumentSet, (set) => set.items)
  @JoinColumn({ name: 'instrumentSetId' })
  instrumentSet: InstrumentSet;

  @Column()
  instrumentId: string;

  @ManyToOne(() => SurgicalInstrument, (instr) => instr.setItems)
  @JoinColumn({ name: 'instrumentId' })
  instrument: SurgicalInstrument;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('sterilisation_records')
@Index(['instrumentId'])
export class SterilisationRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  instrumentId: string;

  @ManyToOne(() => SurgicalInstrument, (instr) => instr.sterilisationRecords)
  @JoinColumn({ name: 'instrumentId' })
  instrument: SurgicalInstrument;

  @Column('timestamp')
  sterilisedAt: Date;

  @Column('timestamp')
  expiresAt: Date;

  @Column({ nullable: true })
  performedById: string;

  @Column({ nullable: true })
  method: string;

  @Column('text', { nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;
}
