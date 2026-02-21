# Queue System Usage

## Overview
Async job processing system using BullMQ for Stellar transactions, IPFS uploads, and email notifications.

## Dispatching Jobs

```typescript
import { QueueService } from './queues/queue.service';
import { JOB_TYPES } from './queues/queue.constants';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MedicalRecordsService {
  constructor(private queueService: QueueService) {}

  async createRecord(data: any, userId: string) {
    // Save to database first
    const record = await this.repository.save(data);

    // Dispatch blockchain anchoring as async job
    const correlationId = uuidv4();
    await this.queueService.dispatchStellarTransaction({
      operationType: JOB_TYPES.ANCHOR_RECORD,
      params: { recordId: record.id, hash: record.hash },
      initiatedBy: userId,
      correlationId,
    });

    return { record, jobCorrelationId: correlationId };
  }
}
```

## Checking Job Status

```bash
GET /jobs/:correlationId/status
```

Response:
```json
{
  "correlationId": "uuid",
  "jobId": "1",
  "status": "completed",
  "progress": 100,
  "returnValue": {
    "txHash": "stellar_tx_hash",
    "status": "anchored"
  },
  "attemptsMade": 1
}
```

## Bull Board UI

Access at: `http://localhost:3000/admin/queues`

Protected by AdminGuard (requires admin role).

## Configuration

Add to `.env`:
```
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

## Retry Policy

- 3 attempts with exponential backoff (2s base delay)
- Failed jobs move to dead-letter queue
- Completed jobs retained (last 100)
- Failed jobs retained (last 500)
