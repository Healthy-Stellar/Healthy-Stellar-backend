import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Request } from 'express';

const ANALYTICS_TTL = 300; // 5 minutes in seconds

@Injectable()
export class AnalyticsCacheInterceptor implements NestInterceptor {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const req: Request = context.switchToHttp().getRequest();
    const cacheKey = `analytics:${req.path}:${new URLSearchParams(
      req.query as Record<string, string>,
    ).toString()}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return of(cached);
    }

    return next.handle().pipe(
      tap(async (data) => {
        await this.cache.set(cacheKey, data, ANALYTICS_TTL);
      }),
    );
  }
}
