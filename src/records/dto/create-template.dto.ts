import { IsString, IsEnum, IsBoolean, IsOptional, IsObject, ValidateBy, ValidationOptions } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecordType } from './create-record.dto';

function IsValidJson(validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isValidJson',
      validator: {
        validate(value: any) {
          if (typeof value === 'object' && value !== null) return true;
          if (typeof value !== 'string') return false;
          try {
            JSON.parse(value);
            return true;
          } catch {
            return false;
          }
        },
        defaultMessage: () => 'schemaJson must be a valid JSON object',
      },
    },
    validationOptions,
  );
}

export class CreateTemplateDto {
  @ApiProperty({ description: 'Template name' })
  @IsString()
  name: string;

  @ApiProperty({ enum: RecordType })
  @IsEnum(RecordType)
  recordType: RecordType;

  @ApiProperty({ description: 'JSON schema defining the template structure' })
  @IsObject()
  @IsValidJson()
  schemaJson: Record<string, any>;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
