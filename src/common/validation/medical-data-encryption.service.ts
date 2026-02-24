import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class MedicalDataEncryptionService {
  private encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-me';

  encryptPHI(data: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(this.padKey(this.encryptionKey)),
      iv,
    );

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  decryptPHI(encryptedData: string): string {
    const [ivHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(this.padKey(this.encryptionKey)),
      iv,
    );

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  private padKey(key: string): string {
    const buffer = Buffer.alloc(32);
    buffer.write(key);
    return buffer.toString();
  }

  hashSSN(ssn: string): string {
    return crypto.createHash('sha256').update(ssn).digest('hex');
  }

  maskSSN(ssn: string): string {
    return '***-**-' + ssn.slice(-4);
  }

  maskCreditCard(cardNumber: string): string {
    const cleaned = cardNumber.replace(/\D/g, '');
    return cleaned.slice(-4).padStart(cleaned.length, '*');
  }
}
