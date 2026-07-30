import { IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWebhookSubscriptionDto {
  @ApiProperty({ description: 'Target HTTPS endpoint to receive webhook events' })
  @IsUrl({ protocols: ['https', 'http'] })
  url: string;

  @ApiProperty({ description: 'Event types to subscribe to (e.g. patient.created)', type: [String] })
  @IsArray()
  @IsString({ each: true })
  events: string[];

  @ApiPropertyOptional({ description: 'Custom HMAC secret (auto-generated if omitted)' })
  @IsString()
  @IsOptional()
  secret?: string;

  @ApiPropertyOptional({ default: 5, minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  maxRetries?: number;
}

export class UpdateWebhookSubscriptionDto {
  @ApiPropertyOptional()
  @IsUrl({ protocols: ['https', 'http'] })
  @IsOptional()
  url?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  events?: string[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  maxRetries?: number;
}
