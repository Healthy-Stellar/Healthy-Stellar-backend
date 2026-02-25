# SDK Auto-Generation Implementation Guide

## Overview

The MedChain TypeScript SDK is auto-generated from the OpenAPI 3.0 specification. This ensures that the SDK always stays in sync with the API and provides type-safe access to all endpoints.

## Directory Structure

```
packages/sdk/
├── src/
│   ├── apis/
│   │   ├── index.ts           # API classes export
│   │   ├── base.api.ts         # Base API class
│   │   ├── records.api.ts      # Records API
│   │   ├── access.api.ts       # Access Control API
│   │   └── auth.api.ts         # Authentication API
│   ├── models/
│   │   └── index.ts            # Data models export
│   ├── configuration.ts        # Configuration class
│   └── index.ts                # SDK root export
├── examples/
│   └── complete-flow.ts        # Full workflow example
├── dist/                       # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

## SDK Generation Flow

### 1. OpenAPI Specification

The SDK is generated from the OpenAPI spec located at:
- **Primary**: `docs/openapi.json`
- **Fallback**: `src/Auto-Generate TypeScript Client SDK from OpenAPI Spec/openapi.json`

The spec defines all API endpoints, models, and authentication methods.

### 2. Generation Configuration

Configuration in `openapitools.json`:

```json
{
  "packageName": "@medchain/sdk",
  "packageVersion": "1.0.0",
  "useAxios": true,
  "withInterfaces": true,
  "typescriptThreePlus": true
}
```

### 3. Generation Command

```bash
npm run generate:sdk
```

This executes `scripts/generate-sdk.sh` which:
1. Validates OpenAPI spec exists
2. Installs `openapi-generator-cli` if needed
3. Generates TypeScript client code
4. Places output in `packages/sdk/src/`

### 4. Build Process

```bash
npm run build:sdk
```

Compiles TypeScript to JavaScript with:
- ES2020 target
- CommonJS module format
- Type declarations (.d.ts)
- Source maps

### 5. Publishing to npm

```bash
npm run publish:sdk
```

Publishes to npm as `@medchain/sdk`

## CI/CD Pipeline

### Automatic SDK Generation (sdk-generate.yml)

Triggered when:
- OpenAPI spec changes
- Backend source code changes
- Workflow file changes

Steps:
1. Generate SDK from latest OpenAPI spec
2. Check for drift (file comparison)
3. Build SDK
4. Run tests
5. Comment on PR with results

**Drift Detection**:
The `check:sdk-drift` script detects if generated SDK differs from committed version:

```bash
npm run check:sdk-drift
```

If drift is detected:
- Lists all changed files
- Shows new, modified, and deleted files
- Fails the build
- Suggests running `npm run generate:sdk` and committing changes

### Automatic Publishing (sdk-publish.yml)

Triggered when:
- Release is published on GitHub
- Manual workflow dispatch

Steps:
1. Checkout code
2. Generate fresh SDK
3. Update version from release tag or manual input
4. Build SDK
5. Publish to npm
6. Create deployment status
7. Comment on release with publication info
8. Send Slack notification (if webhook configured)

## Development Workflow

### Adding a New API Endpoint

1. **Update OpenAPI Spec**

Add endpoint to `docs/openapi.json`:

```json
{
  "paths": {
    "/patients/{patientId}": {
      "get": {
        "summary": "Get patient by ID",
        "operationId": "getPatient",
        "parameters": [
          {"name": "patientId", "in": "path", "required": true}
        ],
        "responses": {
          "200": {
            "description": "Patient found",
            "content": {
              "application/json": {
                "schema": {"$ref": "#/components/schemas/Patient"}
              }
            }
          }
        }
      }
    }
  }
}
```

2. **Generate SDK**

```bash
npm run generate:sdk
```

3. **Review Generated Code**

Check `packages/sdk/src/apis/` for new API classes.

4. **Update README if Needed**

Add usage examples to `packages/sdk/README.md`.

5. **Build and Test**

```bash
npm run build:sdk
npm run test:sdk
```

6. **Commit**

```bash
git add packages/sdk docs/openapi.json
git commit -m "feat: add patient endpoint and regenerate SDK"
```

### Local SDK Testing

```typescript
// Test SDK locally
import { AuthApi, RecordsApi, Configuration } from './packages/sdk/src';

const config = new Configuration({
  accessToken: 'test-token',
  basePath: 'http://localhost:3000/v1',
});

