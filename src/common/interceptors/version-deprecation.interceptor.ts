import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Response } from 'express';
import { DEPRECATED_KEY, DeprecatedOptions } from '../decorators/deprecated.decorator';

/**
 * VersionDeprecationInterceptor
 *
 * Automatically injects IETF-standard deprecation headers on any route
 * decorated with @Deprecated(). Register globally in main.ts or per-module.
 *
 * Headers injected:
 *   Sunset:      <RFC-7231 date> — when the route will be removed
 *   Deprecation: <RFC-7231 date> — when it was deprecated
 *   Link:        <url>; rel="successor-version"  (if provided)
 *
 * References:
 *   https://datatracker.ietf.org/doc/html/rfc8594  (Sunset)
 *   https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-deprecation-header
 */
@Injectable()
export class VersionDeprecationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(VersionDeprecationInterceptor.name);

  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const deprecated = this.reflector.getAllAndOverride<DeprecatedOptions>(DEPRECATED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!deprecated) {
      return next.handle();
    }

    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        response.setHeader('Deprecation', deprecated.deprecation);
        response.setHeader('Sunset', deprecated.sunset);

        if (deprecated.link) {
          response.setHeader('Link', `<${deprecated.link}>; rel="successor-version"`);
        }

        this.logger.warn(
          `Deprecated route accessed — Sunset: ${deprecated.sunset}` +
            (deprecated.link ? ` | Successor: ${deprecated.link}` : ''),
        );
      }),
    );
  }
}
