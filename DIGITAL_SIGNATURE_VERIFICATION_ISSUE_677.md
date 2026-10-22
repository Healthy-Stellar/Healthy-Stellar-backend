# Digital Signature Verification for Medical Record Attachments

## Issue
**#677** — Signed medical documents (discharge summaries, surgical consent forms) are stored as uploads but their digital signatures are not verified on retrieval, so tampering goes undetected.

## Solution
Implemented end-to-end digital signature verification for PDF document attachments using PKCS#7 / CAdES standards. Signatures are extracted on upload, stored in the database, and verified on retrieval. Invalid signatures trigger real-time alerts to the records department.

---

## Architecture

### Components

#### 1. `src/records/entities/record-attachment.entity.ts`
Extended `RecordAttachment` entity with digital signature metadata columns:

| Column | Type | Description |
|--------|------|-------------|
| `signatureStatus` | `enum` | `valid`, `invalid`, or `unsigned` |
| `signatureAlgorithm` | `text \| null` | Digest algorithm used (e.g., `sha256`) |
| `signerCertificate` | `text \| null` | Base64-encoded X.509 signer certificate |
| `signedAt` | `timestamp \| null` | When the document was signed |
| `signatureMetadata` | `text \| null` | JSON blob with ByteRange, error details, etc. |

#### 2. `src/records/services/digital-signature.service.ts`
Core verification service (~580 lines):

- **`extractPdfSignature(buffer)`** — Parses PDF structure to find signature fields (`/Type /Sig`), extracts:
  - PKCS#7 / CAdES signature blob (`/Contents`)
  - ByteRange (which bytes were signed)
  - X.509 signer certificate
  - Signing time
  - Digest algorithm

- **`isValidPdfSignatureStructure(buffer)`** — Lightweight structural validation (parseable PKCS#7, valid ByteRange) used during upload

- **`verifyPdfSignature(buffer, publicKeyPem)`** — Full cryptographic verification against stored public key using OpenSSL CMS + Node.js crypto

- **`verifyDetachedSignature(signatureBytes, data, publicKeyPem)`** — For non-PDF or separately stored signatures

- **`hasPdfSignature(buffer)`** — Quick check for signature field presence

#### 3. `src/records/services/signature-alert.service.ts`
Alerting and audit service (~94 lines):

- **`alertInvalidSignature(payload)`** — Emits `document.signature.invalid` event AND creates audit log entry with `HIGH` severity
- **`logValidSignature(payload)`** — Logs successful verification for audit trail
- Listens for events to notify records department

#### 4. `src/records/services/record-attachment-upload.service.ts`
Enhanced upload flow with signature metadata extraction:

```
Step 1: Validate record exists
Step 2: Validate file (MIME, size, magic bytes)
Step 2b: Extract signature metadata + structural validation (NEW)
         • hasPdfSignature() → check for /Type /Sig field
         • extractPdfSignature() → parse PKCS#7, ByteRange, cert
         • isValidPdfSignatureStructure() → validate structure without public key
Step 3: Encrypt file using patient's KEK
Step 4: Upload encrypted bytes to IPFS
Step 5: Save attachment metadata + signature fields
Step 5b: Trigger alert if INVALID signature structure
Step 6: Log audit entry
```

Full cryptographic verification happens on retrieval (Step 2b) where the stored public key is available.

#### 5. `src/records/controllers/records.controller.ts`
New endpoint:

```
GET /records/:recordId/attachments/:attachmentId
```

Returns `AttachmentResponseDto` with signature status.

#### 6. `src/records/dto/attachment-response.dto.ts`
Response DTO including signature status fields.

---

## Digital Signature Verification Flow

### Upload Time
```
┌─────────────┐     ┌──────────────────────────┐     ┌──────────────┐
│ Client      │────▶│ RecordAttachmentUploadSvc │────▶│ IPFS         │
│             │     │ 1. validateFile()        │     │ (encrypted)  │
│ PDF file    │     │ 2. extractPdfSignature() │     └──────────────┘
└─────────────┘     │ 3. verifyPdfSignature()  │
                    │ 4. encrypt + upload      │
                    │ 5. save metadata         │
                    │ 6. alert if INVALID      │
                    └──────────────────────────┘
```

### Retrieval Time
```
┌─────────────┐     ┌──────────────────────────┐     ┌──────────────┐
│ Client      │────▶│ RecordsController        │────▶│ RecordsSvc   │
│             │     │ GET attachment/:id       │     └──────────────┘
│ Auth token  │     └──────────────────────────┘
└─────────────┘              │
                             ▼
                    ┌──────────────────────────┐
                    │ verifyAttachmentSignature│
                    │ • Fetch from IPFS        │
                    │ • Recompute PKCS#7 hash  │
                    │ • Compare with stored    │
                    │ • Return status          │
                    └──────────────────────────┘
```

---

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| (N/A for 401/403) | — | Auth handled by existing guards |
| `SIGNATURE_VERIFICATION_FAILED` | Audit log | Invalid signature detected — alert triggered |

---

## Benefits

1. **Tamper Detection** — Any modification to a signed PDF invalidates the PKCS#7 signature
2. **Non-Repudiation** — Signer certificate provides proof of who signed the document
3. **Compliance** — Audit trail for HIPAA/regulatory requirements
4. **Zero Impact on Existing Flow** — Unsigned documents continue to work normally
5. **CAdES Support** — Detached signatures supported for flexible key management

---

## Testing

### Unit Tests
```bash
# Digital signature service
npx jest --selectProjects unit --testPathPatterns 'digital-signature.service.spec.ts'
# → 9 tests passed

# Attachment upload with tampered document
npx jest --selectProjects unit --testPathPatterns 'record-attachment-upload.service.spec.ts'
# → 20 tests passed
```

### Tampered Document Test
The test `should flag tampered PDF with INVALID signature status` verifies:
1. A tampered PDF with garbage PKCS#7 bytes is uploaded
2. `DigitalSignatureService.verifyPdfSignature` returns `INVALID`
3. The attachment is saved with `signatureStatus: INVALID`
4. `SignatureAlertService.alertInvalidSignature` is called with correct payload

---

## Pull Request
- **PR**: https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/726
- **Branch**: `feat/record-digital-signature-verification-677`

closes #677