const recordsApi = new RecordsApi(config);
const records = await recordsApi.listRecords();
```

### SDK Documentation

Maintain detailed README in `packages/sdk/README.md`:
- Installation instructions
- Quick start examples
- Complete API reference
- Authentication guide
- Error handling patterns
- Troubleshooting section

## Version Management

SDK version must sync with API version using semantic versioning:

```
API v1.2.3 → SDK v1.2.3
```

### Automatic Versioning (Releases)

When creating a GitHub release:

1. Tag with semantic version: `v1.2.3`
2. SDK publish workflow automatically:
   - Extracts version from tag (removes 'v' prefix)
   - Updates `packages/sdk/package.json`
   - Generates fresh SDK
   - Publishes to npm

### Manual Versioning

```bash
npm run version:sdk -- "1.2.3"
```

This updates `packages/sdk/package.json` version field.

## SDK Generation Features

### Generated Code Includes

1. **Base API Class**: Foundation for all API operations
2. **API Classes per Module**: 
   - `RecordsApi` - Medical record operations
   - `AccessApi` - Access control operations
   - `AuthApi` - Authentication operations
3. **Type Definitions**: Full TypeScript interfaces for all models
4. **Configuration**: Token and endpoint management
5. **Error Handling**: Proper axios error propagation

### Customization

The generated SDK can be enhanced with:

```typescript
// Add custom methods to API classes
class ExtendedRecordsApi extends RecordsApi {
  async createAndGrant(
    record: CreateRecordRequest,
    grantTo: string,
  ) {
    const created = await this.createRecord(record);
    // Auto-grant access
    return created;
  }
}
```

## Testing the SDK

### Unit Tests in SDK

```bash
cd packages/sdk
npm test
```

### Integration Tests

Test the complete flow:

```bash
npx ts-node packages/sdk/examples/complete-flow.ts
```

### In CI/CD

The publish workflow runs tests:

```bash
npm run test:sdk
```

Tests are optional (continue-on-error: true) but reported.

## Troubleshooting

### SDK Not Generating

**Problem**: `openapi-generator-cli` command not found

**Solution**:
```bash
npm install -g @openapitools/openapi-generator-cli
npm run generate:sdk
```

### Drift Detection Failed

**Problem**: Generated SDK differs from committed version

**Solution**:
1. Generate locally: `npm run generate:sdk`
2. Review changes: `git diff packages/sdk/`
3. Commit if changes are valid
4. Re-run CI

### Build Errors After Generation

**Problem**: TypeScript compilation errors

**Solution**:
1. Check OpenAPI spec for validation errors
2. Review generated code in `packages/sdk/src/`
3. Ensure all types are properly exported in `index.ts`
4. Run: `npm run build:sdk`

### npm Publication Fails

**Problem**: NPM_TOKEN not configured or invalid

**Solution**:
1. Add NPM token to GitHub secrets as `NPM_TOKEN`
2. Ensure token has publish permissions
3. Check npm account has access to `@medchain` org
4. Re-run publish workflow

## Best Practices

1. **Always Update OpenAPI Spec First**: Changes should originate from spec
2. **Review Generated Code**: Don't manually edit generated code
3. **Test Before Publishing**: Run the example app to verify SDK works
4. **Keep Versions in Sync**: API and SDK versions should match
5. **Document Breaking Changes**: Update README when API changes significantly
6. **Semantic Versioning**: Follow semver for version numbers
7. **Review PRs with SDK Changes**: Ensure OpenAPI spec changes are valid

## Future Enhancements

1. **SDK for Other Languages**: Python, Go, Java SDKs
2. **API Client Generator**: UI tool for generating custom clients
3. **SDK Plugin System**: Allow SDK extensions
4. **GraphQL Support**: Generate GraphQL client if API supports it
5. **Automatic Breaking Change Detection**: Warn on incompatible changes
6. **SDK Analytics**: Track SDK usage and errors
7. **Stub SDK for Testing**: Mock implementation for tests

## References

- [OpenAPI Documentation](https://swagger.io/specification/)
- [OpenAPI Generator](https://openapi-generator.tech/)
- [Axios Documentation](https://axios-http.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## Questions?

For SDK-related questions:
1. Check [packages/sdk/README.md](../packages/sdk/README.md)
2. Review [examples/complete-flow.ts](../packages/sdk/examples/complete-flow.ts)
3. Run `npm run generate:sdk` to regenerate from latest spec
4. Check GitHub Issues for known issues
