# Key Rotation Procedure

## Overview

This document describes how to rotate the master wrapping key used by the
KeyStore and KeyManagementService adapters. Rotation is the process of
re-encrypting all existing Data Encryption Keys (DEKs) and stored secrets under
a new master key, without touching the underlying encrypted data.

---

## 1. Database-Backed KeyStore (DbKeyStore / local)

The local DbKeyStore derives its wrapping key from the KEY_STORE_MASTER_KEY
environment variable.

### Rotation Steps

1. **Generate a new 32-byte master key**

   `ash
   openssl rand -hex 32
   `

2. **Set the new key as the active key and keep the old one for a rotation window**

   `
   KEY_STORE_MASTER_KEY=<new-64-char-hex>
   KEY_STORE_MASTER_KEY_PREV=<old-64-char-hex>
   `

3. **Trigger rotation via the KeyStore API**

   The otateWrappingKey() method re-encrypts every stored secret with the new
   key. All entries encrypted with the previous key remain decryptable during the
   rotation window because both keys are loaded in memory.

4. **Verify rotation succeeded**

   Call listKeys() and confirm entries report the expected metadata. Spot-check
   etrieveKey() for a sample of keys.

5. **Remove the previous key from environment**

   `
   # Remove these after the rotation window (e.g. 24 hours)
   # KEY_STORE_MASTER_KEY_PREV=<old-key>
   `

---

## 2. AWS KMS KeyStore (AwsKmsKeyStore)

The KMS-backed store relies on AWS-managed key rotation. The CMK ARN is set via
AWS_KMS_KEY_ID.

### Automatic Rotation

1. Enable **automatic key rotation** on the CMK in the AWS KMS console.
   - AWS rotates the backing key annually by default.
   - Existing ciphertext remains decryptable under the old backing key.

2. No application changes are needed — Decrypt and GenerateDataKey continue
   to work transparently.

### Manual Rotation (CMK replacement)

1. Create a new CMK in AWS KMS.

2. Update the AWS_KMS_KEY_ID environment variable to point to the new CMK ARN.

3. Call otateWrappingKey() on AwsKmsKeyStore to re-wrap all stored keys
   under the new CMK. This decrypts each stored key via the old CMK and
   re-encrypts with the new one.

4. Verify all entries are re-wrapped.

5. (Optional) Schedule deletion of the old CMK after a cooldown period.

---

## 3. Envelope Key Management Service Rotation

For the EnvelopeKeyManagementService (DEK management), use the three-phase
rotation built into the service:

### Phase 1 — Prepare

Set the new master key via environment variables:

`
MASTER_KEY_NEW=<new-64-char-hex>
MASTER_KEY_NEW_VERSION=v2
`

### Phase 2 — Execute

Call otateMasterKey(operatorId) on the service. This re-encrypts all DEKs.

### Phase 3 — Cleanup

After the rotation window (all in-flight requests complete), remove the old key:

`
# Remove these env vars:
# MASTER_KEY_PREV=<old-key>
# MASTER_KEY_PREV_VERSION=v1

# Optionally promote the new key as the default:
MASTER_KEY=<new-64-char-hex>
MASTER_KEY_VERSION=v2
`

---

## Environment Variables Reference

| Variable | Purpose | Required For |
|---|---|---|
| KEY_STORE_MASTER_KEY | 32-byte hex key for local KeyStore | DbKeyStore |
| KEY_STORE_MASTER_KEY_PREV | Previous key during rotation window | DbKeyStore (rotation) |
| AWS_KMS_KEY_ID | KMS CMK ARN | AwsKmsKeyStore |
| KEY_STORAGE_BACKEND | database or ws-kms | KeyStore selection |
| MASTER_KEY | Active master key for envelope encryption | EnvelopeKeyManagementService |
| MASTER_KEY_VERSION | Version label for master key | EnvelopeKeyManagementService |
| MASTER_KEY_NEW | New master key during rotation | EnvelopeKeyManagementService (rotation) |
| MASTER_KEY_NEW_VERSION | Version label for new key | EnvelopeKeyManagementService (rotation) |
| MASTER_KEY_PREV | Previous master key during rotation | EnvelopeKeyManagementService (rotation) |
| MASTER_KEY_PREV_VERSION | Version label for previous key | EnvelopeKeyManagementService (rotation) |
