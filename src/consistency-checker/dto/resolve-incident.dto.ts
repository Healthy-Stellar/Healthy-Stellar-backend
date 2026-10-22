import { IsUUID, IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator';

export class ResolveIncidentDto {
  @IsUUID()
  @IsNotEmpty()
  resolvedBy: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}
