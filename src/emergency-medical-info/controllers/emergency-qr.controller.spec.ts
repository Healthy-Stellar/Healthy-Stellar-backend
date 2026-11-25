import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EmergencyQrController } from './emergency-qr.controller';
import { EmergencyQrService } from '../services/emergency-qr.service';
import { EmergencyAccessService } from '../services/emergency-access.service';
import { EmergencyMedicalInfoService } from '../services/emergency-medical-info.service';
import { EmergencyMedicalInfo, BloodType } from '../entities/emergency-medical-info.entity';
import { Patient } from '../../users/entities/patient.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

// Patient record ids intentionally differ from user ids.
const PATIENTS = [
  { id: 'patient-a', userId: 'user-a' },
  { id: 'patient-b', userId: 'user-b' },
];

// Raw JWT payload as set by JwtAuthGuard: `userId`, no `id`/`sub`/`patientId`.
const owner = { userId: 'user-a', role: 'patient', organizationId: 'org-1' };
const otherPatient = { userId: 'user-b', role: 'patient', organizationId: 'org-1' };

function makeRecord(): EmergencyMedicalInfo {
  return {
    id: 'emi-a',
    patientId: 'patient-a',
    bloodType: BloodType.O_POS,
    allergies: [],
    currentMedications: [],
    chronicConditions: [],
    dnrStatus: false,
    emergencyContacts: [],
    insuranceInfo: null,
    additionalNotes: null,
    qrOptIn: false,
    qrToken: null,
    qrIssuedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as EmergencyMedicalInfo;
}

async function build() {
  const record = makeRecord();
  const emiRepo = {
    findOne: jest.fn().mockImplementation(async ({ where }) =>
      where.patientId === record.patientId ? record : null,
    ),
    save: jest.fn().mockImplementation(async (r) => r),
  };
  const patientRepo = {
    findOne: jest.fn().mockImplementation(async ({ where }) =>
      PATIENTS.find((p) => p.userId === where.userId) ?? null,
    ),
  };
  const config = {
    get: jest.fn().mockImplementation((key: string, def?: string) =>
      key === 'QR_HMAC_SECRET' ? 'test-qr-secret' : def,
    ),
  };

  const module: TestingModule = await Test.createTestingModule({
    controllers: [EmergencyQrController],
    providers: [
      EmergencyQrService,
      EmergencyAccessService,
      { provide: getRepositoryToken(EmergencyMedicalInfo), useValue: emiRepo },
      { provide: getRepositoryToken(Patient), useValue: patientRepo },
      { provide: ConfigService, useValue: config },
      { provide: EmergencyMedicalInfoService, useValue: { getLastUpdater: jest.fn().mockResolvedValue(null) } },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .compile();

  return { controller: module.get(EmergencyQrController), record };
}

const req = (user: any) => ({ user }) as any;
const res = () => ({ set: jest.fn(), send: jest.fn() }) as any;

describe('EmergencyQrController', () => {
  it('lets the owner opt in, download and revoke', async () => {
    const { controller, record } = await build();

    const optIn = await controller.optIn('patient-a', req(owner));
    expect(optIn.verifyUrl).toContain('/emergency-medical-info/qr/verify/');
    expect(record.qrOptIn).toBe(true);

    const response = res();
    await controller.download('patient-a', req(owner), response);
    expect(response.send).toHaveBeenCalledWith(expect.any(Buffer));

    await controller.revoke('patient-a', req(owner));
    expect(record.qrOptIn).toBe(false);
    expect(record.qrToken).toBeNull();
  });

  it('returns 403 to another patient on every route', async () => {
    const { controller } = await build();

    await expect(controller.optIn('patient-a', req(otherPatient))).rejects.toThrow(ForbiddenException);
    await expect(controller.download('patient-a', req(otherPatient), res())).rejects.toThrow(
      ForbiddenException,
    );
    await expect(controller.revoke('patient-a', req(otherPatient))).rejects.toThrow(ForbiddenException);
  });

  it('returns 403 when the user has no patient record', async () => {
    const { controller } = await build();
    await expect(
      controller.optIn('patient-a', req({ userId: 'nobody', role: 'patient' })),
    ).rejects.toThrow(ForbiddenException);
  });
});
