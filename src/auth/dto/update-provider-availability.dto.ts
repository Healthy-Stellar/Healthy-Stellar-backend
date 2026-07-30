import { IsBoolean, IsInt, IsOptional, IsArray, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateProviderAvailabilityDto {
    @IsOptional()
    @IsBoolean()
    isAcceptingPatients?: boolean;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(10000)
    maxPatients?: number;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    specializations?: string[];
}
