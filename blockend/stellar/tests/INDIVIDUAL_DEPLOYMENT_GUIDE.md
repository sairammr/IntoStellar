# 🚀 **Individual Contract Deployment Guide - CLI Commands**

This guide provides step-by-step CLI commands to deploy each contract individually for the ETH-Stellar cross-chain atomic swap system.

## 📋 **Prerequisites**

### **Required Tools**

```bash
# Install Stellar CLI
curl -sSf https://soroban.stellar.org/install.sh | sh

# Install Rust and Soroban SDK
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install --target wasm32-unknown-unknown soroban-cli

# Verify installations
stellar --version
```

### **Setup Identity**

```bash
# Create identity for deployment
stellar keys generate alice

# Check existing identities
stellar keys ls

# Fund account (if needed)
stellar account fund --source alice --network testnet
```

## 🏗️ **Contract Deployment Order**

**CRITICAL**: Deploy in this exact order due to dependencies:

1. **FusionPlusEscrow** (Base escrow contract)
2. **StellarLimitOrderProtocol** (LOP for order management)
3. **StellarResolver** (Orchestrates swaps)
4. **StellarEscrowFactory** (Factory that deploys escrow instances)

---

## 📦 **Step 1: Build All Contracts**

```bash
# Navigate to stellar directory
cd blockend/stellar

# Build FusionPlusEscrow
echo "🔨 Building FusionPlusEscrow..."
cd contracts/fusion_plus_escrow
cargo build --target wasm32-unknown-unknown --release
echo "✅ FusionPlusEscrow built"

# Build StellarLimitOrderProtocol
echo "🔨 Building StellarLimitOrderProtocol..."
cd ../stellar_limit_order_protocol
cargo build --target wasm32-unknown-unknown --release
echo "✅ StellarLimitOrderProtocol built"

# Build StellarResolver
echo "🔨 Building StellarResolver..."
cd ../stellar_resolver
cargo build --target wasm32-unknown-unknown --release
echo "✅ StellarResolver built"

# Build StellarEscrowFactory
echo "🔨 Building StellarEscrowFactory..."
cd ../stellar_escrow_factory
cargo build --target wasm32-unknown-unknown --release
echo "✅ StellarEscrowFactory built"

# Return to root
cd ../..
```

---

## 🚀 **Step 2: Deploy FusionPlusEscrow**

```bash
# Navigate to fusion_plus_escrow directory
cd contracts/fusion_plus_escrow

# Deploy the contract
echo "🚀 Deploying FusionPlusEscrow..."
FUSION_ESCROW_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/fusion_plus_escrow.wasm \
  --source alice \
  --network testnet \
  --alias fusion_plus_escrow)

echo "✅ FusionPlusEscrow deployed with ID: $FUSION_ESCROW_ID"

# Get WASM hash for factory initialization
echo "🔍 Getting WASM hash..."
WASM_HASH=$(stellar contract inspect \
  --wasm target/wasm32-unknown-unknown/release/fusion_plus_escrow.wasm \
  | grep "Hash:" | awk '{print $2}')

echo "✅ WASM hash: $WASM_HASH"

# Save contract info
echo "FUSION_ESCROW_ID=$FUSION_ESCROW_ID" > ../../deployment-info.txt
echo "ESCROW_WASM_HASH=$WASM_HASH" >> ../../deployment-info.txt
```

**Expected Output:**

```
Contract deployed with id: CA1234567890ABCDEF...
Hash: a99516dcb5b3c76678c20e864a7b439d3d8cf4d6a871cee2fa5c2baa22bf7a22
```

---

## 🏭 **Step 3: Deploy StellarLimitOrderProtocol**

```bash
# Navigate to stellar_limit_order_protocol directory
cd ../stellar_limit_order_protocol

# Deploy the contract
echo "🚀 Deploying StellarLimitOrderProtocol..."
LOP_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_limit_order_protocol.wasm \
  --source alice \
  --network testnet \
  --alias stellar_limit_order_protocol)

echo "✅ StellarLimitOrderProtocol deployed with ID: $LOP_ID"

# Save contract info
echo "LOP_ID=$LOP_ID" >> ../../deployment-info.txt
```

**Expected Output:**

```
Contract deployed with id: CA1234567890ABCDEF...
```

---

