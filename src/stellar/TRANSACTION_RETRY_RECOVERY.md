# Stellar Transaction Retry and Failure Recovery System

## Overview

This system provides robust transaction submission capabilities for Stellar blockchain operations with automatic retry logic, failure recovery, and transaction queue management.

## Architecture

### Components

1. **StellarTransactionRetryService** - Core retry logic with exponential backoff
2. **StellarTransactionQueueService** - Transaction queue management and scheduling
3. **StellarRecoveryManagerService** - High-level orchestration and unified API
4. **StellarTransactionExampleService** - Usage examples and patterns

### Features

- ✅ Exponential backoff retry with jitter
- ✅ Automatic sequence number conflict resolution
- ✅ Network timeout handling
- ✅ Transaction status tracking
- ✅ Priority-based queue management
- ✅ Automatic transaction rebuilding on sequence errors
- ✅ Comprehensive error classification
- ✅ Transaction persistence and recovery
- ✅ Health monitoring and statistics

## Configuration

Add these environment variables to your `.env` file:

```bash
# Retry Configuration
STELLAR_RETRY_MAX_ATTEMPTS=5
STELLAR_RETRY_BASE_DELAY_MS=1000
STELLAR_RETRY_MAX_DELAY_MS=30000
STELLAR_TRANSACTION_TIMEOUT_MS=60000
STELLAR_SEQUENCE_REFRESH_ENABLED=true

# Queue Configuration
STELLAR_QUEUE_MAX_SIZE=1000
STELLAR_QUEUE_RETRY_INTERVAL_MS=30000
STELLAR_TRANSACTION_TTL_MS=3600000
```

## Usage Examples

### Basic Transaction Submission

```typescript
import { StellarRecoveryManagerService } from './services/stellar-recovery-manager.service';
import { TransactionPriority } from './services/stellar-transaction-queue.service';

// Inject the recovery manager
constructor(
  private readonly recoveryManager: StellarRecoveryManagerService,
) {}

// Submit a transaction with automatic retry
async submitTransaction() {
  const result = await this.recoveryManager.submitWithRecovery(
    server,
    horizonServer,
    transaction,
    sourceKeypair,
    { operation: 'anchor_record' },
    {
      priority: TransactionPriority.NORMAL,
      maxAttempts: 5,
      enableQueueing: true,
    },
  );

  if (result.success) {
    console.log(`Transaction confirmed: ${result.txHash}`);
  } else if (result.queuedForRetry) {
    console.log(`Transaction queued for retry: ${result.queueId}`);
  } else {
    console.error(`Transaction failed: ${result.error}`);
  }
}
```

### Critical Transaction (High Priority)

```typescript
async submitCriticalTransaction() {
  const result = await this.recoveryManager.submitWithRecovery(
    server,
    horizonServer,
    transaction,
    sourceKeypair,
    { operation: 'emergency_access_grant' },
    {
      priority: TransactionPriority.CRITICAL,
      maxAttempts: 10, // More retries for critical operations
      enableQueueing: true,
      metadata: {
        type: 'emergency',
        timestamp: new Date().toISOString(),
      },
    },
  );

  return result;
}
```

### Check Queued Transaction Status

```typescript
async checkTransactionStatus(queueId: string) {
  const status = this.recoveryManager.getQueuedTransactionStatus(queueId);

  if (status) {
    console.log(`Status: ${status.status}`);
    console.log(`Attempts: ${status.attempts}/${status.maxAttempts}`);
    console.log(`Next retry: ${status.nextRetryAt}`);
  }
}
```

### Manually Retry Failed Transaction

```typescript
async retryFailed(queueId: string) {
  const result = await this.recoveryManager.retryFailedTransaction(
    queueId,
    server,
    horizonServer,
    sourceKeypair,
  );

  return result;
}
```

### Get System Health

```typescript
async checkHealth() {
  const health = await this.recoveryManager.healthCheck();

  console.log(`Healthy: ${health.healthy}`);
  console.log(`Queue size: ${health.queueSize}`);
  console.log(`Pending retries: ${health.pendingRetries}`);
  console.log(`Failed transactions: ${health.failedTransactions}`);
}
```

### Batch Submit Transactions

