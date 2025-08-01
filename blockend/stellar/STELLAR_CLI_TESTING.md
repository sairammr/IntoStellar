# Stellar Factory Contract CLI Testing Guide

This guide provides step-by-step commands to test the Stellar Escrow Factory contract directly using the Stellar CLI.

## Contract Information

- **Factory Contract ID**: `CB6YENCF3FP7JGU5K7CQY5T35K3JWCESH5I2PWOMZCKKMP5RZNN7NPMQ`
- **Network**: Testnet
- **RPC URL**: `https://soroban-testnet.stellar.org`

## Prerequisites

1. **Install Stellar CLI** (if not already installed):

   ```bash
   curl -sSfL https://soroban.stellar.org/install | sh
   ```

2. **Set up network configuration**:

   ```bash
   stellar config --rpc-url https://soroban-testnet.stellar.org --network-passphrase "Test SDF Network ; September 2015"
   ```

3. **Create test accounts** (if needed):

   ```bash
   # Create alice account
   stellar keys generate alice
   stellar keys fund alice --network testnet

   # Create bob account
   stellar keys generate bob
   stellar keys fund bob --network testnet
   ```

## Test Commands

### 1. Check Contract Information

```bash
# Get contract details
stellar contract inspect --id CB6YENCF3FP7JGU5K7CQY5T35K3JWCESH5I2PWOMZCKKMP5RZNN7NPMQ
```

### 2. Test Parameters Setup

Set up test variables for consistent testing:

```bash
# Test parameters
export ORDER_HASH="0101010101010101010101010101010101010101010101010101010101010101"
export HASH_LOCK="0202020202020202020202020202020202020202020202020202020202020202"
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
```

### 3. Test create_src_escrow Function

```bash
# Create source escrow
stellar contract invoke \
  --id CB6YENCF3FP7JGU5K7CQY5T35K3JWCESH5I2PWOMZCKKMP5RZNN7NPMQ \
  --source alice \
  --network testnet \
  -- \
  create_src_escrow \
  --order_hash $ORDER_HASH \
  --hash_lock $HASH_LOCK \
  --maker $MAKER \
  --taker $TAKER \
  --token $TOKEN \
  --amount $AMOUNT \
  --safety_deposit $SAFETY_DEPOSIT \
  --finality_delay $FINALITY_DELAY \
  --src_withdrawal_delay $SRC_WITHDRAWAL_DELAY \
  --src_public_withdrawal_delay $SRC_PUBLIC_WITHDRAWAL_DELAY \
  --src_cancellation_delay $SRC_CANCELLATION_DELAY \
  --src_public_cancellation_delay $SRC_PUBLIC_CANCELLATION_DELAY \
  --dst_withdrawal_delay $DST_WITHDRAWAL_DELAY \
  --dst_public_withdrawal_delay $DST_PUBLIC_WITHDRAWAL_DELAY \
  --dst_cancellation_delay $DST_CANCELLATION_DELAY
```

### 4. Test create_dst_escrow Function

```bash
# Create destination escrow (use different hash lock to avoid conflicts)
export DST_HASH_LOCK="0303030303030303030303030303030303030303030303030303030303030303"

stellar contract invoke \
  --id CB6YENCF3FP7JGU5K7CQY5T35K3JWCESH5I2PWOMZCKKMP5RZNN7NPMQ \
  --source bob \
  --network testnet \
  -- \
  create_dst_escrow \
  --order_hash $ORDER_HASH \
  --hash_lock $DST_HASH_LOCK \
  --maker $MAKER \
  --taker $TAKER \
  --token $TOKEN \
  --amount $AMOUNT \
  --safety_deposit $SAFETY_DEPOSIT \
  --finality_delay $FINALITY_DELAY \
  --src_withdrawal_delay $SRC_WITHDRAWAL_DELAY \
  --src_public_withdrawal_delay $SRC_PUBLIC_WITHDRAWAL_DELAY \
  --src_cancellation_delay $SRC_CANCELLATION_DELAY \
  --src_public_cancellation_delay $SRC_PUBLIC_CANCELLATION_DELAY \
  --dst_withdrawal_delay $DST_WITHDRAWAL_DELAY \
  --dst_public_withdrawal_delay $DST_PUBLIC_WITHDRAWAL_DELAY \
  --dst_cancellation_delay $DST_CANCELLATION_DELAY
```

