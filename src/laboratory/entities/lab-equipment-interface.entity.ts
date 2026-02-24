import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { LabEquipment } from './lab-equipment.entity';

export enum InterfaceType {
  HL7 = 'hl7',
  ASTM = 'astm',
  TCP_IP = 'tcp_ip',
  SERIAL = 'serial',
  USB = 'usb',
  REST_API = 'rest_api',
  FILE_BASED = 'file_based',
}

export enum InterfaceStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  MAINTENANCE = 'maintenance',
}

@Entity('lab_equipment_interfaces')
export class LabEquipmentInterface {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'equipment_id' })
  equipmentId: string;

  @ManyToOne(() => LabEquipment, (equipment) => equipment.interfaces)
  @JoinColumn({ name: 'equipment_id' })
  equipment: LabEquipment;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: InterfaceType })
  type: InterfaceType;

  @Column({ type: 'enum', enum: InterfaceStatus, default: InterfaceStatus.DISCONNECTED })
  status: InterfaceStatus;

  @Column({ name: 'connection_string', nullable: true })
  connectionString: string;

  @Column({ type: 'json', nullable: true })
  configuration: Record<string, any>;

  @Column({ name: 'last_connection_at', nullable: true })
  lastConnectionAt: Date;

  @Column({ name: 'last_data_received_at', nullable: true })
  lastDataReceivedAt: Date;

  @Column({ name: 'message_count', default: 0 })
  messageCount: number;

  @Column({ name: 'error_count', default: 0 })
  errorCount: number;

  @Column({ name: 'last_error_message', nullable: true })
  lastErrorMessage: string;

  @Column({ name: 'is_bidirectional', default: false })
  isBidirectional: boolean;

  @Column({ name: 'auto_reconnect', default: true })
  autoReconnect: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
