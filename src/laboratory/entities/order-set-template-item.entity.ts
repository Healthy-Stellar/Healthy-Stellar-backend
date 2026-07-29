import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { OrderSetTemplate } from './order-set-template.entity';

@Entity('order_set_template_items')
@Index(['templateId'])
export class OrderSetTemplateItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  templateId: string;

  @Column({ type: 'uuid' })
  labTestId: string;

  @Column({ nullable: true })
  notes: string;

  @ManyToOne(() => OrderSetTemplate, (template) => template.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'templateId' })
  template: OrderSetTemplate;
}
