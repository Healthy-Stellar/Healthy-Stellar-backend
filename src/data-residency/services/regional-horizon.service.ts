import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataResidencyRegion } from '../../enums/data-residency.enum';
import { DataResidencyService } from './data-residency.service';

/**
 * Manages region-specific Stellar Horizon endpoint configuration
 * Ensures transactions are submitted to regional Horizon nodes
 */
@Injectable()
export class RegionalHorizonService {
  private readonly logger = new Logger(RegionalHorizonService.name);
  private horizonNodeHealth: Map<string, boolean> = new Map();

  constructor(
    private dataResidencyService: DataResidencyService,
    private configService: ConfigService,
  ) {}

  /**
   * Get Stellar Horizon URL for a region
   */
  getHorizonUrl(region: DataResidencyRegion): string {
    const url = this.dataResidencyService.getHorizonUrl(region);
    this.logger.debug(`Using Horizon endpoint for region ${region}: ${url}`);
    return url;
  }

  /**
   * Get all regional Horizon endpoints
   */
  getAllHorizonEndpoints(): Record<DataResidencyRegion, string> {
    const endpoints: Record<DataResidencyRegion, string> = {} as any;

    const CONFIG = this.dataResidencyService.getAllRegionalConfigs();
    for (const [region, config] of Object.entries(CONFIG)) {
      endpoints[region as DataResidencyRegion] = config.horizonUrl;
    }

    return endpoints;
  }

  /**
   * Check Horizon endpoint connectivity
   */
  async checkHorizonHealth(horizonUrl: string): Promise<boolean> {
    try {
      const response = await fetch(`${horizonUrl}/health`, {
        method: 'GET',
        timeout: 5000,
      } as RequestInit);

      const isHealthy = response.ok || response.status === 200;
      this.horizonNodeHealth.set(horizonUrl, isHealthy);
      return isHealthy;
    } catch (error) {
      this.logger.warn(
        `Failed to check health of Horizon endpoint ${horizonUrl}: ${error.message}`,
      );
      this.horizonNodeHealth.set(horizonUrl, false);
      return false;
    }
  }

  /**
   * Get healthy Horizon endpoint for region
   */
  async getHealthyHorizonUrl(region: DataResidencyRegion): Promise<string> {
    const url = this.getHorizonUrl(region);
    const isHealthy = await this.checkHorizonHealth(url);

    if (isHealthy) {
      return url;
    }

    this.logger.warn(
      `Horizon endpoint unhealthy for region ${region}, using fallback`,
    );
    return url; // Return anyway as fallback
  }

  /**
   * Check health of all regional Horizon endpoints
   */
  async checkAllHorizonHealth(): Promise<Record<DataResidencyRegion, boolean>> {
    const endpoints = this.getAllHorizonEndpoints();
    const healthStatus: Record<DataResidencyRegion, boolean> = {} as any;

    const healthChecks = Object.entries(endpoints).map(async ([region, url]) => {
      const isHealthy = await this.checkHorizonHealth(url);
      healthStatus[region as DataResidencyRegion] = isHealthy;
    });

    await Promise.all(healthChecks);
    return healthStatus;
  }

  /**
   * Get Horizon network information for a region
   * Useful for transaction submission and validation
   */
  async getNetworkInfo(region: DataResidencyRegion): Promise<{
    networkPassphrase: string;
    horizonUrl: string;
    version: string;
  }> {
    const horizonUrl = await this.getHealthyHorizonUrl(region);

    try {
      const response = await fetch(horizonUrl);
      const data = await response.json();

      return {
        networkPassphrase:
          data.network_passphrase ||
          'Test SDF Network ; September 2015', // Use test by default
        horizonUrl,
        version: data.version || 'unknown',
      };
    } catch (error) {
      this.logger.error(
        `Failed to get network info from Horizon for region ${region}`,
      );
      // Return defaults
      return {
        networkPassphrase: 'Test SDF Network ; September 2015',
        horizonUrl,
        version: 'unknown',
      };
    }
  }

  /**
   * Mark Horizon endpoint as healthy or unhealthy
   */
  markHorizonHealth(horizonUrl: string, isHealthy: boolean): void {
    this.horizonNodeHealth.set(horizonUrl, isHealthy);
    this.logger.debug(
      `Horizon endpoint ${horizonUrl} marked as ${isHealthy ? 'healthy' : 'unhealthy'}`,
    );
  }

  /**
   * Get Horizon health cache
   */
  getHealthCache(): Map<string, boolean> {
    return this.horizonNodeHealth;
  }
}
