import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Not, FindOptionsWhere } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { Appointment, AppointmentStatus, MedicalPriority } from '../entities/appointment.entity';
import { DoctorAvailability } from '../entities/doctor-availability.entity';
import { CreateAppointmentDto } from '../dto/create-appointment.dto';
import { AuditService } from '../../common/audit/audit.service';
import { TenantContext } from '../../tenant/context/tenant.context';
import { getRequestContext } from '../../common/middleware/request-context.middleware';
import { UserRole } from '../../auth/entities/user.entity';

/** How many minutes before the appointment start a join token becomes valid. */
const TOKEN_VALID_BEFORE_MINUTES = 15;

@Injectable()
export class AppointmentService {
  constructor(
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    @InjectRepository(DoctorAvailability)
    private availabilityRepository: Repository<DoctorAvailability>,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Generates a TypeORM where object that enforces tenant and user-level isolation.
   * @private
   */
  private getScopedWhere(baseWhere: FindOptionsWhere<Appointment> = {}): FindOptionsWhere<Appointment> {
    const tenantId = TenantContext.getTenantId();
    const context = getRequestContext();

    if (!tenantId) {
      throw new ForbiddenException('Tenant context missing');
    }

    const scopedWhere: FindOptionsWhere<Appointment> = {
      ...baseWhere,
      tenantId,
    };

    if (context?.role === UserRole.PATIENT) {
      scopedWhere.patientId = context.userId;
    } else if (context?.role === UserRole.PHYSICIAN) {
      scopedWhere.doctorId = context.userId;
    }
    // Admins and other staff can see all within tenant by default

    return scopedWhere;
  }

  async create(createAppointmentDto: CreateAppointmentDto): Promise<Appointment> {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      throw new ForbiddenException('Tenant context missing');
    }

    const appointmentDate = new Date(createAppointmentDto.appointmentDate);

    // Check doctor availability
    const isAvailable = await this.checkDoctorAvailability(
      createAppointmentDto.doctorId,
      appointmentDate,
      createAppointmentDto.duration,
    );

    if (!isAvailable) {
      throw new BadRequestException('Doctor is not available at the requested time');
    }

    // Check specialty match if specified
    if (createAppointmentDto.specialty) {
      const hasSpecialty = await this.checkDoctorSpecialty(
        createAppointmentDto.doctorId,
        createAppointmentDto.specialty,
      );
      if (!hasSpecialty) {
        throw new BadRequestException('Doctor does not have the required specialty');
      }
    }

    const roomId = createAppointmentDto.isTelemedicine ? randomUUID() : null;

    const appointment = this.appointmentRepository.create({
      ...createAppointmentDto,
      tenantId,
      appointmentDate,
      telemedicineRoomId: roomId,
      telemedicineLink: roomId ? `https://telemedicine.app/room/${roomId}` : null,
    });

    const saved = await this.appointmentRepository.save(appointment);

    // Audit log: APPOINTMENT_CREATED
    await this.auditService.log({
      actorId: createAppointmentDto.patientId,
      action: 'APPOINTMENT_CREATED',
      resourceId: saved.id,
      resourceType: 'Appointment',
      tenantId,
      timestamp: new Date(),
    }).catch((err) => {
      // Non-blocking: log failure but don't throw
      console.error('Failed to log appointment creation audit event:', err.message);
    });

    return saved;
  }

  async findAll(): Promise<Appointment[]> {
    return this.appointmentRepository.find({
      where: this.getScopedWhere(),
      relations: ['consultationNotes'],
      order: { appointmentDate: 'ASC' },
    });
  }

  async findByPriority(priority: MedicalPriority): Promise<Appointment[]> {
    return this.appointmentRepository.find({
      where: this.getScopedWhere({ priority }),
      relations: ['consultationNotes'],
      order: { appointmentDate: 'ASC' },
    });
  }

  async findByDoctor(doctorId: string, date?: Date): Promise<Appointment[]> {
    const whereCondition: FindOptionsWhere<Appointment> = { doctorId };

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      whereCondition.appointmentDate = Between(startOfDay, endOfDay);
    }

