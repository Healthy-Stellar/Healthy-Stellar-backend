import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { UserImportJob, ImportJobStatus } from '../entities/user-import-job.entity';
import { CsvImportJobPayload } from '../dto/bulk-import.dto';
import { QUEUE_NAMES } from '../../queues/queue.constants';
import { User, UserStatus } from '../../auth/entities/user.entity';
import { NotificationsService } from '../../notifications/services/notifications.service';

@Processor(QUEUE_NAMES.USER_CSV_IMPORT)
export class UserImportProcessor extends WorkerHost {
  private readonly logger = new Logger(UserImportProcessor.name);

  constructor(
    @InjectRepository(UserImportJob)
    private readonly jobRepo: Repository<UserImportJob>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationsService: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<CsvImportJobPayload>): Promise<void> {
    const { jobId, rows } = job.data;
    this.logger.log(`Processing CSV import job ${jobId} with ${rows.length} rows`);

    await this.jobRepo.update(jobId, { status: ImportJobStatus.PROCESSING });

    let successRows = 0;
    let failedRows = 0;
    const rowErrors: Array<{ row: number; errors: string[] }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // 1-based, +1 for header row

      try {
        const existing = await this.userRepo.findOne({ where: { email: row.email } });
        if (existing) {
          throw new Error(`Email already exists: ${row.email}`);
        }

        const tempPassword = crypto.randomBytes(16).toString('hex');
        const passwordHash = await bcrypt.hash(tempPassword, 10);

        const user = this.userRepo.create({
          email: row.email,
          firstName: row.firstName,
          lastName: row.lastName,
          role: row.role as any,
          department: row.department,
          passwordHash,
          status: UserStatus.PENDING_VERIFICATION,
          isActive: false,
        });

        const savedUser = await this.userRepo.save(user);

        await this.notificationsService.sendEmail(
          row.email,
          'Welcome to Healthy Stellar',
          'welcome',
          {
            firstName: row.firstName,
            lastName: row.lastName,
            role: row.role,
            tempPassword,
            loginUrl: process.env.APP_URL ?? '',
          },
        );

        successRows++;
        this.logger.debug(`Created user ${savedUser.id} for ${row.email}`);
      } catch (err: any) {
        failedRows++;
        rowErrors.push({ row: rowNumber, errors: [err.message] });
        this.logger.warn(`Row ${rowNumber} failed: ${err.message}`);
      }

      await this.jobRepo.update(jobId, { processedRows: i + 1, successRows, failedRows });
    }

    const finalStatus =
      failedRows === rows.length ? ImportJobStatus.FAILED : ImportJobStatus.COMPLETED;

    await this.jobRepo.update(jobId, {
      status: finalStatus,
      processedRows: rows.length,
      successRows,
      failedRows,
      rowErrors: rowErrors.length > 0 ? rowErrors : undefined,
    });

    this.logger.log(`Job ${jobId} ${finalStatus}: ${successRows} created, ${failedRows} failed`);
  }
}