```typescript
async batchSubmit(transactions: any[]) {
  const results = await Promise.allSettled(
    transactions.map((tx) =>
      this.recoveryManager.submitWithRecovery(
        server,
        horizonServer,
        tx.transaction,
        sourceKeypair,
        { operation: tx.operation },
        {
          priority: tx.priority || TransactionPriority.NORMAL,
          maxAttempts: 5,
          enableQueueing: true,
        },
      ),
    ),
  );

  return results;
}
```

## Error Classification

The system automatically classifies errors into the following types:

| Error Type           | Description                  | Retryable | Auto-Queue |
| -------------------- | ---------------------------- | --------- | ---------- |
| `SEQUENCE_MISMATCH`  | Sequence number conflict     | ✅ Yes    | ✅ Yes     |
| `TIMEOUT`            | Network or operation timeout | ✅ Yes    | ✅ Yes     |
| `NETWORK_ERROR`      | Connection or network issues | ✅ Yes    | ✅ Yes     |
| `INSUFFICIENT_FEE`   | Fee too low for transaction  | ❌ No     | ❌ No      |
| `TRANSACTION_FAILED` | Transaction failed on-chain  | ❌ No     | ❌ No      |
| `UNKNOWN`            | Unclassified error           | ❌ No     | ❌ No      |

## Transaction Priorities

```typescript
enum TransactionPriority {
  LOW = 0, // Non-critical operations
  NORMAL = 1, // Standard operations
  HIGH = 2, // Important operations
  CRITICAL = 3, // Emergency operations
}
```

Higher priority transactions are processed first in the retry queue.

## Transaction Lifecycle

```
┌─────────────────┐
│   Submit Tx     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Retry Logic    │◄──┐
│  (Exponential   │   │
│   Backoff)      │   │
└────────┬────────┘   │
         │            │
         ▼            │
    ┌────────┐        │
    │Success?│        │
    └───┬────┘        │
        │             │
    ┌───┴───┐         │
    │  Yes  │    No   │
    │       │         │
    ▼       ▼         │
┌────────┐ ┌─────────┴──────┐
│ Return │ │ Retryable?     │
│ Result │ │ Max Attempts?  │
└────────┘ └────────┬───────┘
                    │
              ┌─────┴─────┐
              │    Yes    │  No
              │           │
              ▼           ▼
         ┌─────────┐  ┌──────────┐
         │  Queue  │  │  Return  │
         │   for   │  │  Failed  │
         │  Retry  │  │  Result  │
         └─────────┘  └──────────┘
```

## Retry Strategy

### Exponential Backoff

The system uses exponential backoff with jitter to avoid thundering herd problems:

```
Delay = min(BASE_DELAY * 2^(attempt-1) + jitter, MAX_DELAY)
```

Default delays:

- Attempt 1: ~1s
- Attempt 2: ~2s
- Attempt 3: ~4s
- Attempt 4: ~8s
- Attempt 5: ~16s

### Sequence Number Conflict Resolution

When a sequence number mismatch is detected:

1. Fetch fresh account data from Horizon
2. Rebuild transaction with new sequence number
3. Retry submission with updated transaction

## Queue Management

### Automatic Retry Scheduler

The queue service runs a background scheduler that:

1. Checks for transactions ready for retry every 30 seconds (configurable)
2. Processes transactions in priority order
3. Limits concurrent retries to prevent overload
4. Automatically cleans up old transactions

### Transaction TTL

Transactions in the queue have a Time-To-Live (default: 1 hour):

- Expired transactions are marked as `EXPIRED`
- Cleanup runs automatically during retry cycles
- Manual cleanup can be triggered via `cleanup()` method

## Monitoring and Statistics

### Recovery Statistics

```typescript
const stats = recoveryManager.getStats();

console.log(`Total submissions: ${stats.totalSubmissions}`);
console.log(`Success rate: ${(stats.successfulSubmissions / stats.totalSubmissions) * 100}%`);
console.log(`Average attempts: ${stats.averageAttempts}`);
console.log(`Average duration: ${stats.averageSuccessDurationMs}ms`);
```

### Queue Statistics

```typescript
const queueStats = recoveryManager.getQueueStats();

console.log(`Total in queue: ${queueStats.total}`);
console.log(`Pending: ${queueStats.pending}`);
console.log(`Retrying: ${queueStats.retrying}`);
console.log(`Failed: ${queueStats.failed}`);
console.log(`Completed: ${queueStats.completed}`);
```

