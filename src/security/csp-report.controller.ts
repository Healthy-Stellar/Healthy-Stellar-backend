import { Body, Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';

/**
 * Receives Content Security Policy violation reports (Issue #653).
 *
 * Active in staging when Helmet is configured with `reportOnly: true` and
 * `reportUri: ['/csp-report']`.  In production the endpoint still exists but
 * Helmet does not send reports there.
 */
@Controller('csp-report')
export class CspReportController {
  private readonly logger = new Logger(CspReportController.name);

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  report(@Body() body: Record<string, unknown>): void {
    const report = body?.['csp-report'] ?? body;
    this.logger.warn('CSP violation', { report });
  }
}
