import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataResidencyRegion } from '../../enums/data-residency.enum';

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
export class DataResidencyService {
  private readonly logger = new Logger(DataResidencyService.name);

  private readonly regionConfigs: Record<DataResidencyRegion, RegionalConfig> = {
    [DataResidencyRegion.EU]: {
      horizonUrl:
        process.env.STELLAR_HORIZON_EU_URL ||
        'https://horizon.eu.stellar.org',
      ipfsNodes: (
        process.env.IPFS_NODES_EU || 'https://ipfs-eu-1.infura.io:5001'
      ).split(','),
      databaseConfig: {
        host:
          process.env.DB_HOST_EU ||
          'postgres-eu.internal.example.com',
        port: parseInt(process.env.DB_PORT_EU || '5432', 10),
        database: process.env.DB_NAME_EU || 'healthy_stellar_eu',
      },
      awsRegion: 'eu-west-1',
      dataCenter: 'Frankfurt',
      description: 'EU Data Center (GDPR Compliant)',
    },
    [DataResidencyRegion.US]: {
      horizonUrl:
        process.env.STELLAR_HORIZON_US_URL ||
        'https://horizon.us.stellar.org',
      ipfsNodes: (
        process.env.IPFS_NODES_US || 'https://ipfs-us-1.infura.io:5001'
      ).split(','),
      databaseConfig: {
        host:
          process.env.DB_HOST_US ||
          'postgres-us.internal.example.com',
        port: parseInt(process.env.DB_PORT_US || '5432', 10),
        database: process.env.DB_NAME_US || 'healthy_stellar_us',
      },
      awsRegion: 'us-east-1',
      dataCenter: 'N. Virginia',
      description: 'US Data Center (HIPAA Compliant)',
    },
    [DataResidencyRegion.APAC]: {
      horizonUrl:
        process.env.STELLAR_HORIZON_APAC_URL ||
        'https://horizon.apac.stellar.org',
      ipfsNodes: (
        process.env.IPFS_NODES_APAC ||
        'https://ipfs-apac-1.infura.io:5001'
      ).split(','),
      databaseConfig: {
        host:
          process.env.DB_HOST_APAC ||
          'postgres-apac.internal.example.com',
        port: parseInt(process.env.DB_PORT_APAC || '5432', 10),
        database: process.env.DB_NAME_APAC || 'healthy_stellar_apac',
      },
      awsRegion: 'ap-southeast-1',
      dataCenter: 'Singapore',
      description: 'APAC Data Center (PDPA Compliant)',
    },
    [DataResidencyRegion.AFRICA]: {
      horizonUrl:
        process.env.STELLAR_HORIZON_AFRICA_URL ||
        'https://horizon.africa.stellar.org',
      ipfsNodes: (
        process.env.IPFS_NODES_AFRICA ||
        'https://ipfs-africa-1.infura.io:5001'
      ).split(','),
      databaseConfig: {
        host:
          process.env.DB_HOST_AFRICA ||
          'postgres-africa.internal.example.com',
        port: parseInt(process.env.DB_PORT_AFRICA || '5432', 10),
        database: process.env.DB_NAME_AFRICA || 'healthy_stellar_africa',
      },
      awsRegion: 'af-south-1',
      dataCenter: 'Cape Town',
      description: 'Africa Data Center (POPIA Compliant)',
    },
  };

  constructor(private configService: ConfigService) {}

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
