import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { BedStatus } from '../bed-status.enum';

export class AssignBedDto {
  @IsUUID()
  bedId: string;

  @IsUUID()
  patientId: string;
}

export class UpdateBedStatusDto {
  @IsEnum(BedStatus)
  status: BedStatus;
}

export class CreateBedDto {
  @IsString()
  bedNumber: string;

  @IsUUID()
  roomId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];
}

export class CreateRoomDto {
  @IsUUID()
  wardId: string;

  @IsString()
  roomNumber: string;
}

export class CreateWardDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsUUID()
  wardManagerId?: string;
}

export class BedOccupancyQueryDto {
  @IsOptional()
  @IsUUID()
  wardId?: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;

  @IsOptional()
  @IsEnum(BedStatus)
  status?: BedStatus;

  @IsOptional()
  @IsBoolean()
  activeOnly?: boolean;
}
