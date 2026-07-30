import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
// import { Ward } from "../../wards/entities/ward.entity";
// import { Equipment } from "../../equipment/entities/equipment.entity";
// import { Workflow } from "../../workflows/entities/workflow.entity";

@Entity('departments')
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  code: string;

  @Column('text', { array: true })
  specialties: string[];

  @Column({ nullable: true })
  headOfDepartment: string;

  @Column('jsonb', { nullable: true })
  resources: {
    staffCount: number;
    budgetAllocation: number;
    operatingHours: string;
  };

  @Column({ default: true })
  isActive: boolean;

  // @OneToMany(() => Ward, (ward) => ward.department)
  // wards: Ward[];

  // @OneToMany(() => Equipment, (equipment) => equipment.department)
  // equipment: Equipment[];

  // @OneToMany(() => Workflow, (workflow) => workflow.department)
  // workflows: Workflow[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
