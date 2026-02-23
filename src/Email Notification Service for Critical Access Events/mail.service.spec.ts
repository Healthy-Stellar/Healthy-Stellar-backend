// src/mail/mail.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { MailService, Patient, Provider, MedicalRecord } from './mail.service';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

const mockPatient: Patient = {
  id: 'patient-1',
  email: 'patient@example.com',
  name: 'Jane Doe',
};

const mockProvider: Provider = {
  id: 'provider-1',
  name: 'Dr. Smith',
  email: 'dr.smith@hospital.com',
  specialty: 'Cardiology',
};

const mockRecord: MedicalRecord = {
  id: 'record-1',
  title: 'Cardiac MRI Report',
  uploadedAt: new Date('2024-01-15'),
  type: 'Imaging',
};

describe('MailService', () => {
  let service: MailService;
  let mailerService: jest.Mocked<MailerService>;

  const buildModule = async (nodeEnv: string) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: MailerService,
          useValue: { sendMail: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultVal?: any) => {
              const env: Record<string, any> = {
                NODE_ENV: nodeEnv,
                APP_URL: 'http://localhost:3000',
                UNSUBSCRIBE_SECRET: 'test-secret',
              };
              return env[key] ?? defaultVal;
            },
          },
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    mailerService = module.get(MailerService);
  };

  describe('in test environment', () => {
    beforeEach(() => buildModule('test'));

    it('should NOT call mailerService.sendMail when NODE_ENV=test', async () => {
      await service.sendAccessGrantedEmail(mockPatient, mockProvider, mockRecord);
      expect(mailerService.sendMail).not.toHaveBeenCalled();
    });

    it('skips sendAccessRevokedEmail in test env', async () => {
      await service.sendAccessRevokedEmail(mockPatient, mockProvider, mockRecord);
      expect(mailerService.sendMail).not.toHaveBeenCalled();
    });

    it('skips sendRecordUploadedEmail in test env', async () => {
      await service.sendRecordUploadedEmail(mockPatient, mockRecord);
      expect(mailerService.sendMail).not.toHaveBeenCalled();
    });

    it('skips sendSuspiciousAccessEmail in test env', async () => {
      await service.sendSuspiciousAccessEmail(mockPatient, {
        accessedAt: new Date(),
        ipAddress: '1.2.3.4',
        accessorName: 'Unknown',
      });
      expect(mailerService.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('in production environment', () => {
    beforeEach(() => buildModule('production'));

    it('sends access-granted email with correct template and context', async () => {
      await service.sendAccessGrantedEmail(mockPatient, mockProvider, mockRecord);

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockPatient.email,
          template: 'access-granted/access-granted',
          context: expect.objectContaining({
            patientName: mockPatient.name,
            granteeName: mockProvider.name,
            granteeSpecialty: mockProvider.specialty,
            unsubscribeUrl: expect.stringContaining('/notifications/unsubscribe'),
          }),
        }),
      );
    });

    it('includes unsubscribe URL in all emails', async () => {
      await service.sendRecordUploadedEmail(mockPatient, mockRecord);

      const call = mailerService.sendMail.mock.calls[0][0];
      expect(call.context.unsubscribeUrl).toMatch(/\/notifications\/unsubscribe\?token=.+&patientId=patient-1/);
    });

    it('sends suspicious-access email with high urgency subject', async () => {
      await service.sendSuspiciousAccessEmail(mockPatient, {
        accessedAt: new Date(),
        ipAddress: '192.168.1.1',
        location: 'Lagos, NG',
        accessorName: 'Dr. Unknown',
      });

      const call = mailerService.sendMail.mock.calls[0][0];
      expect(call.subject).toContain('Suspicious');
      expect(call.template).toBe('suspicious-access/suspicious-access');
    });
  });
});
