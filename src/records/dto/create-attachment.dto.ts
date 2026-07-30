import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateAttachmentDto {
  @ApiProperty({
    description: 'Description or notes about the attachment',
    example: 'Lab results from January 2024',
    required: false,
  })
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Email of the user uploading the attachment',
    example: 'provider@hospital.com',
  })
  @IsNotEmpty()
  @IsEmail()
  uploaderEmail: string;
}
