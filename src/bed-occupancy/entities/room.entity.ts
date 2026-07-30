import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  wardId: string;

  @Column()
  roomNumber: string;

  @Column({ default: true })
  isActive: boolean;
}
