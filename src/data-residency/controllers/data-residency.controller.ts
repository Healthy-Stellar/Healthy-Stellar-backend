import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiResponse, ApiOperation } from '@nestjs/swagger';
import { DataResidencyService } from '../services/data-residency.service';
import { RegionalDatabaseService } from '../services/regional-database.service';
import { RegionalHorizonService } from '../services/regional-horizon.service';
import { RegionalIpfsService } from '../services/regional-ipfs.service';
import { DataResidencyGuard } from '../guards/data-residency.guard';

/**
 * Data Residency Controller
 * Provides endpoints for monitoring and checking regional infrastructure status
 */
@ApiTags('Data Residency')
@Controller('api/v1/data-residency')
export class DataResidencyController {
  constructor(
    private dataResidencyService: DataResidencyService,
    private regionalDatabaseService: RegionalDatabaseService,
    private regionalHorizonService: RegionalHorizonService,
    private regionalIpfsService: RegionalIpfsService,
  ) {}

  @Get('health')
  @UseGuards(DataResidencyGuard)
  @ApiOperation({
    summary: 'Check regional infrastructure health',
    description: 'Returns health status of all regional data centers',
  })
  @ApiResponse({
    status: 200,
    description: 'Health status of all regions',
    schema: {
      example: {
        database: {
          EU: { status: 'healthy', latency: 45 },
          US: { status: 'healthy', latency: 52 },
        },
        horizon: {
          EU: true,
          US: true,
        },
      },
    },
  })
  async getHealthStatus() {
    const [databaseHealth, horizonHealth] = await Promise.all([
      this.regionalDatabaseService.getRegionalHealthStatus(),
      this.regionalHorizonService.checkAllHorizonHealth(),
    ]);

    return {
      database: databaseHealth,
      horizon: horizonHealth,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('config')
  @UseGuards(DataResidencyGuard)
  @ApiOperation({
    summary: 'Get regional configuration',
    description: 'Returns configuration for all available regions',
  })
  @ApiResponse({
    status: 200,
    description: 'Regional configurations',
  })
  getRegionalConfig() {
    const configs = this.dataResidencyService.getAllRegionalConfigs();
    return {
      regions: Object.keys(configs),
      endpoints: this.regionalHorizonService.getAllHorizonEndpoints(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('my-region')
  @UseGuards(DataResidencyGuard)
  @ApiOperation({
    summary: 'Get current request region',
    description: 'Returns the region where the current request is being processed',
  })
  @ApiResponse({
    status: 200,
    description: 'Current processing region',
    schema: {
      example: {
        region: 'EU',
        dataCenter: 'Frankfurt',
        horizonUrl: 'https://horizon.eu.stellar.org',
      },
    },
  })
  async getMyRegion(@Req() req: any) {
    const region = req.dataRegion;
    const config = this.dataResidencyService.getRegionalConfig(region);

    return {
      region,
      dataCenter: config.dataCenter,
      description: config.description,
      horizonUrl: config.horizonUrl,
      awsRegion: config.awsRegion,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ipfs-nodes')
  @UseGuards(DataResidencyGuard)
  @ApiOperation({
    summary: 'Get IPFS nodes for region',
    description: 'Returns available IPFS nodes for the current request region',
  })
  @ApiResponse({
    status: 200,
    description: 'IPFS nodes for region',
    schema: {
      example: {
        nodes: ['https://ipfs-eu-1.infura.io:5001'],
        primaryNode: 'https://ipfs-eu-1.infura.io:5001',
      },
    },
  })
  async getIpfsNodes(@Req() req: any) {
    const region = req.dataRegion;
    const nodes = this.regionalIpfsService.getIpfsNodes(region);
    const primaryNode = this.regionalIpfsService.getIpfsNode(region);

    return {
      region,
      nodes,
      primaryNode,
      count: nodes.length,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('compliance')
  @UseGuards(DataResidencyGuard)
  @ApiOperation({
    summary: 'Get compliance information',
    description: 'Returns compliance frameworks required for each region',
  })
  @ApiResponse({
    status: 200,
    description: 'Compliance requirements by region',
    schema: {
      example: {
        EU: ['GDPR'],
        US: ['HIPAA'],
        AFRICA: ['POPIA'],
        APAC: ['PDPA'],
      },
    },
  })
  getComplianceInfo() {
    return {
      EU: ['GDPR', 'GDPR Article 44-49 (Data Transfer Restrictions)'],
      US: ['HIPAA', 'HIPAA Privacy Rule', 'HIPAA Security Rule'],
      AFRICA: ['POPIA', 'POPIA Chapter 2 (Personal Information Processing)'],
      APAC: ['PDPA', 'PDPA Schedule 1'],
      timestamp: new Date().toISOString(),
    };
  }
}
