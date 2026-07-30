import { Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as PDFDocument from 'pdfkit';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Billing } from '../entities/billing.entity';
import { MAILER_SERVICE } from '../../notifications/services/notifications.service';

const SIGNING_SECRET = process.env.INVOICE_SIGNING_SECRET ?? 'dev-signing-secret';
const SIGNED_URL_TTL_S = parseInt(process.env.INVOICE_URL_TTL_S ?? '3600', 10);
const STORAGE_DIR = process.env.INVOICE_STORAGE_DIR ?? path.join(process.cwd(), 'storage', 'invoices');
const TAX_RATE = parseFloat(process.env.INVOICE_TAX_RATE ?? '0');

@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);
  private readonly emailEnabled = process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true';

  constructor(
    @InjectRepository(Billing)
    private readonly billingRepository: Repository<Billing>,
    @Optional() @Inject(MAILER_SERVICE) private readonly mailerService?: any,
  ) {}

  private async loadBilling(id: string): Promise<Billing> {
    const billing = await this.billingRepository.findOne({
      where: { id },
      relations: ['lineItems', 'payments'],
    });
    if (!billing) {
      throw new NotFoundException(`Billing with ID ${id} not found`);
    }
    return billing;
  }

  private money(value: number | string): string {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  /** Render a structured invoice PDF for the given billing record. */
  async generateInvoicePdf(id: string): Promise<Buffer> {
    const billing = await this.loadBilling(id);
    return this.buildPdf(billing);
  }

  private buildPdf(billing: Billing): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).text('Invoice', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10);
      doc.text(`Invoice Number: ${billing.invoiceNumber}`);
      doc.text(`Patient: ${billing.patientName}`);
      doc.text(`Date: ${new Date(billing.serviceDate).toLocaleDateString()}`);
      if (billing.providerName) doc.text(`Provider: ${billing.providerName}`);
      if (billing.facilityName) doc.text(`Facility: ${billing.facilityName}`);
      doc.moveDown();

      doc.fontSize(14).text('Itemised Charges');
      doc.moveDown(0.5);
      doc.fontSize(9);
      (billing.lineItems || []).forEach((item) => {
        doc.text(
          `${item.cptCode} - ${item.cptDescription}  |  ${item.units} x ${this.money(
            item.unitCharge,
          )} = ${this.money(item.totalCharge)}`,
        );
      });
      doc.moveDown();

      const subtotal = Number(billing.totalCharges || 0);
      const tax = +(subtotal * TAX_RATE).toFixed(2);
      const total = +(subtotal + tax).toFixed(2);
      const paymentReference =
        billing.payments && billing.payments.length > 0
          ? billing.payments[billing.payments.length - 1].paymentNumber
          : 'N/A';

      doc.fontSize(10);
      doc.text(`Subtotal: ${this.money(subtotal)}`, { align: 'right' });
      doc.text(`Tax (${(TAX_RATE * 100).toFixed(2)}%): ${this.money(tax)}`, { align: 'right' });
      doc.text(`Total: ${this.money(total)}`, { align: 'right' });
      doc.text(`Payments: ${this.money(billing.totalPayments)}`, { align: 'right' });
      doc.text(`Balance Due: ${this.money(billing.balance)}`, { align: 'right' });
      doc.moveDown();
      doc.text(`Payment Reference: ${paymentReference}`);

      doc.end();
    });
  }

  /** Persist the invoice PDF to file storage and return a time-limited signed URL. */
  async storeInvoicePdf(id: string): Promise<{ filePath: string; signedUrl: string }> {
    const buffer = await this.generateInvoicePdf(id);
    await fs.promises.mkdir(STORAGE_DIR, { recursive: true });
    const filePath = path.join(STORAGE_DIR, `${id}.pdf`);
    await fs.promises.writeFile(filePath, buffer);
    return { filePath, signedUrl: this.generateSignedUrl(id) };
  }

  /** Generate an HMAC-signed, time-limited download URL for the invoice PDF. */
  generateSignedUrl(id: string): string {
    const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_S;
    const urlPath = `/billing/invoices/${id}/pdf`;
    const sig = crypto
      .createHmac('sha256', SIGNING_SECRET)
      .update(`${urlPath}:${expiresAt}`)
      .digest('hex');
    return `${urlPath}?expires=${expiresAt}&sig=${sig}`;
  }

  /** Verify a signed invoice download URL signature. */
  verifySignedUrl(id: string, expires?: string, sig?: string): boolean {
    if (!expires || !sig) return false;
    const expiresAt = parseInt(expires, 10);
    if (Number.isNaN(expiresAt) || Date.now() / 1000 > expiresAt) return false;
    const urlPath = `/billing/invoices/${id}/pdf`;
    const expected = crypto
      .createHmac('sha256', SIGNING_SECRET)
      .update(`${urlPath}:${expiresAt}`)
      .digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return false;
    }
  }

  /** Generate + store the invoice and email it as a PDF attachment once payment is confirmed. */
  async sendInvoiceEmail(id: string, to?: string): Promise<void> {
    const billing = await this.loadBilling(id);
    const buffer = await this.buildPdf(billing);
    await fs.promises.mkdir(STORAGE_DIR, { recursive: true });
    await fs.promises.writeFile(path.join(STORAGE_DIR, `${id}.pdf`), buffer);

    const recipient = to ?? process.env.BILLING_NOTIFICATIONS_EMAIL;
    const subject = `Payment received — invoice ${billing.invoiceNumber}`;
    const attachment = { filename: `${billing.invoiceNumber}.pdf`, content: buffer };

    if (!this.emailEnabled || !this.mailerService || !recipient) {
      this.logger.log(
        `[Mock Email] Invoice ${billing.invoiceNumber} PDF ready for ${recipient ?? billing.patientName}`,
      );
      return;
    }

    await this.mailerService.sendMail({
      to: recipient,
      subject,
      text: `Thank you. Your payment for invoice ${billing.invoiceNumber} has been confirmed.`,
      attachments: [attachment],
    });
  }
}
