#!/bin/bash

# Stellar Factory Contract CLI Testing Script
# This script automates testing of the factory contract functions

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Contract information
FACTORY_CONTRACT_ID="CB6YENCF3FP7JGU5K7CQY5T35K3JWCESH5I2PWOMZCKKMP5RZNN7NPMQ"

echo -e "${BLUE}=== Stellar Factory Contract CLI Testing ===${NC}"
echo "Contract ID: $FACTORY_CONTRACT_ID"
echo ""

# Function to print section headers
print_section() {
    echo -e "${YELLOW}=== $1 ===${NC}"
    echo ""
}

# Function to execute command and handle errors
execute_command() {
    local description="$1"
    local command="$2"
    
    echo -e "${BLUE}$description${NC}"
    echo "Command: $command"
    echo ""
    
    if eval "$command"; then
        echo -e "${GREEN}✓ Success${NC}"
    else
        echo -e "${RED}✗ Failed${NC}"
        return 1
    fi
    echo ""
}

# Check if stellar CLI is available
if ! command -v stellar &> /dev/null; then
    echo -e "${RED}Error: Stellar CLI not found. Please install it first.${NC}"
    echo "Run: curl -sSfL https://soroban.stellar.org/install | sh"
    exit 1
fi

# Set up network configuration
print_section "Setting up network configuration"
execute_command "Configuring testnet" \
    "stellar config --rpc-url https://soroban-testnet.stellar.org --network-passphrase 'Test SDF Network ; September 2015'"

# Create test accounts if they don't exist
print_section "Setting up test accounts"

# Check if alice exists, create if not
if ! stellar keys ls | grep -q "alice"; then
    execute_command "Creating alice account" "stellar keys generate alice"
    execute_command "Funding alice account" "stellar keys fund alice --network testnet"
else
    echo -e "${GREEN}✓ Alice account already exists${NC}"
fi

# Check if bob exists, create if not
if ! stellar keys ls | grep -q "bob"; then
    execute_command "Creating bob account" "stellar keys generate bob"
    execute_command "Funding bob account" "stellar keys fund bob --network testnet"
else
    echo -e "${GREEN}✓ Bob account already exists${NC}"
fi

# Set up test parameters
print_section "Setting up test parameters"

# Export test variables
export ORDER_HASH="0101010101010101010101010101010101010101010101010101010101010101"
export HASH_LOCK="0202020202020202020202020202020202020202020202020202020202020202"
export DST_HASH_LOCK="0303030303030303030303030303030303030303030303030303030303030303"
export MAKER="GAFVHOGVUA5A6WZAAMCAYCNHA6ZRLGJ2WFLARJWXHXP6QIJCEI56JMBQ"
export TAKER="GD2RAKWBEOJ3P5YPURRWW6FRAYJYUQ2PH3GX6ITBM5VKML4O5TLAWWXC"
export TOKEN="GAFVHOGVUA5A5WZAAMCAYCNHA6ZRLGJ2WFLARJWXHXP6QIJCEI56JMBQ"
export AMOUNT="100000000"
export SAFETY_DEPOSIT="10000000"

# Timelock parameters (in ascending order)
export FINALITY_DELAY="10"
export SRC_WITHDRAWAL_DELAY="20"
export SRC_PUBLIC_WITHDRAWAL_DELAY="30"
export SRC_CANCELLATION_DELAY="40"
export SRC_PUBLIC_CANCELLATION_DELAY="50"
export DST_WITHDRAWAL_DELAY="60"
export DST_PUBLIC_WITHDRAWAL_DELAY="70"
export DST_CANCELLATION_DELAY="80"

echo -e "${GREEN}✓ Test parameters set${NC}"
echo ""

# Check contract information
print_section "Checking contract information"
execute_command "Inspecting factory contract" \
    "stellar contract inspect --id $FACTORY_CONTRACT_ID"