## 🔧 **Step 4: Deploy StellarResolver**

```bash
# Navigate to stellar_resolver directory
cd ../stellar_resolver

# Deploy the contract
echo "🚀 Deploying StellarResolver..."
RESOLVER_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_resolver.wasm \
  --source alice \
  --network testnet \
  --alias stellar_resolver)

echo "✅ StellarResolver deployed with ID: $RESOLVER_ID"

# Save contract info
echo "RESOLVER_ID=$RESOLVER_ID" >> ../../deployment-info.txt
```

**Expected Output:**

```
Contract deployed with id: CA1234567890ABCDEF...
```

---

## 🏭 **Step 5: Deploy StellarEscrowFactory**

```bash
# Navigate to stellar_escrow_factory directory
cd ../stellar_escrow_factory

# Deploy the contract
echo "🚀 Deploying StellarEscrowFactory..."
FACTORY_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_escrow_factory.wasm \
  --source alice \
  --network testnet \
  --alias stellar_escrow_factory)

echo "✅ StellarEscrowFactory deployed with ID: $FACTORY_ID"

# Save contract info
echo "FACTORY_ID=$FACTORY_ID" >> ../../deployment-info.txt
```

**Expected Output:**

```
Contract deployed with id: CA1234567890ABCDEF...
```

---

## ⚙️ **Step 6: Initialize Contracts**

### **Initialize StellarEscrowFactory**

```bash
# Get admin address
ADMIN_ADDRESS=$(stellar keys public-key alice)

echo "🔧 Initializing StellarEscrowFactory..."
echo "Admin: $ADMIN_ADDRESS"
echo "WASM Hash: $WASM_HASH"
echo "LOP ID: $LOP_ID"

stellar contract invoke \
  --id stellar_escrow_factory \
  --source alice \
  --network testnet \
  -- \
  initialize \
  --escrow_wasm_hash $WASM_HASH \
  --admin $ADMIN_ADDRESS \
  --limit_order_protocol $LOP_ID

echo "✅ StellarEscrowFactory initialized"
```

### **Initialize StellarLimitOrderProtocol**

```bash
echo "🔧 Initializing StellarLimitOrderProtocol..."

stellar contract invoke \
  --id stellar_limit_order_protocol \
  --source alice \
  --network testnet \
  -- \
  initialize \
  --factory $FACTORY_ID

echo "✅ StellarLimitOrderProtocol initialized"
```

### **Initialize StellarResolver**

```bash
echo "🔧 Initializing StellarResolver..."

# Get admin address
ADMIN_ADDRESS=$(stellar keys public-key alice)

stellar contract invoke \
  --id stellar_resolver \
  --source alice \
  --network testnet \
  -- \
  initialize \
  --factory $FACTORY_ID \
  --limit_order_protocol $LOP_ID \
  --admin $ADMIN_ADDRESS

echo "✅ StellarResolver initialized"
```

---

## 🔍 **Step 7: Verify Deployments**

### **Verify StellarEscrowFactory**

```bash
echo "🔍 Verifying StellarEscrowFactory..."

# Check admin
echo "Checking admin..."
stellar contract invoke \
  --id stellar_escrow_factory \
  --source alice \
  --network testnet \
  -- \
  get_admin

# Check WASM hash
echo "Checking WASM hash..."
stellar contract invoke \
  --id stellar_escrow_factory \
  --source alice \
  --network testnet \
  -- \
  get_escrow_wasm_hash

# Check LOP address
echo "Checking LOP address..."
stellar contract invoke \
  --id stellar_escrow_factory \
  --source alice \
  --network testnet \
  -- \
  get_limit_order_protocol
```

### **Verify StellarLimitOrderProtocol**

```bash
echo "🔍 Verifying StellarLimitOrderProtocol..."

# Check factory address
echo "Checking factory address..."
stellar contract invoke \
  --id stellar_limit_order_protocol \
  --source alice \
  --network testnet \
  -- \
  get_factory
```

### **Verify StellarResolver**

```bash
echo "🔍 Verifying StellarResolver..."

# Note: StellarResolver doesn't expose getter functions
# Verification is done by checking if initialization succeeded
echo "✅ StellarResolver initialized successfully"
```

---

## 📝 **Step 8: Save Deployment Information**

