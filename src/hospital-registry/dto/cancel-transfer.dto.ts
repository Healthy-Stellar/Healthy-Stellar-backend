import { IsUUID, IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

export class CancelTransferDto {
  @IsUUID()
  @IsNotEmpty()
  cancelledBy: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}
