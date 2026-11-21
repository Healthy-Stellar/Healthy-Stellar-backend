import { IsUUID, IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

export class RejectTransferDto {
  @IsUUID()
  @IsNotEmpty()
  rejectedBy: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}
