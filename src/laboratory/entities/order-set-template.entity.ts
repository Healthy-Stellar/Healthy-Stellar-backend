import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { OrderSetTemplateItem } from './order-set-template-item.entity';

@Entity('order_set_templates')
@Index(['tenantId', 'isActive'])
export class OrderSetTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column({ nullable: true })
  @Index()
  tenantId: string;

  @Column({ nullable: true })
  departmentId: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isSystemTemplate: boolean;

  @OneToMany(() => OrderSetTemplateItem, (item) => item.template, {
    cascade: true,
    eager: true,
  })
  items: OrderSetTemplateItem[];

  @Column({ nullable: true })
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
