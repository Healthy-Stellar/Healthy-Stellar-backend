import { IsArray, IsString, IsNotEmpty, ValidateNested, Type } from 'class-validator';

export class DrugItemDto {
  @IsString()
  @IsNotEmpty()
  drugId: string;

  @IsString()
  @IsNotEmpty()
  drugName: string;
}

export class DrugInteractionCheckDto {
  @ValidateNested({ each: true })
  @Type(() => DrugItemDto)
  @IsArray()
  @IsNotEmpty()
  drugs: DrugItemDto[];
}
