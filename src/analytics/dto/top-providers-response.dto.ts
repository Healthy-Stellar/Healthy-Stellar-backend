import { IsString, IsNumber, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class ProviderRankingDto {
  @IsString()
  providerId: string;

  @IsNumber()
  activeGrantCount: number;
}

export class TopProvidersResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProviderRankingDto)
  providers: ProviderRankingDto[];
}
