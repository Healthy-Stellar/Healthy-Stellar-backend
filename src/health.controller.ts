import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

/**
 * Health check endpoint — version-neutral.
 * Responds on both /health and /v{n}/health at every API version.
 */
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  @Get()
  @SkipThrottle()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'medical-system',
    };
  }
}
