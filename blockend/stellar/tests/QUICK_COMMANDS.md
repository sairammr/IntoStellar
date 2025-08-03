# Quick Commands Reference

## Setup (One-time)

```bash
# Install Stellar CLI
curl -sSfL https://soroban.stellar.org/install | sh

# Configure network
stellar config --rpc-url https://soroban-testnet.stellar.org --network-passphrase "Test SDF Network ; September 2015"

# Create test accounts
stellar keys generate alice
stellar keys fund alice --network testnet
stellar keys generate bob
stellar keys fund bob --network testnet
```

## Test Parameters

```bash
# Get account public keys
export ALICE_PUBKEY=$(stellar keys show alice)
export BOB_PUBKEY=$(stellar keys show bob)

# Test parameters
export ORDER_HASH="0101010101010101010101010101010101010101010101010101010101010101"
export HASH_LOCK="0202020202020202020202020202020202020202020202020202020202020202"
export MAKER="$ALICE_PUBKEY"
export TAKER="$BOB_PUBKEY"
export TOKEN="$ALICE_PUBKEY"
export AMOUNT="100000000"
export SAFETY_DEPOSIT="10000000"
```

## Core Functions

### 1. Create Source Escrow

```bash
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
  --timelocks '{ "finality_delay": 10, "src_withdrawal_delay": 20, "src_public_withdrawal_delay": 30, "src_cancellation_delay": 40, "src_public_cancellation_delay": 50, "dst_withdrawal_delay": 60, "dst_public_withdrawal_delay": 70, "dst_cancellation_delay": 80 }'
```

### 2. Create Destination Escrow

```bash
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
  --timelocks '{ "finality_delay": 10, "src_withdrawal_delay": 20, "src_public_withdrawal_delay": 30, "src_cancellation_delay": 40, "src_public_cancellation_delay": 50, "dst_withdrawal_delay": 60, "dst_public_withdrawal_delay": 70, "dst_cancellation_delay": 80 }' \
  --caller $TAKER
```

### 3. Get Escrow Address

```bash
stellar contract invoke \
  --id CB6YENCF3FP7JGU5K7CQY5T35K3JWCESH5I2PWOMZCKKMP5RZNN7NPMQ \
  --source alice \
  --network testnet \
  -- \
  get_escrow_address \
  --hash_lock $HASH_LOCK
```

### 4. Check Escrow Exists

```bash
stellar contract invoke \
  --id CB6YENCF3FP7JGU5K7CQY5T35K3JWCESH5I2PWOMZCKKMP5RZNN7NPMQ \
  --source alice \
  --network testnet \
  -- \
  escrow_exists \
  --hash_lock $HASH_LOCK
```

## Monitoring

### Check Transaction

```bash
stellar transaction show <TRANSACTION_HASH>
```

### View Contract Events

```bash
stellar contract events \
  --id CB6YENCF3FP7JGU5K7CQY5T35K3JWCESH5I2PWOMZCKKMP5RZNN7NPMQ \
  --limit 10
```

### Check Account Balance

```bash
stellar account show alice
stellar account show bob
```

## Run Full Test Suite

```bash
./test_factory_cli.sh
```

## Contract Info

- **ID**: `CB6YENCF3FP7JGU5K7CQY5T35K3JWCESH5I2PWOMZCKKMP5RZNN7NPMQ`
- **Network**: Testnet
- **RPC**: `https://soroban-testnet.stellar.org`

## Test Results

✅ **Successfully tested:**

- `create_src_escrow` - Creates escrow with address `CDK75TQDJB2NET7P4E3ZCA6F4LQR2R3VF6QNI4ZGBD6SI5JYT3QAHVEV`
- `get_escrow_address` - Returns correct escrow address
- `escrow_exists` - Returns `true` for existing escrow, `false` for non-existent
- `get_admin` - Returns admin address
