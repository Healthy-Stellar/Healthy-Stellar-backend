import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { IdempotencyService } from './idempotency.service';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotencyService: IdempotencyService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest<{ method: string; headers: Record<string, string> }>();

    if (!MUTATING_METHODS.has(req.method)) return next.handle();

    const key = req.headers['idempotency-key'];
    if (!key) return next.handle();

    const cached = await this.idempotencyService.find(key);
    if (cached) {
      const res = context.switchToHttp().getResponse<{ status: (code: number) => { json: (body: unknown) => void } }>();
      res.status(cached.statusCode).json(JSON.parse(cached.responseBody));
      return of(null);
    }

    return next.handle().pipe(
      tap(async (body) => {
        const res = context.switchToHttp().getResponse<{ statusCode: number }>();
        await this.idempotencyService.store(key, res.statusCode, JSON.stringify(body ?? null));
      }),
    );
  }
}
