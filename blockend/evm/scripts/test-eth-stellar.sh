#!/bin/bash

echo "🚀 Starting ETH-Stellar Cross-Chain Swap Tests"

# Set environment variables for the test
export SRC_CHAIN_RPC="https://eth.merkle.io"
export STELLAR_HORIZON_URL="https://horizon-testnet.stellar.org"
export SRC_CHAIN_CREATE_FORK="true"
export STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

echo "📋 Environment Configuration:"
echo "  - ETH RPC: $SRC_CHAIN_RPC"
echo "  - Stellar Horizon: $STELLAR_HORIZON_URL"
echo "  - ETH Fork: $SRC_CHAIN_CREATE_FORK"
echo "  - Stellar Network: $STELLAR_NETWORK_PASSPHRASE"

echo ""
echo "🔧 Installing dependencies..."
yarn install

echo ""
echo "🏗️  Building contracts..."
forge build

echo ""
echo "🧪 Running ETH-Stellar cross-chain tests..."
node --experimental-vm-modules ./node_modules/jest/bin/jest.js eth-stellar.spec.ts --verbose

echo ""
echo "✅ Test run completed!"