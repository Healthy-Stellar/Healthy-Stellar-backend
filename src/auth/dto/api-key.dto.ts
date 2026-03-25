import { IsString, IsArray, IsEnum, IsNotEmpty, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ApiKeyScope } from '../entities/api-key.entity';

export class CreateApiKeyDto {
  @ApiProperty({
    description: 'Name of the API key',
    example: 'Hospital Integration Key',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Description of the API key usage',
    example: 'For hospital information system integration',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Scopes assigned to the API key',
    example: [ApiKeyScope.READ_RECORDS, ApiKeyScope.WRITE_RECORDS],
    enum: ApiKeyScope,
    isArray: true,
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(ApiKeyScope, { each: true })
  scopes: ApiKeyScope[];
}