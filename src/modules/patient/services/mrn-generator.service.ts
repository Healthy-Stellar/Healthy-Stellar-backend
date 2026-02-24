import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../entities/patient.entity';

@Injectable()
export class MrnGeneratorService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
  ) {}

  /**
   * Generate a unique Medical Record Number
   * Format: HHS-YYYY-NNNNNN (HHS = Healthy-Stellar, YYYY = Year, NNNNNN = Sequential)
   */
  async generateMrn(): Promise<string> {
    const prefix = 'HHS';
    const year = new Date().getFullYear();

    // Get the count of patients created this year
    const startOfYear = new Date(year, 0, 1);
    const count = await this.patientRepository
      .createQueryBuilder('patient')
      .where('patient.createdAt >= :startOfYear', { startOfYear })
      .getCount();

    const sequence = (count + 1).toString().padStart(6, '0');
    const mrn = `${prefix}-${year}-${sequence}`;

    // Verify uniqueness (should never happen, but safety check)
    const exists = await this.patientRepository.findOne({ where: { mrn } });
    if (exists) {
      // Add random suffix if collision (extremely unlikely)
      const randomSuffix = Math.floor(Math.random() * 99)
        .toString()
        .padStart(2, '0');
      return `${mrn}-${randomSuffix}`;
    }

    return mrn;
  }

  /**
   * Validate MRN format
   */
  isValidMrn(mrn: string): boolean {
    const mrnRegex = /^HHS-\d{4}-\d{6}(-\d{2})?$/;
    return mrnRegex.test(mrn);
  }
}
