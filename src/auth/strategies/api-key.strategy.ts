import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { ApiKeyService } from '../services/api-key.service';
import { ApiKey } from '../entities/api-key.entity';

export interface ApiKeyPayload {
  apiKey: ApiKey;
  type: 'api_key';
}

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(private apiKeyService: ApiKeyService) {
    super();
  }

  async validate(req: any): Promise<ApiKeyPayload> {
    const apiKey = this.extractApiKeyFromHeader(req);

    if (!apiKey) {
      throw new UnauthorizedException('No API key provided');
    }

    const validatedKey = await this.apiKeyService.validateApiKey(apiKey);

    if (!validatedKey) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    // Update last used IP if available
    if (req.ip) {
      await this.apiKeyService['apiKeyRepository'].update(validatedKey.id, {
        lastUsedByIp: req.ip,
      });
    }

    return {
      apiKey: validatedKey,
      type: 'api_key',
    };
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