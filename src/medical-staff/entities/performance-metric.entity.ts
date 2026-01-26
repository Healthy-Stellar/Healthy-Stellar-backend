@Entity('performance_metrics')
export class PerformanceMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Doctor, doctor => doctor.performanceMetrics)
  doctor: Doctor;

  @Column({ type: 'date' })
  periodStart: Date;

  @Column({ type: 'date' })
  periodEnd: Date;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  patientSatisfactionScore: number;

  @Column({ type: 'int' })
  totalPatientsServed: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  averageConsultationTime: number;

  @Column({ type: 'int', default: 0 })
  complicationsCases: number;

  @Column({ type: 'int', default: 0 })
  successfulTreatments: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  qualityScore: number;

  @Column({ type: 'jsonb', nullable: true })
  additionalMetrics: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}