# Stellar Integration Module

## Overview

The Stellar module provides integration with the Stellar blockchain network, enabling fee estimation for various blockchain operations used in the healthcare system.

## Features

- **Fee Estimation**: Real-time fee estimates from Stellar Horizon API
- **Smart Caching**: 30-second cache to prevent API hammering
- **Network Congestion Detection**: Automatic detection of network load
- **Operation-Specific Fees**: Different fee multipliers for different operations
- **Error Handling**: Graceful handling of Horizon API unavailability

## API Endpoints

### Get Fee Estimate

```http
GET /stellar/fee-estimate?operation={operation}
```

**Parameters:**
- `operation` (required): One of `anchorRecord`, `grantAccess`, `revokeAccess`

**Response:**
```json
{
  "baseFee": "100",
  "recommended": "150",
  "networkCongestion": "low"
}
```

**Status Codes:**
- `200 OK`: Fee estimate returned successfully
- `400 Bad Request`: Invalid operation parameter
- `503 Service Unavailable`: Horizon API is unreachable

### Get Supported Operations

```http
GET /stellar/operations
```

**Response:**
```json
{
  "operations": ["anchorRecord", "grantAccess", "revokeAccess"]
}
```

## Supported Operations

### 1. anchorRecord
Used for anchoring medical records to the blockchain.
- **Fee Multiplier**: 1.5x (higher priority)
- **Use Case**: Storing immutable medical record hashes

### 2. grantAccess
Used for granting access to medical records.
- **Fee Multiplier**: 1.2x
- **Use Case**: Patient consent management

### 3. revokeAccess
Used for revoking access to medical records.
- **Fee Multiplier**: 1.0x
- **Use Case**: Access control revocation

## Network Congestion Levels

The service automatically detects network congestion based on ledger capacity usage:

- **Low**: < 50% capacity usage
- **Medium**: 50-75% capacity usage
- **High**: > 75% capacity usage

Fee recommendations are adjusted based on congestion level.

## Caching Strategy

- **Cache Duration**: 30 seconds
- **Cache Key**: `fee-estimate:{operation}`
- **Cache Invalidation**: Automatic expiration after TTL
- **Purpose**: Prevent excessive API calls to Horizon

## Configuration

Set the following environment variables:

```env
# Stellar Network Configuration
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
```

For production, use:
```env
STELLAR_NETWORK=mainnet
STELLAR_HORIZON_URL=https://horizon.stellar.org
```

## Error Handling

The service handles various error scenarios:

1. **Horizon Timeout**: Returns 503 with meaningful message
2. **Horizon Unavailable**: Returns 503 with connection error details
3. **Invalid Operation**: Returns 400 with list of valid operations
4. **Network Errors**: Returns 503 with generic error message

## Usage Example

### TypeScript/JavaScript Client

```typescript
// Get fee estimate for anchoring a medical record
const response = await fetch(
  'http://localhost:3000/stellar/fee-estimate?operation=anchorRecord'
);
const feeEstimate = await response.json();

console.log(`Base Fee: ${feeEstimate.baseFee} stroops`);
console.log(`Recommended Fee: ${feeEstimate.recommended} stroops`);
console.log(`Network Congestion: ${feeEstimate.networkCongestion}`);
```

### cURL

```bash
# Get fee estimate
curl "http://localhost:3000/stellar/fee-estimate?operation=anchorRecord"

# Get supported operations
curl "http://localhost:3000/stellar/operations"
```

## Testing

### Unit Tests

```bash
npm run test -- stellar
```

### E2E Tests

```bash
npm run test:e2e -- stellar-fee-estimate
```

### Test Coverage

The module includes comprehensive tests covering:
- Cache hit/miss scenarios
- Horizon API failures
- Network congestion calculations
- Operation-specific fee multipliers
- Error handling

## Architecture

```
stellar/
├── controllers/
│   ├── stellar.controller.ts          # HTTP endpoints
│   └── stellar.controller.spec.ts     # Controller tests
├── services/
│   ├── stellar-fee.service.ts         # Fee calculation logic
│   ├── stellar-fee.service.spec.ts    # Service tests
│   ├── stellar-cache.service.ts       # Caching layer
│   └── stellar-cache.service.spec.ts  # Cache tests
├── interfaces/
│   └── fee-estimate.interface.ts      # Type definitions
├── stellar.module.ts                  # Module definition
└── README.md                          # This file
```

## Security Considerations

- **No Authentication Required**: Fee estimation is a read-only operation
- **Rate Limiting**: Handled by application-level throttling
- **Input Validation**: All operation parameters are validated
- **Error Sanitization**: No sensitive data exposed in error messages

## Performance

- **Cache Hit**: < 1ms response time
- **Cache Miss**: ~100-500ms (depends on Horizon API)
- **Timeout**: 8 seconds maximum wait for Horizon
- **Memory Usage**: Minimal (in-memory cache with automatic cleanup)

## Future Enhancements

- [ ] Support for custom fee multipliers via configuration
- [ ] Historical fee data tracking
- [ ] Fee prediction based on time of day
- [ ] WebSocket support for real-time fee updates
- [ ] Multi-network support (testnet/mainnet switching)

## Troubleshooting

### Horizon API Unreachable

If you receive 503 errors:
1. Check your internet connection
2. Verify `STELLAR_HORIZON_URL` is correct
3. Check Stellar network status: https://status.stellar.org
4. Ensure firewall allows outbound HTTPS connections

### Unexpected Fee Values

If fees seem incorrect:
1. Check network congestion level in response
2. Verify operation type is correct
3. Clear cache and retry: restart the application
4. Check Horizon API directly: `{HORIZON_URL}/fee_stats`

## Support

For issues or questions:
- Check the main project README
- Review test files for usage examples
- Consult Stellar documentation: https://developers.stellar.org