# Test create_src_escrow
print_section "Testing create_src_escrow function"
execute_command "Creating source escrow" \
    "stellar contract invoke --id $FACTORY_CONTRACT_ID --source alice --network testnet -- create_src_escrow --order_hash $ORDER_HASH --hash_lock $HASH_LOCK --maker $MAKER --taker $TAKER --token $TOKEN --amount $AMOUNT --safety_deposit $SAFETY_DEPOSIT --finality_delay $FINALITY_DELAY --src_withdrawal_delay $SRC_WITHDRAWAL_DELAY --src_public_withdrawal_delay $SRC_PUBLIC_WITHDRAWAL_DELAY --src_cancellation_delay $SRC_CANCELLATION_DELAY --src_public_cancellation_delay $SRC_PUBLIC_CANCELLATION_DELAY --dst_withdrawal_delay $DST_WITHDRAWAL_DELAY --dst_public_withdrawal_delay $DST_PUBLIC_WITHDRAWAL_DELAY --dst_cancellation_delay $DST_CANCELLATION_DELAY"

# Test create_dst_escrow
print_section "Testing create_dst_escrow function"
execute_command "Creating destination escrow" \
    "stellar contract invoke --id $FACTORY_CONTRACT_ID --source bob --network testnet -- create_dst_escrow --order_hash $ORDER_HASH --hash_lock $DST_HASH_LOCK --maker $MAKER --taker $TAKER --token $TOKEN --amount $AMOUNT --safety_deposit $SAFETY_DEPOSIT --finality_delay $FINALITY_DELAY --src_withdrawal_delay $SRC_WITHDRAWAL_DELAY --src_public_withdrawal_delay $SRC_PUBLIC_WITHDRAWAL_DELAY --src_cancellation_delay $SRC_CANCELLATION_DELAY --src_public_cancellation_delay $SRC_PUBLIC_CANCELLATION_DELAY --dst_withdrawal_delay $DST_WITHDRAWAL_DELAY --dst_public_withdrawal_delay $DST_PUBLIC_WITHDRAWAL_DELAY --dst_cancellation_delay $DST_CANCELLATION_DELAY"

# Test get_escrow_address
print_section "Testing get_escrow_address function"
execute_command "Getting source escrow address" \
    "stellar contract invoke --id $FACTORY_CONTRACT_ID --source alice --network testnet -- get_escrow_address --order_hash $ORDER_HASH --hash_lock $HASH_LOCK"

execute_command "Getting destination escrow address" \
    "stellar contract invoke --id $FACTORY_CONTRACT_ID --source alice --network testnet -- get_escrow_address --order_hash $ORDER_HASH --hash_lock $DST_HASH_LOCK"

# Test escrow_exists
print_section "Testing escrow_exists function"
execute_command "Checking if source escrow exists" \
    "stellar contract invoke --id $FACTORY_CONTRACT_ID --source alice --network testnet -- escrow_exists --order_hash $ORDER_HASH --hash_lock $HASH_LOCK"

execute_command "Checking if destination escrow exists" \
    "stellar contract invoke --id $FACTORY_CONTRACT_ID --source alice --network testnet -- escrow_exists --order_hash $ORDER_HASH --hash_lock $DST_HASH_LOCK"

# Test non-existent escrow
export NONEXISTENT_HASH="0404040404040404040404040404040404040404040404040404040404040404"
execute_command "Checking if non-existent escrow exists" \
    "stellar contract invoke --id $FACTORY_CONTRACT_ID --source alice --network testnet -- escrow_exists --order_hash $ORDER_HASH --hash_lock $NONEXISTENT_HASH"

# Check account balances
print_section "Checking account balances"
execute_command "Checking alice balance" "stellar account show alice"
execute_command "Checking bob balance" "stellar account show bob"

# View recent contract events
print_section "Viewing recent contract events"
execute_command "Getting recent contract events" \
    "stellar contract events --id $FACTORY_CONTRACT_ID --limit 5"

echo -e "${GREEN}=== Testing Complete ===${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Check the transaction hashes from the output above"
echo "2. Use 'stellar transaction show <HASH>' to view transaction details"
echo "3. Use 'stellar contract events --id $FACTORY_CONTRACT_ID' to view all events"
echo "4. Check the generated escrow addresses and test them individually"
echo ""
echo -e "${YELLOW}Note: If any command failed, check the error message and ensure:${NC}"
echo "- Accounts have sufficient XLM balance"
echo "- Network configuration is correct"
echo "- Contract ID is valid"
echo "- Parameters are in the correct format" 