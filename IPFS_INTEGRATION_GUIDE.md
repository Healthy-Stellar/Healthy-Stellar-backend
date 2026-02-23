# IPFS Integration Guide

## Overview
The bulk export service currently uses a placeholder for IPFS uploads. This guide shows how to integrate actual IPFS functionality.

## Option 1: Self-Hosted IPFS Node

### Installation
```bash
npm install ipfs-http-client
```

### Configuration
```typescript
// src/fhir/services/ipfs.service.ts
import { Injectable } from '@nestjs/common';
import { create, IPFSHTTPClient } from 'ipfs-http-client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class IpfsService {
  private client: IPFSHTTPClient;

  constructor(private configService: ConfigService) {
    this.client = create({
      host: this.configService.get('IPFS_HOST', 'localhost'),
      port: this.configService.get('IPFS_PORT', 5001),
      protocol: this.configService.get('IPFS_PROTOCOL', 'http'),
    });
  }

  async upload(content: string): Promise<string> {
    const { cid } = await this.client.add(content);
    return `ipfs://${cid.toString()}`;
  }

  async download(cid: string): Promise<string> {
    const chunks = [];
    for await (const chunk of this.client.cat(cid)) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf-8');
  }

  async pin(cid: string): Promise<void> {
    await this.client.pin.add(cid);
  }
}
```

### Update BulkExportService
```typescript
// src/fhir/services/bulk-export.service.ts
import { IpfsService } from './ipfs.service';

@Injectable()
export class BulkExportService {
  constructor(
    // ... existing dependencies
    private ipfsService: IpfsService,
  ) {}

  private async uploadToIPFS(content: string): Promise<string> {
    const url = await this.ipfsService.upload(content);
    // Optionally pin for persistence
    const cid = url.replace('ipfs://', '');
    await this.ipfsService.pin(cid);
    return url;
  }
}
```

### Environment Variables
```env
IPFS_HOST=localhost
IPFS_PORT=5001
IPFS_PROTOCOL=http
```

## Option 2: Pinata (Managed IPFS)

### Installation
```bash
npm install @pinata/sdk
```

### Configuration
```typescript
// src/fhir/services/pinata.service.ts
import { Injectable } from '@nestjs/common';
import pinataSDK from '@pinata/sdk';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';

@Injectable()
export class PinataService {
  private pinata: any;

  constructor(private configService: ConfigService) {
    this.pinata = new pinataSDK(
      this.configService.get('PINATA_API_KEY'),
      this.configService.get('PINATA_SECRET_KEY'),
    );
  }

  async upload(content: string, filename: string): Promise<string> {
    const stream = Readable.from([content]);
    const options = {
      pinataMetadata: {
        name: filename,
        keyvalues: {
          type: 'fhir-bulk-export',
          timestamp: new Date().toISOString(),
        },
      },
      pinataOptions: {
        cidVersion: 1,
      },
    };

    const result = await this.pinata.pinFileToIPFS(stream, options);
    return `ipfs://${result.IpfsHash}`;
  }

  async unpin(cid: string): Promise<void> {
    await this.pinata.unpin(cid);
  }

  async testAuthentication(): Promise<boolean> {
    try {
      await this.pinata.testAuthentication();
      return true;
    } catch (error) {
      return false;
    }
  }
}
```

### Environment Variables
```env
PINATA_API_KEY=your_api_key
PINATA_SECRET_KEY=your_secret_key
```

## Option 3: Infura IPFS

### Installation
```bash
npm install ipfs-http-client
```

### Configuration
```typescript
// src/fhir/services/infura-ipfs.service.ts
import { Injectable } from '@nestjs/common';
import { create } from 'ipfs-http-client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InfuraIpfsService {
  private client: any;

  constructor(private configService: ConfigService) {
    const projectId = this.configService.get('INFURA_PROJECT_ID');
    const projectSecret = this.configService.get('INFURA_PROJECT_SECRET');
    const auth = 'Basic ' + Buffer.from(projectId + ':' + projectSecret).toString('base64');

    this.client = create({
      host: 'ipfs.infura.io',
      port: 5001,
      protocol: 'https',
      headers: {
        authorization: auth,
      },
    });
  }

  async upload(content: string): Promise<string> {
    const { cid } = await this.client.add(content);
    return `ipfs://${cid.toString()}`;
  }

  async download(cid: string): Promise<string> {
    const chunks = [];
    for await (const chunk of this.client.cat(cid)) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf-8');
  }
}
```

### Environment Variables
```env
INFURA_PROJECT_ID=your_project_id
INFURA_PROJECT_SECRET=your_project_secret
```

## Option 4: Web3.Storage

### Installation
```bash
npm install web3.storage
```

### Configuration
```typescript
// src/fhir/services/web3-storage.service.ts
import { Injectable } from '@nestjs/common';
import { Web3Storage, File } from 'web3.storage';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class Web3StorageService {
  private client: Web3Storage;

  constructor(private configService: ConfigService) {
    this.client = new Web3Storage({
      token: this.configService.get('WEB3_STORAGE_TOKEN'),
    });
  }

  async upload(content: string, filename: string): Promise<string> {
    const file = new File([content], filename, { type: 'application/x-ndjson' });
    const cid = await this.client.put([file], {
      name: filename,
      maxRetries: 3,
    });
    return `ipfs://${cid}`;
  }

  async download(cid: string): Promise<string> {
    const res = await this.client.get(cid);
    if (!res.ok) {
      throw new Error(`Failed to get ${cid}`);
    }
    const files = await res.files();
    const content = await files[0].text();
    return content;
  }
}
```

### Environment Variables
```env
WEB3_STORAGE_TOKEN=your_api_token
```

## Module Registration

### Update FhirModule
```typescript
// src/fhir/fhir.module.ts
import { Module } from '@nestjs/common';
import { IpfsService } from './services/ipfs.service';
// or PinataService, InfuraIpfsService, Web3StorageService

