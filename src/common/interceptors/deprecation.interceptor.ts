import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  GoneException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { DEPRECATED_ROUTE_KEY, DeprecatedRouteOptions } from '../decorators/deprecated.decorator';

@Injectable()
export class DeprecationInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const isDeprecatedOptions = this.reflector.getAllAndOverride<DeprecatedRouteOptions>(
      DEPRECATED_ROUTE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isDeprecatedOptions) {
      const ctx = context.switchToHttp();
      const response = ctx.getResponse();

      // Set the standard Deprecation header
      response.setHeader('Deprecation', 'true');

      // Set Sunset header if provided
      if (isDeprecatedOptions.sunsetDate) {
        response.setHeader('Sunset', isDeprecatedOptions.sunsetDate);

        const sunsetTime = Date.parse(isDeprecatedOptions.sunsetDate);
        if (!Number.isNaN(sunsetTime) && Date.now() >= sunsetTime) {
          const reason = isDeprecatedOptions.reason ? ` ${isDeprecatedOptions.reason}` : '';
          const replacement = isDeprecatedOptions.alternativeRoute
            ? ` Use ${isDeprecatedOptions.alternativeRoute} instead.`
            : '';
          throw new GoneException(
            `This endpoint is no longer available. Sunset date: ${isDeprecatedOptions.sunsetDate}.${reason}${replacement}`,
          );
        }
      }

      // Add a link to the alternative route if provided
      if (isDeprecatedOptions.alternativeRoute) {
        response.setHeader('Link', `<${isDeprecatedOptions.alternativeRoute}>; rel="alternate"`);
      }
    }

    return next.handle();
  }
}
