// 📝 Relayer Configuration Template
// Copy this to relayer-service/src/config/Config.ts and fill in your values

export const CONFIG = {
  contracts: {
    stellar: {
      escrowFactory: "C[YOUR_FACTORY_CONTRACT_ID]", // From deployment
    },
    ethereum: {
      escrowFactory: "0x[YOUR_ETHEREUM_FACTORY_ADDRESS]", // Deploy on Sepolia
    },
  },
  networks: {
    stellar: {
      horizonUrl: "https://horizon-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
      privateKey: "[YOUR_STELLAR_PRIVATE_KEY]",
      accountId: "[YOUR_STELLAR_ACCOUNT_ID]",
    },
    ethereum: {
      rpcUrl: "https://sepolia.infura.io/v3/[YOUR_INFURA_KEY]",
      privateKey: "[YOUR_ETHEREUM_PRIVATE_KEY]",
      chainId: 11155111, // Sepolia
      gasLimit: 500000,
      confirmations: 12,
    },
  },
  monitoring: {
    healthCheckInterval: 30000, // 30 seconds
    eventSyncInterval: 10000, // 10 seconds
    secretDistributionDelay: 60000, // 1 minute
    maxRetries: 3,
  },
  logging: {
    level: "info",
    format: "json",
  },
};
