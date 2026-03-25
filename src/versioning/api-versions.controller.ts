import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

export interface ApiVersionInfo {
  version: string;
  status: 'current' | 'deprecated' | 'sunset';
  releaseDate: string;
  sunsetDate?: string;
  baseUrl: string;
  changelog?: string;
}

/**
 * Exposes GET /api listing all available API versions, their status,
 * and sunset dates. Served at VERSION_NEUTRAL so it is always reachable
 * regardless of the URI version prefix.
 */
@ApiTags('API Versioning')
@Version(VERSION_NEUTRAL)
@Controller('api')
export class ApiVersionsController {
  @Get()
  @ApiOperation({
    summary: 'List available API versions',
    description:
      'Returns metadata for all API versions including current, deprecated, and sunset versions.',
  })
  getVersions(): { versions: ApiVersionInfo[] } {
    return {
      versions: [
        {
          version: '1',
          status: 'current',
          releaseDate: '2024-01-01',
          baseUrl: '/v1',
          changelog: 'https://github.com/joel-metal/Healthy-Stellar-backend/blob/main/docs/api-versioning.md#v1',
        },
        // v2 placeholder — uncomment when v2 controllers are ready
        // {
        //   version: '2',
        //   status: 'current',
        //   releaseDate: '2025-01-01',
        //   baseUrl: '/v2',
        //   changelog: '...',
        // },
      ],
    };
  }
}
