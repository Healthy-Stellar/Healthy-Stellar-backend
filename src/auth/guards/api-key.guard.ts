import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyService } from '../services/api-key.service';
import { ApiKeyScope } from '../entities/api-key.entity';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private apiKeyService: ApiKeyService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const apiKey = this.extractApiKeyFromHeader(request);

    if (!apiKey) {
      throw new UnauthorizedException('No API key provided');
    }

    const validatedKey = await this.apiKeyService.validateApiKey(apiKey);

    if (!validatedKey) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    // Check required scopes
    const requiredScopes = this.reflector.getAllAndOverride<ApiKeyScope[]>('apiKeyScopes', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredScopes && requiredScopes.length > 0) {
      const hasRequiredScope = this.apiKeyService.hasAnyScope(validatedKey, requiredScopes);
      if (!hasRequiredScope) {
        throw new UnauthorizedException('API key does not have required scope');
      }
    }

    // Update last used IP
    if (request.ip) {
      await this.apiKeyService['apiKeyRepository'].update(validatedKey.id, {
        lastUsedByIp: request.ip,
      });
    }

    // Attach API key info to request
    request.apiKey = validatedKey;
    request.user = { type: 'api_key', apiKey: validatedKey };

    return true;
  }

  private extractApiKeyFromHeader(request: any): string | undefined {
    const apiKeyHeader = request.headers['x-api-key'];
    if (!apiKeyHeader) {
      return undefined;
    }

    // Handle both string and array cases
    if (Array.isArray(apiKeyHeader)) {
      return apiKeyHeader[0];
    }

    return apiKeyHeader;
  }
}