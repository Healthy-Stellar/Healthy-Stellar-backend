import { Injectable, Logger } from '@nestjs/common';
import { create } from 'ipfs-http-client';
import { TracingService } from '../../common/services/tracing.service';

@Injectable()
export class IpfsService {
  private readonly logger = new Logger(IpfsService.name);
  private ipfs: any;

  constructor(private readonly tracingService: TracingService) {
    this.ipfs = create({
      host: process.env.IPFS_HOST || 'localhost',
      port: parseInt(process.env.IPFS_PORT || '5001'),
      protocol: process.env.IPFS_PROTOCOL || 'http',
    });
  }

  async upload(buffer: Buffer): Promise<string> {
    return this.tracingService.withSpan(
      'ipfs.upload',
      async (span) => {
        span.setAttribute('ipfs.buffer_size', buffer.length);
        span.setAttribute('ipfs.host', process.env.IPFS_HOST || 'localhost');

        try {
          this.tracingService.addEvent('ipfs.add.start');
          const result = await this.ipfs.add(buffer);
          const cid = result.path;
          
          span.setAttribute('ipfs.cid', cid);
          this.tracingService.addEvent('ipfs.add.complete', { 'ipfs.cid': cid });
          
          this.logger.log(`File uploaded to IPFS with CID: ${cid}`);
          return cid;
        } catch (error) {
          this.tracingService.recordException(error as Error);
          this.logger.error(`IPFS upload failed: ${error.message}`);
          throw new Error(`IPFS upload failed: ${error.message}`);
        }
      },
    );
  }
}
