import { Injectable, Logger } from '@nestjs/common';
import { create } from 'ipfs-http-client';
import * as fs from 'fs';

@Injectable()
export class IpfsService {
  private readonly logger = new Logger(IpfsService.name);
  private ipfs;

  constructor() {
    this.ipfs = create({ url: process.env.IPFS_URL || 'http://localhost:5001' });
  }

  async uploadFile(filePath: string): Promise<string> {
    try {
      const file = fs.readFileSync(filePath);
      const result = await this.ipfs.add(file, { pin: true });
      
      await this.ipfs.pin.add(result.cid, { timeout: 10000 });
      
      setTimeout(() => this.unpinFile(result.cid.toString()), 7 * 24 * 60 * 60 * 1000);
      
      this.logger.log(`File uploaded to IPFS: ${result.cid}`);
      return result.cid.toString();
    } catch (error) {
      this.logger.error(`IPFS upload failed: ${error.message}`);
      throw error;
    }
  }

  async unpinFile(cid: string): Promise<void> {
    try {
      await this.ipfs.pin.rm(cid);
      this.logger.log(`File unpinned from IPFS: ${cid}`);
    } catch (error) {
      this.logger.error(`IPFS unpin failed: ${error.message}`);
    }
  }

  async getFile(cid: string): Promise<Buffer> {
    const chunks = [];
    for await (const chunk of this.ipfs.cat(cid)) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
}
