import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

export enum ImageType {
  WHOLE_SLIDE = 'whole_slide',
  REGION = 'region',
  MACRO = 'macro',
  THUMBNAIL = 'thumbnail',
}

export enum ImageFormat {
  SVS = 'svs',
  TIFF = 'tiff',
  DICOM = 'dicom',
  JPEG = 'jpeg',
  PNG = 'png',
}

@Entity('digital_images')
@Index(['pathologyCaseId'])
@Index(['histologySlideId'])
@Index(['cytologySlideId'])
export class DigitalImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  pathologyCaseId: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  histologySlideId: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  cytologySlideId: string;

  @Column({
    type: 'enum',
    enum: ImageType,
  })
  imageType: ImageType;

  @Column({
    type: 'enum',
    enum: ImageFormat,
  })
  format: ImageFormat;

  @Column({ type: 'varchar', length: 500 })
  storagePath: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  thumbnailPath: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  scannerInfo: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  magnification: string;

  @Column({ type: 'bigint', nullable: true })
  fileSizeBytes: number;

  @Column({ type: 'int', nullable: true })
  widthPixels: number;

  @Column({ type: 'int', nullable: true })
  heightPixels: number;

  @Column({ type: 'timestamp', nullable: true })
  scanDate: Date;

  @Column({ type: 'uuid', nullable: true })
  scannedBy: string;

  @Column({ type: 'jsonb', nullable: true })
  qualityMetrics: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  annotations: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  aiAnalysisResults: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  accessLog: Array<{
    userId: string;
    accessTime: Date;
    action: string;
  }>;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne('PathologyCase', 'digitalImages')
  @JoinColumn({ name: 'pathologyCaseId' })
  pathologyCase: any;

  @ManyToOne('HistologySlide', 'digitalImages', { nullable: true })
  @JoinColumn({ name: 'histologySlideId' })
  histologySlide: any;

  @ManyToOne('CytologySlide', 'digitalImages', { nullable: true })
  @JoinColumn({ name: 'cytologySlideId' })
  cytologySlide: any;
}
