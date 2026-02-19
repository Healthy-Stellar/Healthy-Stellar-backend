import { Injectable, Logger } from '@nestjs/common';
import { MedicalCacheService } from './medical-cache.service';

/**
 * Patient Cache Service
 *
 * Specialized caching for patient-specific data access patterns.
 * Ensures real-time availability of critical patient information
 * during clinical encounters.
 */
@Injectable()
export class PatientCacheService {
  private readonly logger = new Logger(PatientCacheService.name);

  constructor(private readonly cacheService: MedicalCacheService) {}

  /**
   * Cache patient demographics for quick lookup.
   */
  cachePatientDemographics(patientId: string, data: any): void {
    this.cacheService.set(`patient:demographics:${patientId}`, data, {
      category: 'default',
      priority: 'high',
      tags: [`patient:${patientId}`, 'demographics'],
      ttlMs: 300_000, // 5 minutes
    });
  }

  /**
   * Get cached patient demographics.
   */
  getPatientDemographics(patientId: string): any | null {
    return this.cacheService.get(`patient:demographics:${patientId}`);
  }

  /**
   * Cache patient allergies (critical for medication safety).
   */
  cachePatientAllergies(patientId: string, allergies: any[]): void {
    this.cacheService.set(`patient:allergies:${patientId}`, allergies, {
      category: 'patient-allergies',
      priority: 'critical',
      tags: [`patient:${patientId}`, 'allergies', 'clinical-safety'],
    });
  }

  /**
   * Get cached patient allergies.
   */
  getPatientAllergies(patientId: string): any[] | null {
    return this.cacheService.get<any[]>(`patient:allergies:${patientId}`);
  }

  /**
   * Cache active medications for drug interaction checks.
   */
  cacheActiveMedications(patientId: string, medications: any[]): void {
    this.cacheService.set(`patient:medications:${patientId}`, medications, {
      category: 'patient-medications',
      priority: 'critical',
      tags: [`patient:${patientId}`, 'medications', 'clinical-safety'],
    });
  }

  /**
   * Get cached active medications.
   */
  getActiveMedications(patientId: string): any[] | null {
    return this.cacheService.get<any[]>(`patient:medications:${patientId}`);
  }

  /**
   * Cache patient vital signs (very short TTL for freshness).
   */
  cacheVitalSigns(patientId: string, vitals: any): void {
    this.cacheService.set(`patient:vitals:${patientId}`, vitals, {
      category: 'patient-vitals',
      priority: 'critical',
      tags: [`patient:${patientId}`, 'vitals'],
    });
  }

  /**
   * Get cached vital signs.
   */
  getVitalSigns(patientId: string): any | null {
    return this.cacheService.get(`patient:vitals:${patientId}`);
  }

  /**
   * Cache patient's recent lab results.
   */
  cacheLabResults(patientId: string, results: any[]): void {
    this.cacheService.set(`patient:labs:${patientId}`, results, {
      category: 'default',
      priority: 'high',
      tags: [`patient:${patientId}`, 'lab-results'],
      ttlMs: 120_000, // 2 minutes
    });
  }

  /**
   * Get cached lab results.
   */
  getLabResults(patientId: string): any[] | null {
    return this.cacheService.get<any[]>(`patient:labs:${patientId}`);
  }

  /**
   * Cache an entire patient clinical summary for quick encounter loads.
   */
  cacheClinicalSummary(
    patientId: string,
    summary: {
      demographics: any;
      allergies: any[];
      activeMedications: any[];
      recentVitals: any;
      recentLabs: any[];
      activeDiagnoses: any[];
    },
  ): void {
    this.cacheService.set(`patient:clinical-summary:${patientId}`, summary, {
      priority: 'high',
      tags: [`patient:${patientId}`, 'clinical-summary'],
      ttlMs: 180_000, // 3 minutes
    });
  }

  /**
   * Get cached clinical summary.
   */
  getClinicalSummary(patientId: string): any | null {
    return this.cacheService.get(`patient:clinical-summary:${patientId}`);
  }

  /**
   * Invalidate all cached data for a patient (e.g., after data update).
   */
  invalidatePatientCache(patientId: string): number {
    const count = this.cacheService.invalidateByTag(`patient:${patientId}`);
    this.logger.debug(`Invalidated ${count} cache entries for patient ${patientId}`);
    return count;
  }

  /**
   * Invalidate all clinical safety caches (allergies + medications).
   */
  invalidateClinicalSafetyCache(): number {
    return this.cacheService.invalidateByTag('clinical-safety');
  }

  /**
   * Pre-load patient data for upcoming appointments.
   */
  async preloadForAppointment(
    patientId: string,
    dataLoader: {
      loadDemographics: () => Promise<any>;
      loadAllergies: () => Promise<any[]>;
      loadMedications: () => Promise<any[]>;
      loadVitals: () => Promise<any>;
      loadLabResults: () => Promise<any[]>;
    },
  ): Promise<void> {
    try {
      const [demographics, allergies, medications, vitals, labs] = await Promise.all([
        dataLoader.loadDemographics(),
        dataLoader.loadAllergies(),
        dataLoader.loadMedications(),
        dataLoader.loadVitals(),
        dataLoader.loadLabResults(),
      ]);

      this.cachePatientDemographics(patientId, demographics);
      this.cachePatientAllergies(patientId, allergies);
      this.cacheActiveMedications(patientId, medications);
      this.cacheVitalSigns(patientId, vitals);
      this.cacheLabResults(patientId, labs);

      this.logger.debug(`Pre-loaded cache for patient ${patientId}`);
    } catch (error) {
      this.logger.error(`Failed to pre-load patient cache: ${error.message}`);
    }
  }
}
