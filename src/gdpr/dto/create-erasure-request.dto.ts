import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateErasureRequestDto {
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @IsString()
  @IsNotEmpty()
  requestorIdentity: string;

  @IsOptional()
  @IsString()
  tenantId?: string;
}
