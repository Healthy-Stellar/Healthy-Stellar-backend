# Bugfix Requirements Document

## Introduction

`EventStoreService.append` commits domain events to the database inside a transaction and then publishes them to the NestJS `EventBus` in a post-transaction loop. If the process crashes, is killed, or encounters an unhandled exception after the transaction commits but before (or during) the publish loop, the events are durably stored in the database but projections and downstream consumers never receive them. This leaves the event store and all read models permanently diverged with no automatic recovery path.

The fix introduces the Transactional Outbox pattern: events are written to an `outbox` table inside the same transaction as the domain events, and a separate poller reliably relays them to the `EventBus`, marking each entry dispatched only after a confirmed publish. A metric endpoint exposes the number of un-dispatched entries so operators can detect lag. The snapshot trigger is also moved to depend on the outbox flush completing rather than firing inside the transaction.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the process crashes or is killed after the database transaction commits but before the `eventBus.publish` loop begins THEN the system loses all domain events from that `append` call for downstream consumers, leaving projections permanently out of sync.

1.2 WHEN an unhandled exception is thrown inside the `eventBus.publish` loop (e.g., on the second of three events) THEN the system silently skips the remaining events, causing partial projection updates with no error surfaced to the caller.

1.3 WHEN `EventStoreService.append` is called and the snapshot trigger fires (`headVersion % SNAPSHOT_INTERVAL === 0`) THEN the system rebuilds the snapshot inside the transaction before events have been relayed to consumers, so the snapshot can reflect state that projections have not yet processed.

1.4 WHEN the service restarts after a crash mid-publish THEN the system has no mechanism to detect or replay the un-dispatched events, so the divergence is permanent until manual intervention.

### Expected Behavior (Correct)

2.1 WHEN the process crashes or is killed after the database transaction commits THEN the system SHALL guarantee at-least-once delivery of all domain events to the `EventBus` by persisting them to an outbox table within the same transaction and replaying them on recovery.

2.2 WHEN an exception occurs while publishing an outbox entry to the `EventBus` THEN the system SHALL leave that entry in an un-dispatched state and retry it on the next poller cycle, without skipping subsequent entries.

2.3 WHEN the outbox poller successfully publishes an outbox entry to the `EventBus` THEN the system SHALL mark that entry as dispatched only after the publish call returns without error.

2.4 WHEN `headVersion % SNAPSHOT_INTERVAL === 0` THEN the system SHALL trigger the snapshot rebuild only after the corresponding outbox entries have been successfully flushed, not inside the write transaction.

2.5 WHEN a `GET /admin/event-store/outbox-lag` request is received THEN the system SHALL return the count of outbox entries that have not yet been marked as dispatched.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `EventStoreService.append` is called with a valid `expectedVersion` that matches the current aggregate version THEN the system SHALL CONTINUE TO persist all domain events atomically and enforce optimistic concurrency via pessimistic write lock.

3.2 WHEN `EventStoreService.append` is called with an `expectedVersion` that does not match the current aggregate version THEN the system SHALL CONTINUE TO throw `ConcurrencyException` and persist no events.

3.3 WHEN `EventStoreService.getEvents` is called for an aggregate THEN the system SHALL CONTINUE TO return the ordered event history from the `event_entities` table, unaffected by outbox state.

3.4 WHEN `EventStoreService.getSnapshot` is called for an aggregate THEN the system SHALL CONTINUE TO return the latest snapshot from the `aggregate_snapshots` table.

3.5 WHEN the outbox poller dispatches events THEN the system SHALL CONTINUE TO publish `DomainEventPublished` events to the `EventBus` with the same payload structure as the current implementation.
