@Entity('continuing_education')
export class ContinuingEducation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Doctor, doctor => doctor.continuingEducation)
  doctor: Doctor;

  @Column()
  courseName: string;

  @Column()
  provider: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  creditsEarned: number;

  @Column({ type: 'date' })
  completionDate: Date;

  @Column({ nullable: true })
  certificateNumber: string;

  @Column({ type: 'date', nullable: true })
  expiryDate: Date;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;
}