import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';

export const SKIP_PII_REDACTION = 'skip_pii_redaction';
export const SkipPiiRedaction = () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@nestjs/common').SetMetadata(SKIP_PII_REDACTION, true);

/**
 * Fields redacted to '[REDACTED]' in every outbound JSON response.
 * Add field names (case-insensitive substring match) as the surface grows.
 */
const PII_FIELDS = new Set([
  'password',
  'passwordhash',
  'token',
  'refreshtoken',
  'accesstoken',
  'secret',
  'apikey',
  'api_key',
  'ssn',
  'socialsecuritynumber',
  'dateofbirth',
  'dob',
  'phonenumber',
  'phone',
  'address',
  'creditcard',
  'cardnumber',
  'cvv',
  'bankaccount',
  'insurancenumber',
  'emergencyreason',
]);

function redact(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = PII_FIELDS.has(k.toLowerCase()) ? '[REDACTED]' : redact(v);
    }
    return result;
  }
  return value;
}

@Injectable()
export class PiiRedactionInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_PII_REDACTION, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return next.handle();

    return next.handle().pipe(map((data) => redact(data)));
  }
}
