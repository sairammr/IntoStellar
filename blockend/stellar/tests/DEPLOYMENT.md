# 🚀 **Stellar Contracts Deployment Guide**

This guide walks you through deploying the Fusion+ cross-chain atomic swap contracts to Stellar Testnet.

## 📋 **Prerequisites**

- ✅ Stellar CLI installed and configured
- ✅ Identity configured (e.g., `alice`)
- ✅ Network configured for Testnet
- ✅ Rust and Soroban SDK installed

## 🏗️ **Deployment Order**

The contracts must be deployed in this specific order due to dependencies:

1. **FusionPlusEscrow** (Base escrow contract)
2. **StellarEscrowFactory** (Factory that deploys escrow instances)

## 📦 **Step 1: Build Contracts**

First, build both contracts to generate the WASM files:

```bash
# Build FusionPlusEscrow
cd contracts/fusion_plus_escrow
cargo build --target wasm32-unknown-unknown --release

# Build StellarEscrowFactory
cd ../stellar_escrow_factory
cargo build --target wasm32-unknown-unknown --release
```

## 🚀 **Step 2: Deploy FusionPlusEscrow**

Deploy the base escrow contract first:

```bash
# Navigate to fusion_plus_escrow directory
cd blockend/stellar/contracts/fusion_plus_escrow

# Deploy the contract
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/fusion_plus_escrow.wasm \
  --source alice \
  --network testnet \
  --alias fusion_plus_escrow
```

**Expected Output:**

```
Contract deployed with id: C[CONTRACT_ID_HERE]
```

**Save this contract ID** - you'll need it for the factory deployment.

## 🏭 **Step 3: Deploy StellarEscrowFactory**

Now deploy the factory contract with the escrow contract ID:

```bash
# Navigate to stellar_escrow_factory directory
cd ../stellar_escrow_factory

# Deploy the factory contract
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_escrow_factory.wasm \
  --source alice \
  --network testnet \
  --alias stellar_escrow_factory
```

**Expected Output:**

```
Contract deployed with id: C[FACTORY_CONTRACT_ID_HERE]
```

## ⚙️ **Step 4: Initialize StellarEscrowFactory**

The factory needs to be initialized with the escrow contract's WASM hash:

```bash
# Get the WASM hash of the FusionPlusEscrow contract
cd ../fusion_plus_escrow
stellar contract inspect \
  --wasm target/wasm32-unknown-unknown/release/fusion_plus_escrow.wasm

# Initialize the factory with the escrow WASM hash and admin address
stellar contract invoke \
  --id stellar_escrow_factory \
  --source alice \
  --network testnet \
  -- \
  initialize \
  --escrow_wasm_hash [WASM_HASH_FROM_INSPECT] \
  --admin [YOUR_ADMIN_ADDRESS]
```

**Replace:**

- `[WASM_HASH_FROM_INSPECT]` with the hash from the inspect command
- `[YOUR_ADMIN_ADDRESS]` with your Stellar account address

## 🧪 **Step 5: Test Contract Deployment**

Test that the factory can create escrow instances:

```bash
# Test creating a source escrow (this will fail without proper parameters, but tests the contract)
stellar contract invoke \
  --id stellar_escrow_factory \
  --source alice \
  --network testnet \
  -- \
  create_src_escrow \
  --order_hash [32_BYTE_HEX] \
  --hash_lock [32_BYTE_HEX] \
  --maker [MAKER_ADDRESS] \
  --taker [TAKER_ADDRESS] \
  --token [TOKEN_ADDRESS] \
  --amount 1000000 \
  --safety_deposit 100000 \
  --timelocks [TIMELOCK_PARAMS]
```

## 📝 **Step 6: Update Relayer Configuration**

Update your relayer service configuration with the deployed contract addresses:

```typescript
// In relayer-service/src/config/Config.ts or .env file
export const CONFIG = {
  contracts: {
    stellar: {
      escrowFactory: "C[FACTORY_CONTRACT_ID_HERE]", // From Step 3
    },
    ethereum: {
      escrowFactory: "0x[ETHEREUM_FACTORY_ADDRESS]", // Your Ethereum factory
    },
  },
  networks: {
    stellar: {
      horizonUrl: "https://horizon-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
      privateKey: "[YOUR_STELLAR_PRIVATE_KEY]",
      accountId: "[YOUR_STELLAR_ACCOUNT_ID]",
    },
    ethereum: {
      rpcUrl: "https://sepolia.infura.io/v3/[YOUR_INFURA_KEY]",
      privateKey: "[YOUR_ETHEREUM_PRIVATE_KEY]",
      chainId: 11155111, // Sepolia
    },
  },
};
```

## 🔍 **Step 7: Verify Deployment**

Verify both contracts are properly deployed and initialized:

```bash
# Check factory initialization status
stellar contract invoke \
  --id stellar_escrow_factory \
  --source alice \
  --network testnet \
  -- \
  get_admin

# Check factory escrow WASM hash
stellar contract invoke \
  --id stellar_escrow_factory \
  --source alice \
  --network testnet \
  -- \
  get_escrow_wasm_hash
```

## 🎯 **Deployment Checklist**

- [ ] FusionPlusEscrow contract deployed
- [ ] StellarEscrowFactory contract deployed
- [ ] Factory initialized with escrow WASM hash
- [ ] Admin address set correctly
- [ ] Relayer configuration updated
- [ ] Test escrow creation (optional)

## 🚨 **Important Notes**

### **Contract Dependencies**

- Factory depends on FusionPlusEscrow WASM hash
- Factory must be initialized before use
- Admin address controls factory operations

### **Security Considerations**

- Keep private keys secure
- Use testnet for development
- Verify contract addresses before production

### **Network Configuration**

- **Testnet**: Use for development and testing
- **Mainnet**: Use for production (requires proper security setup)

## 🔧 **Troubleshooting**

### **Common Issues**

1. **"Contract not found"**

   - Verify contract ID is correct
   - Check network configuration

2. **"Not initialized"**

   - Ensure factory is initialized with correct WASM hash
   - Check admin address is set

3. **"Insufficient balance"**
   - Ensure account has sufficient XLM for deployment
   - Check for minimum balance requirements

### **Useful Commands**

```bash
# Check account balance
stellar account show --source alice --network testnet

# List deployed contracts
ls .stellar/contract-ids/

# View contract details
stellar contract inspect --id [CONTRACT_ID]
```

## 📚 **Next Steps**

After successful deployment:

1. **Configure Relayer Service** with contract addresses
2. **Deploy Ethereum Contracts** (EscrowFactory on Sepolia)
3. **Start Relayer Service** to monitor both chains
4. **Test Cross-Chain Swaps** with small amounts

## 🎉 **Success!**

Your Stellar contracts are now deployed and ready for cross-chain atomic swaps! The system supports bidirectional swaps between Ethereum and Stellar networks.
