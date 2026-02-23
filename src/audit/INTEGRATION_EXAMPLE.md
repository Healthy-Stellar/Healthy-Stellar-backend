# Audit Service Integration Example

This guide shows how to integrate the Audit Service with the existing Records module.

## Step 1: Update Records Module

Add AuditModule to the imports:

```typescript
// src/records/records.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { Record } from './entities/record.entity';
import { RecordsController } from './controllers/records.controller';
import { RecordsService } from './services/records.service';
import { IpfsService } from './services/ipfs.service';
import { StellarService } from './services/stellar.service';
import { AuditModule } from '../audit/audit.module'; // Add this

@Module({
  imports: [
    TypeOrmModule.forFeature([Record]),
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
    AuditModule, // Add this
  ],
  controllers: [RecordsController],
  providers: [RecordsService, IpfsService, StellarService],
  exports: [RecordsService],
})
export class RecordsModule {}
```

## Step 2: Update Records Controller

Apply the AuditInterceptor:

```typescript
// src/records/controllers/records.controller.ts
import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RecordsService } from '../services/records.service';
import { CreateRecordDto } from '../dto/create-record.dto';
import { AuditInterceptor } from '../../audit/interceptors/audit.interceptor'; // Add this
import { AuditService, AuditAction, ResourceType } from '../../audit'; // Add this

@Controller('records')
@UseInterceptors(AuditInterceptor) // Add this - automatically logs all requests
export class RecordsController {
  constructor(
    private readonly recordsService: RecordsService,
    private readonly auditService: AuditService, // Add this
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  async uploadRecord(
    @Body() dto: CreateRecordDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Encrypted record file is required');
    }

    const record = await this.recordsService.uploadRecord(dto, file.buffer);

    // Additional audit logging with context
    await this.auditService.log({
      actorId: req.user?.id || 'system',
      action: AuditAction.RECORD_CREATE,
      resourceId: record.id,
      resourceType: ResourceType.RECORD,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: {
        patientId: dto.patientId,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        ipfsHash: record.ipfsHash,
      },
    });

    return record;
  }

  @Get(':id')
  async getRecord(@Param('id') id: string, @Req() req: any) {
    const record = await this.recordsService.findOne(id);

    // Log PHI access
    await this.auditService.log({
      actorId: req.user?.id || 'anonymous',
      action: AuditAction.PHI_ACCESS,
      resourceId: id,
      resourceType: ResourceType.RECORD,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: {
        patientId: record.patientId,
        recordType: record.type,
        accessReason: req.query.reason,
      },
    });

    return record;
  }

  @Put(':id')
  async updateRecord(
    @Param('id') id: string,
    @Body() updateDto: any,
    @Req() req: any,
  ) {
    const record = await this.recordsService.update(id, updateDto);

    // Log record modification
    await this.auditService.log({
      actorId: req.user?.id || 'system',
      action: AuditAction.RECORD_UPDATE,
      resourceId: id,
      resourceType: ResourceType.RECORD,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: {
        patientId: record.patientId,
        updatedFields: Object.keys(updateDto),
      },
    });

    return record;
  }

  @Delete(':id')
  async deleteRecord(@Param('id') id: string, @Req() req: any) {
    const record = await this.recordsService.findOne(id);
    
    await this.recordsService.delete(id);

    // Log record deletion
    await this.auditService.log({
      actorId: req.user?.id || 'system',
      action: AuditAction.RECORD_DELETE,
      resourceId: id,
      resourceType: ResourceType.RECORD,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: {
        patientId: record.patientId,
        deletionReason: req.body.reason,
      },
    });

    return { success: true };
  }

  @Get(':id/download')
  async downloadRecord(@Param('id') id: string, @Req() req: any) {
    const record = await this.recordsService.findOne(id);
    const file = await this.recordsService.downloadFile(id);

    // Log download
    await this.auditService.log({
      actorId: req.user?.id || 'anonymous',
      action: AuditAction.RECORD_DOWNLOAD,
      resourceId: id,
      resourceType: ResourceType.RECORD,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: {
        patientId: record.patientId,
        fileName: record.fileName,
        fileSize: record.fileSize,
      },
    });

    return file;
  }
}
```

## Step 3: Update App Module

Add AuditModule to the main app module:

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { RecordsModule } from './records/records.module';
import { AuditModule } from './audit/audit.module'; // Add this
// ... other imports

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      // ... database config
    }),
    RecordsModule,
    AuditModule, // Add this
    // ... other modules
  ],
})
export class AppModule {}
```

## Step 4: Add Audit Endpoints to API

The audit endpoints are automatically available:

```
GET  /audit                    - Query audit logs
GET  /audit/export             - Export as CSV
GET  /audit/stats/:patientId   - Get patient statistics
```

## Step 5: Test the Integration

### Test 1: Upload a Record

```bash
curl -X POST http://localhost:3000/records \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test-record.pdf" \
  -F "patientId=patient-123"
```

Check audit log:
```bash
curl http://localhost:3000/audit?resourceId=RECORD_ID \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Test 2: Access a Record

```bash
curl http://localhost:3000/records/RECORD_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Check audit log:
```bash
curl http://localhost:3000/audit?action=PHI_ACCESS \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Test 3: Export Audit Logs

