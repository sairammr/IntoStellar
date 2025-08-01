#!/bin/bash

# 🚀 Quick Start Script for Real ETH → XLM Cross-Chain Swap
# This script automates the setup process for a real cross-chain atomic swap

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${PURPLE}🚀 Quick Start: Real ETH → XLM Cross-Chain Swap${NC}"
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

print_step() {
    echo -e "\n${BLUE}📋 $1${NC}"
}

# Check prerequisites
print_step "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js v18+"
    exit 1
fi

if ! command -v stellar &> /dev/null; then
    print_error "Stellar CLI is not installed. Please install Stellar CLI"
    exit 1
fi

if ! command -v cargo &> /dev/null; then
    print_error "Rust is not installed. Please install Rust"
    exit 1
fi

print_success "All prerequisites are installed"

# Step 1: Install dependencies
print_step "Installing dependencies..."

print_status "Installing web dependencies..."
cd web && npm install && cd ..

print_status "Installing relayer dependencies..."
cd blockend/stellar/relayer-service && npm install && cd ../../..

print_status "Installing EVM dependencies..."
cd blockend/evm && npm install && cd ../..

print_success "Dependencies installed successfully"

# Step 2: Create environment files
print_step "Creating environment files..."

# Create relayer .env template
cat > blockend/stellar/relayer-service/.env << 'EOF'
# Ethereum Configuration
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_API_KEY
ETHEREUM_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
ETHEREUM_ESCROW_FACTORY=0x... # Will be filled after deployment

# Stellar Configuration
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_PRIVATE_KEY=your_stellar_private_key_here
STELLAR_ESCROW_FACTORY= # Will be filled after deployment

# Relayer Configuration
RELAYER_PORT=3001
RELAYER_SECRET_KEY=your_random_secret_key_here
CORS_ORIGIN=http://localhost:3000
EOF

# Create EVM .env template
cat > blockend/evm/.env << 'EOF'
INFURA_API_KEY=your_infura_api_key_here
PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_API_KEY
EOF

print_success "Environment files created"

# Step 3: Deploy Stellar contracts
print_step "Deploying Stellar contracts..."

cd blockend/stellar

# Generate Stellar identity
if ! stellar keys ls | grep -q "eth_xlm_swap"; then
    print_status "Generating Stellar identity..."
    stellar keys generate eth_xlm_swap
    print_success "Stellar identity created"
fi

print_status "Funding Stellar identity..."
stellar keys fund eth_xlm_swap --network testnet
print_success "Stellar identity funded"

# Build contracts
print_status "Building FusionPlusEscrow..."
cd contracts/fusion_plus_escrow
cargo build --target wasm32-unknown-unknown --release
print_success "FusionPlusEscrow built"

print_status "Building StellarEscrowFactory..."
cd ../stellar_escrow_factory
cargo build --target wasm32-unknown-unknown --release
print_success "StellarEscrowFactory built"

cd ../../

# Deploy contracts
print_status "Deploying FusionPlusEscrow..."
FUSION_ESCROW_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/fusion_plus_escrow.wasm \
  --source-account eth_xlm_swap \
  --network testnet \
  --alias fusion_plus_escrow)
print_success "FusionPlusEscrow deployed: $FUSION_ESCROW_ID"

print_status "Deploying StellarEscrowFactory..."
FACTORY_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_escrow_factory.wasm \
  --source-account eth_xlm_swap \
  --network testnet \
  --alias stellar_escrow_factory)
print_success "StellarEscrowFactory deployed: $FACTORY_ID"

# Initialize factory
print_status "Initializing factory..."
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
print_success "Factory initialized"

# Update relayer .env with contract addresses
sed -i '' "s/STELLAR_ESCROW_FACTORY=.*/STELLAR_ESCROW_FACTORY=$FACTORY_ID/" relayer-service/.env

cd ../..

# Step 4: Build relayer service
print_step "Building relayer service..."

cd blockend/stellar/relayer-service
npm run build
print_success "Relayer service built"

cd ../../..

# Step 5: Start services
print_step "Starting services..."

# Start relayer in background
print_status "Starting relayer service..."
cd blockend/stellar/relayer-service
npm start &
RELAYER_PID=$!
cd ../../..

# Wait for relayer to start
sleep 5

# Test relayer health
if curl -s http://localhost:3001/health > /dev/null; then
    print_success "Relayer service is running"
else
    print_error "Relayer service failed to start"
    exit 1
fi

# Start web application
print_status "Starting web application..."
cd web
npm run dev &
WEB_PID=$!
cd ..

# Wait for web to start
sleep 5

# Step 6: Summary
print_step "Setup Complete!"

echo -e "\n${GREEN}🎉 Setup completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Contract Addresses:${NC}"
echo "  Stellar Factory: $FACTORY_ID"
echo "  Stellar Escrow: $FUSION_ESCROW_ID"
echo "  Admin Address: $ADMIN_ADDRESS"
echo ""
echo -e "${BLUE}🌐 Services:${NC}"
echo "  Web Application: http://localhost:3000"
echo "  Testing Page: http://localhost:3000/testing"
echo "  Relayer API: http://localhost:3001"
echo "  Relayer Health: http://localhost:3001/health"
echo ""
echo -e "${YELLOW}⚠️  Next Steps:${NC}"
echo "  1. Get an Infura API key from https://infura.io/"
echo "  2. Update the .env files with your API keys"
echo "  3. Deploy Ethereum contracts to Sepolia"
echo "  4. Configure MetaMask for Sepolia testnet"
echo "  5. Get Sepolia ETH from https://sepoliafaucet.com/"
echo "  6. Open http://localhost:3000/testing to start swapping"
echo ""
echo -e "${PURPLE}📚 Documentation:${NC}"
echo "  Setup Guide: SETUP_REAL_SWAP.md"
echo "  Testing Guide: blockend/stellar/ETH_TO_XLM_README.md"
echo ""
echo -e "${GREEN}🚀 Ready to swap ETH for XLM!${NC}"

# Function to cleanup on exit
cleanup() {
    print_status "Stopping services..."
    kill $RELAYER_PID 2>/dev/null || true
    kill $WEB_PID 2>/dev/null || true
    print_success "Services stopped"
}

# Set trap to cleanup on script exit
trap cleanup EXIT

# Keep script running
print_status "Press Ctrl+C to stop all services"
wait 