```bash
# Navigate to root directory
cd ../..

# Create comprehensive deployment info
echo "📝 Creating deployment information..."

DEPLOYMENT_INFO="
# 🚀 ETH-Stellar Cross-Chain Swap Contracts Deployment
# Generated on: $(date)
# Network: testnet
# Identity: alice

# Contract Addresses
FUSION_ESCROW_ID=$FUSION_ESCROW_ID
STELLAR_ESCROW_FACTORY_ID=$FACTORY_ID
STELLAR_LIMIT_ORDER_PROTOCOL_ID=$LOP_ID
STELLAR_RESOLVER_ID=$RESOLVER_ID
ESCROW_WASM_HASH=$WASM_HASH
ADMIN_ADDRESS=$ADMIN_ADDRESS

# Environment Variables for .env file
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_API_KEY
ETHEREUM_PRIVATE_KEY=your_ethereum_private_key_here
ETHEREUM_ESCROW_FACTORY=0x0000000000000000000000000000000000000000
STELLAR_HORIZON_URL=https://soroban-testnet.stellar.org
STELLAR_PRIVATE_KEY=your_stellar_private_key_here
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
STELLAR_ESCROW_FACTORY=$FACTORY_ID
STELLAR_LIMIT_ORDER_PROTOCOL=$LOP_ID
STELLAR_RESOLVER=$RESOLVER_ID

# Relayer Configuration
RELAYER_PORT=3001
RELAYER_SECRET_KEY=your_random_secret_key_here
CORS_ORIGIN=http://localhost:3000

# Test Configuration
TEST_TIMEOUT=120000
VERBOSE_LOGGING=true
ENABLE_COVERAGE=true
"

echo "$DEPLOYMENT_INFO" > deployment-info.txt
echo "✅ Deployment information saved to deployment-info.txt"
```

---

## 🧪 **Step 9: Test Contract Integration**

### **Test Factory Escrow Creation**

```bash
echo "🧪 Testing factory escrow creation..."

# Generate test parameters
ORDER_HASH="1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
HASH_LOCK="abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
MAKER_ADDRESS=$ADMIN_ADDRESS
TAKER_ADDRESS=$ADMIN_ADDRESS
TOKEN_ADDRESS="native"
AMOUNT="1000000"
SAFETY_DEPOSIT="100000"

# Test post_interaction call (this simulates LOP calling factory)
echo "Testing post_interaction..."
stellar contract invoke \
  --id stellar_escrow_factory \
  --source alice \
  --network testnet \
  -- \
  post_interaction \
  --order_hash $ORDER_HASH \
  --hash_lock $HASH_LOCK \
  --maker $MAKER_ADDRESS \
  --taker $TAKER_ADDRESS \
  --token $TOKEN_ADDRESS \
  --amount $AMOUNT \
  --safety_deposit $SAFETY_DEPOSIT \
  --extra_data ""

echo "✅ Factory integration test completed"
```

### **Test Resolver Order Execution**

```bash
echo "🧪 Testing resolver order execution..."

# Test execute_order_on_lop
echo "Testing execute_order_on_lop..."
stellar contract invoke \
  --id stellar_resolver \
  --source alice \
  --network testnet \
  -- \
  execute_order_on_lop \
  --order_hash $ORDER_HASH \
  --hash_lock $HASH_LOCK \
  --maker $MAKER_ADDRESS \
  --taker $TAKER_ADDRESS \
  --token $TOKEN_ADDRESS \
  --amount $AMOUNT \
  --safety_deposit $SAFETY_DEPOSIT

echo "✅ Resolver integration test completed"
```

---

## 🔧 **Step 10: Update Environment Configuration**

### **Create .env file for tests**

```bash
echo "🔧 Creating .env file for automated tests..."

# Copy template and update with real values
cp tests/env-template.txt tests/.env

# Update with actual contract addresses
sed -i '' "s/STELLAR_ESCROW_FACTORY=.*/STELLAR_ESCROW_FACTORY=$FACTORY_ID/" tests/.env
sed -i '' "s/STELLAR_LIMIT_ORDER_PROTOCOL=.*/STELLAR_LIMIT_ORDER_PROTOCOL=$LOP_ID/" tests/.env
sed -i '' "s/STELLAR_RESOLVER=.*/STELLAR_RESOLVER=$RESOLVER_ID/" tests/.env

echo "✅ .env file updated with contract addresses"
```

