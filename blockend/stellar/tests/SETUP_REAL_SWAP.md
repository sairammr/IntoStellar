# 🚀 Real ETH → XLM Cross-Chain Swap Setup Guide

This guide will walk you through setting up a **real, working ETH → XLM cross-chain atomic swap** with actual private keys and real transactions.

## 📋 Prerequisites

### 1. **Development Environment**

```bash
# Required tools
- Node.js (v18+)
- Rust (latest stable)
- Stellar CLI
- MetaMask browser extension
- Git
```

### 2. **API Keys & Accounts**

- **Infura API Key**: https://infura.io/ (free tier)
- **Sepolia Testnet ETH**: https://sepoliafaucet.com/
- **Stellar Testnet XLM**: Automatically funded via CLI

## 🔧 Step-by-Step Setup

### **Step 1: Environment Setup**

#### 1.1 **Clone and Setup Project**

```bash
# Navigate to project root
cd /Users/romariokavin/Documents/PersonalProjects/IntoStellar

# Install dependencies
cd web && npm install
cd ../blockend/stellar/relayer-service && npm install
cd ../../evm && npm install
```

#### 1.2 **Create Environment Files**

**Create `blockend/stellar/relayer-service/.env`:**

```bash
# Ethereum Configuration
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_API_KEY
ETHEREUM_PRIVATE_KEY=
ETHEREUM_ESCROW_FACTORY=0x... # Will be filled after deployment

# Stellar Configuration
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_PRIVATE_KEY=your_stellar_private_key_here
STELLAR_ESCROW_FACTORY= # Will be filled after deployment

# Relayer Configuration
RELAYER_PORT=3001
RELAYER_SECRET_KEY=your_random_secret_key_here
CORS_ORIGIN=http://localhost:3000
```

**Create `blockend/evm/.env`:**

```bash
INFURA_API_KEY=your_infura_api_key_here
PRIVATE_KEY=
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_API_KEY
```

### **Step 2: Deploy Contracts**

#### 2.1 **Deploy Stellar Contracts**

```bash
cd blockend/stellar

# Generate Stellar identity for testing
stellar keys generate eth_xlm_swap
stellar keys fund eth_xlm_swap --network testnet

# Build contracts
cd contracts/fusion_plus_escrow
cargo build --target wasm32-unknown-unknown --release

cd ../stellar_escrow_factory
cargo build --target wasm32-unknown-unknown --release

cd ../../

# Deploy FusionPlusEscrow
FUSION_ESCROW_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/fusion_plus_escrow.wasm \
  --source-account eth_xlm_swap \
  --network testnet \
  --alias fusion_plus_escrow)

echo "FusionPlusEscrow deployed: $FUSION_ESCROW_ID"

# Deploy StellarEscrowFactory
FACTORY_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_escrow_factory.wasm \
  --source-account eth_xlm_swap \
  --network testnet \
  --alias stellar_escrow_factory)

echo "StellarEscrowFactory deployed: $FACTORY_ID"

# Initialize factory
WASM_HASH="a99516dcb5b3c76678c20e864a7b439d3d8cf4d6a871cee2fa5c2baa22bf7a22"
ADMIN_ADDRESS=$(stellar keys public-key eth_xlm_swap)

stellar contract invoke \
  --id stellar_escrow_factory \
  --source-account eth_xlm_swap \
  --network testnet \
  -- \
  initialize \
  --escrow_wasm_hash $WASM_HASH \
  --admin $ADMIN_ADDRESS

# Update relayer .env with Stellar contract addresses
echo "STELLAR_ESCROW_FACTORY=$FACTORY_ID" >> relayer-service/.env
```

#### 2.2 **Deploy Ethereum Contracts**

```bash
cd ../../evm

# Deploy EscrowFactory to Sepolia
npx hardhat run scripts/deploy.js --network sepolia

# Note down the deployed addresses and update relayer .env
echo "ETHEREUM_ESCROW_FACTORY=0x..." >> ../stellar/relayer-service/.env
```

### **Step 3: Configure and Start Relayer**

#### 3.1 **Start Relayer Service**

```bash
cd ../stellar/relayer-service

# Build and start
npm run build
npm start

# Verify it's running
curl http://localhost:3001/health
```

#### 3.2 **Test Relayer API**

```bash
# Test swap creation
curl -X POST http://localhost:3001/api/create-stellar-escrow \
  -H "Content-Type: application/json" \
  -d '{
    "orderHash": "0101010101010101010101010101010101010101010101010101010101010101",
    "secretHash": "ae216c2ef5247a3782c135efa279a3e4cdc61094270f5d2be58c6204b7a612c9",
    "amount": 10000000,
    "maker": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "taker": "GD2RAKWBEOJ3P5YPURRWW6FRAYJYUQ2PH3GX6ITBM5VKML4O5TLAWWXC"
  }'
```

