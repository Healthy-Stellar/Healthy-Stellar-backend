import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { API_VERSION_LIFECYCLE_POLICIES } from './api-version-lifecycle.policy';

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
@Controller({ path: 'api', version: VERSION_NEUTRAL })
export class ApiVersionsController {
  @Get()
  @ApiOperation({
    summary: 'List available API versions',
    description:
      'Returns metadata for all API versions including current, deprecated, and sunset versions.',
  })
  getVersions(): { versions: ApiVersionInfo[] } {
    return {
      versions: API_VERSION_LIFECYCLE_POLICIES,
    };
  }
}
