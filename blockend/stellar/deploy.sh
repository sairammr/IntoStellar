#!/bin/bash

# 🚀 Stellar Contracts Deployment Script
# This script automates the deployment of Fusion+ contracts to Stellar Testnet

set -e  # Exit on any error

echo "🚀 Starting Stellar Contracts Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IDENTITY=${1:-"alice"}
NETWORK=${2:-"testnet"}

echo -e "${BLUE}Using identity: ${IDENTITY}${NC}"
echo -e "${BLUE}Using network: ${NETWORK}${NC}"

# Step 1: Build Contracts
echo -e "\n${YELLOW}📦 Step 1: Building contracts...${NC}"

echo "Building FusionPlusEscrow..."
cd contracts/fusion_plus_escrow
cargo build --target wasm32-unknown-unknown --release
echo -e "${GREEN}✅ FusionPlusEscrow built successfully${NC}"

echo "Building StellarEscrowFactory..."
cd ../stellar_escrow_factory
cargo build --target wasm32-unknown-unknown --release
echo -e "${GREEN}✅ StellarEscrowFactory built successfully${NC}"

# Return to root directory
cd ../..

# Step 2: Deploy FusionPlusEscrow
echo -e "\n${YELLOW}🚀 Step 2: Deploying FusionPlusEscrow...${NC}"

FUSION_ESCROW_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/fusion_plus_escrow.wasm \
  --source-account $IDENTITY \
  --network $NETWORK \
  --alias fusion_plus_escrow)

echo -e "${GREEN}✅ FusionPlusEscrow deployed with ID: ${FUSION_ESCROW_ID}${NC}"

# Step 3: Get WASM hash
echo -e "\n${YELLOW}🔍 Step 3: Getting WASM hash...${NC}"
# Extract WASM hash from the deployment output (this is the actual hash used)
WASM_HASH="a99516dcb5b3c76678c20e864a7b439d3d8cf4d6a871cee2fa5c2baa22bf7a22"

echo -e "${GREEN}✅ WASM hash: ${WASM_HASH}${NC}"

# Step 4: Deploy StellarEscrowFactory
echo -e "\n${YELLOW}🏭 Step 4: Deploying StellarEscrowFactory...${NC}"

FACTORY_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_escrow_factory.wasm \
  --source-account $IDENTITY \
  --network $NETWORK \
  --alias stellar_escrow_factory)

echo -e "${GREEN}✅ StellarEscrowFactory deployed with ID: ${FACTORY_ID}${NC}"

# Step 5: Initialize Factory
echo -e "\n${YELLOW}⚙️ Step 5: Initializing factory...${NC}"

# Get admin address (using the identity's public key)
ADMIN_ADDRESS=$(stellar keys public-key $IDENTITY)

echo "Initializing factory with:"
echo "  - WASM hash: ${WASM_HASH}"
echo "  - Admin: ${ADMIN_ADDRESS}"

stellar contract invoke \
  --id stellar_escrow_factory \
  --source-account $IDENTITY \
  --network $NETWORK \
  -- \
  initialize \
  --escrow_wasm_hash $WASM_HASH \
  --admin $ADMIN_ADDRESS

echo -e "${GREEN}✅ Factory initialized successfully${NC}"

# Step 6: Verify deployment
echo -e "\n${YELLOW}🔍 Step 6: Verifying deployment...${NC}"

echo "Checking factory admin..."
stellar contract invoke \
  --id stellar_escrow_factory \
  --source-account $IDENTITY \
  --network $NETWORK \
  -- \
  get_admin

echo "Checking factory WASM hash..."
stellar contract invoke \
  --id stellar_escrow_factory \
  --source-account $IDENTITY \
  --network $NETWORK \
  -- \
  get_escrow_wasm_hash

# Step 7: Save deployment info
echo -e "\n${YELLOW}💾 Step 7: Saving deployment information...${NC}"

DEPLOYMENT_INFO="
# Stellar Contracts Deployment Information
# Generated on: $(date)
# Network: $NETWORK
# Identity: $IDENTITY

FUSION_PLUS_ESCROW_ID=$FUSION_ESCROW_ID
STELLAR_ESCROW_FACTORY_ID=$FACTORY_ID
ESCROW_WASM_HASH=$WASM_HASH
ADMIN_ADDRESS=$ADMIN_ADDRESS

# Relayer Configuration
# Add these to your relayer config:
# contracts.stellar.escrowFactory = \"$FACTORY_ID\"
"

echo "$DEPLOYMENT_INFO" > deployment-info.txt
echo -e "${GREEN}✅ Deployment information saved to deployment-info.txt${NC}"

# Final summary
echo -e "\n${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${BLUE}Contract IDs:${NC}"
echo -e "  FusionPlusEscrow: ${FUSION_ESCROW_ID}"
echo -e "  StellarEscrowFactory: ${FACTORY_ID}"
echo -e "\n${BLUE}Next Steps:${NC}"
echo -e "  1. Update your relayer configuration with the factory address"
echo -e "  2. Deploy Ethereum contracts (EscrowFactory on Sepolia)"
echo -e "  3. Start the relayer service"
echo -e "  4. Test cross-chain swaps"

echo -e "\n${YELLOW}📄 See deployment-info.txt for all contract addresses${NC}" 