#!/bin/bash

echo "🚀 Starting ETH-Stellar Cross-Chain Full Swap Tests (like ETH-BSC)"

# Set environment variables exactly like the working ETH-BSC test
export SRC_CHAIN_RPC="https://eth.merkle.io"
export STELLAR_HORIZON_URL="https://horizon-testnet.stellar.org"
export SRC_CHAIN_CREATE_FORK="true"
export STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

echo "📋 Environment Configuration:"
echo "  - ETH RPC: $SRC_CHAIN_RPC (forked like ETH-BSC)"
echo "  - Stellar Horizon: $STELLAR_HORIZON_URL"
echo "  - ETH Fork: $SRC_CHAIN_CREATE_FORK"
echo "  - Stellar Network: $STELLAR_NETWORK_PASSPHRASE"

echo ""
echo "🏗️  Building contracts..."
forge build

echo ""
echo "🧪 Running ETH-Stellar full cross-chain tests (mirroring ETH-BSC pattern)..."
node --experimental-vm-modules ./node_modules/jest/bin/jest.js eth-stellar-full.spec.ts --verbose

echo ""
echo "✅ Test run completed!"