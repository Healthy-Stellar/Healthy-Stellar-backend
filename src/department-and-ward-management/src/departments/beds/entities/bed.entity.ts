import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Room } from '../../rooms/entities/room.entity';
import { BedStatus } from '../../../common/enums/bed-status.enum';

@Entity('beds')
export class Bed {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  bedNumber: string;

  @Column({
    type: 'enum',
    enum: BedStatus,
    default: BedStatus.AVAILABLE,
  })
  status: BedStatus;

  // @ManyToOne(() => Room, (room) => room.beds)
  // room: Room;

  @Column()
  roomId: string;

  @Column({ nullable: true })
  patientId: string;

  @Column({ type: 'timestamp', nullable: true })
  assignedAt: Date;

  @Column('text', { array: true, nullable: true })
  features: string[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
