# Webhooks

This guide is for integrators building against the Healthy-Stellar backend webhook
system: subscribing to events, verifying deliveries, and receiving the platform's
own inbound provider callbacks.

Two directions are covered:

- **Outbound webhooks** — the backend POSTs healthcare events to *your* endpoint.
  Signing, retries, replay and the event catalog live in `src/webhooks/`.
- **Inbound webhooks** — the backend receives callbacks from IPFS, Stellar and
  insurance payers. These are verified in
  `src/common/middleware/webhook-signature.middleware.ts`.

The two directions use **different signature formats**. Read the relevant section
carefully; the outbound format (`sha256=<hex>`) is not the same as the inbound
format (`<timestamp>.<nonce>.<hex>`).

---

## 1. Outbound webhooks

### 1.1 Architecture

```
domain event ──▶ WebhookDeliveryService.queueWebhookDeliveries()
                        │  one WebhookDelivery row per matching subscription
                        ▼
                 BullMQ queue `webhook-delivery`
                        │  WebhookDeliveryProcessor
                        ▼
                 deliverWebhook() ──HTTP POST──▶ your endpoint
                        │
                        ├─ 2xx  → status=delivered
                        └─ else → retry (exponential backoff)
                                    └─ attempts exhausted → status=deadletter (+ DLQ, alert)
```

Source files:

| File | Responsibility |
|------|----------------|
| `src/webhooks/dto/webhook-subscription.dto.ts` | Create/update payload contract |
| `src/webhooks/services/webhook-subscription.service.ts` | Subscription CRUD, secret generation, rotation, endpoint ping |
| `src/webhooks/services/webhook-delivery.service.ts` | Signing, delivery, retries, DLQ, replay |
| `src/webhooks/processors/webhook-delivery.processor.ts` | BullMQ worker entry point |
| `src/webhooks/webhooks.controller.ts` | REST endpoints |

### 1.2 Managing subscriptions

All subscription endpoints require a JWT (`Authorization: Bearer <token>`); each
tenant can only see and modify its own subscriptions.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/webhooks/subscriptions` | List the tenant's subscriptions |
| `POST` | `/webhooks/subscriptions` | Create a subscription (runs a validation ping) |
| `PUT` | `/webhooks/subscriptions/:id` | Update `url`, `events`, `isActive`, `maxRetries` |
| `DELETE` | `/webhooks/subscriptions/:id` | Delete (returns `204`) |
| `POST` | `/webhooks/subscriptions/:id/rotate-secret` | Rotate the signing secret |

Create request body (`CreateWebhookSubscriptionDto`):

```jsonc
{
  "url": "https://example.com/webhooks/healthy-stellar", // required, http(s)
  "events": ["record.uploaded", "access.granted"],        // required, string[]
  "secret": "optional-custom-secret",                     // optional; auto-generated if omitted
  "maxRetries": 5                                          // optional, 1..10, default 5
}
```

Notes:

- **Endpoint ping.** Creating a subscription immediately POSTs a validation ping to
  `url`. The ping uses the same signing scheme as a normal delivery and must return a
  `2xx`; anything else (including network failure) rejects creation with `400`.
  The ping body is:

  ```json
  { "type": "ping", "timestamp": "2026-09-25T10:00:00.000Z" }
  ```

  and it is sent with `X-Webhook-Event: ping`.

- **Secret generation.** If `secret` is omitted, a random 32-byte secret is generated
  (`crypto.randomBytes(32).toString('hex')`, 64 hex characters). The secret is used as
  the HMAC key. Store it server-side on your receiver.

- **Subscription cap.** A tenant may hold at most `WEBHOOK_MAX_SUBSCRIPTIONS_PER_TENANT`
  subscriptions (default `25`). Exceeding it returns `403`.

- **`events` is free-form.** The API does not validate event names against an enum
  (see [§7 Event catalog](#7-event-catalog)). A subscription receives an event when the
  queued event type is **exactly equal** to one of its entries — typos silently never
  match, so copy catalog names verbatim.

### 1.3 Delivery headers

Every outbound delivery is an HTTP `POST` with `Content-Type: application/json` and:

| Header | Meaning |
|--------|---------|
| `X-Webhook-Event` | The event type, e.g. `record.uploaded` |
| `X-Webhook-Delivery` | Unique delivery id (UUID). Use it for idempotency/dedup. |
| `X-Webhook-Signature` | `sha256=<hex>` HMAC of the raw body. **Absent if the subscription has no secret.** |
| *custom headers* | Any `customHeaders` map stored on the subscription is merged in last. |

> `customHeaders` are read from `subscription.metadata.customHeaders`. There is
> currently no public DTO field to set them, so in practice most subscriptions only
> receive the three standard headers above.

**Deliveries may not arrive in order.** Each event/delivery is queued independently.
Deduplicate on `X-Webhook-Delivery` and treat delivery as at-least-once.

### 1.4 Verifying the signature (outbound)

The signature is:

```
X-Webhook-Signature: sha256=<hex>
hex = HMAC-SHA256(key = subscription secret, message = raw request body bytes)
```

Key points:

- The HMAC is computed over the **exact raw request body bytes** — `JSON.stringify(eventPayload)`
  as sent by the client. Do **not** re-serialize a parsed object (key ordering/whitespace
  would change the bytes); use the raw body as received.
- The digest is lowercase hex, prefixed with `sha256=`.
- The header contains no timestamp or nonce. There is no replay window on outbound
  deliveries; use `X-Webhook-Delivery` for idempotency.
- If the subscription has no secret, no signature header is sent.

#### Node.js (Express, raw body)

```js
const crypto = require('crypto');
const express = require('express');

function verifySignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;
  const [scheme, receivedHex] = signatureHeader.split('=');
  if (scheme !== 'sha256' || !receivedHex) return false;

  const expectedHex = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8') // raw bytes, not JSON.stringify(req.body)
    .digest('hex');

  const a = Buffer.from(receivedHex, 'hex');
  const b = Buffer.from(expectedHex, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const app = express();
// Capture the raw body before JSON parsing.
app.use('/webhooks/healthy-stellar', express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));

app.post('/webhooks/healthy-stellar', (req, res) => {
  if (!verifySignature(req.rawBody, req.get('X-Webhook-Signature'), process.env.HS_WEBHOOK_SECRET)) {
    return res.status(401).send('invalid signature');
  }
  const event = req.get('X-Webhook-Event');
  const deliveryId = req.get('X-Webhook-Delivery');
  // ... handle event ...
  res.status(200).json({ received: true });
});
```

#### Python (Flask)

```python
import hashlib
import hmac
from flask import Flask, request, abort

app = Flask(__name__)
SECRET = b"your-subscription-secret"

def verify_signature(raw_body: bytes, signature_header: str) -> bool:
    if not signature_header:
        return False
    try:
        scheme, received_hex = signature_header.split("=", 1)
    except ValueError:
        return False
    if scheme != "sha256":
        return False
    expected = hmac.new(SECRET, raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(received_hex, expected)

@app.post("/webhooks/healthy-stellar")
def receive():
    if not verify_signature(request.get_data(), request.headers.get("X-Webhook-Signature", "")):
        abort(401)
    event = request.headers.get("X-Webhook-Event")
    delivery_id = request.headers.get("X-Webhook-Delivery")
    # ... handle event ...
    return {"received": True}, 200
```

The Node algorithm above is exercised against the real signer in
[`src/webhooks/webhook-signature.docs.spec.ts`](../src/webhooks/webhook-signature.docs.spec.ts).

### 1.5 Secret lifecycle

| Action | Endpoint | Behaviour |
|--------|----------|-----------|
| Auto-generated | `POST /webhooks/subscriptions` (no `secret`) | `crypto.randomBytes(32).toString('hex')`; returned in the create response. |
| Custom | `POST /webhooks/subscriptions` (`secret` supplied) | Stored as-is under `webhook_subscriptions.secret`. |
| Rotate | `POST /webhooks/subscriptions/:id/rotate-secret` | Generates and stores a new random secret, returns `{ "secret": "<new>" }`. |

**Rotation invalidates old signatures immediately.** The subscription row stores a
single secret and `rotate-secret` overwrites it in place, so there is **no grace
window** during which the previous secret still validates. The new secret is only ever
displayed in the rotate response, so persist it before you drop the connection. Because
the delivery worker reads the secret from the subscription at send time, any in-flight
or replayed delivery is signed with the *current* secret.

Rotating the secret is recorded as the `WEBHOOK_SECRET_ROTATED` audit operation.

### 1.6 Retries, timeouts and failure alerts

| Aspect | Behaviour |
|--------|-----------|
| Max attempts | `subscription.maxRetries` (default `5`, allowed `1..10`). Queued as `attempts: max(maxRetries, 1)`. |
| Backoff | BullMQ exponential with base delay `1000 ms`: 1s, 2s, 4s, 8s, 16s, … |
| Per-request timeout | `30_000 ms` |
| Success | HTTP `2xx` only |
| Failure | Any non-`2xx` (4xx **and** 5xx) or a timeout/network error. 4xx responses do not throw at the HTTP layer, but are still treated as failures and retried. |
| Response capture | First 200 characters of the response body are stored per attempt. |
| Exhausted | Delivery moves to `deadletter`, is captured by the DLQ (`dlqService.capture`) and emits a `webhook.delivery.failed` event. |
| Alerting | Each dead-letter increments `subscription.consecutiveFailures`. When it reaches `WEBHOOK_FAILURE_ALERT_THRESHOLD` (default `5`), a `webhook.subscription.failed` alert event is emitted. A successful delivery resets `consecutiveFailures` to `0`. |

Delivery states: `pending` → `processing` → `delivered`, or `pending`/`processing` →
`failed`/`deadletter`. (`failed` is used when an admin discards a dead-letter item.)

Because delivery is at-least-once, a receiver should return `2xx` only after
successfully persisting/processing the event, and should be idempotent per
`X-Webhook-Delivery`.

### 1.7 Manual replay

Admin-only endpoints (JWT with `admin` role):

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/webhooks/deliveries` | List deliveries (`?status=&subscriptionId=&limit=&offset=`) |
| `GET` | `/webhooks/:id/deliveries` | Full attempt history for one delivery |
| `POST` | `/webhooks/deliveries/:id/replay` | Replay a dead-lettered delivery |
| `GET` | `/webhooks/dead-letter` | List dead-letter items |
| `GET` | `/webhooks/dead-letter/:deliveryId` | One dead-letter item |
| `POST` | `/webhooks/dead-letter/:deliveryId/replay` | Replay from the DLQ |
| `DELETE` | `/webhooks/dead-letter/:deliveryId` | Discard (marks `failed`) |

Replay rules (`WebhookDeliveryService.replayDelivery`):

- Only deliveries in `deadletter` status can be replayed; anything else throws.
- Replay resets `status=pending`, `attemptCount=0` and clears the attempts history,
  then re-queues the job with `subscription.maxRetries` attempts.
- **The signature is recomputed at send time** from the subscription's *current*
  secret (the payload is re-fetched from the subscription relation, not cached on the
  delivery row). If you rotated the secret between the original attempt and the replay,
  the replay is signed with the new secret.
- Replays are audited as `REPLAYED` with the acting user id.

### 1.8 Delivery payload

The body of a delivery is the event payload as queued by the emitter. Subscribe to an
event only if you can tolerate the payload shape for that event; see the catalog below.

---

## 2. Inbound webhooks

The backend receives provider callbacks on three endpoints:

| Endpoint | Secret env var |
|----------|----------------|
| `POST /webhooks/ipfs` | `IPFS_WEBHOOK_SECRET` |
| `POST /webhooks/stellar` | `STELLAR_WEBHOOK_SECRET` |
| `POST /webhooks/insurance-claims` | `INSURANCE_WEBHOOK_SECRET` |

They are protected by `WebhookSignatureMiddleware`, which requires a valid
`X-Webhook-Signature` header. All three share the same scheme; only the secret differs.

### 2.1 Header format

```
X-Webhook-Signature: <timestampMs>.<nonce>.<hmac-sha256-hex>
```

- `timestampMs` — Unix epoch **milliseconds**.
- `nonce` — an opaque, per-request unique string (senders typically use 16 random bytes hex).
- `hmac-sha256-hex` — lowercase hex HMAC over the string:

  ```
  <timestampMs>.<nonce>.<rawBody>
  ```

  where `rawBody` is the exact request body as sent (the middleware captures the raw
  bytes via `RawBodyMiddleware` before JSON parsing).

### 2.2 Verification and replay protection

The middleware enforces, in order:

1. **Header present and 3 dot-separated parts.** Missing/malformed → `401`.
2. **Timestamp window.** The request must be no older than **5 minutes**
   (`maxAgeMs = 5 * 60 * 1000`). Older (or non-numeric) → `401`.
3. **Nonce deduplication.** The nonce is `SET NX EX 300` in Redis under
   `webhook:nonce:<nonce>`. A repeat nonce → `401` ("Webhook replay detected").
4. **HMAC verification**, using a constant-time comparison over
   `<timestamp>.<nonce>.<rawBody>`. On mismatch the nonce is released so the sender
   can retry with a fresh nonce, and the request is rejected with `401`.

The request body is limited to **1 MB**; larger payloads are rejected with `413`.

On success the handler queues downstream work and returns `200`:

- `/webhooks/ipfs` expects a CID (`cid`, `ipfs_hash` or `hash`) and returns
  `{ "received": true, "cid": "...", "status": "queued_for_processing" }`.
- `/webhooks/stellar` expects a transaction hash (`transaction_hash`, `tx_hash` or
  `hash`) and returns `{ "received": true, "txHash": "...", "status": "queued_for_reconciliation" }`.
- `/webhooks/insurance-claims` accepts an adjudication payload and returns
  `{ "received": true, "claimNumber": "...", "status": "..." }`.

### 2.3 Reference sender snippets

#### Node.js

```js
const crypto = require('crypto');

function signInbound(rawBody, secret, timestamp = Date.now()) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = `${timestamp}.${nonce}.${rawBody}`;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${timestamp}.${nonce}.${hmac}`;
}

