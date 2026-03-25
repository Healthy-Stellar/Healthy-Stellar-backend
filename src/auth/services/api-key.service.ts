import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey, ApiKeyScope } from '../entities/api-key.entity';
import { User } from '../entities/user.entity';
import { AuditService } from '../../common/audit/audit.service';
import { AuditAction } from '../../common/audit/audit-log.entity';
import * as crypto from 'crypto';

export interface CreateApiKeyDto {
  name: string;
  description: string;
  scopes: ApiKeyScope[];
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  description: string;
  scopes: ApiKeyScope[];
  isActive: boolean;
  createdAt: Date;
  lastUsedAt?: Date;
  lastUsedByIp?: string;
  createdBy: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface CreateApiKeyResponse extends ApiKeyResponse {
  key: string; // Only returned once during creation
}

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectRepository(ApiKey)
    private apiKeyRepository: Repository<ApiKey>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private auditService: AuditService,
  ) {}

  /**
   * Generate a secure random API key
   */
  private generateApiKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash an API key using SHA-256
   */
  private hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Create a new API key
   */
  async createApiKey(
    createDto: CreateApiKeyDto,
    createdById: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<CreateApiKeyResponse> {
    // Validate scopes
    if (!createDto.scopes || createDto.scopes.length === 0) {
      throw new BadRequestException('At least one scope must be specified');
    }

    // Check for duplicate name
    const existingKey = await this.apiKeyRepository.findOne({
      where: { name: createDto.name },
    });

    if (existingKey) {
      throw new ConflictException('API key with this name already exists');
    }

    // Get the creator
    const creator = await this.userRepository.findOne({
      where: { id: createdById },
    });

    if (!creator) {
      throw new NotFoundException('Creator user not found');
    }

    // Generate the key
    const rawKey = this.generateApiKey();
    const keyHash = this.hashApiKey(rawKey);

    // Create the API key entity
    const apiKey = this.apiKeyRepository.create({
      name: createDto.name,
      description: createDto.description,
      keyHash,
      scopes: createDto.scopes,
      createdBy: creator,
      createdById,
    });

    const savedKey = await this.apiKeyRepository.save(apiKey);

    // Audit the creation
    await this.auditService.logAction(
      AuditAction.API_KEY_CREATED,
      creator.id,
      `API key "${createDto.name}" created with scopes: ${createDto.scopes.join(', ')}`,
      { apiKeyId: savedKey.id, scopes: createDto.scopes },
      ipAddress,
      userAgent,
    );

    return {
      id: savedKey.id,
      name: savedKey.name,
      description: savedKey.description,
      scopes: savedKey.scopes,
      isActive: savedKey.isActive,
      createdAt: savedKey.createdAt,
      createdBy: {
        id: creator.id,
        email: creator.email,
        firstName: creator.firstName,
        lastName: creator.lastName,
      },
      key: rawKey, // Only returned once
    };
  }

  /**
   * List all API keys (without the actual key values)
   */
  async listApiKeys(): Promise<ApiKeyResponse[]> {
    const keys = await this.apiKeyRepository.find({
      relations: ['createdBy'],
      order: { createdAt: 'DESC' },
    });

    return keys.map(key => ({
      id: key.id,
      name: key.name,
      description: key.description,
      scopes: key.scopes,
      isActive: key.isActive,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
      lastUsedByIp: key.lastUsedByIp,
      createdBy: {
        id: key.createdBy.id,
        email: key.createdBy.email,
        firstName: key.createdBy.firstName,
        lastName: key.createdBy.lastName,
      },
    }));
  }

  /**
   * Revoke (deactivate) an API key
   */
  async revokeApiKey(
    apiKeyId: string,
    revokedById: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id: apiKeyId },
      relations: ['createdBy'],
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    if (!apiKey.isActive) {
      throw new BadRequestException('API key is already revoked');
    }

    // Update the key
    await this.apiKeyRepository.update(apiKeyId, {
      isActive: false,
      updatedAt: new Date(),
    });

    // Audit the revocation
    await this.auditService.logAction(
      AuditAction.API_KEY_REVOKED,
      revokedById,
      `API key "${apiKey.name}" revoked`,
      { apiKeyId },
      ipAddress,
      userAgent,
    );
  }

  /**
   * Validate an API key and return the key entity if valid
   */
  async validateApiKey(apiKey: string): Promise<ApiKey | null> {
    const keyHash = this.hashApiKey(apiKey);

    const apiKeyEntity = await this.apiKeyRepository.findOne({
      where: { keyHash, isActive: true },
    });

    if (!apiKeyEntity) {
      return null;
    }

    // Update last used timestamp
    await this.apiKeyRepository.update(apiKeyEntity.id, {
      lastUsedAt: new Date(),
    });

    return apiKeyEntity;
  }

  /**
   * Check if an API key has a specific scope
   */
  hasScope(apiKey: ApiKey, requiredScope: ApiKeyScope): boolean {
    return apiKey.scopes.includes(requiredScope);
  }

  /**
   * Check if an API key has any of the required scopes
   */
  hasAnyScope(apiKey: ApiKey, requiredScopes: ApiKeyScope[]): boolean {
    return requiredScopes.some(scope => apiKey.scopes.includes(scope));
  }
}