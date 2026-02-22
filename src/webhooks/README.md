# Webhook Signature Verification

HMAC-SHA256 webhook signature verification middleware to prevent spoofing and replay attacks.

## Features

✅ HMAC-SHA256 signature verification  
✅ Replay attack prevention (5-minute window)  
✅ Constant-time comparison (timing attack resistant)  
✅ Selective route application  
✅ No information leakage on failure (401 with no body)

## Setup

1. Add to `.env`:
```env
WEBHOOK_SECRET=your-secure-random-secret-key
```

2. Import `WebhooksModule` in `app.module.ts`:
```typescript
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [WebhooksModule, ...],
})
export class AppModule {}
```

## Signature Format

Header: `X-Webhook-Signature: {timestamp}.{signature}`

Where:
- `timestamp`: Unix timestamp in milliseconds
- `signature`: HMAC-SHA256 hex digest of `{timestamp}.{rawBody}`

## Example: Generating Signature (Client Side)

```typescript
import * as crypto from 'crypto';

const secret = 'your-webhook-secret';
const timestamp = Date.now();
const body = JSON.stringify({ event: 'payment.completed' });
const payload = `${timestamp}.${body}`;
const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

// Send as header
headers['X-Webhook-Signature'] = `${timestamp}.${signature}`;
```

## Testing

```bash
npm test -- webhook-signature.middleware.spec.ts
```

## Security Notes

- Secret must be at least 32 characters
- Requests older than 5 minutes are rejected
- Uses timing-safe comparison to prevent timing attacks
- Returns 401 with no body on any validation failure
