import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, Between } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class MedicalStaffService {
  constructor(
    @InjectRepository(Doctor)
    private doctorRepo: Repository<Doctor>,
    @InjectRepository(Department)
    private departmentRepo: Repository<Department>,
    @InjectRepository(Specialty)
    private specialtyRepo: Repository<Specialty>,
    @InjectRepository(Schedule)
    private scheduleRepo: Repository<Schedule>,
    @InjectRepository(PerformanceMetric)
    private performanceRepo: Repository<PerformanceMetric>,
    @InjectRepository(ContinuingEducation)
    private educationRepo: Repository<ContinuingEducation>,
  ) {}

  // ============ DOCTOR MANAGEMENT ============
  
  async createDoctor(dto: CreateDoctorDto): Promise<Doctor> {
    const existing = await this.doctorRepo.findOne({ 
      where: [
        { email: dto.email },
        { medicalLicenseNumber: dto.medicalLicenseNumber }
      ]
    });

    if (existing) {
      throw new ConflictException('Doctor with this email or license number already exists');
    }

    const doctor = this.doctorRepo.create({
      ...dto,
      dateOfBirth: new Date(dto.dateOfBirth),
      licenseIssueDate: new Date(dto.licenseIssueDate),
      licenseExpiryDate: new Date(dto.licenseExpiryDate),
      boardCertificationExpiry: dto.boardCertificationExpiry ? new Date(dto.boardCertificationExpiry) : null,
    });

    if (dto.departmentId) {
      doctor.department = await this.departmentRepo.findOne({ where: { id: dto.departmentId } });
    }

    if (dto.specialtyIds?.length) {
      doctor.specialties = await this.specialtyRepo.findByIds(dto.specialtyIds);
    }

    // Validate license expiry
    await this.validateLicenseStatus(doctor);

    return this.doctorRepo.save(doctor);
  }

  async findAllDoctors(filters?: { 
    specialization?: SpecializationType; 
    departmentId?: string;
    status?: StaffStatus;
  }): Promise<Doctor[]> {
    const query = this.doctorRepo.createQueryBuilder('doctor')
      .leftJoinAndSelect('doctor.department', 'department')
      .leftJoinAndSelect('doctor.specialties', 'specialties')
      .leftJoinAndSelect('doctor.schedules', 'schedules');

    if (filters?.specialization) {
      query.andWhere(':spec = ANY(doctor.specializations)', { spec: filters.specialization });
    }

    if (filters?.departmentId) {
      query.andWhere('doctor.departmentId = :deptId', { deptId: filters.departmentId });
    }

    if (filters?.status) {
      query.andWhere('doctor.status = :status', { status: filters.status });
    }

    return query.getMany();
  }

  async findDoctorById(id: string): Promise<Doctor> {
    const doctor = await this.doctorRepo.findOne({
      where: { id },
      relations: ['department', 'specialties', 'schedules', 'performanceMetrics', 'continuingEducation']
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    return doctor;
  }

  async updateDoctor(id: string, dto: Partial<CreateDoctorDto>): Promise<Doctor> {
    const doctor = await this.findDoctorById(id);

    Object.assign(doctor, {
      ...dto,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : doctor.dateOfBirth,
      licenseIssueDate: dto.licenseIssueDate ? new Date(dto.licenseIssueDate) : doctor.licenseIssueDate,
      licenseExpiryDate: dto.licenseExpiryDate ? new Date(dto.licenseExpiryDate) : doctor.licenseExpiryDate,
    });

    await this.validateLicenseStatus(doctor);

    return this.doctorRepo.save(doctor);
  }

  // ============ LICENSE TRACKING ============

  private async validateLicenseStatus(doctor: Doctor): Promise<void> {
    const now = new Date();
    const expiryDate = new Date(doctor.licenseExpiryDate);
    const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (expiryDate < now) {
      doctor.licenseStatus = LicenseStatus.EXPIRED;
      doctor.status = StaffStatus.SUSPENDED;
    } else if (daysUntilExpiry <= 90) {
      doctor.licenseStatus = LicenseStatus.PENDING_RENEWAL;
    } else {
      doctor.licenseStatus = LicenseStatus.ACTIVE;
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async checkLicenseRenewals(): Promise<void> {
    const now = new Date();
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const expiringDoctors = await this.doctorRepo.find({
      where: {
        licenseExpiryDate: Between(now, ninetyDaysFromNow),
        licenseStatus: LicenseStatus.ACTIVE
      }
    });

    for (const doctor of expiringDoctors) {
      await this.validateLicenseStatus(doctor);
      await this.doctorRepo.save(doctor);
      
      // Here you would trigger notification service
      console.log(`ALERT: License expiring for Dr. ${doctor.firstName} ${doctor.lastName} on ${doctor.licenseExpiryDate}`);
    }

    const expiredDoctors = await this.doctorRepo.find({
      where: {
        licenseExpiryDate: LessThan(now),
        licenseStatus: LicenseStatus.ACTIVE
      }
    });

    for (const doctor of expiredDoctors) {
      doctor.licenseStatus = LicenseStatus.EXPIRED;
      doctor.status = StaffStatus.SUSPENDED;
      await this.doctorRepo.save(doctor);
      
      console.log(`CRITICAL: License EXPIRED for Dr. ${doctor.firstName} ${doctor.lastName}`);
    }
  }

  async getExpiringLicenses(days: number = 90): Promise<Doctor[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return this.doctorRepo.find({
      where: {
        licenseExpiryDate: Between(now, futureDate)
      },
      order: { licenseExpiryDate: 'ASC' }
    });
  }

  // ============ SCHEDULING ============

  async createSchedule(dto: CreateScheduleDto): Promise<Schedule> {
    const doctor = await this.findDoctorById(dto.doctorId);

    // Check for conflicts
    const conflict = await this.checkScheduleConflict(
      dto.doctorId,
      dto.dayOfWeek,
      dto.startTime,
      dto.endTime,
      dto.effectiveFrom,
      dto.effectiveUntil
    );

    if (conflict) {
      throw new ConflictException('Schedule conflicts with existing schedule');
    }

    const schedule = this.scheduleRepo.create({
      doctor,
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      endTime: dto.endTime,
      effectiveFrom: new Date(dto.effectiveFrom),
      effectiveUntil: dto.effectiveUntil ? new Date(dto.effectiveUntil) : null,
      notes: dto.notes
    });

    return this.scheduleRepo.save(schedule);
  }

  private async checkScheduleConflict(
    doctorId: string,
    dayOfWeek: DayOfWeek,
    startTime: string,
    endTime: string,
    effectiveFrom: string,
    effectiveUntil?: string
  ): Promise<boolean> {
    const query = this.scheduleRepo.createQueryBuilder('schedule')
      .where('schedule.doctorId = :doctorId', { doctorId })
      .andWhere('schedule.dayOfWeek = :dayOfWeek', { dayOfWeek })
      .andWhere('schedule.isActive = true')
      .andWhere('schedule.effectiveFrom <= :checkDate', { checkDate: new Date(effectiveFrom) });

    if (effectiveUntil) {
      query.andWhere('(schedule.effectiveUntil IS NULL OR schedule.effectiveUntil >= :checkDate)', 
        { checkDate: new Date(effectiveFrom) });
    }

    const existingSchedules = await query.getMany();

    for (const existing of existingSchedules) {
      const timeOverlap = this.checkTimeOverlap(
        startTime,
        endTime,
        existing.startTime,
        existing.endTime
      );

      if (timeOverlap) {
        return true;
      }
    }

    return false;
  }

  private checkTimeOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean {
    const s1 = this.timeToMinutes(start1);
    const e1 = this.timeToMinutes(end1);
    const s2 = this.timeToMinutes(start2);
    const e2 = this.timeToMinutes(end2);

    return (s1 < e2 && e1 > s2);
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  async getDoctorSchedule(doctorId: string, date?: Date): Promise<Schedule[]> {
    const query = this.scheduleRepo.createQueryBuilder('schedule')
      .where('schedule.doctorId = :doctorId', { doctorId })
      .andWhere('schedule.isActive = true');

    if (date) {
      query.andWhere('schedule.effectiveFrom <= :date', { date })
        .andWhere('(schedule.effectiveUntil IS NULL OR schedule.effectiveUntil >= :date)', { date });
    }

    return query.orderBy('schedule.dayOfWeek', 'ASC').getMany();
  }

  // ============ PERFORMANCE TRACKING ============

  async createPerformanceMetric(dto: CreatePerformanceMetricDto): Promise<PerformanceMetric> {
    const doctor = await this.findDoctorById(dto.doctorId);

    const qualityScore = this.calculateQualityScore({
      patientSatisfactionScore: dto.patientSatisfactionScore,
      complicationsCases: dto.complicationsCases,
      successfulTreatments: dto.successfulTreatments,
      totalPatientsServed: dto.totalPatientsServed
    });

    const metric = this.performanceRepo.create({
      doctor,
      periodStart: new Date(dto.periodStart),
      periodEnd: new Date(dto.periodEnd),
      patientSatisfactionScore: dto.patientSatisfactionScore,
      totalPatientsServed: dto.totalPatientsServed,
      averageConsultationTime: dto.averageConsultationTime,
      complicationsCases: dto.complicationsCases,
      successfulTreatments: dto.successfulTreatments,
      qualityScore
    });

    return this.performanceRepo.save(metric);
  }

  private calculateQualityScore(data: {
    patientSatisfactionScore: number;
    complicationsCases: number;
    successfulTreatments: number;
    totalPatientsServed: number;
  }): number {
    const successRate = data.totalPatientsServed > 0 
      ? (data.successfulTreatments / data.totalPatientsServed) * 100 
      : 0;
    
    const complicationRate = data.totalPatientsServed > 0
      ? (data.complicationsCases / data.totalPatientsServed) * 100
      : 0;

    const qualityScore = (
      (data.patientSatisfactionScore * 0.3) +
      (successRate * 0.4) +
      ((100 - complicationRate) * 0.3)
    );

    return Math.round(qualityScore * 100) / 100;
  }

  async getDoctorPerformance(doctorId: string, startDate?: Date, endDate?: Date): Promise<PerformanceMetric[]> {
    const query = this.performanceRepo.createQueryBuilder('metric')
      .where('metric.doctorId = :doctorId', { doctorId });

    if (startDate) {
      query.andWhere('metric.periodStart >= :startDate', { startDate });
    }

    if (endDate) {
      query.andWhere('metric.periodEnd <= :endDate', { endDate });
    }

    return query.orderBy('metric.periodStart', 'DESC').getMany();
  }

  // ============ CONTINUING EDUCATION ============

  async addContinuingEducation(dto: CreateContinuingEducationDto): Promise<ContinuingEducation> {
    const doctor = await this.findDoctorById(dto.doctorId);

    const education = this.educationRepo.create({
      doctor,
      courseName: dto.courseName,
      provider: dto.provider,
      creditsEarned: dto.creditsEarned,
      completionDate: new Date(dto.completionDate),
      certificateNumber: dto.certificateNumber,
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
      description: dto.description
    });

    return this.educationRepo.save(education);
  }

  async getDoctorEducationCredits(doctorId: string, year?: number): Promise<{
    totalCredits: number;
    courses: ContinuingEducation[];
  }> {
    const query = this.educationRepo.createQueryBuilder('edu')
      .where('edu.doctorId = :doctorId', { doctorId });

    if (year) {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31);
      query.andWhere('edu.completionDate BETWEEN :startDate AND :endDate', { startDate, endDate });
    }

    const courses = await query.orderBy('edu.completionDate', 'DESC').getMany();
    const totalCredits = courses.reduce((sum, course) => sum + Number(course.creditsEarned), 0);

    return { totalCredits, courses };
  }

  // ============ ANALYTICS ============

  async getDepartmentStats(departmentId: string): Promise<any> {
    const doctors = await this.doctorRepo.find({
      where: { department: { id: departmentId } },
      relations: ['performanceMetrics', 'continuingEducation']
    });

    const totalDoctors = doctors.length;
    const activeDoctors = doctors.filter(d => d.status === StaffStatus.ACTIVE).length;
    
    let totalPatients = 0;
    let avgSatisfaction = 0;

    for (const doctor of doctors) {
      const recentMetrics = doctor.performanceMetrics.slice(0, 3);
      totalPatients += recentMetrics.reduce((sum, m) => sum + m.totalPatientsServed, 0);
      avgSatisfaction += recentMetrics.reduce((sum, m) => sum + Number(m.patientSatisfactionScore), 0) / recentMetrics.length || 0;
    }

    return {
      totalDoctors,
      activeDoctors,
      totalPatients,
      averageSatisfactionScore: totalDoctors > 0 ? avgSatisfaction / totalDoctors : 0
    };
  }
}