@Module({
  imports: [
    // ... existing imports
  ],
  providers: [
    // ... existing providers
    IpfsService, // or your chosen service
  ],
  exports: [
    // ... existing exports
    IpfsService,
  ],
})
export class FhirModule {}
```

## IPFS Gateway Configuration

### Public Gateways
```typescript
// src/fhir/services/ipfs-gateway.service.ts
@Injectable()
export class IpfsGatewayService {
  private gateways = [
    'https://ipfs.io/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://dweb.link/ipfs/',
  ];

  getDownloadUrl(ipfsUrl: string): string {
    const cid = ipfsUrl.replace('ipfs://', '');
    return `${this.gateways[0]}${cid}`;
  }

  getAllGatewayUrls(ipfsUrl: string): string[] {
    const cid = ipfsUrl.replace('ipfs://', '');
    return this.gateways.map(gateway => `${gateway}${cid}`);
  }
}
```

## Compression (Optional)

### Add Gzip Compression
```typescript
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

async uploadCompressed(content: string): Promise<string> {
  const compressed = await gzipAsync(Buffer.from(content));
  return this.ipfsService.upload(compressed.toString('base64'));
}

async downloadCompressed(cid: string): Promise<string> {
  const compressed = await this.ipfsService.download(cid);
  const decompressed = await gunzipAsync(Buffer.from(compressed, 'base64'));
  return decompressed.toString('utf-8');
}
```

## Testing IPFS Integration

### Unit Test
```typescript
describe('IpfsService', () => {
  it('should upload and retrieve content', async () => {
    const content = '{"resourceType":"Patient","id":"1"}';
    const url = await ipfsService.upload(content);
    
    expect(url).toMatch(/^ipfs:\/\//);
    
    const cid = url.replace('ipfs://', '');
    const retrieved = await ipfsService.download(cid);
    
    expect(retrieved).toBe(content);
  });
});
```

### E2E Test
```typescript
it('should export to IPFS and retrieve via gateway', async () => {
  const exportResponse = await request(app.getHttpServer())
    .get('/fhir/r4/Patient/$export')
    .set('Authorization', `Bearer ${token}`)
    .expect(202);

  // Wait for completion
  await waitForCompletion(jobId);

  const statusResponse = await request(app.getHttpServer())
    .get(`/fhir/r4/$export-status/${jobId}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  const ipfsUrl = statusResponse.body.output[0].url;
  const cid = ipfsUrl.replace('ipfs://', '');
  
  // Test retrieval via gateway
  const gatewayUrl = `https://ipfs.io/ipfs/${cid}`;
  const response = await axios.get(gatewayUrl);
  
  expect(response.data).toBeDefined();
});
```

## Cleanup Strategy

### Automatic Unpinning
```typescript
async cleanupExpiredJobs(): Promise<void> {
  const expired = await this.jobRepo.find({
    where: { status: ExportJobStatus.COMPLETED },
  });

  const now = new Date();
  for (const job of expired) {
    if (job.expiresAt && job.expiresAt < now) {
      // Unpin IPFS files
      for (const file of job.outputFiles || []) {
        const cid = file.url.replace('ipfs://', '');
        await this.ipfsService.unpin(cid);
      }
      
      await this.jobRepo.remove(job);
    }
  }
}
```

## Monitoring

### Track IPFS Metrics
```typescript
@Injectable()
export class IpfsMetricsService {
  private uploadCount = 0;
  private uploadBytes = 0;
  private uploadErrors = 0;

  async trackUpload(size: number, success: boolean): Promise<void> {
    this.uploadCount++;
    if (success) {
      this.uploadBytes += size;
    } else {
      this.uploadErrors++;
    }
  }

  getMetrics() {
    return {
      uploads: this.uploadCount,
      bytes: this.uploadBytes,
      errors: this.uploadErrors,
      errorRate: this.uploadErrors / this.uploadCount,
    };
  }
}
```

## Recommended Approach

For production, we recommend:

1. **Development/Testing**: Self-hosted IPFS node
2. **Production**: Pinata or Web3.Storage (managed, reliable)
3. **High Volume**: Self-hosted IPFS cluster with load balancing
4. **Cost-Sensitive**: Web3.Storage (free tier available)

## Next Steps

1. Choose IPFS solution based on requirements
2. Install appropriate package
3. Create service implementation
4. Update `bulk-export.service.ts`
5. Add environment variables
6. Test upload/download
7. Configure cleanup/unpinning
8. Set up monitoring
9. Deploy and verify
