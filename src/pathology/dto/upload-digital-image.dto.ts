import { IsString, IsUUID, IsEnum, IsOptional, IsNumber } from 'class-validator';
import { ImageType, ImageFormat } from '../entities/digital-image.entity';

export class UploadDigitalImageDto {
  @IsUUID()
  pathologyCaseId: string;

  @IsUUID()
  @IsOptional()
  histologySlideId?: string;

  @IsUUID()
  @IsOptional()
  cytologySlideId?: string;

  @IsEnum(ImageType)
  imageType: ImageType;

  @IsEnum(ImageFormat)
  format: ImageFormat;

  @IsString()
  storagePath: string;

  @IsString()
  @IsOptional()
  thumbnailPath?: string;

  @IsString()
  @IsOptional()
  scannerInfo?: string;

  @IsString()
  @IsOptional()
  magnification?: string;

  @IsNumber()
  @IsOptional()
  fileSizeBytes?: number;

  @IsNumber()
  @IsOptional()
  widthPixels?: number;

  @IsNumber()
  @IsOptional()
  heightPixels?: number;

  @IsOptional()
  qualityMetrics?: Record<string, any>;

  @IsOptional()
  annotations?: Record<string, any>;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
