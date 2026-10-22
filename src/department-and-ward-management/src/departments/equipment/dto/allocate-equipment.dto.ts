import { IsString, IsEnum, IsOptional } from 'class-validator';
import { EquipmentStatus } from '../../../common/enums/equipment-status.enum';

export class AllocateEquipmentDto {
  @IsString()
  @IsOptional()
  currentLocation?: string;

  @IsString()
  @IsOptional()
  assignedToRoomId?: string;

  @IsEnum(EquipmentStatus)
  status: EquipmentStatus;
}
