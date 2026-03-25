# Encryption Module

This module implements envelope encryption for medical record payloads using a two-tier key hierarchy.

## Structure

- `interfaces/` - TypeScript interfaces for encrypted records and related types
- `errors/` - Custom error classes for encryption operations
- `services/` - Core encryption and key management services
- `encryption.module.ts` - NestJS module definition

## Key Components

- **EncryptionService**: Main service for encrypting and decrypting medical records
- **KeyManagementService**: Manages KEKs and performs DEK wrapping/unwrapping
- **EncryptedRecord**: Interface defining the structure of encrypted data

## Dependencies

- `@nestjs/common` - NestJS framework
- `fast-check` - Property-based testing library
- Node.js `crypto` module - Cryptographic operations

## Documentation

- **[STORAGE_SEPARATION.md](./STORAGE_SEPARATION.md)** - Detailed documentation on storage separation requirements, security architecture, and compliance considerations

## Usage

Import the `EncryptionModule` in your application module to use the encryption services.

```typescript
import { EncryptionModule } from './encryption/encryption.module';

@Module({
  imports: [EncryptionModule],
  // ...
})
export class AppModule {}
```
