# 🚀 ETH-Stellar Cross-Chain Atomic Swap Automated Tests

This directory contains comprehensive automated tests for ETH-Stellar cross-chain atomic swaps, similar to the ETH-BSC tests in the EVM version.

## 📁 File Structure

```
tests/
├── eth-stellar-swap.spec.ts      # Main test suite
├── jest.config.js                # Jest configuration
├── setup.ts                      # Test environment setup
├── package.json                  # Test dependencies
├── run-automated-tests.sh        # Automated test runner
├── env-template.txt              # Environment variables template
└── README.md                     # This file
```

## 🎯 Test Categories

### 1. **Contract Deployment Verification**

- Verifies all contracts are deployed and accessible
- Checks Ethereum and Stellar contract connectivity
- Validates relayer service operational status

### 2. **Cross-Chain Atomic Swap Flow**

- **ETH → XLM Swap**: Complete flow from Ethereum to Stellar
- **XLM → ETH Swap**: Complete flow from Stellar to Ethereum
- Tests the full orchestration including:
  - Escrow creation on both chains
  - Secret distribution
  - Withdrawal verification
  - Swap completion

### 3. **Error Handling and Edge Cases**

- Insufficient balance scenarios
- Timelock expiry handling
- Invalid secret attempts
- Network connectivity issues

### 4. **Performance and Load Testing**

- Multiple concurrent swaps
- High-volume testing
- Stress testing scenarios

## 🚀 Quick Start

### Step 1: Setup Environment

```bash
# Navigate to test directory
cd blockend/stellar/tests

# Copy environment template
cp env-template.txt .env

# Edit .env with your actual values
nano .env
```

### Step 2: Install Dependencies

```bash
# Install test dependencies
npm install

# Install relayer dependencies
cd ../../relayer-service
npm install
```

### Step 3: Deploy Contracts

```bash
# Navigate back to stellar directory
cd ../blockend/stellar

# Deploy contracts to testnet
./deploy.sh alice testnet

# Update .env with deployed contract addresses
```

### Step 4: Run Tests

```bash
# Navigate to test directory
cd tests

# Run all tests
./run-automated-tests.sh

# Or run specific test categories
./run-automated-tests.sh deployment
./run-automated-tests.sh swap-flow
./run-automated-tests.sh error-handling
./run-automated-tests.sh performance
```

## 🔧 Manual Test Execution

### Run Individual Test Categories

```bash
# Contract deployment verification
npm run test:deployment

# Cross-chain swap flows
npm run test:swap-flow

# Error handling scenarios
npm run test:error-handling

# Performance testing
npm run test:performance

# All tests
npm test
```

### Run with Coverage

```bash
npm run test:coverage
```

## 📋 Required Environment Variables

### Ethereum Configuration

```bash
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
ETHEREUM_PRIVATE_KEY=your_private_key
ETHEREUM_ESCROW_FACTORY=0x...
```

### Stellar Configuration

```bash
STELLAR_HORIZON_URL=https://soroban-testnet.stellar.org
STELLAR_PRIVATE_KEY=S...
STELLAR_ESCROW_FACTORY=CA...
STELLAR_LIMIT_ORDER_PROTOCOL=CA...
STELLAR_RESOLVER=CA...
```

### Relayer Configuration

```bash
RELAYER_PORT=3001
RELAYER_SECRET_KEY=your_secret_key
CORS_ORIGIN=http://localhost:3000
```

## 🔄 Test Flow Overview

### ETH → XLM Swap Flow

1. **Setup**: Initialize Ethereum and Stellar providers
2. **Order Creation**: User creates cross-chain order
3. **Ethereum Escrow**: Resolver fills order, creates EscrowSrc
4. **Stellar Escrow**: Relayer detects event, creates FusionPlusEscrow
5. **Finality Wait**: Wait for blockchain finality
6. **Secret Revelation**: User reveals secret
7. **Withdrawal**: Resolver withdraws on both chains
8. **Verification**: Confirm swap completion

### XLM → ETH Swap Flow

1. **Setup**: Initialize providers
2. **Order Creation**: User creates reverse order
3. **Stellar Escrow**: Create FusionPlusEscrow on Stellar
4. **Ethereum Escrow**: Relayer creates corresponding EscrowSrc
5. **Finality Wait**: Wait for finality
6. **Secret Revelation**: User reveals secret
7. **Withdrawal**: Resolver withdraws on both chains
8. **Verification**: Confirm swap completion

## 🧪 Test Utilities

### TestUtils Class

