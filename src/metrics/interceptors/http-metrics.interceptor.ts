import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CustomMetricsService } from '../custom-metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: CustomMetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const start = Date.now();

    // Normalise route: prefer express route pattern over raw URL to avoid cardinality explosion
    const method = req.method as string;
    const route = (req.route?.path as string) ?? req.url ?? 'unknown';

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = (Date.now() - start) / 1000;
          this.metrics.recordHttpRequest(method, route, res.statusCode as number, duration);
        },
        error: (err: any) => {
          const duration = (Date.now() - start) / 1000;
          const status: number = err?.status ?? err?.statusCode ?? 500;
          this.metrics.recordHttpRequest(method, route, status, duration);
        },
      }),
    );
  }
}
