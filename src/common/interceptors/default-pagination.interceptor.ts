import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * DefaultPaginationInterceptor
 *
 * Applied globally (registered in AppModule as APP_INTERCEPTOR).
 *
 * Injects safe pagination defaults into every incoming HTTP GET request so
 * that list endpoints never perform a full-table scan when a client omits
 * pagination parameters.
 *
 * Rules:
 *  - `page`     → defaults to 1 if absent, empty, or < 1
 *  - `pageSize` → defaults to 20 if absent/empty; capped at 100 even if the
 *                 client sends a larger value (belt-and-suspenders on top of
 *                 the @Max(100) validator on PaginationDto)
 *  - `limit`    → same as pageSize (some endpoints use this alias)
 *  - `offset`   → defaults to 0 if absent, empty, or negative
 *
 * Only GET requests are modified; mutations are left untouched.
 */
@Injectable()
export class DefaultPaginationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpCtx = context.switchToHttp();
    const request = httpCtx.getRequest<Record<string, any>>();

    // Only apply to HTTP GET requests (list / read endpoints)
    if (!request || request.method !== 'GET') {
      return next.handle();
    }

    const query: Record<string, any> = request.query ?? {};

    // ── page ──────────────────────────────────────────────────────────────
    if (query['page'] === undefined || query['page'] === '') {
      query['page'] = '1';
    } else {
      const n = parseInt(query['page'], 10);
      if (isNaN(n) || n < 1) query['page'] = '1';
    }

    // ── pageSize ──────────────────────────────────────────────────────────
    if (query['pageSize'] === undefined || query['pageSize'] === '') {
      query['pageSize'] = String(DEFAULT_PAGE_SIZE);
    } else {
      const n = parseInt(query['pageSize'], 10);
      if (isNaN(n) || n < 1) {
        query['pageSize'] = String(DEFAULT_PAGE_SIZE);
      } else if (n > MAX_PAGE_SIZE) {
        query['pageSize'] = String(MAX_PAGE_SIZE);
      }
    }

    // ── limit (alias used by some endpoints) ──────────────────────────────
    if (query['limit'] === undefined || query['limit'] === '') {
      query['limit'] = String(DEFAULT_PAGE_SIZE);
    } else {
      const n = parseInt(query['limit'], 10);
      if (isNaN(n) || n < 1) {
        query['limit'] = String(DEFAULT_PAGE_SIZE);
      } else if (n > MAX_PAGE_SIZE) {
        query['limit'] = String(MAX_PAGE_SIZE);
      }
    }

    // ── offset ────────────────────────────────────────────────────────────
    if (query['offset'] === undefined || query['offset'] === '') {
      query['offset'] = '0';
    } else {
      const n = parseInt(query['offset'], 10);
      if (isNaN(n) || n < 0) query['offset'] = '0';
    }

    request.query = query;
    return next.handle();
  }
}
