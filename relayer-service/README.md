# Fusion+ Cross-Chain Relayer Service

An off-chain relayer service that facilitates atomic swaps between Ethereum and Stellar using the 1inch Fusion+ protocol.

## Overview

This service monitors escrow creation events on both Ethereum and Stellar networks, manages secrets for hash-time-locked contracts (HTLC), and coordinates the cross-chain swap process to ensure atomic execution.

## Features

- **Event Monitoring**: Real-time monitoring of escrow events on Ethereum and Stellar
- **Secret Management**: Secure generation and distribution of secrets for HTLC
- **Cross-Chain Coordination**: Ensures both escrows are properly created before revealing secrets
- **Failure Recovery**: Handles timeout scenarios and provides recovery mechanisms
- **Comprehensive Logging**: Detailed logging for monitoring and debugging
- **Health Monitoring**: Built-in health checks and statistics

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Ethereum      │    │  Relayer Service │    │    Stellar      │
│   EscrowSrc     │◄──►│                  │◄──►│  FusionEscrow   │
│                 │    │  ┌─────────────┐ │    │                 │
│ Events:         │    │  │SecretManager│ │    │ Events:         │
│ • SrcCreated    │    │  │             │ │    │ • EscrowCreated │
│ • Withdrawal    │    │  └─────────────┘ │    │ • Withdrawal    │
│ • Cancellation  │    │                  │    │ • Cancellation  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure the following:

### Ethereum Configuration

- `ETH_RPC_URL`: Ethereum RPC endpoint
- `ETH_WS_URL`: Ethereum WebSocket endpoint (optional, for real-time events)
- `ETH_CHAIN_ID`: Ethereum chain ID (1 for mainnet, 11155111 for Sepolia)
- `ETH_PRIVATE_KEY`: Private key for transaction signing
- `ETH_CONFIRMATIONS`: Number of confirmations to wait for finality

### Stellar Configuration

- `STELLAR_HORIZON_URL`: Stellar Horizon server URL
- `STELLAR_NETWORK_PASSPHRASE`: Stellar network passphrase
- `STELLAR_PRIVATE_KEY`: Stellar account private key
- `STELLAR_ACCOUNT_ID`: Stellar account public key

### Contract Addresses

- `ETH_ESCROW_FACTORY`: Ethereum EscrowFactory contract address
- `ETH_LIMIT_ORDER_PROTOCOL`: 1inch Limit Order Protocol address
- `STELLAR_ESCROW_FACTORY`: Stellar EscrowFactory contract ID

### Optional Services

- **Redis**: For persistent state management

## Usage

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

### Testing

```bash
npm test
```

## Swap Lifecycle

1. **Escrow Creation**: Service detects `SrcEscrowCreated` event on Ethereum
2. **Cross-Chain Relay**: Detects escrow creation and triggers corresponding escrow on other chain
3. **Stellar Escrow**: Monitors for corresponding escrow creation on Stellar
4. **Validation**: Validates that both escrows have matching parameters
5. **Secret Distribution**: After finality period, reveals the secret to resolvers
6. **Completion**: Monitors withdrawal events on both chains

## API Endpoints

The service exposes the following endpoints for monitoring:

- `GET /health` - Health check
- `GET /status` - Service status and statistics
- `GET /swaps` - Active swaps
- `GET /swaps/:hashLock` - Specific swap status
- `POST /trigger-escrow` - Manually trigger escrow creation (admin)
- `POST /reveal-secret` - Manually reveal secret (admin)

## Event Types

### Escrow Events

- `escrowCreated` - New escrow detected
- `withdrawal` - Escrow withdrawal detected
- `cancellation` - Escrow cancellation detected

### Swap Events

- `secretDistributed` - Secret revealed to resolvers
- `swapCompleted` - Cross-chain swap completed
- `swapFailed` - Swap failed or cancelled

## Error Handling

The service implements comprehensive error handling:

- **Network Failures**: Automatic retry with exponential backoff
- **Event Processing**: Failed events are logged and retried
- **Secret Management**: Secrets are securely stored and cleaned up
- **Graceful Shutdown**: Proper cleanup on service termination

## Monitoring

### Logs

- Application logs are written to `logs/` directory
- Structured JSON logging for production environments
- Configurable log levels (debug, info, warn, error)

### Metrics

- Active swaps count
- Completed/cancelled swap statistics
- Event processing metrics
- Error rates and types

## Security Considerations

1. **Private Keys**: Store private keys securely (consider using HSM or key management services)
2. **Secret Management**: Secrets are kept in memory and cleaned up after use
3. **Network Security**: Use TLS for all external communications
4. **Rate Limiting**: Implement rate limiting for public endpoints
5. **Access Control**: Restrict access to sensitive operations

## Deployment

### Docker

```bash
docker build -t fusion-plus-relayer .
docker run -d --env-file .env fusion-plus-relayer
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fusion-plus-relayer
spec:
  replicas: 1
  selector:
    matchLabels:
      app: fusion-plus-relayer
  template:
    metadata:
      labels:
        app: fusion-plus-relayer
    spec:
      containers:
        - name: relayer
          image: fusion-plus-relayer:latest
          envFrom:
            - secretRef:
                name: relayer-config
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement changes with tests
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support and questions:

- GitHub Issues: [Report bugs and request features]
- Documentation: [Detailed API documentation]
- Discord: [Community chat]
