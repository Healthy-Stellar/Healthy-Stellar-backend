import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: parseInt(process.env.MAIL_PORT || "587"),
      secure: process.env.MAIL_PORT === "465",
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD,
      },
    });
  }

  async sendWelcomeEmail(
    tenantName: string,
    adminEmail: string,
    adminName: string,
    tenantUrl: string,
  ): Promise<void> {
    this.logger.debug(`Sending welcome email to ${adminEmail}`);

    try {
      const subject = `Welcome to Healthcare Platform - Tenant Setup Complete`;
      const htmlContent = `
        <h2>Welcome to Healthcare Platform</h2>
        <p>Hello ${adminName},</p>
        <p>Your organization '<strong>${tenantName}</strong>' has been successfully set up and is ready to use.</p>
        
        <h3>Getting Started</h3>
        <ul>
          <li>Your tenant URL: <a href="${tenantUrl}">${tenantUrl}</a></li>
          <li>Login with your admin credentials</li>
          <li>Configure your organization settings</li>
          <li>Invite your team members</li>
        </ul>

        <h3>Support</h3>
        <p>If you have any questions, please contact our support team at support@healthcare.local</p>

        <p>Best regards,<br/>Healthcare Platform Team</p>
      `;

      const mailOptions = {
        from: process.env.MAIL_FROM || "noreply@healthcare.local",
        to: adminEmail,
        subject,
        html: htmlContent,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Welcome email sent successfully to ${adminEmail}`);
    } catch (error) {
      this.logger.error(
        `Failed to send welcome email to ${adminEmail}: ${error.message}`,
      );
      throw error;
    }
  }

  async sendProvisioningErrorEmail(
    adminEmail: string,
    tenantName: string,
    errorMessage: string,
  ): Promise<void> {
    this.logger.debug(`Sending error email to ${adminEmail}`);

    try {
      const subject = `Healthcare Platform - Tenant Setup Failed`;
      const htmlContent = `
        <h2>Tenant Setup Error</h2>
        <p>Hello,</p>
        <p>Unfortunately, the setup for your organization '<strong>${tenantName}</strong>' encountered an error.</p>
        
        <h3>Error Details</h3>
        <pre>${errorMessage}</pre>

        <p>Our support team has been notified and will investigate this issue.</p>
        <p>Please contact support@healthcare.local for assistance.</p>

        <p>Best regards,<br/>Healthcare Platform Team</p>
      `;

      const mailOptions = {
        from: process.env.MAIL_FROM || "noreply@healthcare.local",
        to: adminEmail,
        subject,
        html: htmlContent,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Error email sent successfully to ${adminEmail}`);
    } catch (error) {
      this.logger.error(
        `Failed to send error email to ${adminEmail}: ${error.message}`,
      );
      // Don't throw - we don't want email failures to fail the entire provisioning
    }
  }
}
