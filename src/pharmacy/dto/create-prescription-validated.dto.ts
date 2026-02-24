import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsEnum,
  IsArray,
  ValidateNested,
  IsOptional,
  MaxLength,
  Min,
  Max,
  Type,
  IsPositive,
  Matches,
} from 'class-validator';

enum Frequency {
  ONCE_DAILY = 'ONCE_DAILY',
  TWICE_DAILY = 'TWICE_DAILY',
  THREE_TIMES_DAILY = 'THREE_TIMES_DAILY',
  FOUR_TIMES_DAILY = 'FOUR_TIMES_DAILY',
  AS_NEEDED = 'AS_NEEDED',
}

enum Route {
  ORAL = 'ORAL',
  INTRAVENOUS = 'INTRAVENOUS',
  INTRAMUSCULAR = 'INTRAMUSCULAR',
  TOPICAL = 'TOPICAL',
  INTRANASAL = 'INTRANASAL',
}

export class PrescriptionItemDto {
  @IsString()
  @IsNotEmpty()
  drugId: string;

  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  quantity: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  strength: string;

  @IsEnum(Route)
  @IsNotEmpty()
  route: Route;

  @IsEnum(Frequency)
  @IsNotEmpty()
  frequency: Frequency;

  @IsNumber()
  @Min(1)
  @Max(365)
  @IsOptional()
  durationDays: number;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  specialInstructions: string;
}

export class CreatePrescriptionValidatedDto {
  @IsString()
  @IsNotEmpty()
  patientId: string;

  @IsString()
  @IsNotEmpty()
  providerId: string;

  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  @IsArray()
  @IsNotEmpty()
  items: PrescriptionItemDto[];

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' })
  startDate: string;
}
