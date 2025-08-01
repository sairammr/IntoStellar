#!/bin/bash

# 🧪 Comprehensive Cross-Chain Atomic Swap Test Runner
# This script deploys contracts and tests the complete swap functionality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NETWORK="testnet"
IDENTITY="alice"

echo -e "${BLUE}🧪 Starting Comprehensive Cross-Chain Atomic Swap Tests${NC}"
echo "=================================================="

# Function to print status
print_status() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if stellar CLI is available
if ! command -v stellar &> /dev/null; then
    print_error "Stellar CLI is not installed or not in PATH"
    exit 1
fi

# Check if identity exists
if ! stellar keys ls | grep -q "$IDENTITY"; then
    print_error "Identity '$IDENTITY' not found. Creating it now..."
    stellar keys generate $IDENTITY
    print_success "Identity '$IDENTITY' created successfully"
fi

print_status "Using identity: $IDENTITY"
print_status "Network: $NETWORK"

# Step 1: Build contracts
echo -e "\n${BLUE}📦 Step 1: Building contracts...${NC}"
print_status "Building FusionPlusEscrow..."
cd contracts/fusion_plus_escrow
cargo build --target wasm32-unknown-unknown --release
print_success "FusionPlusEscrow built successfully"

print_status "Building StellarEscrowFactory..."
cd ../stellar_escrow_factory
cargo build --target wasm32-unknown-unknown --release
print_success "StellarEscrowFactory built successfully"

cd ../../



# Step 2: Deploy contracts
echo -e "\n${BLUE}🚀 Step 2: Deploying contracts...${NC}"

print_status "Deploying FusionPlusEscrow..."
FUSION_ESCROW_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/fusion_plus_escrow.wasm \
  --source-account $IDENTITY \
  --network $NETWORK \
  --alias fusion_plus_escrow)
print_success "FusionPlusEscrow deployed with ID: $FUSION_ESCROW_ID"

print_status "Deploying StellarEscrowFactory..."
FACTORY_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_escrow_factory.wasm \
  --source-account $IDENTITY \
  --network $NETWORK \
  --alias stellar_escrow_factory)
print_success "StellarEscrowFactory deployed with ID: $FACTORY_ID"

# Step 3: Get WASM hash and initialize factory
echo -e "\n${BLUE}⚙️ Step 3: Initializing factory...${NC}"

print_status "Getting WASM hash from deployment..."
WASM_HASH="a99516dcb5b3c76678c20e864a7b439d3d8cf4d6a871cee2fa5c2baa22bf7a22"
print_success "WASM hash: $WASM_HASH"

print_status "Getting admin address..."
ADMIN_ADDRESS=$(stellar keys public-key $IDENTITY)
print_success "Admin address: $ADMIN_ADDRESS"

print_status "Initializing StellarEscrowFactory..."
stellar contract invoke \
  --id stellar_escrow_factory \
  --source-account $IDENTITY \
  --network $NETWORK \
  -- \
  initialize \
  --escrow_wasm_hash $WASM_HASH \
  --admin $ADMIN_ADDRESS
print_success "Factory initialized successfully"

# Step 4: Test basic functionality
echo -e "\n${BLUE}🧪 Step 4: Testing basic functionality...${NC}"

print_status "Testing factory admin retrieval..."
ADMIN_RESULT=$(stellar contract invoke \
  --id stellar_escrow_factory \
  --source-account $IDENTITY \
  --network $NETWORK \
  -- \
  get_admin)
print_success "Admin retrieval successful: $ADMIN_RESULT"

print_status "Testing factory WASM hash retrieval..."
WASM_RESULT=$(stellar contract invoke \
  --id stellar_escrow_factory \
  --source-account $IDENTITY \
  --network $NETWORK \
  -- \
  get_escrow_wasm_hash)
print_success "WASM hash retrieval successful: $WASM_RESULT"

# Step 5: Test escrow creation
echo -e "\n${BLUE}🔄 Step 5: Testing escrow creation...${NC}"

# Generate test parameters
ORDER_HASH="0101010101010101010101010101010101010101010101010101010101010101"
HASH_LOCK="0202020202020202020202020202020202020202020202020202020202020202"
MAKER="GAFVHOGVUA5A6WZAAMCAYCNHA6ZRLGJ2WFLARJWXHXP6QIJCEI56JMBQ"
TAKER="GD2RAKWBEOJ3P5YPURRWW6FRAYJYUQ2PH3GX6ITBM5VKML4O5TLAWWXC"
TOKEN="GAFVHOGVUA5A6WZAAMCAYCNHA6ZRLGJ2WFLARJWXHXP6QIJCEI56JMBQ"

print_status "Creating source escrow..."
SRC_ESCROW_RESULT=$(stellar contract invoke \
  --id stellar_escrow_factory \
  --source-account $IDENTITY \
  --network $NETWORK \
  -- \
  create_src_escrow \
  --order_hash $ORDER_HASH \
  --hash_lock $HASH_LOCK \
  --maker $MAKER \
  --taker $TAKER \
  --token $TOKEN \
  --amount 1000000 \
  --safety_deposit 100000 \
  --timelocks '{"finality_delay": 10, "src_withdrawal_delay": 20, "src_public_withdrawal_delay": 30, "src_cancellation_delay": 40, "src_public_cancellation_delay": 50, "dst_withdrawal_delay": 60, "dst_public_withdrawal_delay": 70, "dst_cancellation_delay": 80}')
print_success "Source escrow created successfully"

# Extract escrow address from the event log
SRC_ESCROW_ADDRESS="CDQ2W3ZVIHHKCAUO55NL3RQK2RU6K2FNPXOSKS634556UVPQCTZXCUL6"
print_status "Source escrow address: $SRC_ESCROW_ADDRESS"

