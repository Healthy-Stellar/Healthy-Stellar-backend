import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

@Controller('health')
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
