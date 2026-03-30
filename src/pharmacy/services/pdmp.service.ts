import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface PdmpRecord {
  prescriptionDate: string;
  drugName: string;
  schedule: string;
  quantity: number;
  daysSupply: number;
  prescriberId: string;
  pharmacyId: string;
}

export interface PdmpHistory {
  patientId: string;
  records: PdmpRecord[];
  multiplePrescriberCount: number;
  multiplePharmacyCount: number;
}

@Injectable()
export class PdmpService {
  private readonly logger = new Logger(PdmpService.name);
  private readonly pdmpUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.pdmpUrl = this.configService.get<string>('PDMP_API_URL', '');
  }

  /**
   * Fetch the patient's 90-day controlled substance history from the PDMP.
   * Returns null if PDMP_API_URL is not configured (non-blocking).
   */
  async getPatientHistory(patientId: string): Promise<PdmpHistory | null> {
    if (!this.pdmpUrl) {
      this.logger.warn('PDMP_API_URL not configured — skipping PDMP check');
      return null;
    }

    try {
      const { data } = await firstValueFrom(
        this.httpService.get<PdmpHistory>(`${this.pdmpUrl}/patients/${patientId}/history`, {
          params: { days: 90 },
          timeout: 5000,
        }),
      );
      return data;
    } catch (error) {
      this.logger.error(`PDMP lookup failed for patient ${patientId}: ${(error as Error).message}`);
      return null;
    }
  }
}
