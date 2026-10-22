import { IsString, IsEnum } from 'class-validator';
import { BedStatus } from '../../../common/enums/bed-status.enum';

export class AssignBedDto {
  @IsString()
  patientId: string;

  @IsEnum(BedStatus)
  status: BedStatus;
}
