import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateAppointmentDto } from '../appointments/dto/create-appointment.dto';
import { CreateConsultationNoteDto } from '../appointments/dto/create-consultation-note.dto';
import { RegisterDto, LoginDto, ChangePasswordDto, ResetPasswordConfirmDto } from '../auth/dto/auth.dto';
import { CreateAccessGrantDto } from '../access-control/dto/create-access-grant.dto';
import { CreateLabOrderDto } from '../laboratory/dto/create-lab-order.dto';
import { CreateLabResultDto } from '../laboratory/dto/create-lab-result.dto';
import { CreateTreatmentPlanDto } from '../treatment-planning/dto/treatment-planning.dto';
import { ProviderDirectoryQueryDto } from '../auth/dto/provider-directory-query.dto';
import { CreateMedicalRecordDto } from '../medical-records/dto/create-medical-record.dto';
import { AppointmentType, MedicalPriority } from '../appointments/entities/appointment.entity';
import { AccessLevel } from '../access-control/entities/access-grant.entity';
import { OrderPriority } from '../laboratory/entities/lab-order.entity';
import { RecordType } from '../medical-records/entities/medical-record.entity';

async function errors(cls: any, plain: object): Promise<string[]> {
  const instance = plainToInstance(cls, plain);
  const errs = await validate(instance);
  return errs.map((e) => e.property);
}

