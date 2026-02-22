# Real-Time Notifications Module

WebSocket-based real-time notification system for patient record access and consent management.

## Features

✅ **WebSocket Gateway** - Socket.IO with CORS configured  
✅ **JWT Authentication** - Custom WsAuthGuard for handshake validation  
✅ **Private Rooms** - Users join rooms keyed to their userId  
✅ **Event Types** - record.accessed, access.granted, access.revoked, record.uploaded  
✅ **Structured Payloads** - { eventType, actorId, resourceId, timestamp, metadata }  
✅ **Injectable Service** - NotificationsService for cross-module event emission  
✅ **Offline Queue** - Redis-backed queue (max 50 events, 24hr TTL)  
✅ **Unit Tests** - Full coverage for auth guard, room joining, event emission

## Architecture

```
notifications/
├── guards/
│   ├── ws-auth.guard.ts           # JWT authentication for WebSocket
│   └── ws-auth.guard.spec.ts
├── interfaces/
│   └── notification-event.interface.ts
├── services/
│   ├── notifications.service.ts    # Injectable service for other modules
│   ├── notifications.service.spec.ts
│   ├── notification-queue.service.ts  # Redis queue for offline events
│   └── notification-queue.service.spec.ts
├── notifications.gateway.ts        # WebSocket gateway
├── notifications.gateway.spec.ts
├── notifications.module.ts
├── INTEGRATION_EXAMPLE.md
└── README.md
```

## Quick Start

### 1. Environment Variables

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
CORS_ORIGIN=http://localhost:3001
```

### 2. Client Connection

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/notifications', {
  auth: { token: 'Bearer your-jwt-token' }
});

socket.on('record.accessed', (event) => {
  console.log('Someone accessed your record:', event);
});
```

### 3. Server-Side Usage

```typescript
import { NotificationsService } from './notifications/services/notifications.service';

@Injectable()
export class YourService {
  constructor(private notifications: NotificationsService) {}

  async someMethod() {
    this.notifications.emitRecordAccessed('actor-id', 'record-id', {
      targetUserId: 'patient-id',
    });
  }
}
```

## API

### NotificationsService Methods

- `emitRecordAccessed(actorId, resourceId, metadata?)`
- `emitAccessGranted(actorId, resourceId, metadata?)`
- `emitAccessRevoked(actorId, resourceId, metadata?)`
- `emitRecordUploaded(actorId, resourceId, metadata?)`

### WebSocket Events

**Client → Server:**
- `ping` - Health check

**Server → Client:**
- `record.accessed` - Record was viewed
- `access.granted` - New access permission granted
- `access.revoked` - Access permission revoked
- `record.uploaded` - New record uploaded
- `queued.events` - Missed events delivered on reconnect

## Testing

```bash
npm test -- notifications
```

## Security

- JWT validation on WebSocket handshake
- Session verification via SessionManagementService
- Private rooms prevent cross-user event leakage
- CORS configured for trusted origins only

## Offline Support

Events for offline users are queued in Redis:
- Max 50 events per user
- 24-hour TTL
- Delivered on reconnect via `queued.events`
