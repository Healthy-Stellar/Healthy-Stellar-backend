import { SetMetadata } from '@nestjs/common';

export const DEPRECATED_ROUTE_KEY = 'deprecatedRoute';

export interface DeprecatedRouteOptions {
  sunsetDate?: string; // Standard format: Wed, 11 Nov 2026 11:00:00 GMT
  alternativeRoute?: string;
  reason?: string;
}

/**
 * Marks a route as deprecated, automatically adding `Deprecation: true` and optionally `Sunset` and `Link` headers
 * through the global DepeprecationInterceptor.
 *
 * @param options configuration options for the deprecation headers
 */
export const DeprecatedRoute = (options: DeprecatedRouteOptions = {}) =>
  SetMetadata(DEPRECATED_ROUTE_KEY, options);
