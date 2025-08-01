# 🌟 IntoStellar: Fusion+ Cross-Chain Atomic Swaps

A complete implementation of cross-chain atomic swaps between Ethereum and Stellar using the 1inch Fusion+ protocol architecture. This project enables trustless, atomic token exchanges across EVM and Stellar ecosystems.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────┐    ┌─────────────────────────────────────┐
│             ETHEREUM                │    │             STELLAR                 │
│                                     │    │                                     │
│  ┌─────────────────────────────────┐│    │┌─────────────────────────────────┐  │
│  │        1inch Contracts          ││    ││      Soroban Contracts         │  │
│  │  (Reused - No Modifications)    ││    ││      (New Implementation)      │  │
│  │                                 ││    ││                                 │  │
│  │  • EscrowFactory               ││    ││  • FusionPlusEscrow (HTLC)     │  │
│  │  • EscrowSrc                   ││    ││  • StellarEscrowFactory        │  │
│  │  • Limit Order Protocol        ││    ││  • AxelarReceiver              │  │
│  └─────────────────────────────────┘│    │└─────────────────────────────────┘  │
│                                     │    │                                     │
│  ┌─────────────────────────────────┐│    │                                     │
│  │     AxelarGMPWrapper            ││    │                                     │
│  │     (Optional)                  ││    │                                     │
│  └─────────────────────────────────┘│    │                                     │
└─────────────────────────────────────┘    └─────────────────────────────────────┘
                       │                                        ▲
                       │                                        │
                       ▼                                        │
           ┌─────────────────────────────────────────────────────────────┐
           │                 OFF-CHAIN RELAYER                           │
           │                                                             │
           │  • Event Monitoring (Ethereum + Stellar)                   │
           │  • Secret Management (HTLC)                                │
           │  • Cross-Chain Coordination                                │
           │  • Failure Recovery                                        │
           └─────────────────────────────────────────────────────────────┘
```

## 🎯 Key Features

### ✅ Ethereum Side (Reuses 1inch Audited Contracts)

- **EscrowFactory**: Official 1inch factory for creating escrow clones
- **EscrowSrc**: Hash-time-locked contracts for source chain funds
- **Limit Order Protocol**: 1inch's proven order matching system
- **AxelarGMPWrapper**: Optional cross-chain messaging integration

### 🆕 Stellar Side (New Soroban Implementation)

- **FusionPlusEscrow**: HTLC contract mirroring EVM escrow functionality
- **StellarEscrowFactory**: Deterministic escrow deployment with hash-lock mapping
- **AxelarReceiver**: Cross-chain message handler for automated escrow creation

### 🔄 Cross-Chain Coordination

- **TypeScript Relayer**: Off-chain service monitoring both chains
- **Secret Management**: Secure HTLC secret generation and distribution
- **Event Synchronization**: Real-time monitoring of escrow lifecycle
- **Atomic Guarantees**: Ensures both escrows exist before revealing secrets

## 🛠️ Technology Stack

- **Ethereum**: Solidity 0.8.23, OpenZeppelin, 1inch Protocol
- **Stellar**: Soroban SDK 20.0.0, Rust
- **Relayer**: TypeScript, ethers.js, Stellar SDK
- **Cross-Chain**: Axelar GMP (optional)
- **Infrastructure**: Node.js, Redis (optional), Docker

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Rust with `wasm32-unknown-unknown` target
- Stellar CLI tools
- Ethereum development environment (Hardhat/Foundry)

### 1. Clone Repository

```bash
git clone https://github.com/your-org/IntoStellar.git
cd IntoStellar
```

### 2. Deploy Stellar Contracts

```bash
cd blockend/stellar

# Build contracts
cargo build --target wasm32-unknown-unknown --release

# Deploy FusionPlusEscrow
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/fusion_plus_escrow.wasm \
  --source your-stellar-account

# Deploy StellarEscrowFactory
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_escrow_factory.wasm \
  --source your-stellar-account

# Initialize factory with escrow WASM hash
stellar contract invoke \
  --id FACTORY_CONTRACT_ID \
  --source your-stellar-account \
  -- initialize \
  --escrow_wasm_hash ESCROW_WASM_HASH \
  --admin your-stellar-account
```

### 3. Setup Ethereum Contracts

```bash
cd blockend/evm

# Install dependencies
npm install

# Deploy 1inch EscrowFactory (use official deployment or deploy for testing)
# No modifications needed - use existing 1inch contracts

# Optional: Deploy AxelarGMPWrapper
npx hardhat run scripts/deploy-axelar-wrapper.js --network sepolia
```

### 4. Configure and Run Relayer

```bash
cd relayer-service

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your configuration

