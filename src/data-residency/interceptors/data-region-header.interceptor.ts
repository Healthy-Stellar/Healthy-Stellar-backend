import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

/**
 * Interceptor to add X-Data-Region header to all responses
 * Indicates which regional data center processed the request
 */
@Injectable()
export class DataRegionHeaderInterceptor implements NestInterceptor {
  private readonly logger = new Logger(DataRegionHeaderInterceptor.name);

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Get data region from request (set by DataResidencyGuard or middleware)
    const dataRegion = (request as any).dataRegion;

    return next.handle().pipe(
      tap(() => {
        if (dataRegion) {
          response.setHeader('X-Data-Region', dataRegion);
          response.setHeader(
            'X-Data-Processing-Location',
            this.getLocationName(dataRegion),
          );
        }
        // Always include cache control headers for data residency compliance
        response.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        response.setHeader('Pragma', 'no-cache');
      }),
    );
  }

  /**
   * Get human-readable location name for a region
   */
  private getLocationName(region: string): string {
    const locations: Record<string, string> = {
      EU: 'Frankfurt, Germany',
      US: 'N. Virginia, USA',
      APAC: 'Singapore',
      AFRICA: 'Cape Town, South Africa',
    };
    return locations[region] || 'Unknown';
  }
}
