import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class PaginationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    if (!request || typeof request !== 'object') {
      return next.handle();
    }

    const query = request.query;
    if (query && typeof query === 'object') {
      if (query.page === undefined || query.page === null || query.page === '') {
        query.page = 1;
      }

      if (query.offset === undefined || query.offset === null || query.offset === '') {
        query.offset = 0;
      }

      if (query.pageSize === undefined || query.pageSize === null || query.pageSize === '') {
        if (query.limit !== undefined && query.limit !== null && query.limit !== '') {
          query.pageSize = query.limit;
        } else {
          query.pageSize = 20;
        }
      }

      if (query.limit !== undefined && query.limit !== null && query.limit !== '' && query.pageSize === undefined) {
        query.pageSize = query.limit;
      }
    }

    return next.handle();
  }
}
