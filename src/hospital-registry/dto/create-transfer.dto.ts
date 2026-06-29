import {
  IsString,
  IsUUID,
  IsOptional,
  IsArray,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';

export class CreateTransferDto {
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  patientName: string;

  @IsUUID()
  @IsNotEmpty()
  toHospitalId: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  transferReason?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  recordIdsToShare?: string[];
}
