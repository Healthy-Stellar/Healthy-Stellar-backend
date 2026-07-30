import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { INestApplication } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { randomUUID } from 'crypto';
import { DatabaseConfig } from '../src/config/database.config';
import { GdprModule } from '../src/gdpr/gdpr.module';
import { DeletionRegistryService } from '../src/gdpr/services/deletion-registry.service';
import { User, UserRole } from '../src/auth/entities/user.entity';
import { MedicalRecord, RecordType } from '../src/medical-records/entities/medical-record.entity';
import { ClinicalNote } from '../src/medical-records/entities/clinical-note.entity';
import { LabOrder } from '../src/laboratory/entities/lab-order.entity';
import { Specimen } from '../src/laboratory/entities/specimen.entity';
import { LabResult } from '../src/laboratory/entities/lab-result.entity';
import { Prescription } from '../src/pharmacy/entities/prescription.entity';
import {
  Appointment,
  AppointmentStatus,
  AppointmentType,
  MedicalPriority,
} from '../src/appointments/entities/appointment.entity';
import { AuditLog } from '../src/common/entities/audit-log.entity';

/**
 * Exercises the GDPR right-to-erasure cascade end-to-end against a real
 * database connection: seeds patient-identifiable rows across laboratory,
 * pharmacy, appointments, and medical-records, previews the cascade (dry
 * run), then runs it for real and asserts every module's rows are gone and
 * an audit log entry was recorded for each cascade step.
 */
describe('GDPR right-to-erasure cascade (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let deletionRegistry: DeletionRegistryService;

  const userId = randomUUID();
  const orderNumber = `ORD-${userId.slice(0, 8)}`;
  const specimenId = `SPEC-${userId.slice(0, 8)}`;
  let labOrderId: string;
  let appointmentId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TypeOrmModule.forRootAsync({ useClass: DatabaseConfig }), GdprModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    deletionRegistry = moduleFixture.get(DeletionRegistryService);

    await dataSource.getRepository(User).save({
      id: userId,
      email: `${userId}@example.com`,
      passwordHash: 'not-a-real-hash',
      firstName: 'Jane',
      lastName: 'Doe',
      role: UserRole.PATIENT,
    });

    const labOrder = await dataSource.getRepository(LabOrder).save({
      orderNumber,
      patientId: userId,
      providerId: randomUUID(),
      tests: [{ testId: 't1', testCode: 'GLUCOSE', testName: 'Glucose' }],
      status: 'completed',
      orderDate: new Date(),
    });
    labOrderId = labOrder.id;

    await dataSource.getRepository(Specimen).save({
      specimenId,
      orderId: labOrderId,
      patientId: userId,
      specimenType: 'blood',
      collectedAt: new Date(),
      collectedBy: 'phlebotomist-1',
    });

    await dataSource.getRepository(LabResult).save({
      orderId: labOrderId,
      testId: 't1',
      testCode: 'GLUCOSE',
      testName: 'Glucose',
      result: '95',
      unit: 'mg/dL',
      performedBy: 'lab-tech-1',
      performedAt: new Date(),
    });

    await dataSource.getRepository(Prescription).save({
      prescriptionNumber: `RX-${userId.slice(0, 8)}`,
      patientId: userId,
      providerId: randomUUID(),
      drugId: 'drug-1',
      drugName: 'Amoxicillin',
      dosage: '500mg',
      quantity: 30,
      refills: 0,
      refillsRemaining: 0,
      instructions: 'Take twice daily',
      prescribedDate: new Date(),
    });

    const appointment = await dataSource.getRepository(Appointment).save({
      tenantId: randomUUID(),
      patientId: userId,
      doctorId: randomUUID(),
      appointmentDate: new Date(),
      duration: 30,
      type: AppointmentType.ROUTINE,
      status: AppointmentStatus.SCHEDULED,
      priority: MedicalPriority.NORMAL,
    });
    appointmentId = appointment.id;

    await dataSource.getRepository(MedicalRecord).save({
      patientId: userId,
      recordType: RecordType.CONSULTATION,
    } as Partial<MedicalRecord>);

    await dataSource.getRepository(ClinicalNote).save({
      patientId: userId,
      title: 'Follow-up note',
    } as Partial<ClinicalNote>);
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports a non-zero preview for every seeded module without deleting anything (dry run)', async () => {
    const preview = await deletionRegistry.previewForUser(userId);
    const byModule = new Map(preview.map((p) => [p.moduleName, p.estimatedCount]));

    expect(byModule.get('laboratory')).toBeGreaterThan(0);
    expect(byModule.get('pharmacy')).toBeGreaterThan(0);
    expect(byModule.get('appointments')).toBeGreaterThan(0);
    expect(byModule.get('medical-records')).toBeGreaterThan(0);
    expect(byModule.get('clinical-notes')).toBeGreaterThan(0);

    // Nothing should have been touched by the dry run.
    expect(await dataSource.getRepository(LabOrder).count({ where: { patientId: userId } })).toBe(1);
    expect(await dataSource.getRepository(Appointment).count({ where: { id: appointmentId } })).toBe(1);
  });

  it('cascades deletion across every module and logs an audit entry per step', async () => {
    await deletionRegistry.deleteAllForUser(userId);

    expect(await dataSource.getRepository(LabOrder).count({ where: { patientId: userId } })).toBe(0);
    expect(await dataSource.getRepository(Specimen).count({ where: { patientId: userId } })).toBe(0);
    expect(
      await dataSource.getRepository(LabResult).count({ where: { orderId: In([labOrderId, orderNumber]) } }),
    ).toBe(0);
    expect(await dataSource.getRepository(Prescription).count({ where: { patientId: userId } })).toBe(0);
    expect(await dataSource.getRepository(Appointment).count({ where: { patientId: userId } })).toBe(0);
    expect(await dataSource.getRepository(MedicalRecord).count({ where: { patientId: userId } })).toBe(0);
    expect(await dataSource.getRepository(ClinicalNote).count({ where: { patientId: userId } })).toBe(0);

    const steps = await dataSource.getRepository(AuditLog).find({
      where: { userId, operation: 'GDPR_ERASURE_CASCADE_STEP' },
    });
    const loggedModules = steps.map((s) => s.entityType);

    expect(loggedModules).toEqual(
      expect.arrayContaining(['laboratory', 'pharmacy', 'appointments', 'medical-records', 'clinical-notes']),
    );
    expect(steps.every((s) => s.status === 'success')).toBe(true);

    // Re-running the dry run afterwards should now report nothing left to delete.
    const previewAfter = await deletionRegistry.previewForUser(userId);
    const labAfter = previewAfter.find((p) => p.moduleName === 'laboratory');
    expect(labAfter?.estimatedCount).toBe(0);
  });
});
