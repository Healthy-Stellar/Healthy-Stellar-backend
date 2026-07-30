import { IsString, IsNotEmpty, IsObject } from 'class-validator';
import { Exclude } from 'class-transformer';

export class StellarTransactionJobDto {
  @IsString()
  @IsNotEmpty()
  operationType: string;

  /** Never serialized in responses or logs — may contain sensitive contract parameters */
  @Exclude()
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
