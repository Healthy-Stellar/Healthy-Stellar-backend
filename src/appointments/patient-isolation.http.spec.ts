/**
 * #1324 — patient scoping for appointments and consultations must use the
 * identity established by JwtAuthGuard, never client headers.
 *
 * Runs the real RequestContextMiddleware → JwtAuthGuard → RolesGuard →
 * controller → service chain over HTTP with in-memory repositories.
 */
jest.mock('./services/waitlist.service', () => ({ WaitlistService: class WaitlistService {} }));

import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { AppointmentController } from './controllers/appointment.controller';
import { ConsultationController } from './controllers/consultation.controller';
import { AppointmentService } from './services/appointment.service';
import { ConsultationService } from './services/consultation.service';
import { WaitlistService } from './services/waitlist.service';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { DoctorAvailability } from './entities/doctor-availability.entity';
import { ConsultationNote } from './entities/consultation-note.entity';
import { AuditService } from '../common/audit/audit.service';
import { UserRole } from '../auth/entities/user.entity';
import {
  HARNESS_TENANT_ID,
  InMemoryRepository,
  bearer,
  createJwtHttpHarness,
} from '../../test/utils/jwt-http-harness';

const PATIENT_A = { userId: 'patient-a', role: UserRole.PATIENT };
const PATIENT_B = { userId: 'patient-b', role: UserRole.PATIENT };
const DOCTOR = { userId: 'doctor-1', role: UserRole.PHYSICIAN };

describe('Appointment & consultation patient isolation (HTTP, #1324)', () => {
  let app: INestApplication;
  let appointments: InMemoryRepository<any>;
  let notes: InMemoryRepository<any>;
  let audit: { log: jest.Mock };

  const apptA = {
    id: 'appt-a',
    tenantId: HARNESS_TENANT_ID,
    patientId: PATIENT_A.userId,
    doctorId: DOCTOR.userId,
    status: AppointmentStatus.SCHEDULED,
  };
  const apptB = {
    id: 'appt-b',
    tenantId: HARNESS_TENANT_ID,
    patientId: PATIENT_B.userId,
    doctorId: DOCTOR.userId,
    status: AppointmentStatus.SCHEDULED,
  };

  beforeEach(async () => {
    appointments = new InMemoryRepository([apptA, apptB]);
    notes = new InMemoryRepository([
      { id: 'note-a', tenantId: HARNESS_TENANT_ID, appointmentId: 'appt-a', doctorId: DOCTOR.userId, appointment: apptA },
      { id: 'note-b', tenantId: HARNESS_TENANT_ID, appointmentId: 'appt-b', doctorId: DOCTOR.userId, appointment: apptB },
    ]);
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    app = await createJwtHttpHarness({
      controllers: [AppointmentController, ConsultationController],
      providers: [
        AppointmentService,
        ConsultationService,
        { provide: getRepositoryToken(Appointment), useValue: appointments },
        { provide: getRepositoryToken(DoctorAvailability), useValue: new InMemoryRepository() },
        { provide: getRepositoryToken(ConsultationNote), useValue: notes },
        { provide: JwtService, useValue: {} },
        { provide: AuditService, useValue: audit },
        { provide: ConfigService, useValue: { get: (_k: string, d?: any) => d } },
        { provide: WaitlistService, useValue: { notifyNextEligible: jest.fn().mockResolvedValue(undefined) } },
      ],
    });
  });

  afterEach(async () => {
    await app?.close();
  });

  describe('authentication', () => {
    it('rejects anonymous callers with 401', async () => {
      await request(app.getHttpServer()).get('/consultations/appointment/appt-b').expect(401);
      await request(app.getHttpServer()).patch('/appointments/appt-b/status').expect(401);
    });

    it('does not accept identity from an x-user-id header', async () => {
      await request(app.getHttpServer())
        .get('/consultations/appointment/appt-b')
        .set('x-user-id', PATIENT_B.userId)
        .expect(401);
    });
  });

  describe('consultations', () => {
    it("patient A cannot read patient B's consultation notes", async () => {
      const res = await request(app.getHttpServer())
        .get('/consultations/appointment/appt-b')
        .set('Authorization', bearer(PATIENT_A))
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('patient A can read their own consultation notes', async () => {
      const res = await request(app.getHttpServer())
        .get('/consultations/appointment/appt-a')
        .set('Authorization', bearer(PATIENT_A))
        .expect(200);
      expect(res.body.map((n: any) => n.id)).toEqual(['note-a']);
    });

    it('spoofed x-user-id is ignored for an authenticated patient', async () => {
      const res = await request(app.getHttpServer())
        .get('/consultations/appointment/appt-b')
        .set('Authorization', bearer(PATIENT_A))
        .set('x-user-id', PATIENT_B.userId)
        .expect(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('appointments', () => {
    it("patient A cannot cancel patient B's appointment", async () => {
      await request(app.getHttpServer())
        .patch('/appointments/appt-b/status')
        .set('Authorization', bearer(PATIENT_A))
        .send({ status: AppointmentStatus.CANCELLED })
        .expect(404);
      expect(appointments.rows.find((a) => a.id === 'appt-b').status).toBe(AppointmentStatus.SCHEDULED);
    });

    it('patient A can cancel their own appointment, audited as patient A', async () => {
      await request(app.getHttpServer())
        .patch('/appointments/appt-a/status')
        .set('Authorization', bearer(PATIENT_A))
        .set('x-user-id', 'spoofed-actor')
        .send({ status: AppointmentStatus.CANCELLED })
        .expect(200);
      expect(appointments.rows.find((a) => a.id === 'appt-a').status).toBe(AppointmentStatus.CANCELLED);
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ actorId: PATIENT_A.userId }));
    });

    it('patient A cannot book an appointment for patient B', async () => {
      await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', bearer(PATIENT_A))
        .send({ patientId: PATIENT_B.userId, doctorId: DOCTOR.userId, appointmentDate: new Date().toISOString(), duration: 30 })
        .expect(403);
    });

    it('patients cannot list appointments (staff-only route)', async () => {
      await request(app.getHttpServer())
        .get('/appointments')
        .set('Authorization', bearer(PATIENT_A))
        .expect(403);
    });

    it('a physician only sees their own appointments when listing', async () => {
      appointments.rows.push({ ...apptB, id: 'appt-other-doc', doctorId: 'doctor-2' });
      const res = await request(app.getHttpServer())
        .get('/appointments')
        .set('Authorization', bearer(DOCTOR))
        .expect(200);
      expect(res.body.map((a: any) => a.id).sort()).toEqual(['appt-a', 'appt-b']);
    });
  });

  describe('service-level scoping (listing as a patient)', () => {
    it('AppointmentService.findAll scopes a patient to their own rows', async () => {
      const service = app.get(AppointmentService);
      const { TenantContext } = await import('../tenant/context/tenant.context');
      const rows = await TenantContext.run(
        { tenantId: HARNESS_TENANT_ID, tenantSlug: HARNESS_TENANT_ID, schemaName: 'x' },
        () => service.findAll(PATIENT_A),
      );
      expect(rows.map((a) => a.id)).toEqual(['appt-a']);
    });
  });
});
