import { SetMetadata } from '@nestjs/common';

export const DEPRECATED_KEY = 'deprecated_route';

export interface DeprecatedOptions {
  /**
   * RFC-7231 formatted date after which the route will be removed.
   * Example: 'Sat, 01 Jan 2027 00:00:00 GMT'
   */
  sunset: string;
  /**
   * RFC-7231 formatted date when the route was deprecated.
   * Example: 'Mon, 01 Jul 2026 00:00:00 GMT'
   */
  deprecation: string;
  /**
   * Optional URL of the successor / replacement endpoint documentation.
   */
  link?: string;
}

/**
 * Mark a route or controller as deprecated.
 * The `VersionDeprecationInterceptor` will automatically inject
 * `Sunset`, `Deprecation`, and `Link` response headers.
 *
 * @example
 * @Get('old-endpoint')
 * @Deprecated({
 *   sunset: 'Sat, 01 Jan 2027 00:00:00 GMT',
 *   deprecation: 'Mon, 01 Jul 2026 00:00:00 GMT',
 *   link: 'https://docs.example.com/v2/new-endpoint',
 * })
 * oldEndpoint() { ... }
 */
export const Deprecated = (options: DeprecatedOptions) => SetMetadata(DEPRECATED_KEY, options);
