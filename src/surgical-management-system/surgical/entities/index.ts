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

export enum SurgeryType {
  ELECTIVE = 'ELECTIVE',
  EMERGENCY = 'EMERGENCY',
  URGENT = 'URGENT',
}

export enum CaseStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  DELAYED = 'DELAYED',
}

export enum RoomStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
  CLEANING = 'CLEANING',
  MAINTENANCE = 'MAINTENANCE',
}

export enum TeamRole {
  SURGEON = 'SURGEON',
  ANESTHESIOLOGIST = 'ANESTHESIOLOGIST',
  NURSE = 'NURSE',
  SURGICAL_TECH = 'SURGICAL_TECH',
  ASSISTANT = 'ASSISTANT',
}

export enum EquipmentStatus {
  AVAILABLE = 'AVAILABLE',
  IN_USE = 'IN_USE',
  STERILIZING = 'STERILIZING',
  MAINTENANCE = 'MAINTENANCE',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE',
}

@Entity('operating_rooms')
export class OperatingRoom {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  roomNumber: string;

  @Column()
  roomName: string;

  @Column({
    type: 'enum',
    enum: RoomStatus,
    default: RoomStatus.AVAILABLE,
  })
  status: RoomStatus;

  @Column('simple-array', { nullable: true })
  capabilities: string[]; // e.g., ['cardiac', 'neurosurgery', 'orthopedic']

  @Column('simple-json', { nullable: true })
  equipment: Record<string, any>;

  @Column('int', { default: 0 })
  capacity: number;

  @Column({ default: true })
  isActive: boolean;

  @Column('text', { nullable: true })
  notes: string;