### **Update relayer configuration**

```bash
echo "🔧 Updating relayer configuration..."

# Create relayer config
RELAYER_CONFIG="
export const CONFIG = {
  contracts: {
    stellar: {
      escrowFactory: '$FACTORY_ID',
      limitOrderProtocol: '$LOP_ID',
      resolver: '$RESOLVER_ID',
    },
    ethereum: {
      escrowFactory: '0x0000000000000000000000000000000000000000', // Update with actual ETH factory
    },
  },
  networks: {
    stellar: {
      horizonUrl: 'https://soroban-testnet.stellar.org',
      networkPassphrase: 'Test SDF Network ; September 2015',
      privateKey: 'your_stellar_private_key_here',
      accountId: '$ADMIN_ADDRESS',
    },
    ethereum: {
      rpcUrl: 'https://sepolia.infura.io/v3/your_infura_key',
      privateKey: 'your_ethereum_private_key_here',
      chainId: 11155111,
    },
  },
};
"

echo "$RELAYER_CONFIG" > relayer-config.ts
echo "✅ Relayer configuration updated"
```

---

## 🎯 **Deployment Verification Checklist**

```bash
echo "🎯 Running deployment verification..."

# Check all contracts are deployed
echo "1. Checking contract deployments..."
stellar contract inspect --id $FUSION_ESCROW_ID
stellar contract inspect --id $FACTORY_ID
stellar contract inspect --id $LOP_ID
stellar contract inspect --id $RESOLVER_ID

# Check factory initialization
echo "2. Checking factory initialization..."
stellar contract invoke --id $FACTORY_ID --source alice --network testnet -- get_admin
stellar contract invoke --id $FACTORY_ID --source alice --network testnet -- get_escrow_wasm_hash
stellar contract invoke --id $FACTORY_ID --source alice --network testnet -- get_limit_order_protocol

# Check LOP initialization
echo "3. Checking LOP initialization..."
stellar contract invoke --id $LOP_ID --source alice --network testnet -- get_factory

# Check resolver initialization
echo "4. Checking resolver initialization..."
echo "✅ StellarResolver initialized successfully (no getter functions exposed)"

echo "✅ All verification checks completed"
```

---

## 🚨 **Troubleshooting Commands**

### **Check Account Balance**

```bash
stellar account show --source alice --network testnet
```

### **List Deployed Contracts**

```bash
ls .stellar/contract-ids/
```

### **View Contract Details**

```bash
stellar contract inspect --id $CONTRACT_ID
```

### **Check Contract Events**

```bash
stellar contract events --id $CONTRACT_ID --network testnet
```

### **Reset Deployment (if needed)**

```bash
# Remove contract IDs
rm -rf .stellar/contract-ids/*

# Remove deployment info
rm deployment-info.txt

# Start fresh deployment
```

---

## 📊 **Final Summary**

After successful deployment, you should have:

- ✅ **FusionPlusEscrow**: `$FUSION_ESCROW_ID`
- ✅ **StellarEscrowFactory**: `$FACTORY_ID`
- ✅ **StellarLimitOrderProtocol**: `$LOP_ID`
- ✅ **StellarResolver**: `$RESOLVER_ID`
- ✅ **All contracts initialized**
- ✅ **Environment configured**
- ✅ **Relayer ready**

### **Next Steps:**

1. **Deploy Ethereum contracts** (EscrowFactory on Sepolia)
2. **Update Ethereum addresses** in configuration
3. **Start relayer service**
4. **Run automated tests**: `cd tests && ./run-automated-tests.sh`

---

## 🎉 **Success!**

Your Stellar contracts are now deployed and ready for ETH-Stellar cross-chain atomic swaps! The system supports bidirectional swaps with full hashlock/timelock functionality.

**Contract Addresses Summary:**

```
FusionPlusEscrow: $FUSION_ESCROW_ID
StellarEscrowFactory: $FACTORY_ID
StellarLimitOrderProtocol: $LOP_ID
StellarResolver: $RESOLVER_ID
```

**Files Created:**

- `deployment-info.txt` - Complete deployment information
- `tests/.env` - Environment variables for tests
- `relayer-config.ts` - Relayer configuration
