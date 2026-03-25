import { IsDateString, IsNotEmpty } from 'class-validator';

export class ActivityQueryDto {
  @IsDateString()
  @IsNotEmpty()
  from: string;

  @IsDateString()
  @IsNotEmpty()
  to: string;
}
