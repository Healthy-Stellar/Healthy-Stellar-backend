import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('wards')
export class Ward {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  wardManagerId: string;

  @Column({ default: true })
  isActive: boolean;
}
