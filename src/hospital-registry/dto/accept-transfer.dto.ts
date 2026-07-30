import { IsUUID, IsNotEmpty } from 'class-validator';

export class AcceptTransferDto {
  @IsUUID()
  @IsNotEmpty()
  acceptedBy: string;
}
