import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

export interface TempStorageOptions {
  provider: 'local' | 's3';
  localDir?: string;
  s3Bucket?: string;
  s3Region?: string;
}

@Injectable()
export class TempStorageService {
  private readonly logger = new Logger(TempStorageService.name);
  private readonly options: TempStorageOptions;
  private s3Client: S3Client | null = null;
  private readonly localDir: string;

  constructor(private readonly configService: ConfigService) {
    const provider = this.configService.get<'local' | 's3'>('EHR_IMPORT_TEMP_PROVIDER', 'local');
    this.options = {
      provider,
      localDir: this.configService.get('EHR_IMPORT_TEMP_DIR', path.join(os.tmpdir(), 'ehr-import')),
      s3Bucket: this.configService.get('EHR_IMPORT_S3_BUCKET'),
      s3Region: this.configService.get('AWS_REGION', 'us-east-1'),
    };

    if (this.options.provider === 's3') {
      this.s3Client = new S3Client({
        region: this.options.s3Region,
      });
    }

    this.localDir = this.options.localDir;
    if (!fs.existsSync(this.localDir)) {
      fs.mkdirSync(this.localDir, { recursive: true });
    }
  }

  async writeStream(
    jobId: string,
    stream: Readable,
    originalName: string,
  ): Promise<string> {
    const filename = `${jobId}-${path.basename(originalName)}`;
    const filePath = path.join(this.localDir, filename);

    const writeStream = fs.createWriteStream(filePath);
    stream.pipe(writeStream);

    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => resolve(filePath));
      writeStream.on('error', reject);
      stream.on('error', reject);
    });
  }

  async writeBuffer(jobId: string, buffer: Buffer, originalName: string): Promise<string> {
    const filename = `${jobId}-${path.basename(originalName)}`;
    const filePath = path.join(this.localDir, filename);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  }

  async readFile(filePath: string): Promise<Buffer> {
    return fs.readFileSync(filePath);
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      this.logger.warn(`Failed to delete temp file ${filePath}: ${err}`);
    }
  }

  async getStream(filePath: string): Promise<Readable> {
    if (this.options.provider === 's3' && filePath.startsWith('s3://')) {
      return this._getS3Stream(filePath);
    }
    return fs.createReadStream(filePath);
  }

  private async _getS3Stream(s3Path: string): Promise<Readable> {
    if (!this.s3Client) throw new Error('S3 client not initialized');

    const bucket = this.options.s3Bucket;
    const key = s3Path.replace(`s3://${bucket}/`, '');

    const response = await this.s3Client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );

    return response.Body as Readable;
  }
}