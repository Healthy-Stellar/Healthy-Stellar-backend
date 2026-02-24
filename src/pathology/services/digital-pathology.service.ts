import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DigitalImage } from '../entities/digital-image.entity';
import { UploadDigitalImageDto } from '../dto/upload-digital-image.dto';

@Injectable()
export class DigitalPathologyService {
  private readonly logger = new Logger(DigitalPathologyService.name);

  constructor(
    @InjectRepository(DigitalImage)
    private imageRepository: Repository<DigitalImage>,
  ) {}

  async uploadImage(uploadDto: UploadDigitalImageDto, userId: string): Promise<DigitalImage> {
    const image = this.imageRepository.create({
      ...uploadDto,
      scanDate: new Date(),
      scannedBy: userId,
      accessLog: [],
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.imageRepository.save(image);
    this.logger.log(`Digital image uploaded: ${saved.id}`);

    return saved;
  }

  async findOne(id: string, userId: string): Promise<DigitalImage> {
    const image = await this.imageRepository.findOne({
      where: { id },
      relations: ['pathologyCase', 'histologySlide', 'cytologySlide'],
    });

    if (!image) {
      throw new NotFoundException(`Digital image with ID ${id} not found`);
    }

    // Log access
    await this.logAccess(image, userId, 'view');

    return image;
  }

  async findByCase(caseId: string): Promise<DigitalImage[]> {
    return this.imageRepository.find({
      where: { pathologyCaseId: caseId },
      order: { createdAt: 'DESC' },
    });
  }

  async findBySlide(slideId: string, slideType: 'histology' | 'cytology'): Promise<DigitalImage[]> {
    const where =
      slideType === 'histology' ? { histologySlideId: slideId } : { cytologySlideId: slideId };

    return this.imageRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async addAnnotation(
    id: string,
    annotations: Record<string, any>,
    userId: string,
  ): Promise<DigitalImage> {
    const image = await this.findOne(id, userId);

    image.annotations = {
      ...image.annotations,
      ...annotations,
      lastModified: new Date(),
      lastModifiedBy: userId,
    };
    image.updatedBy = userId;

    await this.logAccess(image, userId, 'annotate');

    return this.imageRepository.save(image);
  }

  async addAIAnalysis(
    id: string,
    analysisResults: Record<string, any>,
    userId: string,
  ): Promise<DigitalImage> {
    const image = await this.findOne(id, userId);

    image.aiAnalysisResults = {
      ...analysisResults,
      analyzedAt: new Date(),
      analyzedBy: userId,
    };
    image.updatedBy = userId;

    return this.imageRepository.save(image);
  }

  private async logAccess(image: DigitalImage, userId: string, action: string): Promise<void> {
    if (!image.accessLog) {
      image.accessLog = [];
    }

    image.accessLog.push({
      userId,
      accessTime: new Date(),
      action,
    });

    // Keep only last 100 access logs
    if (image.accessLog.length > 100) {
      image.accessLog = image.accessLog.slice(-100);
    }

    await this.imageRepository.save(image);
  }
}
