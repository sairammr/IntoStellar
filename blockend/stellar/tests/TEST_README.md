# 🧪 Cross-Chain Atomic Swap Test Suite

This directory contains comprehensive tests for the cross-chain atomic swap functionality, mirroring the structure and approach of the EVM `main.spec.ts` tests.

## 📁 Test Files

### 1. `test_swap_functionality.rs`

**Comprehensive Rust test suite** that deploys contracts and tests the complete swap flow.

**Features:**

- ✅ Complete cross-chain atomic swap simulation
- ✅ Failed swap scenario testing
- ✅ Public withdrawal and cancellation testing
- ✅ Multiple escrow testing
- ✅ Event emission verification
- ✅ Error handling validation

**Test Functions:**

- `test_cross_chain_atomic_swap()` - Full swap flow simulation
- `test_failed_swap_scenarios()` - Invalid secret and double withdrawal tests
- `test_public_operations()` - Public withdrawal and cancellation tests
- `test_multiple_escrows()` - Multiple escrow creation and verification

### 2. `run_swap_tests.sh`

**Automated bash script** that deploys contracts and tests functionality using the Stellar CLI.

**Features:**

- ✅ Automated contract deployment
- ✅ Factory initialization
- ✅ Escrow creation (source and destination)
- ✅ Basic functionality testing
- ✅ Interactive contract calls
- ✅ Comprehensive status reporting

## 🚀 Quick Start

### Prerequisites

1. **Stellar CLI** installed and configured
2. **Rust toolchain** with `wasm32-unknown-unknown` target
3. **Identity** created (e.g., `alice`)

### Running the Tests

#### Option 1: Automated Script (Recommended)

```bash
# Make script executable
chmod +x run_swap_tests.sh

# Run comprehensive tests
./run_swap_tests.sh
```

#### Option 2: Rust Test Suite

```bash
# Build and run the test binary
cargo run --bin test_swap_functionality
```

#### Option 3: Individual Contract Tests

```bash
# Test factory contract
cd contracts/stellar_escrow_factory
cargo test --lib

# Test escrow contract
cd ../fusion_plus_escrow
cargo test --lib
```

## 📋 Test Flow

### Phase 1: Setup & Deployment

1. **Build contracts** for WASM target
2. **Deploy FusionPlusEscrow** contract
3. **Deploy StellarEscrowFactory** contract
4. **Initialize factory** with WASM hash and admin

### Phase 2: Swap Initiation

1. **Create source escrow** (simulating Ethereum side)
2. **Create destination escrow** (Stellar side)
3. **Verify escrow creation** and tracking

### Phase 3: Escrow Interaction

1. **Test deposit functionality**
2. **Test withdrawal with valid secret**
3. **Test secret revelation**
4. **Verify escrow states**

### Phase 4: Verification

1. **Check both escrows are withdrawn**
2. **Verify different contract addresses**
3. **Confirm factory tracking**

## 🧪 Test Scenarios

### ✅ Success Scenarios

- **Complete swap flow** - Full cross-chain atomic swap
- **Multiple escrows** - Factory handling multiple swaps
- **Public operations** - Public withdrawal and cancellation
- **Secret revelation** - Proper secret handling

### ❌ Failure Scenarios

- **Invalid secret** - Rejection of wrong secrets
- **Double withdrawal** - Prevention of duplicate withdrawals
- **Unauthorized access** - Proper access control
- **Invalid parameters** - Parameter validation

## 📊 Expected Output

### Successful Test Run

