import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RecordType } from '../dto/create-record.dto';

@Entity('record_templates')
export class RecordTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  providerId: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: RecordType })
  recordType: RecordType;

  @Column({ type: 'jsonb' })
  schemaJson: Record<string, any>;

  @Column({ default: false })
  isPublic: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
