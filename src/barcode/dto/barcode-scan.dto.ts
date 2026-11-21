import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { VerificationType } from '../enums/verification-type.enum';

export class BarcodeScanDto {
  @ApiProperty({
    description: 'The raw barcode value that was scanned',
    example: '0123456789012',
  })
  @IsString()
  @IsNotEmpty()
  barcode: string;

  @ApiProperty({
    description: 'The type of verification this scan is intended to satisfy',
    enum: VerificationType,
    example: VerificationType.MEDICATION_BARCODE,
  })
  @IsEnum(VerificationType)
  verificationType: VerificationType;

  @ApiPropertyOptional({
    description:
      'Whether the scan captured dose-specific data (e.g. dose amount) that can be compared against the ordered dose. ' +
      'Only set this to true when the scanned payload actually contains dose information.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  doseVerified?: boolean;

  @ApiPropertyOptional({
    description:
      'Whether the scan captured route-specific data (e.g. administration route) that can be compared against the ordered route. ' +
      'Only set this to true when the scanned payload actually contains route information.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  routeVerified?: boolean;
}
