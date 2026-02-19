import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type DeviceStatus = 'online' | 'offline' | 'maintenance' | 'error' | 'degraded';
export type DeviceType =
  | 'vital-signs-monitor'
  | 'infusion-pump'
  | 'ventilator'
  | 'lab-analyzer'
  | 'imaging-system'
  | 'ehr-terminal'
  | 'pharmacy-dispenser'
  | 'barcode-scanner'
  | 'patient-wristband'
  | 'nurse-call-system'
  | 'other';

@Entity('medical_devices')
@Index(['deviceType', 'status'])
@Index(['status'])
@Index(['location'])
export class MedicalDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  deviceType: DeviceType;

  @Column({ type: 'varchar', length: 255, unique: true })
  serialNumber: string;

  @Column({ type: 'varchar', length: 50, default: 'offline' })
  status: DeviceStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  department: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  ipAddress: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  firmwareVersion: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  protocol: string;

  @Column({ type: 'int', default: 0 })
  dataPointsReceived: number;

  @Column({ type: 'int', default: 0 })
  errorCount: number;

  @Column({ type: 'float', nullable: true })
  averageLatencyMs: number;

  @Column({ type: 'timestamp', nullable: true })
  lastHeartbeat: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastDataReceived: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  configuration: Record<string, any>;

  @CreateDateColumn()
  registeredAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
