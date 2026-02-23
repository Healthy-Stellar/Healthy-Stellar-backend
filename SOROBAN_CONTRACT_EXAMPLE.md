# Example Soroban Contract for Record Anchoring

This is a reference implementation of a Soroban smart contract that can be used with the Records module.

## Contract Code (Rust)

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, Env, String, Symbol, symbol_short};

#[contract]
pub struct RecordAnchor;

#[contractimpl]
impl RecordAnchor {
    /// Anchor a medical record CID to a patient ID
    /// 
    /// # Arguments
    /// * `env` - The contract environment
    /// * `patient_id` - The patient identifier
    /// * `cid` - The IPFS Content Identifier
    /// 
    /// # Returns
    /// * `Result<(), Error>` - Success or error
    pub fn anchor_record(
        env: Env,
        patient_id: String,
        cid: String,
    ) -> Result<(), Error> {
        // Create a storage key from patient_id
        let key = Symbol::new(&env, &patient_id);
        
        // Store the CID mapping
        env.storage().instance().set(&key, &cid);
        
        // Emit an event for indexing
        env.events().publish(
            (symbol_short!("anchor"), patient_id.clone()),
            cid.clone()
        );
        
        Ok(())
    }
    
    /// Retrieve the CID for a given patient ID
    /// 
    /// # Arguments
    /// * `env` - The contract environment
    /// * `patient_id` - The patient identifier
    /// 
    /// # Returns
    /// * `Option<String>` - The CID if found, None otherwise
    pub fn get_record(
        env: Env,
        patient_id: String,
    ) -> Option<String> {
        let key = Symbol::new(&env, &patient_id);
        env.storage().instance().get(&key)
    }
    
    /// Check if a record exists for a patient
    /// 
    /// # Arguments
    /// * `env` - The contract environment
    /// * `patient_id` - The patient identifier
    /// 
    /// # Returns
    /// * `bool` - True if record exists, false otherwise
    pub fn has_record(
        env: Env,
        patient_id: String,
    ) -> bool {
        let key = Symbol::new(&env, &patient_id);
        env.storage().instance().has(&key)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Events, Env, String};

    #[test]
    fn test_anchor_record() {
        let env = Env::default();
        let contract_id = env.register_contract(None, RecordAnchor);
        let client = RecordAnchorClient::new(&env, &contract_id);

        let patient_id = String::from_str(&env, "patient-123");
        let cid = String::from_str(&env, "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco");

        // Anchor the record
        client.anchor_record(&patient_id, &cid);

        // Verify it was stored
        assert_eq!(client.get_record(&patient_id), Some(cid.clone()));
        assert!(client.has_record(&patient_id));
    }
}
```

## Building the Contract

### Prerequisites
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Stellar CLI
cargo install --locked stellar-cli

# Add wasm target
rustup target add wasm32-unknown-unknown
```

### Build Steps

1. Create a new Soroban project:
```bash
stellar contract init record-anchor
cd record-anchor
```

2. Replace `src/lib.rs` with the contract code above

3. Build the contract:
```bash
stellar contract build
```

4. Deploy to testnet:
```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/record_anchor.wasm \
  --source YOUR_SECRET_KEY \
  --network testnet
```

5. Save the contract ID to your `.env` file:
```env
STELLAR_CONTRACT_ID=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

## Contract Methods

### anchor_record(patient_id: String, cid: String)
Stores the IPFS CID for a given patient ID.

**Parameters:**
- `patient_id`: Unique patient identifier
- `cid`: IPFS Content Identifier

**Returns:** Success or error

**Example:**
```typescript
// Called automatically by StellarService
await stellarService.anchorCid('patient-123', 'QmXxx...');
```

### get_record(patient_id: String)
Retrieves the CID for a given patient ID.

**Parameters:**
- `patient_id`: Unique patient identifier

**Returns:** CID string or None

### has_record(patient_id: String)
Checks if a record exists for a patient.

**Parameters:**
- `patient_id`: Unique patient identifier

**Returns:** Boolean

## Testing the Contract

```bash
# Run contract tests
cargo test

# Invoke contract on testnet
stellar contract invoke \
  --id YOUR_CONTRACT_ID \
  --source YOUR_SECRET_KEY \
  --network testnet \
  -- \
  anchor_record \
  --patient_id "patient-123" \
  --cid "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco"
```

## Advanced Features (Optional)

### Access Control
```rust
pub fn anchor_record(
    env: Env,
    caller: Address,
    patient_id: String,
    cid: String,
) -> Result<(), Error> {
    // Verify caller is authorized
    caller.require_auth();
    
    // Check if caller has permission
    if !is_authorized(&env, &caller, &patient_id) {
        return Err(Error::Unauthorized);
    }
    
    // ... rest of implementation
}
```

### Versioning
```rust
pub fn anchor_record_version(
    env: Env,
    patient_id: String,
    cid: String,
    version: u32,
) -> Result<(), Error> {
    let key = (patient_id.clone(), version);
    env.storage().instance().set(&key, &cid);
    Ok(())
}
```

### Expiration
```rust
pub fn anchor_record_with_expiry(
    env: Env,
    patient_id: String,
    cid: String,
    expiry_ledger: u32,
) -> Result<(), Error> {
    let key = Symbol::new(&env, &patient_id);
    env.storage().instance().set(&key, &cid);
    env.storage().instance().extend_ttl(&key, expiry_ledger, expiry_ledger);
    Ok(())
}
```

## Resources

- [Soroban Documentation](https://soroban.stellar.org/)
- [Stellar CLI Guide](https://developers.stellar.org/docs/tools/developer-tools)
- [Soroban Examples](https://github.com/stellar/soroban-examples)
- [Rust SDK Documentation](https://docs.rs/soroban-sdk/)

## Notes

- This is a simplified example for demonstration purposes
- Production contracts should include proper access control
- Consider implementing versioning for record updates
- Add event emission for better indexing and monitoring
- Implement proper error handling and validation
- Consider gas optimization for production use