  @OneToMany(() => RoomBooking, (booking) => booking.operatingRoom)
  bookings: RoomBooking[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('surgical_cases')
@Index(['scheduledDate', 'status'])
@Index(['patientId'])
export class SurgicalCase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  patientId: string;

  @Column()
  patientName: string;

  @Column()
  procedureName: string;

  @Column('text', { nullable: true })
  procedureDescription: string;

  @Column({
    type: 'enum',
    enum: SurgeryType,
    default: SurgeryType.ELECTIVE,
  })
  surgeryType: SurgeryType;

  @Column({
    type: 'enum',
    enum: CaseStatus,
    default: CaseStatus.SCHEDULED,
  })
  status: CaseStatus;

  @Column('timestamp')
  scheduledDate: Date;

  @Column('int')
  estimatedDuration: number; // in minutes

  @Column('timestamp', { nullable: true })
  actualStartTime: Date;

  @Column('timestamp', { nullable: true })
  actualEndTime: Date;

  @Column('int', { nullable: true })
  actualDuration: number;

  @Column({ nullable: true })
  operatingRoomId: string;

  @ManyToOne(() => OperatingRoom, { nullable: true })
  @JoinColumn({ name: 'operatingRoomId' })
  operatingRoom: OperatingRoom;

  @Column({ nullable: true })
  primarySurgeonId: string;

  @Column('text', { nullable: true })
  preOpNotes: string;

  @Column('text', { nullable: true })
  specialRequirements: string;

  @Column('simple-array', { nullable: true })
  requiredEquipment: string[];

  @OneToMany(() => SurgicalTeamMember, (member) => member.surgicalCase)
  teamMembers: SurgicalTeamMember[];

  @OneToMany(() => OperativeNote, (note) => note.surgicalCase)
  operativeNotes: OperativeNote[];

  @OneToMany(() => SurgicalOutcome, (outcome) => outcome.surgicalCase)
  outcomes: SurgicalOutcome[];

  @OneToMany(() => SurgicalChecklist, (checklist) => checklist.surgicalCase)
  checklists: SurgicalChecklist[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('room_bookings')
@Index(['operatingRoomId', 'startTime', 'endTime'])
export class RoomBooking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  operatingRoomId: string;

  @ManyToOne(() => OperatingRoom, (room) => room.bookings)
  @JoinColumn({ name: 'operatingRoomId' })
  operatingRoom: OperatingRoom;

  @Column({ nullable: true })
  surgicalCaseId: string;

  @ManyToOne(() => SurgicalCase)
  @JoinColumn({ name: 'surgicalCaseId' })
  surgicalCase: SurgicalCase;

  @Column('timestamp')
  startTime: Date;

  @Column('timestamp')
  endTime: Date;

  @Column({ default: false })
  isBlocked: boolean; // for maintenance or cleaning

  @Column('text', { nullable: true })
  blockingReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('surgical_team_members')
@Index(['surgicalCaseId', 'role'])
export class SurgicalTeamMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  surgicalCaseId: string;

  @ManyToOne(() => SurgicalCase, (surgicalCase) => surgicalCase.teamMembers)
  @JoinColumn({ name: 'surgicalCaseId' })
  surgicalCase: SurgicalCase;

  @Column()
  staffId: string;

  @Column()
  staffName: string;

  @Column({
    type: 'enum',
    enum: TeamRole,
  })
  role: TeamRole;

  @Column({ default: false })
  isPrimary: boolean;

  @Column('timestamp', { nullable: true })
  assignedAt: Date;

  @Column({ default: true })
  isConfirmed: boolean;

  @Column('text', { nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('surgical_equipment')
@Index(['equipmentType', 'status'])
export class SurgicalEquipment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  equipmentCode: string;

  @Column()
  equipmentName: string;

  @Column()
  equipmentType: string;

  @Column({
    type: 'enum',
    enum: EquipmentStatus,
    default: EquipmentStatus.AVAILABLE,
  })
  status: EquipmentStatus;

  @Column({ nullable: true })
  currentLocationId: string;

  @Column({ nullable: true })
  assignedCaseId: string;

  @Column('timestamp', { nullable: true })
  lastSterilizedAt: Date;

  @Column('timestamp', { nullable: true })
  nextMaintenanceDate: Date;

  @Column('simple-json', { nullable: true })
  maintenanceHistory: Array<{
    date: Date;
    type: string;
    notes: string;
  }>;

  @Column('simple-json', { nullable: true })
  usageHistory: Array<{
    caseId: string;
    date: Date;
    duration: number;
  }>;

  @Column('text', { nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('operative_notes')
export class OperativeNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  surgicalCaseId: string;

  @ManyToOne(() => SurgicalCase, (surgicalCase) => surgicalCase.operativeNotes)
  @JoinColumn({ name: 'surgicalCaseId' })
  surgicalCase: SurgicalCase;

  @Column()
  surgeonId: string;

  @Column()
  surgeonName: string;

  @Column('text')
  preOpDiagnosis: string;

  @Column('text')
  postOpDiagnosis: string;

  @Column('text')
  procedurePerformed: string;

  @Column('text')
  findingsAndTechnique: string;

  @Column('text', { nullable: true })
  complications: string;

  @Column('text', { nullable: true })
  specimensSent: string;

  @Column('int', { nullable: true })
  estimatedBloodLoss: number; // in mL

  @Column('simple-array', { nullable: true })
  antibioticsGiven: string[];

  @Column('text')
  postOpInstructions: string;

  @Column('text', { nullable: true })
  additionalNotes: string;

  @Column('timestamp')
  dictatedAt: Date;

  @Column({ default: false })
  isSigned: boolean;

  @Column('timestamp', { nullable: true })
  signedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('surgical_outcomes')
@Index(['surgicalCaseId'])
export class SurgicalOutcome {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  surgicalCaseId: string;

  @ManyToOne(() => SurgicalCase, (surgicalCase) => surgicalCase.outcomes)
  @JoinColumn({ name: 'surgicalCaseId' })
  surgicalCase: SurgicalCase;

  // Quality Metrics
  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  patientSatisfactionScore: number;

  @Column({ default: false })
  hadComplications: boolean;

  @Column('text', { nullable: true })
  complicationDetails: string;

  @Column({ default: false })
  hadReadmission: boolean;

  @Column('int', { nullable: true })
  readmissionDays: number;

  @Column({ default: false })
  hadInfection: boolean;

  @Column({ default: false })
  hadMortality: boolean;

  @Column('int', { nullable: true })
  lengthOfStay: number; // in days

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  estimatedCost: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  actualCost: number;

  // Time Metrics
  @Column('int', { nullable: true })
  timeFromIncisionToClosure: number; // in minutes

  @Column('int', { nullable: true })
  anesthesiaTime: number; // in minutes

  @Column('int', { nullable: true })
  turnoverTime: number; // time between cases in minutes

  // Quality Indicators
  @Column({ default: false })
  prophylacticAntibioticsGiven: boolean;

  @Column({ default: false })
  dvtProphylaxisGiven: boolean;

  @Column({ default: false })
  normothermiaMaintained: boolean;

  @Column('text', { nullable: true })
  qualityNotes: string;

  @Column('simple-json', { nullable: true })
  customMetrics: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

/**
 * A single line item on a pre-operative checklist (e.g. "Site marked and
 * verified", "Patient identity confirmed", "Allergies reviewed").
 *
 * Item-level completedBy/completedAt is tracked (in addition to the
 * checklist-level completedBy/completedAt below) because in practice
 * different OR nurses/surgeons typically check off different items rather
 * than one person completing the whole checklist at once.
 */
export interface SurgicalChecklistItem {
  id: string;
  label: string;
  description?: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: Date;
}

@Entity('surgical_checklists')
@Index(['surgicalCaseId'], { unique: true })
export class SurgicalChecklist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  surgicalCaseId: string;

  @ManyToOne(() => SurgicalCase, (surgicalCase) => surgicalCase.checklists, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'surgicalCaseId' })
  surgicalCase: SurgicalCase;

  @Column('jsonb', { default: () => "'[]'" })
  items: SurgicalChecklistItem[];

  @Column({ default: false })
  isComplete: boolean;

  // Checklist-level completion metadata, set once every item is completed.
  // Records the last user to complete the final outstanding item.
  @Column({ nullable: true })
  completedBy: string;

  @Column('timestamp', { nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}