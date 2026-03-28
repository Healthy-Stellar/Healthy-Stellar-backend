import { IsString, MinLength, IsOptional } from 'class-validator';

export class AmendRecordDto {
  @IsString()
  @MinLength(20, { message: 'amendmentReason must be at least 20 characters' })
  amendmentReason: string;

  @IsOptional()
  @IsString()
  encryptedDek?: string;
}