```typescript
// Generate random secret
const secret = TestUtils.generateSecret();

// Generate hash lock from secret
const hashLock = TestUtils.generateHashLock(secret);

// Generate order hash
const orderHash = TestUtils.generateOrderHash(maker, amount, nonce);

// Wait for transaction
await TestUtils.waitForTransaction(provider, hash);

// Increase time (for testing timelocks)
await TestUtils.increaseTime(provider, seconds);
```

### Global Test Utilities

```typescript
// Available in all tests
global.testUtils.generateSecret();
global.testUtils.generateHashLock(secret);
global.testUtils.wait(ms);
global.testUtils.increaseTime(provider, seconds);
```

## 🔍 Test Verification Points

### Contract Deployment

- ✅ Ethereum EscrowFactory deployed and accessible
- ✅ Stellar contracts deployed and accessible
- ✅ Relayer service operational

### Swap Execution

- ✅ Escrow creation on source chain
- ✅ Corresponding escrow creation on destination chain
- ✅ Secret distribution across chains
- ✅ Withdrawal execution on both chains
- ✅ Swap completion verification

### Error Handling

- ✅ Insufficient balance detection
- ✅ Timelock expiry handling
- ✅ Invalid secret rejection
- ✅ Network failure recovery

### Performance

- ✅ Multiple concurrent swaps
- ✅ High-volume processing
- ✅ Memory and resource management

## 🚨 Troubleshooting

### Common Issues

1. **Environment Variables Missing**

   ```bash
   # Check if .env file exists and has all required variables
   cat .env | grep -E "(ETHEREUM|STELLAR|RELAYER)"
   ```

2. **Contracts Not Deployed**

   ```bash
   # Deploy contracts first
   cd ../blockend/stellar
   ./deploy.sh alice testnet
   ```

3. **Relayer Service Not Starting**

   ```bash
   # Check relayer dependencies
   cd ../../relayer-service
   npm install
   npm run build
   ```

4. **Test Timeouts**
   ```bash
   # Increase timeout in jest.config.js
   testTimeout: 300000, // 5 minutes
   ```

### Debug Mode

```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test with debugging
npm test -- --testNamePattern="ETH → XLM swap" --verbose
```

## 📊 Test Results

### Expected Output

```
🚀 ETH-Stellar Cross-Chain Swap Automated Test Runner
==============================================================

[STEP] Checking prerequisites...
[SUCCESS] All prerequisites satisfied

[STEP] Installing test dependencies...
[SUCCESS] Test dependencies installed

[STEP] Building Stellar contracts...
[SUCCESS] All contracts built successfully

[STEP] Building relayer service...
[SUCCESS] Relayer service built

[STEP] Checking contract deployment status...
[SUCCESS] Contracts already deployed and accessible

[STEP] Starting relayer service...
[SUCCESS] Relayer service started (PID: 12345)

[STEP] Running automated tests...
🧪 Setting up ETH-Stellar test environment...
✅ Test environment setup completed

🔍 Verifying contract deployments...
✅ Ethereum EscrowFactory deployed
✅ Stellar contracts accessible
✅ Relayer service operational

🔄 Starting ETH → XLM cross-chain swap...
📦 Step 1: Creating Ethereum escrow...
🌐 Step 2: Creating corresponding Stellar escrow...
🔍 Step 3: Verifying Stellar escrow creation...
✅ Stellar escrow created successfully
⏰ Step 4: Waiting for finality period...
🔑 Step 5: User reveals secret...
🔍 Step 6: Verifying secret distribution...
✅ Secret revealed successfully
⏰ Step 7: Waiting for withdrawal period...
🔍 Step 8: Verifying swap completion...
✅ ETH → XLM swap completed successfully!

🎉 Automated test run completed successfully!
```

## 🔗 Related Files

- **Main Test**: `eth-stellar-swap.spec.ts`
- **Configuration**: `jest.config.js`, `setup.ts`
- **Environment**: `env-template.txt`
- **Runner**: `run-automated-tests.sh`
- **Dependencies**: `package.json`

## 📝 Notes

1. **Testnet Only**: All tests run on testnet networks
2. **Real Transactions**: Tests use real blockchain transactions
3. **Time Requirements**: Cross-chain tests require time for finality
4. **Resource Usage**: Tests may consume significant resources
5. **Cost**: Testnet transactions may have minimal costs

## 🎉 Success Criteria

A successful test run should:

- ✅ Deploy all contracts successfully
- ✅ Execute complete ETH → XLM swap
- ✅ Execute complete XLM → ETH swap
- ✅ Handle error scenarios gracefully
- ✅ Process multiple concurrent swaps
- ✅ Complete within reasonable time limits
- ✅ Maintain data consistency across chains
