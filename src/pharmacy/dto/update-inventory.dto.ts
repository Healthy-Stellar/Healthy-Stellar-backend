import {
  IsOptional,
  IsInt,
  IsString,
  IsBoolean,
  IsDateString,
  IsDecimal,
  Min,
} from 'class-validator';

export class UpdateInventoryDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  reorderLevel?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  reorderQuantity?: number;

  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsBoolean()
  isRecalled?: boolean;

  @IsOptional()
  @IsString()
  recallReason?: string;

  @IsOptional()
  @IsDateString()
  recallDate?: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  unitCost?: number;

  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  sellingPrice?: number;

  @IsOptional()
  @IsBoolean()
  isFormularyDrug?: boolean;

  @IsOptional()
  @IsString()
  formularyTier?: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  formularyCopay?: number;
}