```bash
curl http://localhost:3000/audit/export?patientId=patient-123 \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  > audit-logs.csv
```

## Step 6: Add Real-time Monitoring (Optional)

Listen to audit events for real-time monitoring:

```typescript
// src/monitoring/audit-monitor.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class AuditMonitorService {
  private readonly logger = new Logger(AuditMonitorService.name);

  @OnEvent('audit.logged')
  handleAuditLogged(payload: any) {
    // Log to external monitoring system
    this.logger.log(`Audit event: ${payload.action} by ${payload.actorId}`);
    
    // Send to monitoring service (e.g., DataDog, New Relic)
    // this.monitoringService.track('audit.event', payload);
  }

  @OnEvent('audit.anomaly')
  handleAuditAnomaly(payload: any) {
    // Alert on suspicious activity
    this.logger.warn(`Audit anomaly detected: ${JSON.stringify(payload)}`);
    
    // Send alert
    // this.alertService.sendAlert('Suspicious audit activity', payload);
  }
}
```

## Step 7: Add Stellar Anchoring (Optional)

Anchor audit logs to Stellar blockchain:

```typescript
// src/records/services/records.service.ts
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/services/audit.service';
import { StellarService } from './stellar.service';

@Injectable()
export class RecordsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly stellarService: StellarService,
  ) {}

  async uploadRecord(dto: CreateRecordDto, buffer: Buffer) {
    // ... upload logic

    // Log to audit
    const auditLogId = await this.auditService.log({
      // ... audit event
    });

    // Anchor to Stellar (async, don't wait)
    this.anchorAuditToStellar(auditLogId).catch(err => {
      console.error('Failed to anchor audit log to Stellar', err);
    });

    return record;
  }

  private async anchorAuditToStellar(auditLogId: string) {
    // Create Stellar transaction
    const txHash = await this.stellarService.createTransaction({
      type: 'audit_anchor',
      auditLogId,
      timestamp: Date.now(),
    });

    // Update audit log with Stellar hash
    await this.auditService.anchorToStellar(auditLogId, txHash);
  }
}
```

## Complete Example: Access Control with Audit

```typescript
// src/access-control/services/access-control.service.ts
import { Injectable } from '@nestjs/common';
import { AuditService, AuditAction, ResourceType } from '../../audit';

@Injectable()
export class AccessControlService {
  constructor(private readonly auditService: AuditService) {}

  async grantAccess(grantDto: GrantAccessDto, requestingUserId: string) {
    // Grant access
    const grant = await this.accessGrantRepository.save({
      userId: grantDto.userId,
      patientId: grantDto.patientId,
      expiresAt: grantDto.expiresAt,
      grantedBy: requestingUserId,
    });

    // Audit the grant
    await this.auditService.log({
      actorId: requestingUserId,
      action: AuditAction.ACCESS_GRANT,
      resourceId: grant.id,
      resourceType: ResourceType.ACCESS_GRANT,
      metadata: {
        grantedTo: grantDto.userId,
        patientId: grantDto.patientId,
        expiresAt: grantDto.expiresAt,
        permissions: grantDto.permissions,
      },
    });

    return grant;
  }

  async revokeAccess(grantId: string, requestingUserId: string) {
    const grant = await this.accessGrantRepository.findOne({ where: { id: grantId } });
    
    await this.accessGrantRepository.delete(grantId);

    // Audit the revocation
    await this.auditService.log({
      actorId: requestingUserId,
      action: AuditAction.ACCESS_REVOKE,
      resourceId: grantId,
      resourceType: ResourceType.ACCESS_GRANT,
      metadata: {
        revokedFrom: grant.userId,
        patientId: grant.patientId,
        revocationReason: 'Manual revocation',
      },
    });

    return { success: true };
  }
}
```

## Testing the Integration

```typescript
// src/records/controllers/records.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { RecordsController } from './records.controller';
import { RecordsService } from '../services/records.service';
import { AuditService } from '../../audit/services/audit.service';

describe('RecordsController with Audit', () => {
  let controller: RecordsController;
  let auditService: AuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecordsController],
      providers: [
        {
          provide: RecordsService,
          useValue: {
            uploadRecord: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<RecordsController>(RecordsController);
    auditService = module.get<AuditService>(AuditService);
  });

  it('should audit record upload', async () => {
    const mockFile = {
      originalname: 'test.pdf',
      size: 1024,
      mimetype: 'application/pdf',
      buffer: Buffer.from('test'),
    } as Express.Multer.File;

    const mockRequest = {
      user: { id: 'user-123' },
      ip: '192.168.1.1',
      headers: { 'user-agent': 'Mozilla/5.0' },
    };

    await controller.uploadRecord(
      { patientId: 'patient-123' },
      mockFile,
      mockRequest,
    );

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-123',
        action: 'RECORD_CREATE',
        resourceType: 'RECORD',
      }),
    );
  });
});
```

## Summary

With these changes:

1. ✅ All record operations are automatically audited via interceptor
2. ✅ Additional context is logged for important operations
3. ✅ Audit logs are immutable and tamper-evident
4. ✅ Admins can query and export audit logs
5. ✅ Patients can view their own audit history
6. ✅ Optional Stellar anchoring for blockchain verification
7. ✅ Real-time monitoring via event emitters

The audit system is now fully integrated with the Records module!
