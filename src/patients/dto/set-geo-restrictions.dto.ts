import { IsArray, IsString, Length, ArrayMaxSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetGeoRestrictionsDto {
  @ApiProperty({
    description: 'ISO 3166-1 alpha-2 country codes that are allowed to access records. Empty array removes all restrictions.',
    example: ['US', 'GB', 'CA'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @Length(2, 2, { each: true })
  @ArrayMaxSize(250)
  allowedCountries: string[];
}
