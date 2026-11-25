import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'tenant_id', type: 'varchar', nullable: true })
  tenantId: string | null;

  @Column()
  wardId: string;

  @Column()
  roomNumber: string;

  @Column({ default: true })
  isActive: boolean;
}
