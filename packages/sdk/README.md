# @medchain/sdk

Auto-generated TypeScript SDK for MedChain Healthcare API with Stellar and IPFS integration.

[![npm version](https://img.shields.io/npm/v/@medchain/sdk)](https://www.npmjs.com/package/@medchain/sdk)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow.svg)](https://opensource.org/licenses/ISC)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)

## Features

- 🔐 **Type-Safe**: Fully typed request/response interfaces and models
- 🚀 **Auto-Generated**: Generated from OpenAPI 3.0 specification for API consistency
- 📦 **Modular APIs**: Separate classes for Records, Access Control, and Authentication
- 🔄 **Promise-based**: Native Promise support with async/await
- 🛡️ **JWT Authentication**: Bearer token authentication support
- 📊 **Patient Data Management**: Create, read, update, and delete medical records
- 🔐 **Access Control**: Grant and revoke access to patient records
- 🌐 **Blockchain Integration**: Stellar and IPFS support for decentralized records
- 📄 **Full Documentation**: Comprehensive API documentation and examples

## Installation

```bash
npm install @medchain/sdk axios
# or
yarn add @medchain/sdk axios
# or
pnpm add @medchain/sdk axios
```

## Quick Start

### 1. Authentication

```typescript
import { AuthApi, Configuration } from '@medchain/sdk';

// Initialize auth API
const config = new Configuration({
  basePath: 'https://api.medchain.io/v1',
});

const authApi = new AuthApi(config);

// Login
const token = await authApi.login({
  email: 'user@example.com',
  password: 'your-password',
});

console.log('Access Token:', token.accessToken);

// Use token for subsequent requests
const newConfig = new Configuration({
  accessToken: token.accessToken,
  basePath: 'https://api.medchain.io/v1',
});
```

### 2. Working with Records

```typescript
import { RecordsApi, Configuration } from '@medchain/sdk';

const config = new Configuration({
  accessToken: 'your-jwt-token',
  basePath: 'https://api.medchain.io/v1',
});

const recordsApi = new RecordsApi(config);

// Create a medical record
const record = await recordsApi.createRecord({
  patientId: 'patient-123',
  recordType: 'LAB_RESULT',
  data: {
    testName: 'Blood Test',
    results: {
      hemoglobin: '15.5 g/dL',
      whiteCells: '7.2 x10^9/L',
    },
  },
  metadata: {
    laboratorian: 'Dr. Smith',
    labName: 'Central Hospital Lab',
  },
});

console.log('Record created:', record.id);

// Retrieve a record
const fetchedRecord = await recordsApi.getRecord(record.id);
console.log('Record data:', fetchedRecord.data);

// List records with pagination
const records = await recordsApi.listRecords(1, 10, 'LAB_RESULT');
console.log(`Found ${records.total} lab results`);

// Update a record
const updated = await recordsApi.updateRecord(record.id, {
  data: {
    ...fetchedRecord.data,
    reviewed: true,
  },
});

// Delete a record
await recordsApi.deleteRecord(record.id);
```

### 3. Access Control

```typescript
import { AccessApi, Configuration } from '@medchain/sdk';

const config = new Configuration({
  accessToken: 'your-jwt-token',
  basePath: 'https://api.medchain.io/v1',
});

const accessApi = new AccessApi(config);

// Grant access to a record
const grant = await accessApi.grantAccess({
  recordId: 'record-123',
  recipientId: 'doctor-456',
  permissions: ['read', 'comment'],
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
});

console.log('Access granted:', grant.id);

// Check if user has access
const access = await accessApi.checkAccess('record-123');
if (access.hasAccess) {
  console.log('Permissions:', access.permissions);
}

// List all access grants for a record
const grants = await accessApi.listAccessGrants('record-123', 1, 5);
console.log(`Found ${grants.total} access grants`);

// Revoke access
const revoked = await accessApi.revokeAccess(grant.id);
console.log('Access revoked at:', revoked.revokedAt);
```

## Advanced Usage

### Custom Configuration

```typescript
import { Configuration, RecordsApi } from '@medchain/sdk';
import axios from 'axios';

// Create custom axios instance with interceptors
const customAxios = axios.create({
  timeout: 30000,
});

customAxios.interceptors.request.use((config) => {
  console.log('Request:', config.method, config.url);
  return config;
});

customAxios.interceptors.response.use(
  (response) => {
    console.log('Response:', response.status);
    return response;
  },
  (error) => {
    console.error('Error:', error.message);
    return Promise.reject(error);
  },
);

// Initialize API with custom axios
const config = new Configuration({
  accessToken: 'your-jwt-token',
  basePath: 'https://api.medchain.io/v1',
});

const recordsApi = new RecordsApi(config, 'https://api.medchain.io/v1', customAxios);
```

### Dynamic Token Refresh

```typescript
import { Configuration, AuthApi, RecordsApi } from '@medchain/sdk';

class TokenManager {
  private accessToken: string = '';
  private refreshToken: string = '';
  private authApi: AuthApi;

  constructor(basePath: string) {
    const config = new Configuration({ basePath });
    this.authApi = new AuthApi(config);
  }

  async login(email: string, password: string) {
    const result = await this.authApi.login({ email, password });
    this.accessToken = result.accessToken;
    this.refreshToken = result.refreshToken || '';
    return result;
  }

  async getAccessToken(): Promise<string> {
    // Implement token expiration check and refresh logic
    // For simplicity, just return current token
    return this.accessToken;
  }

  getConfiguration(): Configuration {
    return new Configuration({
      accessToken: this.accessToken,
    });
  }
}

const tokenManager = new TokenManager('https://api.medchain.io/v1');
await tokenManager.login('user@example.com', 'password');

const recordsApi = new RecordsApi(tokenManager.getConfiguration());
```

### Error Handling

```typescript
import { RecordsApi, Configuration } from '@medchain/sdk';

const config = new Configuration({
  accessToken: 'your-jwt-token',
  basePath: 'https://api.medchain.io/v1',
});

const recordsApi = new RecordsApi(config);

try {
  const record = await recordsApi.getRecord('non-existent-id');
} catch (error: any) {
  if (error.response) {
    // API error response
    console.error('Status:', error.response.status);
    console.error('Data:', error.response.data);

    if (error.response.status === 401) {
      // Handle authentication error
      console.log('Please re-authenticate');
    } else if (error.response.status === 404) {
      // Handle not found error
      console.log('Record not found');
    }
  } else if (error.request) {
    // Request made but no response
    console.error('No response from server');
  } else {
    // Error in request setup
    console.error('Error:', error.message);
  }
}
```

### Batch Operations

```typescript
import { RecordsApi, Configuration } from '@medchain/sdk';

const config = new Configuration({
  accessToken: 'your-jwt-token',
  basePath: 'https://api.medchain.io/v1',
});

const recordsApi = new RecordsApi(config);

// Create multiple records in parallel
const recordTypes = ['LAB_RESULT', 'DIAGNOSIS', 'PRESCRIPTION'];
const promises = recordTypes.map((type) =>
  recordsApi.createRecord({
    patientId: 'patient-123',
    recordType: type,
    data: { /* record data */ },
  }),
);

const createdRecords = await Promise.all(promises);
console.log(`Created ${createdRecords.length} records`);

// Fetch multiple records
const recordIds = createdRecords.map((r) => r.id);
const records = await Promise.all(
  recordIds.map((id) => recordsApi.getRecord(id)),
);
```

## Complete Example: Upload → Grant → Fetch Flow

See [examples/complete-flow.ts](./examples/complete-flow.ts) for a complete working example demonstrating:

1. User registration
2. Medical record creation
3. Access grant to healthcare provider
4. Record retrieval by provider
5. Access revocation

Run the example:

```bash
npx ts-node examples/complete-flow.ts
```

## API Classes

### AuthApi

Authentication and user management:
- `login(credentials)` - Authenticate user
- `register(userData)` - Create new user account
- `refreshToken(token)` - Refresh access token
- `logout()` - Logout user
- `getCurrentUser()` - Get current user info
- `verifyToken(token)` - Verify JWT token validity

### RecordsApi

Medical record management:
- `createRecord(data)` - Create new medical record
- `getRecord(id)` - Retrieve specific record
- `listRecords(page, pageSize, type)` - List records with pagination
- `updateRecord(id, data)` - Update record data
- `deleteRecord(id)` - Delete record

### AccessApi

Access control and permissions:
- `grantAccess(grant)` - Grant access to record
- `getAccessGrant(id)` - Get specific access grant
- `listAccessGrants(page, pageSize)` - List access grants
- `revokeAccess(id)` - Revoke access grant
- `checkAccess(recordId)` - Check if user has access

## Configuration Options

```typescript
interface ConfigurationParameters {
  apiKey?: string | (() => string);          // API key for key-based auth
  accessToken?: string | (() => Promise<string>); // JWT token
  basePath?: string;                          // API base URL
  baseOptions?: any;                          // Axios base options
}
```

## Environment Variables

```bash
# Development
VITE_API_BASE_URL=http://localhost:3000/v1
VITE_API_KEY=your-api-key  # Optional

# Production
VITE_API_BASE_URL=https://api.medchain.io/v1
VITE_API_KEY=your-api-key  # Optional
```

## Types and Interfaces

The SDK provides TypeScript interfaces for all API requests and responses:

```typescript
interface RecordResponse {
  id: string;
  patientId: string;
  recordType: string;
  data: Record<string, any>;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  ipfsHash?: string;
  stellarTxHash?: string;
}

interface AccessGrant {
  id: string;
  recordId: string;
  grantedBy: string;
  grantedTo: string;
  permissions: string[];
  expiresAt?: string;
  revokedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
  user?: UserInfo;
}
```

## Troubleshooting

### 401 Unauthorized

Ensure your access token is valid and not expired:

```typescript
try {
  const user = await authApi.getCurrentUser();
} catch (error: any) {
  if (error.response?.status === 401) {
    // Token expired or invalid
    // Re-authenticate and get new token
  }
}
```

### 403 Forbidden

You don't have permission for this resource:

```typescript
const access = await accessApi.checkAccess(recordId);
if (!access.hasAccess) {
  console.log('You do not have access to this record');
}
```

### Network Errors

Handle network timeouts and connection errors:

```typescript
const config = new Configuration({
  accessToken: 'token',
  baseOptions: {
    timeout: 30000, // 30 seconds
  },
});
```

## Browser Support

- Chrome/Edge: All versions
- Firefox: All versions
- Safari: 11+
- Mobile browsers: iOS Safari 11+, Chrome Android 51+

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

ISC - See [LICENSE](../../LICENSE) file for details

## Support

- 📖 [API Documentation](https://docs.medchain.io)
- 🐛 [GitHub Issues](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/issues)
- 💬 [Discussions](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/discussions)

## SDK Version

- **Current Version**: 1.0.0
- **Auto-generated from API Version**: 1.0.0
- **Generated**: 2026-02-25

---

**Note**: This SDK is auto-generated from the OpenAPI 3.0 specification. Regenerate with:

```bash
npm run generate:sdk
```