### 5. Test get_escrow_address Function

```bash
# Get escrow address for source escrow
stellar contract invoke \
  --id CB6YENCF3FP7JGU5K7CQY5T35K3JWCESH5I2PWOMZCKKMP5RZNN7NPMQ \
  --source alice \
  --network testnet \
  -- \
  get_escrow_address \
  --order_hash $ORDER_HASH \
  --hash_lock $HASH_LOCK

# Get escrow address for destination escrow
stellar contract invoke \
  --id CB6YENCF3FP7JGU5K7CQY5T35K3JWCESH5I2PWOMZCKKMP5RZNN7NPMQ \
  --source alice \
  --network testnet \
  -- \
  get_escrow_address \
  --order_hash $ORDER_HASH \
  --hash_lock $DST_HASH_LOCK
```

### 6. Test escrow_exists Function

```bash
# Check if source escrow exists
stellar contract invoke \
  --id CB6YENCF3FP7JGU5K7CQY5T35K3JWCESH5I2PWOMZCKKMP5RZNN7NPMQ \
  --source alice \
  --network testnet \
  -- \
  escrow_exists \
  --order_hash $ORDER_HASH \
  --hash_lock $HASH_LOCK

# Check if destination escrow exists
stellar contract invoke \
  --id CB6YENCF3FP7JGU5K7CQY5T35K3JWCESH5I2PWOMZCKKMP5RZNN7NPMQ \
  --source alice \
  --network testnet \
  -- \
  escrow_exists \
  --order_hash $ORDER_HASH \
  --hash_lock $DST_HASH_LOCK

# Check if non-existent escrow exists
export NONEXISTENT_HASH="0404040404040404040404040404040404040404040404040404040404040404"
stellar contract invoke \
  --id CB6YENCF3FP7JGU5K7CQY5T35K3JWCESH5I2PWOMZCKKMP5RZNN7NPMQ \
  --source alice \
  --network testnet \
  -- \
  escrow_exists \
  --order_hash $ORDER_HASH \
  --hash_lock $NONEXISTENT_HASH
```

## Advanced Testing Scenarios

### 7. Test with Different Parameters

```bash
# Test with different amounts
export AMOUNT_2="50000000"
export SAFETY_DEPOSIT_2="5000000"

stellar contract invoke \
  --id CB6YENCF3FP7JGU5K7CQY5T35K3JWCESH5I2PWOMZCKKMP5RZNN7NPMQ \
  --source alice \
  --network testnet \
  -- \
  create_src_escrow \
  --order_hash $ORDER_HASH \
  --hash_lock $HASH_LOCK \
  --maker $MAKER \
  --taker $TAKER \
  --token $TOKEN \
  --amount $AMOUNT_2 \
  --safety_deposit $SAFETY_DEPOSIT_2 \
  --finality_delay $FINALITY_DELAY \
  --src_withdrawal_delay $SRC_WITHDRAWAL_DELAY \
  --src_public_withdrawal_delay $SRC_PUBLIC_WITHDRAWAL_DELAY \
  --src_cancellation_delay $SRC_CANCELLATION_DELAY \
  --src_public_cancellation_delay $SRC_PUBLIC_CANCELLATION_DELAY \
  --dst_withdrawal_delay $DST_WITHDRAWAL_DELAY \
  --dst_public_withdrawal_delay $DST_PUBLIC_WITHDRAWAL_DELAY \
  --dst_cancellation_delay $DST_CANCELLATION_DELAY
```

### 8. Test Error Cases

