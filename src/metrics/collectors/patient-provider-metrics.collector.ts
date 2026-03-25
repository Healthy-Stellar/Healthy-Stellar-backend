import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interval } from '@nestjs/schedule';
import { CustomMetricsService } from '../custom-metrics.service';
import { Patient } from '../../patients/entities/patient.entity';

const POLL_INTERVAL_MS = 30_000; // 30 s

@Injectable()
export class PatientProviderMetricsCollector implements OnModuleInit {
  private readonly logger = new Logger(PatientProviderMetricsCollector.name);

  constructor(
    private readonly metrics: CustomMetricsService,
    @InjectRepository(Patient) private readonly patientRepo: Repository<Patient>,
  ) {}

  async onModuleInit() {
    await this.collect();
  }

  @Interval(POLL_INTERVAL_MS)
  async collect() {
    try {
      const activePatients = await this.patientRepo.count({ where: { isActive: true } });
      this.metrics.setActivePatients(activePatients);
    } catch (err) {
      this.logger.warn(`Failed to collect patient/provider metrics: ${(err as Error).message}`);
    }

    // active_providers_total: no Provider entity exists yet — set to 0 as placeholder
    // Replace with a real repository query once the Provider entity is available.
    this.metrics.setActiveProviders(0);
  }
}
