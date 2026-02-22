import { IsString, IsNotEmpty, IsObject } from 'class-validator';

export class StellarTransactionJobDto {
  @IsString()
  @IsNotEmpty()
  operationType: string;

  @IsObject()
  @IsNotEmpty()
  params: Record<string, any>;

  @IsString()
  @IsNotEmpty()
  initiatedBy: string;

  @IsString()
  @IsNotEmpty()
  correlationId: string;
}
