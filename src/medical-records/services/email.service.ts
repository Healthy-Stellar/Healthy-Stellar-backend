import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendReportReadyEmail(patientEmail: string, jobId: string, downloadToken: string) {
    const downloadLink = `${process.env.APP_URL}/reports/${jobId}/download?token=${downloadToken}`;
    
    this.logger.log(`Sending report ready email to ${patientEmail}`);
    this.logger.log(`Download link: ${downloadLink}`);
    
    // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
    // For now, just log the email details
    
    return {
      to: patientEmail,
      subject: 'Your Medical Record Report is Ready',
      body: `Your medical record activity report is ready for download. 
      
Download link: ${downloadLink}

This link is single-use and will expire in 48 hours.`,
    };
  }
}
