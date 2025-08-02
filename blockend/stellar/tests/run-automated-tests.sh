#!/bin/bash

# 🚀 Automated ETH-Stellar Cross-Chain Swap Test Runner
# This script runs the complete test suite for ETH-Stellar atomic swaps

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$TEST_DIR")"
RELAYER_DIR="$(dirname "$PROJECT_ROOT")/relayer-service"

echo -e "${PURPLE}🚀 ETH-Stellar Cross-Chain Swap Automated Test Runner${NC}"
echo "================================================================"
echo -e "${BLUE}Test Directory:${NC} $TEST_DIR"
echo -e "${BLUE}Project Root:${NC} $PROJECT_ROOT"
echo -e "${BLUE}Relayer Directory:${NC} $RELAYER_DIR"
echo ""

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
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_step "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed or not in PATH"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed or not in PATH"
        exit 1
    fi
    
    # Check Stellar CLI
    if ! command -v stellar &> /dev/null; then
        print_error "Stellar CLI is not installed or not in PATH"
        exit 1
    fi
    
    # Check if .env file exists
    if [ ! -f "$TEST_DIR/.env" ]; then
        print_error ".env file not found in $TEST_DIR"
        print_status "Please create .env file with required environment variables"
        exit 1
    fi
    
    print_success "All prerequisites satisfied"
}

# Install dependencies
install_dependencies() {
    print_step "Installing test dependencies..."
    
    cd "$TEST_DIR"
    
    if [ ! -d "node_modules" ]; then
        npm install
        print_success "Test dependencies installed"
    else
        print_status "Dependencies already installed"
    fi
    
    cd "$RELAYER_DIR"
    
    if [ ! -d "node_modules" ]; then
        npm install
        print_success "Relayer dependencies installed"
    else
        print_status "Relayer dependencies already installed"
    fi
}

# Build contracts
build_contracts() {
    print_step "Building Stellar contracts..."
    
    cd "$PROJECT_ROOT"
    
    # Build FusionPlusEscrow
    print_status "Building FusionPlusEscrow..."
    cd contracts/fusion_plus_escrow
    cargo build --target wasm32-unknown-unknown --release
    print_success "FusionPlusEscrow built"
    
    # Build StellarEscrowFactory
    print_status "Building StellarEscrowFactory..."
    cd ../stellar_escrow_factory
    cargo build --target wasm32-unknown-unknown --release
    print_success "StellarEscrowFactory built"
    
    # Build StellarResolver
    print_status "Building StellarResolver..."
    cd ../stellar_resolver
    cargo build --target wasm32-unknown-unknown --release
    print_success "StellarResolver built"
    
    # Build StellarLimitOrderProtocol
    print_status "Building StellarLimitOrderProtocol..."
    cd ../stellar_limit_order_protocol
    cargo build --target wasm32-unknown-unknown --release
    print_success "StellarLimitOrderProtocol built"
    
    cd "$PROJECT_ROOT"
    print_success "All contracts built successfully"
}

# Build relayer
build_relayer() {
    print_step "Building relayer service..."
    
    cd "$RELAYER_DIR"
    npm run build
    print_success "Relayer service built"
}

# Deploy contracts (if needed)
deploy_contracts() {
    print_step "Checking contract deployment status..."
    
    # Check if contracts are already deployed
    if [ -f "$PROJECT_ROOT/deployment-info.txt" ]; then
        print_status "Contracts already deployed, checking status..."
        source "$PROJECT_ROOT/deployment-info.txt"
        
        # Verify contracts are accessible
        if [ -n "$FUSION_ESCROW_ID" ] && [ -n "$FACTORY_ID" ]; then
            print_success "Contracts already deployed and accessible"
            return 0
        fi
    fi
    
    print_status "Deploying contracts..."
    cd "$PROJECT_ROOT"
    ./deploy.sh alice testnet
    
    print_success "Contracts deployed successfully"
}

# Start relayer service
start_relayer() {
    print_step "Starting relayer service..."
    
    cd "$RELAYER_DIR"
    
    # Start relayer in background
    npm start &
    RELAYER_PID=$!
    
    # Wait for relayer to start
    sleep 5
    
    # Check if relayer is running
    if kill -0 $RELAYER_PID 2>/dev/null; then
        print_success "Relayer service started (PID: $RELAYER_PID)"
    else
        print_error "Failed to start relayer service"
        exit 1
    fi
}

# Stop relayer service
stop_relayer() {
    if [ -n "$RELAYER_PID" ]; then
        print_step "Stopping relayer service..."
        kill $RELAYER_PID 2>/dev/null || true
        print_success "Relayer service stopped"
    fi
}

# Run tests
run_tests() {
    print_step "Running automated tests..."
    
    cd "$TEST_DIR"
    
    # Run all tests
    print_status "Running complete test suite..."
    npm test
    
    print_success "All tests completed successfully"
}

# Run specific test categories
run_test_category() {
    local category=$1
    print_step "Running $category tests..."
    
    cd "$TEST_DIR"
    
    case $category in
        "deployment")
            npm run test:deployment
            ;;
        "swap-flow")
            npm run test:swap-flow
            ;;
        "error-handling")
            npm run test:error-handling
            ;;
        "performance")
            npm run test:performance
            ;;
        *)
            print_error "Unknown test category: $category"
            exit 1
            ;;
    esac
    
    print_success "$category tests completed"
}

# Main execution
main() {
    local test_category=${1:-"all"}
    
    echo -e "${PURPLE}Starting automated test run for category: $test_category${NC}"
    echo ""
    
    # Setup phase
    check_prerequisites
    install_dependencies
    build_contracts
    build_relayer
    deploy_contracts
    
    # Start relayer
    start_relayer
    
    # Run tests
    if [ "$test_category" = "all" ]; then
        run_tests
    else
        run_test_category "$test_category"
    fi
    
    # Cleanup
    stop_relayer
    
    echo ""
    echo -e "${GREEN}🎉 Automated test run completed successfully!${NC}"
}

# Handle script arguments
case "${1:-}" in
    "deployment")
        main "deployment"
        ;;
    "swap-flow")
        main "swap-flow"
        ;;
    "error-handling")
        main "error-handling"
        ;;
    "performance")
        main "performance"
        ;;
    "all"|"")
        main "all"
        ;;
    *)
        echo "Usage: $0 [all|deployment|swap-flow|error-handling|performance]"
        echo ""
        echo "Test categories:"
        echo "  all              - Run all tests (default)"
        echo "  deployment       - Test contract deployment verification"
        echo "  swap-flow        - Test complete swap flows"
        echo "  error-handling   - Test error scenarios and edge cases"
        echo "  performance      - Test performance and load scenarios"
        exit 1
        ;;
esac 