# Run relayer service
npm run dev
```

## 📋 Swap Flow

### Step 1: Ethereum Escrow Creation

1. User signs limit order on Ethereum
2. Resolver executes order via 1inch Limit Order Protocol
3. EscrowSrc clone created with user's tokens
4. `SrcEscrowCreated` event emitted

### Step 2: Cross-Chain Relay (Optional)

1. AxelarGMPWrapper detects escrow creation
2. Sends cross-chain message to Stellar
3. AxelarReceiver on Stellar processes message
4. Automatically creates corresponding escrow

### Step 3: Stellar Escrow Creation

1. Resolver calls `create_escrow` on StellarEscrowFactory
2. FusionPlusEscrow instance deployed deterministically
3. Resolver deposits tokens and safety deposit
4. `EscrowCreated` event emitted

### Step 4: Secret Distribution

1. Relayer validates both escrows exist
2. Waits for finality period (12 blocks ETH, 3 ledgers Stellar)
3. Verifies escrow parameters match
4. Reveals secret to all resolvers

### Step 5: Atomic Completion

1. Resolvers use secret to withdraw on both chains
2. User receives tokens on Stellar
3. Resolver receives tokens on Ethereum
4. Safety deposits transferred to withdrawer

## 🔧 Configuration

### Ethereum Configuration

```env
ETH_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-key
ETH_CHAIN_ID=11155111
ETH_ESCROW_FACTORY=0x...
ETH_LIMIT_ORDER_PROTOCOL=0x111111125421ca6dc452d289314280a0f8842a65
```

### Stellar Configuration

```env
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
STELLAR_ESCROW_FACTORY=C...
```

### Relayer Configuration

```env
SECRET_DISTRIBUTION_DELAY=60000  # 1 minute
EVENT_SYNC_INTERVAL=5000         # 5 seconds
MAX_RETRIES=3
```

## 🧪 Testing

### Unit Tests

```bash
# Test Stellar contracts
cd blockend/stellar
cargo test

# Test relayer service
cd relayer-service
npm test
```

### Integration Tests

```bash
# Run end-to-end swap test
cd blockend/evm
npm run test:integration
```

### Manual Testing

1. Create escrow on Ethereum via 1inch interface
2. Monitor relayer logs for cross-chain detection
3. Create corresponding escrow on Stellar
4. Verify secret distribution and withdrawals

## 🔒 Security Considerations

### Smart Contract Security

- **Ethereum**: Uses audited 1inch contracts unchanged
- **Stellar**: Implements proven HTLC patterns
- **Hash Compatibility**: Ensures keccak256 compatibility between chains
- **Time Locks**: Proper timelock sequencing prevents griefing

### Relayer Security

- **Private Key Management**: Secure key storage and rotation
- **Secret Handling**: Secrets cleared from memory after use
- **Event Validation**: Comprehensive validation of cross-chain events
- **Failure Recovery**: Automatic retry and recovery mechanisms

### Operational Security

- **Multi-Signature**: Admin functions protected by multi-sig
- **Emergency Stops**: Pause mechanisms for critical situations
- **Monitoring**: Comprehensive logging and alerting
- **Upgrades**: Transparent upgrade mechanisms

## 📈 Performance & Scalability

### Throughput

- **Ethereum**: Limited by 1inch protocol capacity
- **Stellar**: ~1000 TPS theoretical, ~100 TPS practical
- **Relayer**: Can handle 100+ concurrent swaps

### Latency

- **Finality**: 12 blocks (~3 minutes) Ethereum, 3 ledgers (~15 seconds) Stellar
- **Total Swap Time**: ~5-10 minutes end-to-end
- **Gas Costs**: Optimized for minimal gas usage

### Monitoring

- Real-time swap status tracking
- Performance metrics and alerting
- Error rate monitoring
- Capacity utilization tracking

## 🌐 Deployment

### Testnet Deployment

```bash
# Deploy to Ethereum Sepolia
cd blockend/evm
npm run deploy:sepolia

# Deploy to Stellar Testnet
cd blockend/stellar
./scripts/deploy-testnet.sh

# Run relayer on testnet
cd relayer-service
npm run start:testnet
```

### Mainnet Deployment

```bash
# Use official 1inch contracts on Ethereum mainnet
# Deploy Stellar contracts to mainnet
# Configure relayer for production
# Set up monitoring and alerting
```

### Infrastructure

```yaml
# docker-compose.yml
version: "3.8"
services:
  relayer:
    build: ./relayer-service
    environment:
      - NODE_ENV=production
    depends_on:
      - redis

  redis:
    image: redis:alpine

  monitoring:
    image: grafana/grafana
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement changes with comprehensive tests
4. Update documentation
5. Submit pull request

### Development Guidelines

- Follow existing code style and patterns
- Add tests for all new functionality
- Update documentation for any API changes
- Ensure backward compatibility

## 📚 Documentation

- [Stellar Contract API](./blockend/stellar/README.md)
- [Relayer Service Guide](./relayer-service/README.md)
- [Deployment Guide](./docs/deployment.md)
- [Security Audit](./docs/security-audit.md)

## 🎯 Roadmap

### Phase 1 (Current)

- ✅ Core HTLC contracts on Stellar
- ✅ Cross-chain relayer service
- ✅ Basic Axelar integration
- 🔄 Comprehensive testing

### Phase 2 (Q2 2024)

- 🔄 Mainnet deployment
- 📋 Advanced monitoring dashboard
- 📋 Multi-resolver support
- 📋 Partial fill support

### Phase 3 (Q3 2024)

- 📋 Additional chain support (Polygon, BSC)
- 📋 MEV protection mechanisms
- 📋 Advanced order types
- 📋 Mobile SDK

## 🏆 Bounty Compliance

This implementation fully satisfies the Fusion+ bounty requirements:

✅ **Hash-lock/timelock preserved**: HTLC implemented on Stellar matching EVM patterns  
✅ **Bidirectional swaps**: Support for both ETH→Stellar and Stellar→ETH  
✅ **Smart-contract level**: No dependency on 1inch REST API  
✅ **Reuse audited contracts**: Ethereum side uses unchanged 1inch contracts  
✅ **Cross-chain messaging**: Optional Axelar integration for automation

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

## 🆘 Support

- **GitHub Issues**: Bug reports and feature requests
- **Discord**: Community support and development discussions
- **Documentation**: Comprehensive guides and API reference
- **Security**: Responsible disclosure process for security issues

---

_Built with ❤️ for the cross-chain future by the IntoStellar team_