```
🧪 Starting Comprehensive Cross-Chain Atomic Swap Tests
==================================================
[INFO] Using identity: alice
[INFO] Network: testnet

📦 Step 1: Building contracts...
[SUCCESS] FusionPlusEscrow built successfully
[SUCCESS] StellarEscrowFactory built successfully

🚀 Step 2: Deploying contracts...
[SUCCESS] FusionPlusEscrow deployed with ID: CDNUQ6MGPSJKUSQNMJL5WCEMZ5SOLXHIYLDDJNZSDVMVUQTLAWCW4ZYW
[SUCCESS] StellarEscrowFactory deployed with ID: CABC123...

⚙️ Step 3: Initializing factory...
[SUCCESS] Factory initialized successfully

🧪 Step 4: Testing basic functionality...
[SUCCESS] Admin retrieval successful
[SUCCESS] WASM hash retrieval successful

🔄 Step 5: Testing escrow creation...
[SUCCESS] Source escrow created successfully
[SUCCESS] Destination escrow created successfully

🔍 Step 6: Testing escrow verification...
[SUCCESS] Escrow existence check: true
[SUCCESS] Escrow address: CXYZ789...

💼 Step 7: Testing escrow interactions...
[SUCCESS] Escrow deposit successful
[SUCCESS] Withdrawn status: false
[SUCCESS] Cancelled status: false

📊 Step 8: Test Summary
==================================================
✅ All tests completed successfully!

🎉 Cross-chain atomic swap functionality is ready for integration!
```

## 🔧 Configuration

### Environment Variables

- `NETWORK` - Stellar network (testnet/mainnet)
- `IDENTITY` - Stellar CLI identity to use

### Test Parameters

- **Timelocks** - Short durations for testing (10-80 seconds)
- **Amounts** - 1,000,000 units (1 token with 6 decimals)
- **Safety deposits** - 100,000 units (0.1 token)

## 🐛 Troubleshooting

### Common Issues

1. **"Identity not found"**

   ```bash
   stellar keys generate alice
   ```

2. **"WASM target not found"**

   ```bash
   rustup target add wasm32-unknown-unknown
   ```

3. **"Contract deployment failed"**

   - Check network connectivity
   - Verify identity has sufficient XLM
   - Ensure contracts compile successfully

4. **"Function call failed"**
   - Check parameter types and values
   - Verify contract initialization
   - Review error messages for specific issues

### Debug Mode

```bash
# Enable verbose output
RUST_LOG=debug cargo run --bin test_swap_functionality

# Check contract state
stellar contract invoke --id <CONTRACT_ID> --source-account alice --network testnet -- get_admin
```

## 📈 Performance Metrics

### Test Execution Times

- **Build time**: ~30-60 seconds
- **Deployment time**: ~10-20 seconds per contract
- **Test execution**: ~30-60 seconds
- **Total time**: ~2-3 minutes

### Gas Usage (Estimated)

- **FusionPlusEscrow deployment**: ~50,000 operations
- **StellarEscrowFactory deployment**: ~30,000 operations
- **Escrow creation**: ~20,000 operations per escrow
- **Withdrawal**: ~15,000 operations

## 🔗 Integration

### With Relayer Service

The test suite validates the contract interfaces that the relayer service will use:

1. **Event monitoring** - Factory events for escrow creation
2. **Secret management** - Proper secret revelation and distribution
3. **Timelock validation** - 7-stage timelock system
4. **Cross-chain coordination** - Bidirectional swap support

### With EVM Side

The tests mirror the EVM `main.spec.ts` structure:

- **Similar test phases** - Setup, deployment, interaction, verification
- **Equivalent functionality** - Escrow creation, withdrawal, cancellation
- **Matching parameters** - Timelocks, amounts, addresses
- **Same validation** - State verification, error handling

## 📚 Additional Resources

- [Stellar CLI Documentation](https://developers.stellar.org/docs/tools/developer-tools)
- [Soroban Testing Guide](https://developers.stellar.org/docs/soroban/learn/testing)
- [EVM Test Reference](../evm/tests/main.spec.ts)
- [Contract Documentation](./contracts/)

---

**🎯 Goal**: Validate that the Stellar contracts provide the same functionality as the EVM contracts, enabling seamless cross-chain atomic swaps through the relayer service.
