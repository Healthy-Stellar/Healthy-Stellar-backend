import {
  CallHandler,
  ExecutionContext,
  GoneException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NestInterceptor,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { VERSION_METADATA } from '@nestjs/common/constants';
import { Observable } from 'rxjs';
import {
  API_VERSION_LIFECYCLE_POLICIES,
  ApiVersionLifecyclePolicy,
} from './api-version-lifecycle.policy';

/** URL pointing to the migration guide for deprecated API versions. */
const MIGRATION_GUIDE_URL =
  'https://github.com/Healthy-Stellar/Healthy-Stellar-backend/blob/main/docs/api-versioning.md';

@Injectable()
export class ApiVersionLifecycleInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ApiVersionLifecycleInterceptor.name);

  constructor(
    private readonly policies: ApiVersionLifecyclePolicy[] = API_VERSION_LIFECYCLE_POLICIES,
    private readonly nowProvider: () => Date = () => new Date(),
    private readonly defaultVersion = '1',
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();

    const version = this.resolveEffectiveVersion(
      context,
      request?.originalUrl ?? request?.url ?? '',
    );
    if (!version) return next.handle();

    const policy = this.policies.find((p) => p.version === version);
    if (!policy) {
      throw new InternalServerErrorException(
        `API version v${version} is not registered in the lifecycle policy.`,
      );
    }

    response.setHeader('API-Version', `v${policy.version}`);
    response.setHeader('API-Version-Status', policy.status);

    if (policy.status === 'deprecated' || this.isSunset(policy)) {
      // RFC 8594 — Deprecation header contains the sunset date as a DateTime
      if (policy.sunsetDate) {
        response.setHeader('Deprecation', policy.sunsetDate);
        response.setHeader('Sunset', policy.sunsetDate);
      } else {
        response.setHeader('Deprecation', 'true');
      }
      // Link header pointing to the migration guide
      const alternateLink =
        policy.replacementVersion
          ? `<${MIGRATION_GUIDE_URL}>; rel=\"help\", </v${policy.replacementVersion}>; rel=\"alternate\"`
          : `<${MIGRATION_GUIDE_URL}>; rel=\"help\"`;
      response.setHeader('Link', alternateLink);

      // Server-side deprecation warning log
      const path = request?.originalUrl ?? request?.url ?? '';
      this.logger.warn(
        `Deprecated API version v${policy.version} called: ${path}. Sunset: ${policy.sunsetDate ?? 'unscheduled'}. ` +
          `Replacement: v${policy.replacementVersion ?? 'N/A'}.`,
      );
    }

    if (this.isSunset(policy)) {
      throw new GoneException(this.buildSunsetMessage(policy));
    }

    return next.handle();
  }

  private isSunset(policy: ApiVersionLifecyclePolicy): boolean {
    if (policy.status === 'sunset') return true;
    if (policy.status !== 'deprecated' || !policy.sunsetDate) return false;

    const sunsetTime = Date.parse(policy.sunsetDate);
    if (Number.isNaN(sunsetTime)) return false;

    return this.nowProvider().getTime() >= sunsetTime;
  }

  private buildSunsetMessage(policy: ApiVersionLifecyclePolicy): string {
    const replacement = policy.replacementVersion
      ? ` Use /v${policy.replacementVersion} instead.`
      : '';
    const sunset = policy.sunsetDate ? ` Sunset date: ${policy.sunsetDate}.` : '';
    return `API version v${policy.version} is no longer available.${sunset}${replacement}`.trim();
  }

  private resolveEffectiveVersion(context: ExecutionContext, urlPath: string): string | null {
    const uriVersion = this.extractUriVersion(urlPath);
    if (uriVersion) return uriVersion;

    const routeVersion = this.getRouteVersion(context);
    if (routeVersion === null) return null;
    if (routeVersion) return routeVersion;

    return this.defaultVersion;
  }

  private getRouteVersion(context: ExecutionContext): string | null | undefined {
    const handlerVersion = this.normalizeVersion(
      Reflect.getMetadata(VERSION_METADATA, context.getHandler()),
    );
    if (handlerVersion !== undefined) return handlerVersion;

    return this.normalizeVersion(Reflect.getMetadata(VERSION_METADATA, context.getClass()));
  }

  private normalizeVersion(version: unknown): string | null | undefined {
    if (version === undefined) return undefined;
    if (version === VERSION_NEUTRAL) return null;
    if (Array.isArray(version)) {
      const concreteVersion = version.find((item) => item !== VERSION_NEUTRAL);
      return concreteVersion === undefined ? null : String(concreteVersion);
    }

    return String(version);
  }

  private extractUriVersion(urlPath: string): string | null {
    const match = /^\/v(\d+)(?:\/|$)/i.exec(urlPath);
    return match?.[1] ?? null;
  }
}
