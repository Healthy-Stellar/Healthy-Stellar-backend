import {
  IsString,
  IsDateString,
  IsArray,
  IsNumber,
  IsOptional,
  ValidateNested,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RemittanceLineDto {
  @ApiProperty({ description: 'Claim ID this line references' })
  @IsUUID()
  claimId: string;

  @ApiProperty({ description: 'Original billed amount' })
  @IsNumber()
  billedAmount: number;

  @ApiProperty({ description: 'Amount paid by payer' })
  @IsNumber()
  paidAmount: number;

  @ApiProperty({ description: 'Adjustment amount applied' })
  @IsNumber()
  adjustmentAmount: number;

  @ApiPropertyOptional({ description: 'Raw ERA/835 data for this line' })
  @IsOptional()
  raw?: any;
}

export class IngestRemittanceDto {
  @ApiProperty({ description: 'Name of the insurance payer' })
  @IsString()
  payerName: string;

  @ApiProperty({ description: 'Date of the remittance' })
  @IsDateString()
  remittanceDate: Date;

  @ApiProperty({ type: [RemittanceLineDto], description: 'Remittance lines to process' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RemittanceLineDto)
  lines: RemittanceLineDto[];
}
