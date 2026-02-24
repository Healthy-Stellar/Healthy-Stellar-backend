import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('query_performance_logs')
@Index(['executedAt'])
@Index(['queryType', 'executedAt'])
@Index(['isSlowQuery', 'executedAt'])
export class QueryPerformanceLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  query: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  queryType: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  tableName: string;

  @Column({ type: 'int' })
  executionTimeMs: number;

  @Column({ type: 'int', nullable: true })
  rowsAffected: number;

  @Column({ type: 'boolean', default: false })
  isSlowQuery: boolean;

  @Column({ type: 'text', nullable: true })
  executionPlan: string;

  @Column({ type: 'text', nullable: true })
  optimizationSuggestion: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  callerModule: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  callerIp: string;

  @CreateDateColumn()
  executedAt: Date;
}