### **Step 4: Start Frontend**

#### 4.1 **Start Web Application**

```bash
cd ../../web

# Start the frontend
npm run dev

# Open http://localhost:3000/testing
```

#### 4.2 **Configure MetaMask**

1. Open MetaMask
2. Add Sepolia testnet network:
   - Network Name: Sepolia
   - RPC URL: https://sepolia.infura.io/v3/YOUR_INFURA_API_KEY
   - Chain ID: 11155111
   - Currency Symbol: ETH
3. Import your private key or create a new account
4. Get Sepolia ETH from faucet

### **Step 5: Execute Real Swap**

#### 5.1 **Prepare Swap Parameters**

1. Open http://localhost:3000/testing
2. Connect MetaMask to Sepolia
3. Generate a secret and hash
4. Set ETH amount (e.g., 0.01) and XLM amount (e.g., 10)

#### 5.2 **Execute Swap Steps**

1. **Deploy Contracts** (one-time setup)
2. **Create ETH Order** (simulates 1inch Fusion+ order)
3. **Create XLM Escrow** (creates Stellar escrow)
4. **Deposit ETH** (locks ETH in Ethereum escrow)
5. **Deposit XLM** (locks XLM in Stellar escrow)
6. **Claim XLM** (reveals secret to claim XLM)
7. **Claim ETH** (uses secret to claim ETH)

## 🔍 Verification Steps

### **Check Contract Deployments**

```bash
# Stellar contracts
stellar contract inspect --id stellar_escrow_factory
stellar contract inspect --id fusion_plus_escrow

# Ethereum contracts (on Etherscan Sepolia)
# https://sepolia.etherscan.io/address/YOUR_CONTRACT_ADDRESS
```

### **Monitor Transactions**

```bash
# Stellar transactions
stellar contract invoke --id stellar_escrow_factory --source-account eth_xlm_swap --network testnet -- get_admin

# Ethereum transactions (on Etherscan)
# Check transaction status and events
```

### **Check Relayer Logs**

```bash
# Monitor relayer service
tail -f relayer-service/logs/relayer.log

# Check API endpoints
curl http://localhost:3001/status
curl http://localhost:3001/api/swap-status/YOUR_ORDER_HASH
```

## 🛠️ Troubleshooting

### **Common Issues**

#### 1. **MetaMask Connection Issues**

```bash
# Ensure MetaMask is connected to Sepolia
# Check if the account has sufficient ETH
# Verify network configuration
```

#### 2. **Stellar Contract Errors**

```bash
# Check if identity has sufficient XLM
stellar keys fund eth_xlm_swap --network testnet

# Verify contract deployment
stellar contract inspect --id stellar_escrow_factory
```

#### 3. **Relayer Service Issues**

```bash
# Check if service is running
curl http://localhost:3001/health

# Check environment variables
cat relayer-service/.env

# Restart service
npm run build && npm start
```

#### 4. **Frontend Issues**

```bash
# Check browser console for errors
# Verify API endpoints are accessible
# Check CORS configuration
```

### **Debug Commands**

```bash
# Test Stellar contract directly
stellar contract invoke --id stellar_escrow_factory --source-account eth_xlm_swap --network testnet -- get_admin

# Test Ethereum contract (using Hardhat)
npx hardhat console --network sepolia

# Check relayer logs
tail -f relayer-service/logs/relayer.log
```

## 📊 Expected Results

### **Successful Swap Flow**

1. ✅ Contracts deployed successfully
2. ✅ Ethereum order created
3. ✅ Stellar escrow created
4. ✅ ETH deposited and locked
5. ✅ XLM deposited and locked
6. ✅ Secret revealed for XLM claim
7. ✅ XLM claimed successfully
8. ✅ ETH claimed using secret
9. ✅ Swap completed atomically

### **Transaction Hashes**

- **Ethereum**: Check on https://sepolia.etherscan.io/
- **Stellar**: Check on https://stellar.expert/explorer/testnet/

### **Contract Addresses**

- **Stellar Factory**: `CBUXHMGZEAROJBXIPIOUNEJETLD2MAVSPTP6ZYEDZTFPQ43HFA5GJCB4`
- **Stellar Escrow**: `CAVJPSMZQRHX2DDUAY7SUCLK6OOBPKKRWT6BBZP2VE24JGMD56KLGVX5`
- **Ethereum Factory**: `0x...` (your deployed address)

## 🎯 Next Steps

### **Production Deployment**

1. Deploy to Ethereum mainnet
2. Deploy to Stellar mainnet
3. Configure production relayer
4. Set up monitoring and alerting
5. Implement proper secret management

### **Integration**

1. Integrate with 1inch Fusion+ frontend
2. Add support for more token pairs
3. Implement batch processing
4. Add advanced security features

---

**🎉 Congratulations! You now have a fully functional ETH → XLM cross-chain atomic swap system!**
