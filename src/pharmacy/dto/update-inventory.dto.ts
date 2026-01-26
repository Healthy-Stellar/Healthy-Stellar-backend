import { IsInt, IsOptional, IsDateString, IsDecimal, IsString, Min } from 'class-validator';

export class UpdateInventoryDto {
  @IsInt()
  @IsOptional()
  @Min(0)
  quantity?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  reorderLevel?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  reorderQuantity?: number;

  @IsDateString()
  @IsOptional()
  expirationDate?: string;

  @IsDecimal()
  @IsOptional()
  unitCost?: number;

  @IsDecimal()
  @IsOptional()
  sellingPrice?: number;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  status?: string;
}