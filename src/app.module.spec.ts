import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ClinicalMfaGuard } from './auth/guards/clinical-mfa.guard';
import { CustomThrottlerGuard } from './common/throttler/custom-throttler.guard';
import { TenantGuard } from './tenant/guards/tenant.guard';
import { TenantIpAllowlistGuard } from './tenant-config/guards/tenant-ip-allowlist.guard';
import { CircuitBreakerExceptionFilter } from './common/circuit-breaker/filters/circuit-breaker-exception.filter';
import { I18nExceptionFilter } from './i18n/filters/i18n-exception.filter';
import { MedicalEmergencyErrorFilter } from './common/errors/medical-emergency-error.filter';
import { MedicalDataValidationPipe } from './common/validation/medical-data.validator.pipe';
import { DataResidencyInterceptor } from './common/interceptors/data-residency.interceptor';
import { HttpMetricsInterceptor } from './metrics/interceptors/http-metrics.interceptor';
import { IdempotencyInterceptor } from './idempotency/idempotency.interceptor';
import { PaginationInterceptor } from './common/interceptors/pagination.interceptor';
import { PiiRedactionInterceptor } from './common/interceptors/pii-redaction.interceptor';
import { QueryPerformanceInterceptor } from './common/interceptors/query-performance.interceptor';
import { TenantInterceptor } from './tenant/interceptors/tenant.interceptor';
import { TracingInterceptor } from './common/interceptors/tracing.interceptor';
import { BullBoardAuthMiddleware } from './queues/middleware/bull-board-auth.middleware';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

describe('AppModule', () => {
  it('registers each imported module exactly once', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // Access the metadata used by Nest to build the module graph.
    const imports: unknown[] =
      Reflect.getMetadata('imports', AppModule) ?? [];

    const seen = new Set<unknown>();
    const duplicates: unknown[] = [];

    for (const imported of imports) {
      if (seen.has(imported)) {
        duplicates.push(imported);
      } else {
        seen.add(imported);
      }
    }

    const duplicateNames = duplicates.map(
      (dup) => (dup as { name?: string })?.name ?? String(dup),
    );

    expect(duplicateNames).toEqual([]);

    await moduleRef.close();
  });

  it('registers all global guards, interceptors, filters, and the validation pipe', () => {
    const providers = Reflect.getMetadata('providers', AppModule) ?? [];
    const registrations = providers.filter(
      (provider: { provide?: unknown; useClass?: unknown }) => provider.useClass,
    );
    const registered = new Set(
      registrations.map((provider: { provide: unknown; useClass: unknown }) =>
        `${String(provider.provide)}:${String(provider.useClass)}`,
      ),
    );

    expect(registered).toEqual(
      new Set([
        `${String(APP_INTERCEPTOR)}:${String(PiiRedactionInterceptor)}`,
        `${String(APP_INTERCEPTOR)}:${String(PaginationInterceptor)}`,
        `${String(APP_INTERCEPTOR)}:${String(TracingInterceptor)}`,
        `${String(APP_INTERCEPTOR)}:${String(QueryPerformanceInterceptor)}`,
        `${String(APP_INTERCEPTOR)}:${String(HttpMetricsInterceptor)}`,
        `${String(APP_INTERCEPTOR)}:${String(TenantInterceptor)}`,
        `${String(APP_INTERCEPTOR)}:${String(DataResidencyInterceptor)}`,
        `${String(APP_INTERCEPTOR)}:${String(IdempotencyInterceptor)}`,
        `${String(APP_FILTER)}:${String(MedicalEmergencyErrorFilter)}`,
        `${String(APP_FILTER)}:${String(CircuitBreakerExceptionFilter)}`,
        `${String(APP_FILTER)}:${String(I18nExceptionFilter)}`,
        `${String(APP_PIPE)}:${String(MedicalDataValidationPipe)}`,
        `${String(APP_GUARD)}:${String(CustomThrottlerGuard)}`,
        `${String(APP_GUARD)}:${String(TenantGuard)}`,
        `${String(APP_GUARD)}:${String(TenantIpAllowlistGuard)}`,
        `${String(APP_GUARD)}:${String(ClinicalMfaGuard)}`,
      ]),
    );
  });

  it('configures request and Bull Board middleware', () => {
    const apply = jest.fn().mockReturnValue({ forRoutes: jest.fn() });
    AppModule.prototype.configure({ apply } as any);

    expect(apply).toHaveBeenNthCalledWith(1, RequestIdMiddleware, RequestContextMiddleware);
    expect(apply).toHaveBeenNthCalledWith(2, BullBoardAuthMiddleware);
  });
});
