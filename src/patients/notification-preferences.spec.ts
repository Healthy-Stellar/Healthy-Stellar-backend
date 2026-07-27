import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PatientsService } from './patients.service';
import { Patient } from './entities/patient.entity';
import {
  NotificationChannel,
  UpdateNotificationPreferencesDto,
} from './dto/update-notification-preferences.dto';
import { DEFAULT_NOTIFICATION_PREFERENCES } from './types/notification-preferences.type';
import { UserRole } from '../auth/entities/user.entity';

describe('PatientsService.updateNotificationPreferences', () => {
  let service: PatientsService;

  const patientId = 'patient-123';
  const otherPatientId = 'patient-456';

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const makePatient = (overrides: Partial<Patient> = {}): Patient =>
    ({
      id: patientId,
      mrn: 'MRN-123',
      firstName: 'Jane',
      lastName: 'Doe',
      dateOfBirth: '1990-01-01',
      sex: 'female',
      isAdmitted: false,
      isActive: true,
      allowedCountries: null,
      isPhoneVerified: false,
      notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
      ...overrides,
    }) as Patient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        {
          provide: getRepositoryToken(Patient),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<PatientsService>(PatientsService);
    jest.clearAllMocks();
    mockRepository.save.mockImplementation(async (patient: Patient) => patient);
  });

  it('merges partial preferences over the existing settings', async () => {
    mockRepository.findOne.mockResolvedValue(makePatient());

    const result = await service.updateNotificationPreferences(
      patientId,
      patientId,
      UserRole.PATIENT,
      { newRecord: false, accessGranted: false },
    );

    expect(result.notificationPreferences.newRecord).toBe(false);
    expect(result.notificationPreferences.accessGranted).toBe(false);
    expect(result.notificationPreferences.accessRevoked).toBe(true);
    expect(result.notificationPreferences.appointmentReminder).toBe(true);
    expect(result.notificationPreferences.channels).toEqual([NotificationChannel.WEBSOCKET]);
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
  });

  it('allows non-SMS channels without phone verification', async () => {
    mockRepository.findOne.mockResolvedValue(makePatient());

    const dto: UpdateNotificationPreferencesDto = {
      channels: [NotificationChannel.EMAIL, NotificationChannel.WEBSOCKET],
    };
    const result = await service.updateNotificationPreferences(
      patientId,
      patientId,
      UserRole.PATIENT,
      dto,
    );

    expect(result.notificationPreferences.channels).toEqual(dto.channels);
  });

  it('persists all boolean flags when set to false', async () => {
    mockRepository.findOne.mockResolvedValue(makePatient());

    const result = await service.updateNotificationPreferences(
      patientId,
      patientId,
      UserRole.PATIENT,
      {
        newRecord: false,
        accessGranted: false,
        accessRevoked: false,
        appointmentReminder: false,
      },
    );

    expect(result.notificationPreferences).toMatchObject({
      newRecord: false,
      accessGranted: false,
      accessRevoked: false,
      appointmentReminder: false,
    });
  });

  it('rejects SMS when the phone number is not verified', async () => {
    mockRepository.findOne.mockResolvedValue(makePatient({ isPhoneVerified: false }));

    await expect(
      service.updateNotificationPreferences(patientId, patientId, UserRole.PATIENT, {
        channels: [NotificationChannel.SMS],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it('allows SMS when the phone number is verified', async () => {
    mockRepository.findOne.mockResolvedValue(makePatient({ isPhoneVerified: true }));

    const result = await service.updateNotificationPreferences(
      patientId,
      patientId,
      UserRole.PATIENT,
      { channels: [NotificationChannel.WEBSOCKET, NotificationChannel.SMS] },
    );

    expect(result.notificationPreferences.channels).toContain(NotificationChannel.SMS);
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
  });

  it('rejects updates for another patient profile', async () => {
    mockRepository.findOne.mockResolvedValue(makePatient());

    await expect(
      service.updateNotificationPreferences(patientId, otherPatientId, UserRole.PATIENT, {
        newRecord: false,
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it('rejects non-patient users', async () => {
    mockRepository.findOne.mockResolvedValue(makePatient());

    await expect(
      service.updateNotificationPreferences(patientId, patientId, UserRole.ADMIN, {
        newRecord: false,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws when the patient does not exist', async () => {
    mockRepository.findOne.mockResolvedValue(null);

    await expect(
      service.updateNotificationPreferences(patientId, patientId, UserRole.PATIENT, {
        newRecord: false,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('falls back to defaults when stored preferences are missing', async () => {
    mockRepository.findOne.mockResolvedValue(
      makePatient({ notificationPreferences: null as any }),
    );

    const result = await service.updateNotificationPreferences(
      patientId,
      patientId,
      UserRole.PATIENT,
      { appointmentReminder: false },
    );

    expect(result.notificationPreferences.newRecord).toBe(true);
    expect(result.notificationPreferences.appointmentReminder).toBe(false);
    expect(result.notificationPreferences.channels).toEqual([NotificationChannel.WEBSOCKET]);
  });
});
