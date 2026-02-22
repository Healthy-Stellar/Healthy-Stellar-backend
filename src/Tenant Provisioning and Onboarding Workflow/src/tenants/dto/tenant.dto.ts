import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";

export class CreateTenantDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  name: string;

  @IsNotEmpty()
  @IsEmail()
  adminEmail: string;

  @IsNotEmpty()
  @IsString()
  adminFirstName: string;

  @IsNotEmpty()
  @IsString()
  adminLastName: string;
}

export class TenantResponseDto {
  id: string;
  name: string;
  schemaName: string;
  status: string;
  adminEmail: string;
  sorobanContractId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ProvisioningLogDto {
  id: string;
  step: string;
  status: string;
  result?: string;
  error?: string;
  durationMs?: number;
  createdAt: Date;
}

export class ProvisioningStatusDto {
  tenantId: string;
  tenantName: string;
  overallStatus: string;
  logs: ProvisioningLogDto[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}
