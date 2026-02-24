import { Injectable } from '@nestjs/common';

@Injectable()
export class MedicalDataSanitizerService {
  sanitizeText(text: string): string {
    if (!text || typeof text !== 'string') return '';

    return text
      .trim()
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[<>\"']/g, '') // Remove dangerous characters
      .substring(0, 5000); // Limit length
  }

  sanitizeCode(code: string): string {
    if (!code || typeof code !== 'string') return '';

    return code
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9\.\-]/g, '')
      .substring(0, 50);
  }

  sanitizeMRN(mrn: string): string {
    if (!mrn || typeof mrn !== 'string') return '';

    return mrn
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9\-]/g, '');
  }

  sanitizeEmail(email: string): string {
    if (!email || typeof email !== 'string') return '';

    return email
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9@.\-_]/g, '');
  }

  sanitizePhoneNumber(phone: string): string {
    if (!phone || typeof phone !== 'string') return '';

    return phone.trim().replace(/[^0-9+\-\(\) ]/g, '');
  }

  sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return this.sanitizeText(String(obj));

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (this.isPHIField(key)) {
        sanitized[key] = '***REDACTED***';
      } else if (typeof value === 'string') {
        sanitized[key] = this.sanitizeText(value);
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  private isPHIField(fieldName: string): boolean {
    const phiFields = ['ssn', 'creditCard', 'bankAccount', 'password'];
    return phiFields.some((field) => fieldName.toLowerCase().includes(field));
  }
}
