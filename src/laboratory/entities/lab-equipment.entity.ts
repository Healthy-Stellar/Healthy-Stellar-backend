import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { LabEquipmentInterface } from './lab-equipment-interface.entity';

export enum EquipmentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
  CALIBRATION = 'calibration',
  OUT_OF_ORDER = 'out_of_order',
}

export enum EquipmentType {
  ANALYZER = 'analyzer',
  CENTRIFUGE = 'centrifuge',
  MICROSCOPE = 'microscope',
  INCUBATOR = 'incubator',
  SPECTROPHOTOMETER = 'spectrophotometer',
  PCR_MACHINE = 'pcr_machine',
  HEMATOLOGY_ANALYZER = 'hematology_analyzer',
  CHEMISTRY_ANALYZER = 'chemistry_analyzer',
  IMMUNOASSAY_ANALYZER = 'immunoassay_analyzer',
}

@Entity('lab_equipment')
export class LabEquipment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  model: string;

  @Column()
  manufacturer: string;

  @Column({ name: 'serial_number', unique: true })
  serialNumber: string;

  @Column({ type: 'enum', enum: EquipmentType })
  type: EquipmentType;

  @Column({ type: 'enum', enum: EquipmentStatus, default: EquipmentStatus.ACTIVE })
  status: EquipmentStatus;

  @Column({ nullable: true })
  location: string;

  @Column({ name: 'installation_date', nullable: true })
  installationDate: Date;

  @Column({ name: 'last_maintenance_date', nullable: true })
  lastMaintenanceDate: Date;

  @Column({ name: 'next_maintenance_date', nullable: true })
  nextMaintenanceDate: Date;

  @Column({ name: 'last_calibration_date', nullable: true })
  lastCalibrationDate: Date;

  @Column({ name: 'next_calibration_date', nullable: true })
  nextCalibrationDate: Date;

  @Column({ type: 'json', nullable: true })
  specifications: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  configuration: Record<string, any>;

  @OneToMany(() => LabEquipmentInterface, (interface_) => interface_.equipment)
  interfaces: LabEquipmentInterface[];

  @Column({ name: 'is_automated', default: false })
  isAutomated: boolean;

  @Column({ name: 'supports_lis_integration', default: false })
  supportsLisIntegration: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