```bash
# Test with invalid timelock order (should fail)
export INVALID_FINALITY_DELAY="100"  # Higher than other delays

stellar contract invoke \
  --id CB6YENCF3FP7JGU5K7CQY5T35K3JWCESH5I2PWOMZCKKMP5RZNN7NPMQ \
  --source alice \
  --network testnet \
  -- \
  create_src_escrow \
  --order_hash $ORDER_HASH \
  --hash_lock $HASH_LOCK \
  --maker $MAKER \
  --taker $TAKER \
  --token $TOKEN \
  --amount $AMOUNT \
  --safety_deposit $SAFETY_DEPOSIT \
  --finality_delay $INVALID_FINALITY_DELAY \
  --src_withdrawal_delay $SRC_WITHDRAWAL_DELAY \
  --src_public_withdrawal_delay $SRC_PUBLIC_WITHDRAWAL_DELAY \
  --src_cancellation_delay $SRC_CANCELLATION_DELAY \
  --src_public_cancellation_delay $SRC_PUBLIC_CANCELLATION_DELAY \
  --dst_withdrawal_delay $DST_WITHDRAWAL_DELAY \
  --dst_public_withdrawal_delay $DST_PUBLIC_WITHDRAWAL_DELAY \
  --dst_cancellation_delay $DST_CANCELLATION_DELAY
```

### 9. Test Duplicate Escrow Creation

```bash
# Try to create the same escrow twice (should fail)
stellar contract invoke \
  --id CB6YENCF3FP7JGU5K7CQY5T35K3JWCESH5I2PWOMZCKKMP5RZNN7NPMQ \
  --source alice \
  --network testnet \
  -- \
  create_src_escrow \
  --order_hash $ORDER_HASH \
  --hash_lock $HASH_LOCK \
  --maker $MAKER \
  --taker $TAKER \
  --token $TOKEN \
  --amount $AMOUNT \
  --safety_deposit $SAFETY_DEPOSIT \
  --finality_delay $FINALITY_DELAY \
  --src_withdrawal_delay $SRC_WITHDRAWAL_DELAY \
  --src_public_withdrawal_delay $SRC_PUBLIC_WITHDRAWAL_DELAY \
  --src_cancellation_delay $SRC_CANCELLATION_DELAY \
  --src_public_cancellation_delay $SRC_PUBLIC_CANCELLATION_DELAY \
  --dst_withdrawal_delay $DST_WITHDRAWAL_DELAY \
  --dst_public_withdrawal_delay $DST_PUBLIC_WITHDRAWAL_DELAY \
  --dst_cancellation_delay $DST_CANCELLATION_DELAY
```

## Monitoring and Debugging

### 10. Check Transaction Status

```bash
# After running any command, check the transaction status
stellar transaction show <TRANSACTION_HASH>
```

### 11. View Contract Events

```bash
# Get recent events from the contract
stellar contract events \
  --id CB6YENCF3FP7JGU5K7CQY5T35K3JWCESH5I2PWOMZCKKMP5RZNN7NPMQ \
  --limit 10
```

### 12. Check Account Balances

```bash
# Check alice balance
stellar account show alice

# Check bob balance
stellar account show bob
```

## Expected Results

### Successful create_src_escrow:

- Should return a transaction hash
- Should emit a `SrcEscrowCreated` event
- Should create a new escrow contract

### Successful create_dst_escrow:

- Should return a transaction hash
- Should emit a `DstEscrowCreated` event
- Should create a new escrow contract

### Successful get_escrow_address:

- Should return the escrow contract address for existing escrows
- Should return null/empty for non-existent escrows

### Successful escrow_exists:

- Should return `true` for existing escrows
- Should return `false` for non-existent escrows

## Troubleshooting

### Common Issues:

1. **"Account not found"**: Fund the account using `stellar keys fund <account>`
2. **"Insufficient balance"**: Check account balance and fund if needed
3. **"Invalid timelock order"**: Ensure timelock delays are in ascending order
4. **"Escrow already exists"**: Use different order hash or hash lock
5. **"Transaction failed"**: Check the transaction details for specific error

### Debug Commands:

```bash
# Check network status
stellar network show

# Check account details
stellar account show <ACCOUNT_NAME>

# View recent transactions
stellar transaction list <ACCOUNT_NAME> --limit 5
```

## Notes

- All commands use the testnet network
- Make sure to have sufficient XLM balance in test accounts
- The factory contract ID is hardcoded for this testing
- Timelock parameters must be in ascending order
- Each escrow creation requires a unique combination of order hash and hash lock
