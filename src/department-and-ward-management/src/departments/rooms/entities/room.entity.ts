import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Ward } from '../../wards/entities/ward.entity';
import { Bed } from '../../beds/entities/bed.entity';
import { RoomType } from '../../../common/enums/room-type.enum';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  roomNumber: string;

  @Column({
    type: 'enum',
    enum: RoomType,
    default: RoomType.GENERAL,
  })
  type: RoomType;

  @Column()
  capacity: number;

  @Column('text', { array: true, nullable: true })
  amenities: string[];

  // @ManyToOne(() => Ward, (ward) => ward.rooms)
  // ward: Ward;

  @Column()
  wardId: string;

  // @OneToMany(() => Bed, (bed) => bed.room)
  // beds: Bed[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