    return this.appointmentRepository.find({
      where: this.getScopedWhere(whereCondition),
      relations: ['consultationNotes'],
      order: { appointmentDate: 'ASC' },
    });
  }

  async updateStatus(id: string, status: AppointmentStatus): Promise<Appointment> {
    const appointment = await this.appointmentRepository.findOne({ 
      where: this.getScopedWhere({ id }) 
    });
    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    appointment.status = status;
    const updated = await this.appointmentRepository.save(appointment);

    // Audit log appropriate action based on status change
    const auditAction =
      status === AppointmentStatus.CANCELLED
        ? 'APPOINTMENT_CANCELLED'
        : 'APPOINTMENT_UPDATED';

    await this.auditService.log({
      actorId: appointment.patientId,
      action: auditAction,
      resourceId: id,
      resourceType: 'Appointment',
      tenantId: appointment.tenantId,
      timestamp: new Date(),
    }).catch((err) => {
      console.error(`Failed to log appointment status change audit event: ${err.message}`);
    });

    return updated;
  }

  async getAvailableSlots(doctorId: string, date: Date): Promise<string[]> {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      throw new ForbiddenException('Tenant context missing');
    }

    const dayOfWeek = date.getDay() || 7; // Convert Sunday (0) to 7

    const availability = await this.availabilityRepository.findOne({
      where: {
        doctorId,
        dayOfWeek,
        isActive: true,
      },
    });

    if (!availability) {
      return [];
    }

    // Get existing appointments for the day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const existingAppointments = await this.appointmentRepository.find({
      where: this.getScopedWhere({
        doctorId,
        appointmentDate: Between(startOfDay, endOfDay),
        status: Not(AppointmentStatus.CANCELLED),
      }),
    });

    return this.calculateAvailableSlots(availability, existingAppointments, date);
  }

  private async checkDoctorAvailability(
    doctorId: string,
    appointmentDate: Date,
    duration: number,
  ): Promise<boolean> {
    const tenantId = TenantContext.getTenantId();
    const dayOfWeek = appointmentDate.getDay() || 7;

    const availability = await this.availabilityRepository.findOne({
      where: {
        doctorId,
        dayOfWeek,
        isActive: true,
      },
    });

    if (!availability) return false;

    // Check if appointment time falls within availability hours
    const appointmentTime = appointmentDate.getHours() * 60 + appointmentDate.getMinutes();
    const [startHour, startMin] = availability.startTime.split(':').map(Number);
    const [endHour, endMin] = availability.endTime.split(':').map(Number);
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (appointmentTime < startTime || appointmentTime + duration > endTime) {
      return false;
    }

    // Check for conflicts with existing appointments
    const startOfSlot = new Date(appointmentDate);
    const endOfSlot = new Date(appointmentDate.getTime() + duration * 60000);

    const conflictingAppointments = await this.appointmentRepository.count({
      where: this.getScopedWhere({
        doctorId,
        appointmentDate: Between(startOfSlot, endOfSlot),
        status: Not(AppointmentStatus.CANCELLED),
      }),
    });

    return conflictingAppointments === 0;
  }

  private async checkDoctorSpecialty(doctorId: string, specialty: string): Promise<boolean> {
    const availability = await this.availabilityRepository.findOne({
      where: { doctorId, isActive: true },
    });

    return availability?.specialties?.includes(specialty) || false;
  }

  private calculateAvailableSlots(
    availability: DoctorAvailability,
    existingAppointments: Appointment[],
    date: Date,
  ): string[] {
    const slots: string[] = [];
    const [startHour, startMin] = availability.startTime.split(':').map(Number);
    const [endHour, endMin] = availability.endTime.split(':').map(Number);

    let currentTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    while (currentTime + availability.slotDuration <= endTime) {
      const slotStart = new Date(date);
      slotStart.setHours(Math.floor(currentTime / 60), currentTime % 60, 0, 0);

      const slotEnd = new Date(slotStart.getTime() + availability.slotDuration * 60000);

      const hasConflict = existingAppointments.some((apt) => {
        const aptStart = new Date(apt.appointmentDate);
        const aptEnd = new Date(aptStart.getTime() + apt.duration * 60000);
        return slotStart < aptEnd && slotEnd > aptStart;
      });

      if (!hasConflict) {
        slots.push(
          `${String(Math.floor(currentTime / 60)).padStart(2, '0')}:${String(currentTime % 60).padStart(2, '0')}`,
        );
      }

      currentTime += availability.slotDuration;
    }

    return slots;
  }

  /**
   * Issues a signed, time-limited JWT that authorises `participantId` to join
   * the telemedicine room for appointment `id`.
   *
   * The token is valid only within the window
   *   [appointmentDate - TOKEN_VALID_BEFORE_MINUTES, appointmentDate + duration]
   * so it cannot be used to join early or after the session ends.
   */
  async issueTelemedicineToken(
    id: string,
    participantId: string,
  ): Promise<{ token: string; roomUrl: string }> {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      throw new ForbiddenException('Tenant context missing');
    }

    // Load the sensitive columns that are excluded from normal selects
    const appointment = await this.appointmentRepository
      .createQueryBuilder('a')
      .addSelect('a.telemedicine_room_id', 'a_telemedicineRoomId')
      .addSelect('a.telemedicine_link', 'a_telemedicineLink')
      .where('a.id = :id', { id })
      .andWhere('a.tenant_id = :tenantId', { tenantId })
      .getOne();

    if (!appointment) throw new NotFoundException(`Appointment ${id} not found`);
    if (!appointment.isTelemedicine || !appointment.telemedicineRoomId) {
      throw new BadRequestException('Appointment is not a telemedicine session');
    }

    // Only the patient or the doctor may obtain a token
    if (participantId !== appointment.patientId && participantId !== appointment.doctorId) {
      throw new ForbiddenException('Not a participant of this appointment');
    }

    const now = Date.now();
    const windowStart = appointment.appointmentDate.getTime() - TOKEN_VALID_BEFORE_MINUTES * 60_000;
    const windowEnd = appointment.appointmentDate.getTime() + appointment.duration * 60_000;

    if (now < windowStart) {
      throw new BadRequestException(
        `Token not yet available – join window opens ${TOKEN_VALID_BEFORE_MINUTES} minutes before the appointment`,
      );
    }
    if (now > windowEnd) {
      throw new BadRequestException('Appointment session has already ended');
    }

    const expiresInSeconds = Math.floor((windowEnd - now) / 1000);

    const token = this.jwtService.sign(
      {
        sub: participantId,
        appointmentId: id,
        roomId: appointment.telemedicineRoomId,
        role: participantId === appointment.doctorId ? 'doctor' : 'patient',
      },
      { expiresIn: expiresInSeconds },
    );

    return {
      token,
      roomUrl: `${appointment.telemedicineLink}?token=${token}`,
    };
  }
}
