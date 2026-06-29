import { IsArray, IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel, NotificationFrequency } from '../entities/notification-category-preference.entity';

export class UpdateCategoryPreferenceDto {
  @ApiProperty({
    enum: NotificationChannel,
    isArray: true,
    description: 'Channels this notification category should be delivered on',
    example: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
  })
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  channels: NotificationChannel[];

  @ApiPropertyOptional({ description: 'Whether this category is enabled at all', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    enum: NotificationFrequency,
    description: 'Deliver immediately or batch into the daily digest email',
    default: NotificationFrequency.IMMEDIATE,
  })
  @IsOptional()
  @IsEnum(NotificationFrequency)
  frequency?: NotificationFrequency;
}

export class CategoryPreferenceResponseDto {
  @ApiProperty()
  category: string;

  @ApiProperty({ enum: NotificationChannel, isArray: true })
  channels: NotificationChannel[];

  @ApiProperty()
  enabled: boolean;

  @ApiProperty({ enum: NotificationFrequency })
  frequency: NotificationFrequency;
}
