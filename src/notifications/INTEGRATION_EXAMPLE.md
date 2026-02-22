# Notifications Integration Example

## How to Use NotificationsService in Your Module

### 1. Import NotificationsModule

```typescript
// your-module.module.ts
import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { YourService } from './your.service';

@Module({
  imports: [NotificationsModule],
  providers: [YourService],
})
export class YourModule {}
```

### 2. Inject NotificationsService

```typescript
// your.service.ts
import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications/services/notifications.service';

@Injectable()
export class YourService {
  constructor(private notificationsService: NotificationsService) {}

  async accessMedicalRecord(recordId: string, userId: string, patientId: string) {
    // Your business logic here...
    
    // Emit notification
    this.notificationsService.emitRecordAccessed(userId, recordId, {
      targetUserId: patientId,
      recordType: 'medical-record',
    });
  }
}
```

### 3. Example: Medical Records Integration

```typescript
// medical-records.service.ts
import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../../notifications/services/notifications.service';

@Injectable()
export class MedicalRecordsService {
  constructor(private notificationsService: NotificationsService) {}

  async findOne(id: string, userId: string, patientId: string) {
    const record = await this.medicalRecordRepository.findOne({ where: { id } });
    
    // Emit record accessed notification
    this.notificationsService.emitRecordAccessed(userId, id, {
      targetUserId: patientId,
      recordType: record.recordType,
    });
    
    return record;
  }

  async create(createDto: CreateMedicalRecordDto, userId: string) {
    const record = await this.medicalRecordRepository.save(createDto);
    
    // Emit record uploaded notification
    this.notificationsService.emitRecordUploaded(userId, record.id, {
      targetUserId: record.patientId,
      recordType: record.recordType,
    });
    
    return record;
  }
}
```

### 4. Example: Consent Management Integration

```typescript
// consent.service.ts
import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../../notifications/services/notifications.service';

@Injectable()
export class ConsentService {
  constructor(private notificationsService: NotificationsService) {}

  async createConsent(createDto: CreateConsentDto, userId: string) {
    const consent = await this.consentRepository.save(createDto);
    
    // Emit access granted notification
    this.notificationsService.emitAccessGranted(userId, consent.recordId, {
      targetUserId: consent.patientId,
      grantedTo: consent.grantedToUserId,
      permissions: consent.permissions,
    });
    
    return consent;
  }

  async revokeConsent(id: string, userId: string) {
    const consent = await this.consentRepository.findOne({ where: { id } });
    consent.status = 'revoked';
    await this.consentRepository.save(consent);
    
    // Emit access revoked notification
    this.notificationsService.emitAccessRevoked(userId, consent.recordId, {
      targetUserId: consent.patientId,
      revokedFrom: consent.grantedToUserId,
    });
  }
}
```

## Client-Side Connection Example

```typescript
// client.ts
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/notifications', {
  auth: {
    token: 'your-jwt-token-here'
  }
});

socket.on('connect', () => {
  console.log('Connected to notifications');
});

socket.on('record.accessed', (event) => {
  console.log('Record accessed:', event);
  // Show notification to user
});

socket.on('access.granted', (event) => {
  console.log('Access granted:', event);
  // Show notification to user
});

socket.on('access.revoked', (event) => {
  console.log('Access revoked:', event);
  // Show notification to user
});

socket.on('record.uploaded', (event) => {
  console.log('Record uploaded:', event);
  // Show notification to user
});

socket.on('queued.events', (events) => {
  console.log('Missed events:', events);
  // Process missed events
});
```

## Event Payload Structure

All events follow this structure:

```typescript
{
  eventType: 'record.accessed' | 'access.granted' | 'access.revoked' | 'record.uploaded',
  actorId: string,        // User who performed the action
  resourceId: string,     // ID of the resource (record, consent, etc.)
  timestamp: Date,        // When the event occurred
  metadata: {
    targetUserId: string, // User who should receive the notification
    // Additional context-specific fields
  }
}
```
