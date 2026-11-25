import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('wards')
export class Ward {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'tenant_id', type: 'varchar', nullable: true })
  tenantId: string | null;

  @Column()
  name: string;

  @Column({ nullable: true })
  wardManagerId: string;

  @Column({ default: true })
  isActive: boolean;
}
