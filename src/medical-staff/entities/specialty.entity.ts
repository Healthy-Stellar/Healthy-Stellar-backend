@Entity('specialties')
export class Specialty {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @ManyToMany(() => Doctor, doctor => doctor.specialties)
  doctors: Doctor[];

  @CreateDateColumn()
  createdAt: Date;
}