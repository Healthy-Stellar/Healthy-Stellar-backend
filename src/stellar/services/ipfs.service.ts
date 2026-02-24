import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface IpfsBlob {
  cid: string;
  encryptedPayload: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class IpfsService {
  private readonly logger = new Logger(IpfsService.name);
  private readonly ipfsGateway: string;

  constructor(private readonly configService: ConfigService) {
    this.ipfsGateway = this.configService.get<string>('IPFS_GATEWAY', 'https://ipfs.io/ipfs/');
  }

  async fetch(cid: string): Promise<IpfsBlob> {
    this.logger.log(`Fetching IPFS content for CID: ${cid}`);

    try {
      const response = await fetch(`${this.ipfsGateway}${cid}`);
      
      if (!response.ok) {
        throw new Error(`IPFS fetch failed: ${response.statusText}`);
      }

      const encryptedPayload = await response.text();

      return {
        cid,
        encryptedPayload,
        metadata: {
          fetchedAt: new Date().toISOString(),
          size: encryptedPayload.length,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch from IPFS: ${error.message}`, error.stack);
      throw error;
    }
  }
}