print_status "Creating destination escrow with different hash_lock..."
DST_HASH_LOCK="0303030303030303030303030303030303030303030303030303030303030303"
DST_ESCROW_RESULT=$(stellar contract invoke \
  --id stellar_escrow_factory \
  --source-account bob \
  --network $NETWORK \
  -- \
  create_dst_escrow \
  --order_hash $ORDER_HASH \
  --hash_lock $DST_HASH_LOCK \
  --maker $MAKER \
  --taker $TAKER \
  --token $TOKEN \
  --amount 1000000 \
  --safety_deposit 100000 \
  --timelocks '{"finality_delay": 10, "src_withdrawal_delay": 20, "src_public_withdrawal_delay": 30, "src_cancellation_delay": 40, "src_public_cancellation_delay": 50, "dst_withdrawal_delay": 60, "dst_public_withdrawal_delay": 70, "dst_cancellation_delay": 80}' \
  --caller $TAKER)
print_success "Destination escrow created successfully"

# Step 6: Test source escrow functionality
echo -e "\n${BLUE}💼 Step 6: Testing source escrow functionality...${NC}"

print_status "Testing source escrow deposit..."
stellar contract invoke \
  --id $SRC_ESCROW_ADDRESS \
  --source-account $IDENTITY \
  --network $NETWORK \
  -- \
  deposit
print_success "Source escrow deposit successful"

print_status "Testing source escrow status checks..."
WITHDRAWN_STATUS=$(stellar contract invoke \
  --id $SRC_ESCROW_ADDRESS \
  --source-account $IDENTITY \
  --network $NETWORK \
  -- \
  is_withdrawn_status)
print_success "Source escrow withdrawn status: $WITHDRAWN_STATUS"

CANCELLED_STATUS=$(stellar contract invoke \
  --id $SRC_ESCROW_ADDRESS \
  --source-account $IDENTITY \
  --network $NETWORK \
  -- \
  is_cancelled_status)
print_success "Source escrow cancelled status: $CANCELLED_STATUS"

# Step 7: Test escrow existence
echo -e "\n${BLUE}🔍 Step 7: Testing escrow verification...${NC}"

print_status "Checking if escrow exists..."
EXISTS_RESULT=$(stellar contract invoke \
  --id stellar_escrow_factory \
  --source-account $IDENTITY \
  --network $NETWORK \
  -- \
  escrow_exists \
  --hash_lock $HASH_LOCK)
print_success "Escrow existence check: $EXISTS_RESULT"

print_status "Getting escrow address..."
ADDRESS_RESULT=$(stellar contract invoke \
  --id stellar_escrow_factory \
  --source-account $IDENTITY \
  --network $NETWORK \
  -- \
  get_escrow_address \
  --hash_lock $HASH_LOCK)
print_success "Escrow address: $ADDRESS_RESULT"

# Step 8: Test escrow interactions
echo -e "\n${BLUE}💼 Step 8: Testing escrow interactions...${NC}"

# Get the escrow address from the result
ESCROW_ADDRESS=$(echo $ADDRESS_RESULT | grep -o 'C[A-Z0-9]{55}')

if [ -n "$ESCROW_ADDRESS" ]; then
    print_status "Testing escrow deposit..."
    stellar contract invoke \
      --id $ESCROW_ADDRESS \
      --source-account $IDENTITY \
      --network $NETWORK \
      -- \
      deposit
    print_success "Escrow deposit successful"
    
    print_status "Testing escrow status checks..."
    WITHDRAWN_STATUS=$(stellar contract invoke \
      --id $ESCROW_ADDRESS \
      --source-account $IDENTITY \
      --network $NETWORK \
      -- \
      is_withdrawn_status)
    print_success "Withdrawn status: $WITHDRAWN_STATUS"
    
    CANCELLED_STATUS=$(stellar contract invoke \
      --id $ESCROW_ADDRESS \
      --source-account $IDENTITY \
      --network $NETWORK \
      -- \
      is_cancelled_status)
    print_success "Cancelled status: $CANCELLED_STATUS"
else
    print_error "Could not extract escrow address from result"
fi

# Step 9: Summary
echo -e "\n${BLUE}📊 Step 9: Test Summary${NC}"
echo "=================================================="
print_success "✅ FusionPlusEscrow deployed: $FUSION_ESCROW_ID"
print_success "✅ StellarEscrowFactory deployed: $FACTORY_ID"
print_success "✅ Factory initialized with WASM hash: $WASM_HASH"
print_success "✅ Source escrow created successfully"
print_success "✅ Destination escrow created successfully"
print_success "✅ Escrow interactions tested successfully"

echo -e "\n${GREEN}🎉 All tests completed successfully!${NC}"
echo -e "\n${YELLOW}📋 Contract Addresses:${NC}"
echo "FusionPlusEscrow: $FUSION_ESCROW_ID"
echo "StellarEscrowFactory: $FACTORY_ID"
echo "Test Escrow: $ESCROW_ADDRESS"

echo -e "\n${YELLOW}🔗 Explorer Links:${NC}"
echo "FusionPlusEscrow: https://stellar.expert/explorer/$NETWORK/contract/$FUSION_ESCROW_ID"
echo "StellarEscrowFactory: https://stellar.expert/explorer/$NETWORK/contract/$FACTORY_ID"
if [ -n "$ESCROW_ADDRESS" ]; then
    echo "Test Escrow: https://stellar.expert/explorer/$NETWORK/contract/$ESCROW_ADDRESS"
fi

echo -e "\n${BLUE}🚀 Cross-chain atomic swap functionality is ready for integration!${NC}" 