import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly isTestEnv: boolean;
  private readonly fromAddress: string;
  private readonly fromName: string;

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {
    this.isTestEnv = configService.get<string>('NODE_ENV') === 'test';
    this.fromAddress = configService.get<string>('MAIL_FROM_ADDRESS', 'noreply@healthystellar.com');
    this.fromName = configService.get<string>('MAIL_FROM_NAME', 'HealthyStellar');
  }

  async sendReportReadyEmail(
    patientEmail: string,
    jobId: string,
    downloadToken: string,
  ): Promise<void> {
    const appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
    const downloadLink = `${appUrl}/reports/${jobId}/download?token=${downloadToken}`;
    const subject = 'Your Medical Record Report is Ready';

    if (this.isTestEnv) {
      this.logger.log(
        `[TEST] Would send '${subject}' to ${patientEmail} — download link: ${downloadLink}`,
      );
      return;
    }

    this.logger.log(`Sending report-ready email to ${patientEmail} for job ${jobId}`);

    await this.mailerService.sendMail({
      to: patientEmail,
      from: `"${this.fromName}" <${this.fromAddress}>`,
      subject,
      text:
        `Your medical record activity report is ready for download.\n\n` +
        `Download link: ${downloadLink}\n\n` +
        `This link is single-use and will expire in 48 hours.`,
      html:
        `<p>Your medical record activity report is ready for download.</p>` +
        `<p><a href="${downloadLink}">Download Report</a></p>` +
        `<p><small>This link is single-use and will expire in 48 hours.</small></p>`,
    });

    this.logger.log(`Report-ready email sent to ${patientEmail} for job ${jobId}`);
  }
}
