import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataResidencyRegion } from '../../enums/data-residency.enum';
import { DATA_RESIDENCY_CONFIG_KEY } from '../config/data-residency.config';

/**
 * Regional infrastructure configuration
 */
export interface RegionalConfig {
  horizonUrl: string;
  ipfsNodes: string[];
  databaseConfig: {
    host: string;
    port: number;
    database: string;
  };
  awsRegion: string;
  dataCenter: string;
  description: string;
}

/**
 * Manages regional configuration for data residency
 */
@Injectable()
export class DataResidencyService implements OnModuleInit {
  private readonly logger = new Logger(DataResidencyService.name);
  private regionConfigs: Record<DataResidencyRegion, RegionalConfig>;

  constructor(private configService: ConfigService) {}

  onModuleInit(): void {
    const cfg = (key: string) => this.configService.get(`${DATA_RESIDENCY_CONFIG_KEY}.${key}`);

    this.regionConfigs = {
      [DataResidencyRegion.EU]: {
        horizonUrl: cfg('eu.horizonUrl'),
        ipfsNodes: cfg('eu.ipfsNodes'),
        databaseConfig: {
          host: cfg('eu.dbHost'),
          port: cfg('eu.dbPort'),
          database: cfg('eu.dbName'),
        },
        awsRegion: 'eu-west-1',
        dataCenter: 'Frankfurt',
        description: 'EU Data Center (GDPR Compliant)',
      },
      [DataResidencyRegion.US]: {
        horizonUrl: cfg('us.horizonUrl'),
        ipfsNodes: cfg('us.ipfsNodes'),
        databaseConfig: {
          host: cfg('us.dbHost'),
          port: cfg('us.dbPort'),
          database: cfg('us.dbName'),
        },
        awsRegion: 'us-east-1',
        dataCenter: 'N. Virginia',
        description: 'US Data Center (HIPAA Compliant)',
      },
      [DataResidencyRegion.APAC]: {
        horizonUrl: cfg('apac.horizonUrl'),
        ipfsNodes: cfg('apac.ipfsNodes'),
        databaseConfig: {
          host: cfg('apac.dbHost'),
          port: cfg('apac.dbPort'),
          database: cfg('apac.dbName'),
        },
        awsRegion: 'ap-southeast-1',
        dataCenter: 'Singapore',
        description: 'APAC Data Center (PDPA Compliant)',
      },
      [DataResidencyRegion.AFRICA]: {
        horizonUrl: cfg('africa.horizonUrl'),
        ipfsNodes: cfg('africa.ipfsNodes'),
        databaseConfig: {
          host: cfg('africa.dbHost'),
          port: cfg('africa.dbPort'),
          database: cfg('africa.dbName'),
        },
        awsRegion: 'af-south-1',
        dataCenter: 'Cape Town',
        description: 'Africa Data Center (POPIA Compliant)',
      },
    };
  }

  /**
   * Get regional configuration for a specific region
   */
  getRegionalConfig(region: DataResidencyRegion): RegionalConfig {
    const config = this.regionConfigs[region];
    if (!config) {
      this.logger.error(`Invalid region: ${region}`);
      throw new Error(`Unsupported region: ${region}`);
    }
    return config;
  }

  /**
   * Get all regional configurations
   */
  getAllRegionalConfigs(): Record<DataResidencyRegion, RegionalConfig> {
    return this.regionConfigs;
  }

  /**
   * Get Stellar Horizon URL for a region
   */
  getHorizonUrl(region: DataResidencyRegion): string {
    return this.getRegionalConfig(region).horizonUrl;
  }

  /**
   * Get IPFS nodes for a region
   */
  getIpfsNodes(region: DataResidencyRegion): string[] {
    return this.getRegionalConfig(region).ipfsNodes;
  }

  /**
   * Get database configuration for a region
   */
  getDatabaseConfig(region: DataResidencyRegion) {
    return this.getRegionalConfig(region).databaseConfig;
  }

  /**
   * Get AWS region for data processing
   */
  getAwsRegion(region: DataResidencyRegion): string {
    return this.getRegionalConfig(region).awsRegion;
  }

  /**
   * Check if request IP is allowed for region (optional enforcement)
   */
  isIpAllowedForRegion(
    region: DataResidencyRegion,
    clientIp: string,
    allowedRanges?: string[],
  ): boolean {
    // If no IP ranges configured, allow all (configurable per tenant)
    if (!allowedRanges || allowedRanges.length === 0) {
      return true;
    }

    return allowedRanges.some((range) => this.ipInRange(clientIp, range));
  }

  /**
   * Check if IP address is within a CIDR range
   */
  private ipInRange(ip: string, range: string): boolean {
    //This is a simplified check. For production, use ip-cidr library
    const [rangeIp, maskBits] = range.split('/');
    if (!maskBits) {
      return ip === rangeIp; // Exact match if no CIDR notation
    }

    // Simplified CIDR check - in production use ipaddr.js or similar
    const parts = ip.split('.').map(Number);
    const rangeParts = rangeIp.split('.').map(Number);

    const maskNum = parseInt(maskBits, 10);
    const bytesToCheck = Math.floor(maskNum / 8);

    for (let i = 0; i < bytesToCheck; i++) {
      if (parts[i] !== rangeParts[i]) {
        return false;
      }
    }

    return true;
  }
}
