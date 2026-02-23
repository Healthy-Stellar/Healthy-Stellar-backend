#!/bin/bash

echo "Building Hospital Discharge Management Smart Contract..."

# Build the contract
cargo build --target wasm32-unknown-unknown --release

if [ $? -eq 0 ]; then
    echo "✓ Build successful!"
    echo ""
    echo "WASM output: target/wasm32-unknown-unknown/release/hospital_discharge.wasm"
    echo ""
    echo "Running tests..."
    cargo test
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✓ All tests passed!"
        echo ""
        echo "To deploy:"
        echo "  soroban contract deploy --wasm target/wasm32-unknown-unknown/release/hospital_discharge.wasm --source <YOUR_SECRET_KEY> --rpc-url <RPC_URL> --network-passphrase <NETWORK_PASSPHRASE>"
    else
        echo "✗ Tests failed"
        exit 1
    fi
else
    echo "✗ Build failed"
    exit 1
fi
