import {
  IsString,
  IsInt,
  IsOptional,
  IsBoolean,
  IsArray,
  IsEmail,
  Min,
} from 'class-validator';

export class CreateOutbreakThresholdDto {
  @IsString()
  pathogen: string;

  @IsString()
  location: string;

  @IsInt()
  @Min(1)
  thresholdCount: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  windowMinutes?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @IsEmail({}, { each: true })
  @IsOptional()
  notifyEmails?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  notifyUserIds?: string[];
}
