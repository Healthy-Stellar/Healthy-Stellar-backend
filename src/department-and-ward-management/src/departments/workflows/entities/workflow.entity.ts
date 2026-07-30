import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
// import { Department } from '../../departments/entities/department.entity';

@Entity('workflows')
export class Workflow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column('jsonb')
  steps: {
    order: number;
    title: string;
    description: string;
    responsibleRole: string;
    estimatedDuration: number;
  }[];

  // @ManyToOne(() => Department, (department) => department.workflows)
  // department: Department;

  @Column()
  departmentId: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
