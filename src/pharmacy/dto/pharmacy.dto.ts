import { IsString, IsNumber, IsDate, IsOptional, IsBoolean, IsArray, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDrugDto {
  @ApiProperty({ example: '12345-678-90' })
  @IsString()
  ndc: string;

  @ApiProperty({ example: 'Lisinopril 10mg' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Lisinopril' })
  @IsString()
  genericName: string;

  @ApiProperty({ example: 'PharmaCorp' })
  @IsString()
  manufacturer: string;

  @ApiProperty({ example: 'Tablet' })
  @IsString()
  dosageForm: string;

  @ApiProperty({ example: '10mg' })
  @IsString()
  strength: string;

  @ApiProperty({ example: 15.5 })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @Min(0)
  quantityOnHand: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  reorderLevel: number;

  @ApiProperty({ example: 500 })
  @IsNumber()
  reorderQuantity: number;

  @ApiProperty({ example: 'LOT123456' })
  @IsString()
  lotNumber: string;

  @ApiProperty({ example: '2025-12-31' })
  @IsString()
  expirationDate: string;

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  interactions?: string[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  controlledSubstance?: boolean;
}

export class CreatePrescriptionDto {
  @ApiProperty({ example: 'patient-12345-anon' })
  @IsString()
  patientId: string;

  @ApiProperty({ example: 'provider-001' })
  @IsString()
  providerId: string;

  @ApiProperty({ example: 'drug-uuid' })
  @IsString()
  drugId: string;

  @ApiProperty({ example: '10mg once daily' })
  @IsString()
  dosage: string;

  @ApiProperty({ example: 30 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 3 })
  @IsNumber()
  @Min(0)
  refills: number;

  @ApiProperty({ example: 'Take with food' })
  @IsString()
  instructions: string;
}

export class FillPrescriptionDto {
  @ApiProperty({ example: 'pharmacist-001' })
  @IsString()
  pharmacistId: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
