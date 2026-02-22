import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum EquipmentType {
  VENTILATOR = 'ventilator',
  MONITOR = 'monitor',
  INFUSION_PUMP = 'infusion_pump',
  DEFIBRILLATOR = 'defibrillator',
  XRAY_MACHINE = 'xray_machine',
  CT_SCANNER = 'ct_scanner',
  MRI_MACHINE = 'mri_machine',
  ULTRASOUND = 'ultrasound',
  DIALYSIS_MACHINE = 'dialysis_machine',
  ANESTHESIA_MACHINE = 'anesthesia_machine',
}

export enum EquipmentHealthStatus {
  OPERATIONAL = 'operational',
  WARNING = 'warning',
  CRITICAL = 'critical',
  OFFLINE = 'offline',
  MAINTENANCE = 'maintenance',
}

@Entity('equipment_status')
@Index(['equipmentType', 'status'])
@Index(['department', 'status'])
@Index(['lastMaintenanceDate'])
export class EquipmentStatus {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100, unique: true })
  equipmentId: string;

  @Column({ length: 200 })
  equipmentName: string;

  @Column({
    type: 'enum',
    enum: EquipmentType,
  })
  equipmentType: EquipmentType;

  @Column({ length: 100 })
  manufacturer: string;

  @Column({ length: 100 })
  model: string;

  @Column({ length: 100 })
  serialNumber: string;

  @Column({
    type: 'enum',
    enum: EquipmentHealthStatus,
    default: EquipmentHealthStatus.OPERATIONAL,
  })
  status: EquipmentHealthStatus;

  @Column({ length: 100 })
  department: string;

  @Column({ length: 50 })
  location: string;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  batteryLevel: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  operatingHours: number;

  @Column({ nullable: true })
  lastMaintenanceDate: Date;

  @Column({ nullable: true })
  nextMaintenanceDate: Date;

  @Column('text', { nullable: true })
  currentIssues: string;

  @Column('json', { nullable: true })
  performanceMetrics: Record<string, any>;

  @Column('json', { nullable: true })
  calibrationData: Record<string, any>;

  @Column('simple-array', { nullable: true })
  alerts: string[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}