# Hospital Discharge Management Smart Contract

A comprehensive Soroban smart contract for managing hospital discharge workflows on the Stellar blockchain.

## Overview

This contract tracks the complete patient discharge journey from hospital to home or skilled nursing facility (SNF), storing all workflow data on-chain with cryptographic verification.

## Features

### Core Functions

1. **initiate_discharge_planning** - Start a new discharge plan
2. **assess_discharge_readiness** - Evaluate patient readiness across multiple dimensions
3. **create_discharge_orders** - Create medication, DME, and other orders
4. **arrange_home_health** - Coordinate home health services
5. **order_dme_for_discharge** - Order durable medical equipment
6. **schedule_followup_appointments** - Schedule post-discharge appointments
7. **provide_discharge_education** - Track patient/family education
8. **coordinate_with_snf** - Coordinate skilled nursing facility transfers
9. **complete_discharge** - Finalize the discharge process
10. **track_readmission_risk** - Monitor readmission risk factors

### Data Structures

- **DischargeMedication** - Medication prescriptions with dosage and frequency
- **FollowUpAppointment** - Post-discharge appointment details
- **ReadinessScore** - Multi-dimensional discharge readiness assessment

### Storage Model

All data is stored in persistent storage with 1-year TTL:
- Discharge plans indexed by plan ID
- Readiness assessments
- Discharge orders (medications, DME, etc.)
- Home health arrangements
- Follow-up appointments
- Education records
- SNF coordination details
- Readmission risk tracking

### Security

- All functions require caller authentication via `require_auth()`
- Input validation on all parameters
- Plan existence verification
- Date validation (no past dates for future events)
- Score validation (0-100 range)
- Prevents duplicate discharge completion

### Events

The contract emits events for all major actions:
- Discharge initiated
- Readiness assessed
- Orders created
- Home health arranged
- DME ordered
- Appointments scheduled
- Education provided
- SNF coordinated
- Discharge completed
- Risk tracked

## Building

```bash
cargo build --target wasm32-unknown-unknown --release
```

## Testing

```bash
cargo test
```

The test suite includes:
- Unit tests for all functions
- Error condition testing
- Full workflow integration test
- Edge case validation

Target test coverage: ≥85%

## Deployment

1. Build the contract:
   ```bash
   cargo build --target wasm32-unknown-unknown --release
   ```

2. Optimize the WASM (optional):
   ```bash
   soroban contract optimize --wasm target/wasm32-unknown-unknown/release/hospital_discharge.wasm
   ```

3. Deploy to Stellar:
   ```bash
   soroban contract deploy \
     --wasm target/wasm32-unknown-unknown/release/hospital_discharge.wasm \
     --source <YOUR_SECRET_KEY> \
     --rpc-url https://soroban-testnet.stellar.org \
     --network-passphrase "Test SDF Network ; September 2015"
   ```

## Usage Example

```rust
// 1. Initiate discharge planning
let plan_id = contract.initiate_discharge_planning(
    &caller,
    &patient_id,
    &admission_date,
    &expected_discharge_date,
    &0u32, // Home
);

// 2. Assess readiness
let readiness = contract.assess_discharge_readiness(
    &caller,
    &plan_id,
    &85u32, // Medical stability
    &80u32, // Functional status
    &90u32, // Support system
    &75u32, // Education completion
);

// 3. Create orders, arrange services, schedule appointments...

// 4. Complete discharge
contract.complete_discharge(
    &caller,
    &plan_id,
    &actual_discharge_date,
    &discharge_summary_hash,
);
```

## Discharge Destination Codes

- 0 = Home
- 1 = Skilled Nursing Facility (SNF)
- 2 = Rehabilitation Facility
- 3 = Other

## Service Type Codes

### Home Health Services
- 0 = Nursing
- 1 = Physical Therapy
- 2 = Occupational Therapy
- 3 = Speech Therapy

### DME Equipment Types
- 0 = Walker
- 1 = Wheelchair
- 2 = Oxygen Concentrator
- 3 = Hospital Bed

### Education Topics
- 0 = Medications
- 1 = Wound Care
- 2 = Diet & Nutrition
- 3 = Activity Restrictions

### Readmission Risk Factors (Bitmap)
- 1 = Multiple Comorbidities
- 2 = Poor Social Support
- 4 = Medication Non-Compliance
- 8 = Recent Readmission

## License

MIT