describe('Input Validation Hardening', () => {
  // ─── CreateAppointmentDto ───────────────────────────────────────────────────
  describe('CreateAppointmentDto', () => {
    const valid = {
      patientId: '123e4567-e89b-12d3-a456-426614174000',
      doctorId: '123e4567-e89b-12d3-a456-426614174001',
      appointmentDate: '2024-06-01T10:00:00Z',
      duration: 30,
      type: AppointmentType.CONSULTATION,
      priority: MedicalPriority.ROUTINE,
    };

    it('accepts a valid payload', async () => {
      expect(await errors(CreateAppointmentDto, valid)).toHaveLength(0);
    });

    it('rejects non-UUID patientId', async () => {
      expect(await errors(CreateAppointmentDto, { ...valid, patientId: 'not-a-uuid' })).toContain('patientId');
    });

    it('rejects non-UUID doctorId', async () => {
      expect(await errors(CreateAppointmentDto, { ...valid, doctorId: 'not-a-uuid' })).toContain('doctorId');
    });

    it('rejects notes exceeding MaxLength', async () => {
      expect(await errors(CreateAppointmentDto, { ...valid, notes: 'x'.repeat(2001) })).toContain('notes');
    });

    it('rejects reason exceeding MaxLength', async () => {
      expect(await errors(CreateAppointmentDto, { ...valid, reason: 'x'.repeat(1001) })).toContain('reason');
    });
  });

  // ─── CreateConsultationNoteDto ──────────────────────────────────────────────
  describe('CreateConsultationNoteDto', () => {
    const valid = {
      appointmentId: '123e4567-e89b-12d3-a456-426614174000',
      doctorId: '123e4567-e89b-12d3-a456-426614174001',
      symptoms: 'Fever and cough',
      diagnosis: 'Upper respiratory infection',
      outcome: 'RESOLVED',
    };

    it('accepts a valid payload', async () => {
      expect(await errors(CreateConsultationNoteDto, valid)).toHaveLength(0);
    });

    it('rejects non-UUID appointmentId', async () => {
      expect(await errors(CreateConsultationNoteDto, { ...valid, appointmentId: 'bad' })).toContain('appointmentId');
    });

    it('rejects non-UUID doctorId', async () => {
      expect(await errors(CreateConsultationNoteDto, { ...valid, doctorId: 'bad' })).toContain('doctorId');
    });

    it('rejects symptoms exceeding MaxLength', async () => {
      expect(await errors(CreateConsultationNoteDto, { ...valid, symptoms: 'x'.repeat(2001) })).toContain('symptoms');
    });
  });

  // ─── Auth DTOs ──────────────────────────────────────────────────────────────
  describe('RegisterDto', () => {
    const valid = {
      email: 'user@example.com',
      password: 'Str0ng!Pass#1',
      firstName: 'Jane',
      lastName: 'Doe',
    };

    it('accepts a valid payload', async () => {
      expect(await errors(RegisterDto, valid)).toHaveLength(0);
    });

    it('rejects email exceeding 254 chars', async () => {
      expect(await errors(RegisterDto, { ...valid, email: 'a'.repeat(250) + '@b.com' })).toContain('email');
    });

    it('rejects invalid role string', async () => {
      expect(await errors(RegisterDto, { ...valid, role: 'SUPERADMIN' })).toContain('role');
    });

    it('rejects weak password', async () => {
      expect(await errors(RegisterDto, { ...valid, password: 'weakpassword' })).toContain('password');
    });
  });

  describe('LoginDto', () => {
    it('rejects password exceeding 128 chars', async () => {
      expect(await errors(LoginDto, { email: 'a@b.com', password: 'x'.repeat(129) })).toContain('password');
    });
  });

  describe('ChangePasswordDto', () => {
    it('rejects currentPassword exceeding 128 chars', async () => {
      const payload = { currentPassword: 'x'.repeat(129), newPassword: 'Str0ng!Pass#1', confirmPassword: 'Str0ng!Pass#1' };
      expect(await errors(ChangePasswordDto, payload)).toContain('currentPassword');
    });
  });

  describe('ResetPasswordConfirmDto', () => {
    it('rejects token exceeding 512 chars', async () => {
      expect(await errors(ResetPasswordConfirmDto, { token: 'x'.repeat(513), newPassword: 'Str0ng!Pass#1' })).toContain('token');
    });
  });

  // ─── CreateAccessGrantDto ───────────────────────────────────────────────────
  describe('CreateAccessGrantDto', () => {
    const valid = {
      granteeId: '123e4567-e89b-12d3-a456-426614174000',
      recordIds: ['123e4567-e89b-12d3-a456-426614174001'],
      accessLevel: AccessLevel.READ,
    };

    it('accepts a valid payload', async () => {
      expect(await errors(CreateAccessGrantDto, valid)).toHaveLength(0);
    });

    it('rejects empty recordIds array', async () => {
      expect(await errors(CreateAccessGrantDto, { ...valid, recordIds: [] })).toContain('recordIds');
    });

    it('rejects recordIds exceeding 100 items', async () => {
      const ids = Array.from({ length: 101 }, () => '123e4567-e89b-12d3-a456-426614174000');
      expect(await errors(CreateAccessGrantDto, { ...valid, recordIds: ids })).toContain('recordIds');
    });

    it('rejects non-UUID entries in recordIds', async () => {
      expect(await errors(CreateAccessGrantDto, { ...valid, recordIds: ['not-a-uuid'] })).toContain('recordIds');
    });
  });

  // ─── CreateLabOrderDto ──────────────────────────────────────────────────────
  describe('CreateLabOrderDto', () => {
    const valid = {
      patientId: '123e4567-e89b-12d3-a456-426614174000',
      patientName: 'John Doe',
      orderingProviderId: '123e4567-e89b-12d3-a456-426614174001',
      orderingProviderName: 'Dr. Smith',
      priority: OrderPriority.ROUTINE,
      items: [{ labTestId: '123e4567-e89b-12d3-a456-426614174002' }],
    };

    it('accepts a valid payload', async () => {
      expect(await errors(CreateLabOrderDto, valid)).toHaveLength(0);
    });

    it('rejects empty items array', async () => {
      expect(await errors(CreateLabOrderDto, { ...valid, items: [] })).toContain('items');
    });

    it('rejects clinicalIndication exceeding 2000 chars', async () => {
      expect(await errors(CreateLabOrderDto, { ...valid, clinicalIndication: 'x'.repeat(2001) })).toContain('clinicalIndication');
    });

    it('rejects notes exceeding 2000 chars', async () => {
      expect(await errors(CreateLabOrderDto, { ...valid, notes: 'x'.repeat(2001) })).toContain('notes');
    });
  });

  // ─── CreateTreatmentPlanDto ─────────────────────────────────────────────────
  describe('CreateTreatmentPlanDto', () => {
    const valid = {
      patientId: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Recovery Plan',
      startDate: '2024-06-01',
    };

    it('accepts a valid payload', async () => {
      expect(await errors(CreateTreatmentPlanDto, valid)).toHaveLength(0);
    });

    it('rejects description exceeding 5000 chars', async () => {
      expect(await errors(CreateTreatmentPlanDto, { ...valid, description: 'x'.repeat(5001) })).toContain('description');
    });

    it('rejects goals array exceeding 50 items', async () => {
      const goals = Array.from({ length: 51 }, () => ({ goal: 'test' }));
      expect(await errors(CreateTreatmentPlanDto, { ...valid, goals })).toContain('goals');
    });

    it('rejects diagnosisIds exceeding 50 items', async () => {
      const ids = Array.from({ length: 51 }, () => '123e4567-e89b-12d3-a456-426614174000');
      expect(await errors(CreateTreatmentPlanDto, { ...valid, diagnosisIds: ids })).toContain('diagnosisIds');
    });
  });

  // ─── ProviderDirectoryQueryDto ──────────────────────────────────────────────
  describe('ProviderDirectoryQueryDto', () => {
    it('rejects search exceeding 200 chars', async () => {
      expect(await errors(ProviderDirectoryQueryDto, { search: 'x'.repeat(201) })).toContain('search');
    });

    it('rejects specialty exceeding 100 chars', async () => {
      expect(await errors(ProviderDirectoryQueryDto, { specialty: 'x'.repeat(101) })).toContain('specialty');
    });
  });

  // ─── CreateMedicalRecordDto ─────────────────────────────────────────────────
  describe('CreateMedicalRecordDto', () => {
    const valid = {
      patientId: '123e4567-e89b-12d3-a456-426614174000',
      recordType: RecordType.CONSULTATION,
    };

    it('accepts a valid UUID patientId', async () => {
      expect(await errors(CreateMedicalRecordDto, valid)).toHaveLength(0);
    });

    it('rejects non-UUID patientId', async () => {
      expect(await errors(CreateMedicalRecordDto, { ...valid, patientId: 'patient-12345-anon' })).toContain('patientId');
    });

    it('rejects non-UUID providerId', async () => {
      expect(await errors(CreateMedicalRecordDto, { ...valid, providerId: 'provider-67890-anon' })).toContain('providerId');
    });
  });
});