## Best Practices

### 1. Choose Appropriate Priority

```typescript
// Critical operations (emergency access, life-critical data)
priority: TransactionPriority.CRITICAL;

// Important operations (access grants, record anchoring)
priority: TransactionPriority.HIGH;

// Standard operations (routine updates)
priority: TransactionPriority.NORMAL;

// Non-critical operations (analytics, logging)
priority: TransactionPriority.LOW;
```

### 2. Set Reasonable Max Attempts

```typescript
// Critical operations: 10+ attempts
maxAttempts: 10;

// Normal operations: 5 attempts
maxAttempts: 5;

// Low priority: 3 attempts
maxAttempts: 3;
```

### 3. Enable Queueing for Retryable Operations

```typescript
// Enable for operations that can be retried later
enableQueueing: true;

// Disable for time-sensitive operations that must succeed immediately
enableQueueing: false;
```

### 4. Monitor System Health

```typescript
// Regular health checks
setInterval(async () => {
  const health = await recoveryManager.healthCheck();

  if (!health.healthy) {
    logger.warn('Recovery system unhealthy', health);
    // Alert operations team
  }
}, 60000); // Every minute
```

### 5. Handle Failed Transactions

```typescript
// Periodically review failed transactions
const failed = recoveryManager.getFailedTransactions();

for (const tx of failed) {
  logger.error(`Failed transaction: ${tx.id}`, {
    operation: tx.context.operation,
    error: tx.lastError,
    attempts: tx.attempts,
  });

  // Decide whether to retry manually or escalate
}
```

## Integration with Existing Code

### Update Existing Services

```typescript
// Before
async anchorRecord(patientId: string, cid: string) {
  const tx = await this.buildTransaction(...);
  const result = await this.server.sendTransaction(tx);
  return result;
}

// After
async anchorRecord(patientId: string, cid: string) {
  const tx = await this.buildTransaction(...);

  const result = await this.recoveryManager.submitWithRecovery(
    this.server,
    this.horizonServer,
    tx,
    this.sourceKeypair,
    { operation: 'anchor_record', metadata: { patientId, cid } },
    {
      priority: TransactionPriority.HIGH,
      maxAttempts: 5,
      enableQueueing: true,
    },
  );

  if (!result.success && !result.queuedForRetry) {
    throw new Error(`Failed to anchor record: ${result.error}`);
  }

  return result;
}
```

## Troubleshooting

### High Failure Rate

1. Check network connectivity to Stellar nodes
2. Verify account has sufficient XLM for fees
3. Review error types in failed transactions
4. Check if sequence numbers are being properly managed

### Queue Growing Too Large

1. Increase `STELLAR_QUEUE_RETRY_INTERVAL_MS` to process faster
2. Increase `maxAttempts` for retryable operations
3. Review failed transactions for systemic issues
4. Consider scaling Stellar node infrastructure

### Sequence Number Conflicts

1. Ensure `STELLAR_SEQUENCE_REFRESH_ENABLED=true`
2. Avoid concurrent transaction submissions from same account
3. Implement transaction coordination if multiple services submit

### Timeouts

1. Increase `STELLAR_TRANSACTION_TIMEOUT_MS`
2. Check Stellar node performance
3. Consider using faster Stellar RPC endpoints
4. Review network latency

## Performance Considerations

### Memory Usage

- Each queued transaction consumes ~1-5KB of memory
- Default max queue size: 1000 transactions (~1-5MB)
- Adjust `STELLAR_QUEUE_MAX_SIZE` based on available memory

### CPU Usage

- Retry scheduler runs every 30 seconds
- Processes up to 5 transactions concurrently
- Minimal CPU impact under normal load

### Network Usage

- Each retry attempt makes 2-3 network calls
- Exponential backoff reduces network pressure
- Consider rate limiting if submitting many transactions

## Future Enhancements

- [ ] Persistent queue storage (Redis/Database)
- [ ] Distributed queue for multi-instance deployments
- [ ] Advanced metrics and alerting
- [ ] Transaction priority adjustment based on age
- [ ] Automatic fee adjustment for insufficient fee errors
- [ ] Transaction batching for improved throughput
- [ ] Webhook notifications for transaction status changes

## Support

For issues or questions:

1. Check the troubleshooting section
2. Review system health and statistics
3. Examine failed transaction logs
4. Contact the development team