fetch('https://api.example.com/webhooks/stellar', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signInbound(JSON.stringify(body), process.env.STELLAR_WEBHOOK_SECRET),
  },
  body: JSON.stringify(body),
});
```

#### Python

```python
import hashlib
import hmac
import os
import time
import uuid

def sign_inbound(raw_body: bytes, secret: bytes) -> str:
    timestamp = str(int(time.time() * 1000))
    nonce = uuid.uuid4().hex
    payload = f"{timestamp}.{nonce}.".encode() + raw_body
    digest = hmac.new(secret, payload, hashlib.sha256).hexdigest()
    return f"{timestamp}.{nonce}.{digest}"
```

The Node signer above is exercised against the real `WebhookSignatureMiddleware` in
[`src/webhooks/webhook-signature.docs.spec.ts`](../src/webhooks/webhook-signature.docs.spec.ts).

---

## 3. Environment variables

| Variable | Used by | Default | Description |
|----------|---------|---------|-------------|
| `IPFS_WEBHOOK_SECRET` | Inbound `/webhooks/ipfs` | — | Required; HMAC secret for IPFS callbacks |
| `STELLAR_WEBHOOK_SECRET` | Inbound `/webhooks/stellar` | — | Required; HMAC secret for Stellar callbacks |
| `INSURANCE_WEBHOOK_SECRET` | Inbound `/webhooks/insurance-claims` | — | Required; HMAC secret for payer callbacks |
| `WEBHOOK_MAX_SUBSCRIPTIONS_PER_TENANT` | Subscription service | `25` | Per-tenant subscription cap |
| `WEBHOOK_FAILURE_ALERT_THRESHOLD` | Delivery service | `5` | Consecutive dead-letters before an alert event |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Inbound middleware | `localhost:6379` | Redis used for nonce deduplication |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 4. Event catalog

### 4.1 How matching works

`WebhookSubscription.events` is a JSON array of strings and the delivery service
matches with `subscription.events.includes(eventType)` — an **exact string match with
no enum validation**. Any name is accepted at subscription time, but only queued event
types that match exactly are delivered. Use the canonical names below.

The outbound pipeline is generic: `WebhookDeliveryService.queueWebhookDeliveries(eventType,
eventPayload, tenantId?)` is the single emission point. It creates one delivery per
active subscription (optionally tenant-scoped) whose `events` includes `eventType`.
Domain modules call it with the event names below.

### 4.2 Canonical event names

Event names align with the platform notification/domain events. The `Source` column
names where the event is defined.

| Event | Source | Notes |
|-------|--------|-------|
| `ping` | `webhook-subscription.service.ts` | Sent only during subscription validation; not subscribable. |
| `record.uploaded` | `NotificationEventType.RECORD_UPLOADED` | A medical record was anchored/uploaded. |
| `record.accessed` | `NotificationEventType.RECORD_ACCESSED` | A record was read. |
| `record.amended` | `NotificationEventType.RECORD_AMENDED` | A record was amended. |
| `access.granted` | `NotificationEventType.ACCESS_GRANTED` | Access grant created. |
| `access.revoked` | `NotificationEventType.ACCESS_REVOKED` | Access grant revoked. |
| `emergency-access` | `NotificationEventType.EMERGENCY_ACCESS` | Break-glass access used. |
| `diagnosis.created` | `NotificationEventType.DIAGNOSIS_CREATED` | Diagnosis recorded. |
| `diagnosis.severity_escalated` | `NotificationEventType.DIAGNOSIS_SEVERITY_ESCALATED` | Severity increased. |
| `diagnosis.status_confirmed` | `NotificationEventType.DIAGNOSIS_STATUS_CONFIRMED` | Diagnosis confirmed. |
| `quota.warning` | `NotificationEventType.QUOTA_WARNING` | Tenant nearing a usage quota. |
| `payment.confirmed` | `stellar-payment-verification.service.ts` (`PAYMENT_CONFIRMED_EVENT`) | A previously-unconfirmed payment confirmed. |
| `health_credit.issued` | `health-credit-contract.service.ts` | Health credits issued on-chain. |
| `retention.batch_processed` | `event-store/domain-events.ts` | Data-retention batch completed. |

> `patient.created` appears in the DTO JSDoc as an illustrative example and is **not**
> currently emitted by any module. Treat the table above as the catalog of event names
> the backend defines today; confirm against a running environment before relying on a
> specific event in production.

### 4.3 Sample payloads

Notification-derived events share the `NotificationEvent` envelope:

```jsonc
// record.uploaded / record.accessed / record.amended /
// access.granted / access.revoked / emergency-access /
// diagnosis.* / quota.warning
{
  "eventType": "record.uploaded",
  "actorId": "user-uuid",
  "resourceId": "record-uuid",
  "timestamp": "2026-09-25T10:00:00.000Z",
  "metadata": { "targetUserId": "patient-uuid" }
}
```

```jsonc
// payment.confirmed
{ "paymentId": "payment-uuid", "status": "CONFIRMED", "txHash": "..." }
```

```jsonc
// health_credit.issued
{ "creditId": "credit-uuid", "subject": "patient-uuid", "amount": 100, "txHash": "..." }
```

```jsonc
// retention.batch_processed
{
  "policyId": "policy-uuid",
  "entityType": "MedicalRecord",
  "tenantId": "tenant-uuid",
  "action": "archive",
  "recordCount": 42,
  "archivedCount": 40,
  "deletedCount": 2,
  "dryRun": false,
  "cutoffDate": "2024-01-01T00:00:00.000Z"
}
```

Payloads are the event-specific data passed to `queueWebhookDeliveries`; the envelope
above is the shape used by the notification domain. Integrators should parse
defensively and verify the signature over the raw body before trusting any field.

---

## 5. Testing your receiver

The algorithms in this guide are verified against the real signer and middleware in
`src/webhooks/webhook-signature.docs.spec.ts`. You can use those helpers as the basis
for your own integration tests, and the shipped suite as a reference for the exact
byte-level contract:

- Outbound: `WebhookDeliveryService.deliverWebhook` sets
  `X-Webhook-Signature: sha256=<HMAC-SHA256(secret, rawBody)>`.
- Inbound: `WebhookSignatureMiddleware` accepts
  `<timestampMs>.<nonce>.<HMAC-SHA256(secret, "<timestampMs>.<nonce>.<rawBody>")>`.
