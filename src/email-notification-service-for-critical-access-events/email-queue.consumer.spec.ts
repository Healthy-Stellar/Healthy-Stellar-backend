import { EmailQueueConsumer } from './email-queue.consumer';
import { MailService } from './mail.service';
import { EmailLookupService } from './email-lookup.service';
import { EmailJobType } from './email-queue.producer';

describe('EmailQueueConsumer', () => {
  let consumer: EmailQueueConsumer;
  let mailService: jest.Mocked<MailService>;
  let lookup: jest.Mocked<EmailLookupService>;
  let digestQueue: { add: jest.Mock };

  beforeEach(() => {
    mailService = {
      sendAccessGrantedEmail: jest.fn().mockResolvedValue(undefined),
      sendAccessRevokedEmail: jest.fn().mockResolvedValue(undefined),
      sendRecordUploadedEmail: jest.fn().mockResolvedValue(undefined),
      sendSuspiciousAccessEmail: jest.fn().mockResolvedValue(undefined),
      sendDigestEmail: jest.fn().mockResolvedValue(undefined),
    } as any;

    lookup = {
      findPatient: jest
        .fn()
        .mockResolvedValue({ id: 'patient-1', email: 'p@example.com', name: 'Pat' }),
      findProvider: jest
        .fn()
        .mockResolvedValue({ id: 'prov-1', name: 'Dr. Who', email: 'dr@example.com' }),
      findRecord: jest.fn().mockResolvedValue({ id: 'rec-1', title: 'Lab Result' }),
      findAccessEvent: jest.fn().mockResolvedValue({
        accessedAt: new Date(),
        ipAddress: '1.2.3.4',
        accessorName: 'Someone',
      }),
      prefersDigestDelivery: jest.fn(),
    } as any;

    digestQueue = { add: jest.fn().mockResolvedValue(undefined) };

    consumer = new EmailQueueConsumer(mailService, lookup, digestQueue as any);
  });

  it('always sends suspicious-access (critical) emails immediately, even when the patient prefers digest delivery', async () => {
    lookup.prefersDigestDelivery.mockResolvedValue(true);

    const job = {
      id: '1',
      name: EmailJobType.SUSPICIOUS_ACCESS,
      attemptsMade: 0,
      data: {
        type: EmailJobType.SUSPICIOUS_ACCESS,
        patientId: 'patient-1',
        accessEventId: 'evt-1',
      },
    } as any;

    await consumer.process(job);

    expect(mailService.sendSuspiciousAccessEmail).toHaveBeenCalled();
    expect(digestQueue.add).not.toHaveBeenCalled();
  });

  it('queues non-critical access-granted emails for digest delivery when the patient prefers digest mode', async () => {
    lookup.prefersDigestDelivery.mockResolvedValue(true);

    const job = {
      id: '2',
      name: EmailJobType.ACCESS_GRANTED,
      attemptsMade: 0,
      data: {
        type: EmailJobType.ACCESS_GRANTED,
        patientId: 'patient-1',
        granteeId: 'prov-1',
        recordId: 'rec-1',
      },
    } as any;

    await consumer.process(job);

    expect(digestQueue.add).toHaveBeenCalledWith(EmailJobType.ACCESS_GRANTED, job.data);
    expect(mailService.sendAccessGrantedEmail).not.toHaveBeenCalled();
  });

  it('sends non-critical emails immediately when the patient prefers immediate delivery', async () => {
    lookup.prefersDigestDelivery.mockResolvedValue(false);

    const job = {
      id: '3',
      name: EmailJobType.RECORD_UPLOADED,
      attemptsMade: 0,
      data: { type: EmailJobType.RECORD_UPLOADED, patientId: 'patient-1', recordId: 'rec-1' },
    } as any;

    await consumer.process(job);

    expect(mailService.sendRecordUploadedEmail).toHaveBeenCalled();
    expect(digestQueue.add).not.toHaveBeenCalled();
  });
});
