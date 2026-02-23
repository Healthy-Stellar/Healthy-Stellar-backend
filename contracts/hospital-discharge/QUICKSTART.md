# Hospital Discharge Management Contract - Quick Start

## 🚀 Get Started in 5 Minutes

### Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Soroban CLI
cargo install --locked soroban-cli

# Add WASM target
rustup target add wasm32-unknown-unknown
```

### Build

```bash
cd contracts/hospital-discharge
cargo build --target wasm32-unknown-unknown --release
```

✅ Output: `target/wasm32-unknown-unknown/release/hospital_discharge.wasm`

### Deploy to Testnet

```bash
# Set up identity (first time only)
soroban keys generate alice --network testnet

# Deploy contract
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/hospital_discharge.wasm \
  --source alice \
  --network testnet
```

Save the returned contract ID!

### Invoke Functions

```bash
# Set contract ID
CONTRACT_ID="YOUR_CONTRACT_ID_HERE"

# 1. Initiate discharge planning
soroban contract invoke \
  --id $CONTRACT_ID \
  --source alice \
  --network testnet \
  -- \
  initiate_discharge_planning \
  --caller "$(soroban keys address alice)" \
  --patient_id "0000000000000000000000000000000000000000000000000000000000000001" \
  --admission_date 1000 \
  --expected_discharge_date 5000 \
  --discharge_destination 0

# Returns: 0 (first plan ID)

# 2. Assess readiness
soroban contract invoke \
  --id $CONTRACT_ID \
  --source alice \
  --network testnet \
  -- \
  assess_discharge_readiness \
  --caller "$(soroban keys address alice)" \
  --discharge_plan_id 0 \
  --medical_stability_score 85 \
  --functional_status_score 80 \
  --support_system_score 90 \
  --education_completion_score 75

# Returns: ReadinessScore with is_ready=true

# 3. Complete discharge
soroban contract invoke \
  --id $CONTRACT_ID \
  --source alice \
  --network testnet \
  -- \
  complete_discharge \
  --caller "$(soroban keys address alice)" \
  --discharge_plan_id 0 \
  --actual_discharge_date 5000 \
  --discharge_summary_hash "0000000000000000000000000000000000000000000000000000000000000002"
```

## 📊 Function Overview

| Function | Purpose | Returns |
|----------|---------|---------|
| initiate_discharge_planning | Start new discharge plan | Plan ID (u64) |
| assess_discharge_readiness | Evaluate patient readiness | ReadinessScore |
| create_discharge_orders | Create orders | () |
| arrange_home_health | Arrange home health | () |
| order_dme_for_discharge | Order equipment | () |
| schedule_followup_appointments | Schedule appointments | Vec<u64> |
| provide_discharge_education | Track education | () |
| coordinate_with_snf | Coordinate SNF transfer | () |
| complete_discharge | Finalize discharge | () |
| track_readmission_risk | Track risk factors | () |

## 🔢 Code Reference

### Discharge Destinations
- 0 = Home
- 1 = Skilled Nursing Facility (SNF)
- 2 = Rehabilitation Facility
- 3 = Other

### Service Types (Home Health)
- 0 = Nursing
- 1 = Physical Therapy (PT)
- 2 = Occupational Therapy (OT)
- 3 = Speech Therapy

### Equipment Types (DME)
- 0 = Walker
- 1 = Wheelchair
- 2 = Oxygen Concentrator
- 3 = Hospital Bed

### Order Types
- 0 = Medication
- 1 = DME
- 2 = Home Health
- 3 = Lab

### Education Topics
- 0 = Medications
- 1 = Wound Care
- 2 = Diet & Nutrition
- 3 = Activity Restrictions

### Appointment Specialties
- 0 = Primary Care
- 1 = Cardiology
- 2 = Surgery
- 3 = Other

### Risk Factors (Bitmap)
- 1 = Multiple Comorbidities
- 2 = Poor Social Support
- 4 = Medication Non-Compliance
- 8 = Recent Readmission

## 🧪 Testing

```bash
# Run all tests
cargo test

# Run specific test
cargo test test_full_discharge_workflow

# Run with output
cargo test -- --nocapture
```

## 📖 Full Documentation

- **README.md** - Complete user guide
- **DEPLOYMENT_GUIDE.md** - Detailed deployment instructions
- **IMPLEMENTATION_SUMMARY.md** - Technical implementation details

## 🆘 Troubleshooting

### Build fails with "can't find crate for `core`"
```bash
rustup target add wasm32-unknown-unknown
```

### "dlltool.exe not found" during tests
This is a Windows-specific issue. The WASM build still succeeds. To run tests, install MinGW-w64 or use WSL.

### Contract deployment fails
- Ensure you have testnet XLM: `soroban keys fund alice --network testnet`
- Check network connectivity
- Verify contract WASM exists

## 💡 Tips

1. **Use testnet first** - Always test on testnet before mainnet
2. **Save contract ID** - Store the deployed contract ID securely
3. **Monitor events** - Use Horizon API to track contract events
4. **Validate inputs** - All scores must be 0-100, dates must be valid
5. **Check readiness** - Assess readiness before completing discharge

## 🔗 Resources

- [Soroban Documentation](https://soroban.stellar.org/docs)
- [Stellar SDK](https://github.com/stellar/js-stellar-sdk)
- [Horizon API](https://developers.stellar.org/api)

## 📞 Support

For issues or questions, refer to:
- Contract source code in `src/`
- Test examples in `src/test.rs`
- Full documentation in README.md

---

**Ready to deploy?** Follow the steps above and you'll have a working discharge management system on Stellar in minutes! 🎉
