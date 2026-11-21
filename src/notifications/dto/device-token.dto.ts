import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DevicePlatform } from '../entities/device-token.entity';

export class RegisterDeviceTokenDto {
  @ApiProperty({ description: 'FCM or APNs device token' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ enum: DevicePlatform, description: 'Target platform' })
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;
}

export class DeregisterDeviceTokenDto {
  @ApiProperty({ description: 'Device token to remove' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
