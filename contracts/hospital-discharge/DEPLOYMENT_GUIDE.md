# Hospital Discharge Management Contract - Deployment Guide

## Build Status

✅ **WASM Build Successful**

The contract has been successfully compiled to WebAssembly:
- Location: `target/wasm32-unknown-unknown/release/hospital_discharge.wasm`
- Build Profile: Release (optimized)

## Prerequisites

1. **Rust & Cargo** - Install from https://rustup.rs/
2. **Soroban CLI** - Install with:
   ```bash
   cargo install --locked soroban-cli
   ```
3. **wasm32 target**:
   ```bash
   rustup target add wasm32-unknown-unknown
   ```

## Building the Contract

```bash
cd contracts/hospital-discharge
cargo build --target wasm32-unknown-unknown --release
```

The compiled WASM will be at: `target/wasm32-unknown-unknown/release/hospital_discharge.wasm`

## Testing

### Unit Tests

The contract includes comprehensive unit tests covering:
- All 10 public functions
- Error conditions and validation
- Full discharge workflow integration
- Edge cases

To run tests (requires dlltool for Windows):
```bash
cargo test
```

### Test Coverage

The test suite includes:
- 20+ unit tests
- Error condition testing
- Full workflow integration test
- Input validation tests
- State management verification

**Target Coverage: ≥85%**

## Deployment

### 1. Deploy to Testnet

```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/hospital_discharge.wasm \
  --source <YOUR_SECRET_KEY> \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"
```

### 2. Deploy to Mainnet

```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/hospital_discharge.wasm \
  --source <YOUR_SECRET_KEY> \
  --rpc-url https://soroban-mainnet.stellar.org \
  --network-passphrase "Public Global Stellar Network ; September 2015"
```

### 3. Optimize WASM (Optional)

For production deployments, optimize the WASM:

```bash
soroban contract optimize \
  --wasm target/wasm32-unknown-unknown/release/hospital_discharge.wasm
```

This reduces the contract size and deployment costs.

## Contract Functions

### 1. initiate_discharge_planning
Starts a new discharge planning process.

**Parameters:**
- `caller: Address` - Authenticated caller
- `patient_id: BytesN<32>` - Patient identifier hash
- `admission_date: u64` - Admission timestamp
- `expected_discharge_date: u64` - Expected discharge timestamp
- `discharge_destination: u32` - Destination code (0=Home, 1=SNF, 2=Rehab, 3=Other)

**Returns:** `Result<u64, Error>` - Discharge plan ID

### 2. assess_discharge_readiness
Evaluates patient readiness for discharge.

**Parameters:**
- `caller: Address`
- `discharge_plan_id: u64`
- `medical_stability_score: u32` (0-100)
- `functional_status_score: u32` (0-100)
- `support_system_score: u32` (0-100)
- `education_completion_score: u32` (0-100)

**Returns:** `Result<ReadinessScore, Error>`

### 3. create_discharge_orders
Creates discharge orders (medications, equipment, etc.).

**Parameters:**
- `caller: Address`
- `discharge_plan_id: u64`
- `order_type: u32` (0=Medication, 1=DME, 2=HomeHealth, 3=Lab)
- `order_details_hash: BytesN<32>`

### 4. arrange_home_health
Arranges home health services.

**Parameters:**
- `caller: Address`
- `discharge_plan_id: u64`
- `agency_id: BytesN<32>`
- `service_type: u32` (0=Nursing, 1=PT, 2=OT, 3=SpeechTherapy)
- `frequency_per_week: u32`
- `duration_weeks: u32`

### 5. order_dme_for_discharge
Orders durable medical equipment.

**Parameters:**
- `caller: Address`
- `discharge_plan_id: u64`
- `equipment_type: u32` (0=Walker, 1=Wheelchair, 2=OxygenConcentrator, 3=HospitalBed)
- `supplier_id: BytesN<32>`
- `delivery_date: u64`

### 6. schedule_followup_appointments
Schedules post-discharge appointments.

