# EVM Contract Deployment Scripts

This directory contains deployment scripts for all EVM contracts used in the cross-chain atomic swap system.

## 📁 Scripts Overview

### Individual Deployment Scripts

- **`deploy-limit-order-protocol.js`** - Deploys the LimitOrderProtocol contract
- **`deploy-escrow-factory.js`** - Deploys the EscrowFactory contract
- **`deploy-resolver.js`** - Deploys the Resolver contract

### Master Scripts

- **`deploy-all.js`** - Deploys all contracts in the correct order
- **`verify-contracts.js`** - Verifies deployed contracts on Etherscan
- **`test-contracts.js`** - Tests deployed contracts functionality

## 🚀 Quick Start

### 1. Setup Environment Variables

Create a `.env` file in the `blockend/evm` directory:

```bash
# Network Configuration
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
PRIVATE_KEY=your_private_key_here

# Contract Addresses (will be auto-populated by deploy-all.js)
WETH_ADDRESS=0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9
LIMIT_ORDER_PROTOCOL=
ESCROW_FACTORY=
RESOLVER=

# Optional: Etherscan API Key for contract verification
ETHERSCAN_API_KEY=your_etherscan_api_key_here
```

### 2. Deploy All Contracts

```bash
cd blockend/evm
node scripts/deploy-all.js
```

This will:

- Deploy LimitOrderProtocol first
- Deploy EscrowFactory with the LimitOrderProtocol address
- Deploy Resolver with both addresses
- Save deployment info to `deployment-info.json`
- Display environment variables for easy copy-paste

### 3. Verify Contracts (Optional)

```bash
node scripts/verify-contracts.js
```

### 4. Test Contracts

```bash
node scripts/test-contracts.js
```

## 📋 Individual Script Usage

### Deploy LimitOrderProtocol Only

```bash
node scripts/deploy-limit-order-protocol.js
```

### Deploy EscrowFactory Only

```bash
# Set the LimitOrderProtocol address first
export LIMIT_ORDER_PROTOCOL=0x...
node scripts/deploy-escrow-factory.js
```

### Deploy Resolver Only

```bash
# Set both addresses first
export ESCROW_FACTORY=0x...
export LIMIT_ORDER_PROTOCOL=0x...
node scripts/deploy-resolver.js
```

## 🔧 Contract Dependencies

The deployment order is important due to contract dependencies:

1. **LimitOrderProtocol** - No dependencies
2. **EscrowFactory** - Requires LimitOrderProtocol address
3. **Resolver** - Requires both LimitOrderProtocol and EscrowFactory addresses

## 📊 Deployment Output

After running `deploy-all.js`, you'll get:

- **Console output** with deployment progress and addresses
- **`deployment-info.json`** file with all contract addresses
- **Environment variables** ready to copy-paste

Example output:

```
🎉 All contracts deployed successfully!
📊 Deployment Summary:
├── LimitOrderProtocol: 0x1234...
├── EscrowFactory: 0x5678...
└── Resolver: 0x9abc...

🔧 Environment Variables:
LIMIT_ORDER_PROTOCOL=0x1234...
ESCROW_FACTORY=0x5678...
RESOLVER=0x9abc...
```

## 🧪 Testing

The `test-contracts.js` script performs:

- **Basic contract state checks** (owner, paused status, etc.)
- **Contract relationship verification** (correct address references)
- **Functionality tests** (pause/unpause operations)
- **Network connectivity verification**

## 🔍 Verification

The `verify-contracts.js` script:

- Submits contracts to Etherscan for verification
- Requires `ETHERSCAN_API_KEY` environment variable
- Provides verification status and Etherscan URLs
- Handles constructor arguments automatically

## ⚠️ Important Notes

1. **Private Key Security**: Never commit your private key to version control
2. **Network Selection**: Scripts default to Sepolia testnet
3. **Gas Fees**: Ensure your wallet has sufficient ETH for deployment
4. **Contract Dependencies**: Always deploy in the correct order
5. **Environment Variables**: Use the provided environment variables for consistency

## 🛠️ Troubleshooting

### Common Issues

1. **"Cannot find module" errors**
    - Ensure you're in the `blockend/evm` directory
    - Run `npm install` to install dependencies

2. **"Insufficient funds" errors**
    - Add more ETH to your wallet
    - Check gas prices and adjust if needed

3. **"Contract verification failed"**
    - Check your Etherscan API key
    - Ensure constructor arguments are correct

4. **"Contract not found" errors**
    - Verify the contract was deployed successfully
    - Check the deployment-info.json file

### Getting Help

- Check the console output for detailed error messages
- Verify all environment variables are set correctly
- Ensure you're connected to the correct network
- Check that contracts were compiled successfully (`forge build`)

## 📚 Additional Resources

- [Foundry Documentation](https://book.getfoundry.sh/)
- [Ethers.js Documentation](https://docs.ethers.org/)
- [Etherscan API Documentation](https://docs.etherscan.io/)
- [Sepolia Faucet](https://sepoliafaucet.com/)
