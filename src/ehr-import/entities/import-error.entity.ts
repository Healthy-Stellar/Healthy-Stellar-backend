import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

@Entity('import_errors')
@Index(['jobId'])
export class ImportError {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  jobId: string;

  @Column({ type: 'int' })
  rowIndex: number;

  @Column({ type: 'text' })
  sourceRow: string;

  @Column({ type: 'text' })
  errorMessage: string;

  @Column({ type: 'text', nullable: true })
  stack: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
