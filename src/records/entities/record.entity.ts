import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { RecordType } from '../dto/create-record.dto';

@Entity('records')
export class Record {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  patientId: string;

  @Column()
  cid: string;

  @Column({ nullable: true })
  stellarTxHash: string;

  @Column({ type: 'enum', enum: RecordType })
  recordType: RecordType;

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;
}
