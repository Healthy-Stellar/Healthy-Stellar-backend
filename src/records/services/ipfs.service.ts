import { Injectable, Logger } from '@nestjs/common';
import { create } from 'ipfs-http-client';

@Injectable()
export class IpfsService {
  private readonly logger = new Logger(IpfsService.name);
  private ipfs: any;

  constructor() {
    this.ipfs = create({
      host: process.env.IPFS_HOST || 'localhost',
      port: parseInt(process.env.IPFS_PORT || '5001'),
      protocol: process.env.IPFS_PROTOCOL || 'http',
    });
  }

  async upload(buffer: Buffer): Promise<string> {
    try {
      const result = await this.ipfs.add(buffer);
      const cid = result.path;
      this.logger.log(`File uploaded to IPFS with CID: ${cid}`);
      return cid;
    } catch (error) {
      this.logger.error(`IPFS upload failed: ${error.message}`);
      throw new Error(`IPFS upload failed: ${error.message}`);
    }
  }
}
