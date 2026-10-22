import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Department } from '../../../departments/entities/department.entity';
import { Room } from '../../rooms/entities/room.entity';

@Entity('wards')
export class Ward {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  floor: number;

  @Column()
  wing: string;

  @Column()
  nurseStationLocation: string;

  @Column({ nullable: true })
  wardManagerId: string;

  // @ManyToOne(() => Department, (department) => department.wards)
  // department: Department;

  @Column()
  departmentId: string;

  // @OneToMany(() => Room, (room) => room.ward)
  // rooms: Room[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