**Parameters:**
- `caller: Address`
- `discharge_plan_id: u64`
- `appointments: Vec<FollowUpAppointment>`

**Returns:** `Result<Vec<u64>, Error>` - Appointment IDs

### 7. provide_discharge_education
Tracks patient/family education.

**Parameters:**
- `caller: Address`
- `discharge_plan_id: u64`
- `education_topic: u32` (0=Medications, 1=WoundCare, 2=DietNutrition, 3=ActivityRestrictions)
- `materials_hash: BytesN<32>`
- `completed: bool`

### 8. coordinate_with_snf
Coordinates skilled nursing facility transfers.

**Parameters:**
- `caller: Address`
- `discharge_plan_id: u64`
- `snf_id: BytesN<32>`
- `bed_reserved: bool`
- `transfer_date: u64`
- `medical_summary_hash: BytesN<32>`

### 9. complete_discharge
Finalizes the discharge process.

**Parameters:**
- `caller: Address`
- `discharge_plan_id: u64`
- `actual_discharge_date: u64`
- `discharge_summary_hash: BytesN<32>`

### 10. track_readmission_risk
Monitors readmission risk factors.

**Parameters:**
- `caller: Address`
- `discharge_plan_id: u64`
- `risk_factors: u32` (Bitmap: 1=MultipleComorbidities, 2=PoorSocialSupport, 4=MedicationNonCompliance, 8=RecentReadmission)
- `risk_score: u32` (0-100)

## Error Codes

- `PlanNotFound = 1` - Discharge plan does not exist
- `InvalidDate = 2` - Invalid date (past date for future event)
- `InvalidScore = 3` - Score out of range (must be 0-100)
- `InvalidInput = 4` - Invalid input parameters
- `AlreadyCompleted = 5` - Discharge already completed
- `Unauthorized = 6` - Caller not authorized

## Events

All functions emit events for tracking:
- `discharge:init` - Discharge initiated
- `discharge:ready` - Readiness assessed
- `discharge:order` - Order created
- `discharge:homeheal` - Home health arranged
- `discharge:dme` - DME ordered
- `discharge:appt` - Appointment scheduled
- `discharge:edu` - Education provided
- `discharge:snf` - SNF coordinated
- `discharge:complete` - Discharge completed
- `discharge:risk` - Risk tracked

## Storage

All data is stored in persistent storage with 1-year TTL:
- Discharge plans
- Readiness assessments
- Orders
- Home health arrangements
- DME orders
- Follow-up appointments
- Education records
- SNF coordination
- Completion status
- Readmission risk data

## Security Features

- ✅ All functions require caller authentication (`require_auth()`)
- ✅ Input validation on all parameters
- ✅ Plan existence verification
- ✅ Date validation (no past dates for future events)
- ✅ Score validation (0-100 range)
- ✅ Prevents duplicate discharge completion
- ✅ Hash-based document verification using BytesN<32>

## Integration Example

```javascript
// Using Stellar SDK
const { Contract, Keypair, Networks, TransactionBuilder } = require('@stellar/stellar-sdk');

const contractId = 'YOUR_CONTRACT_ID';
const contract = new Contract(contractId);

// 1. Initiate discharge planning
const patientId = Buffer.from('patient_hash_here').toString('hex');
const tx = new TransactionBuilder(account, {
  fee: '100',
  networkPassphrase: Networks.TESTNET
})
  .addOperation(
    contract.call(
      'initiate_discharge_planning',
      caller,
      patientId,
      1000,
      2000,
      0
    )
  )
  .setTimeout(30)
  .build();

// Sign and submit transaction
```

## Monitoring

Monitor contract events using Stellar Horizon API:
```bash
curl "https://horizon-testnet.stellar.org/contracts/{CONTRACT_ID}/events"
```

## Support

For issues or questions:
1. Check the README.md for detailed documentation
2. Review test cases in src/test.rs for usage examples
3. Consult Soroban documentation: https://soroban.stellar.org/docs

## License

MIT
