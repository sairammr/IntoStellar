/**
 * @fileoverview Configuration management for the Fusion+ Relayer Service
 */

export interface EthereumConfig {
  rpcUrl: string;
  wsUrl?: string;
  chainId: number;
  privateKey: string;
  gasLimit: number;
  gasPrice?: string;
  confirmations: number;
}

export interface StellarConfig {
  horizonUrl: string;
  networkPassphrase: string;
  privateKey: string;
  accountId: string;
  allowHttp?: boolean;
}

export interface ContractConfig {
  ethereum: {
    escrowFactory: string;
    limitOrderProtocol: string;
  };
  stellar: {
    escrowFactory: string;
    limitOrderProtocol: string;
    resolver: string;
  };
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
}

export interface RelayerConfig {
  ethereum: EthereumConfig;
  stellar: StellarConfig;
  contracts: ContractConfig;
  redis?: RedisConfig;
  monitoring: {
    healthCheckInterval: number;
    eventSyncInterval: number;
    secretDistributionDelay: number;
    maxRetries: number;
  };
  logging: {
    level: "debug" | "info" | "warn" | "error";
    format: "json" | "simple";
  };
}

/**
 * Singleton configuration class
 */
export class Config {
  private static instance: Config;
  private config: RelayerConfig;

  private constructor() {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  /**
   * Get the full configuration
   */
  getConfig(): RelayerConfig {
    return this.config;
  }

  /**
   * Get Ethereum configuration
   */
  get ethereum(): EthereumConfig {
    return this.config.ethereum;
  }

  /**
   * Get Stellar configuration
   */
  get stellar(): StellarConfig {
    return this.config.stellar;
  }

  /**
   * Get contract addresses
   */
  get contracts(): ContractConfig {
    return this.config.contracts;
  }

  /**
   * Get Redis configuration
   */
  get redis(): RedisConfig | undefined {
    return this.config.redis;
  }

  /**
   * Get monitoring configuration
   */
  get monitoring() {
    return this.config.monitoring;
  }

  /**
   * Get logging configuration
   */
  get logging() {
    return this.config.logging;
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfig(): RelayerConfig {
    return {
      ethereum: {
        rpcUrl: this.getEnvVar("ETH_RPC_URL"),
        wsUrl: process.env.ETH_WS_URL,
        chainId: parseInt(this.getEnvVar("ETH_CHAIN_ID", "1")),
        privateKey: this.getEnvVar("ETH_PRIVATE_KEY"),
        gasLimit: parseInt(this.getEnvVar("ETH_GAS_LIMIT", "500000")),
        gasPrice: process.env.ETH_GAS_PRICE,
        confirmations: parseInt(this.getEnvVar("ETH_CONFIRMATIONS", "12")),
      },
      stellar: {
        horizonUrl: this.getEnvVar(
          "STELLAR_HORIZON_URL",
          "https://horizon.stellar.org"
        ),
        networkPassphrase: this.getEnvVar(
          "STELLAR_NETWORK_PASSPHRASE",
          "Public Global Stellar Network ; September 2015"
        ),
        privateKey: this.getEnvVar("STELLAR_PRIVATE_KEY"),
        accountId: this.getEnvVar("STELLAR_ACCOUNT_ID"),
      },
      contracts: {
        ethereum: {
          escrowFactory: this.getEnvVar("ETH_ESCROW_FACTORY"),
          limitOrderProtocol: this.getEnvVar("ETH_LIMIT_ORDER_PROTOCOL"),
        },
        stellar: {
          escrowFactory: this.getEnvVar("STELLAR_ESCROW_FACTORY"),
          limitOrderProtocol: this.getEnvVar("STELLAR_LIMIT_ORDER_PROTOCOL"),
          resolver: this.getEnvVar("STELLAR_RESOLVER"),
        },
      },

      redis: process.env.REDIS_HOST
        ? {
            host: this.getEnvVar("REDIS_HOST", "localhost"),
            port: parseInt(this.getEnvVar("REDIS_PORT", "6379")),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(this.getEnvVar("REDIS_DB", "0")),
          }
        : undefined,
      monitoring: {
        healthCheckInterval: parseInt(
          this.getEnvVar("HEALTH_CHECK_INTERVAL", "30000")
        ),
        eventSyncInterval: parseInt(
          this.getEnvVar("EVENT_SYNC_INTERVAL", "5000")
        ),
        secretDistributionDelay: parseInt(
          this.getEnvVar("SECRET_DISTRIBUTION_DELAY", "60000")
        ),
        maxRetries: parseInt(this.getEnvVar("MAX_RETRIES", "3")),
      },
      logging: {
        level: (process.env.LOG_LEVEL as any) || "info",
        format: (process.env.LOG_FORMAT as any) || "simple",
      },
    };
  }

  /**
   * Get environment variable with optional default
   */
  private getEnvVar(name: string, defaultValue?: string): string {
    const value = process.env[name];
    if (value === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Environment variable ${name} is required but not set`);
    }
    return value;
  }

  /**
   * Validate the configuration
   */
  private validateConfig(): void {
    // Validate Ethereum config
    if (!this.config.ethereum.rpcUrl.startsWith("http")) {
      throw new Error("Invalid Ethereum RPC URL");
    }

    if (!this.config.ethereum.privateKey.startsWith("0x")) {
      throw new Error("Invalid Ethereum private key format");
    }

    // Validate Stellar config
    if (!this.config.stellar.horizonUrl.startsWith("http")) {
      throw new Error("Invalid Stellar Horizon URL");
    }

    // Validate contract addresses
    if (
      !this.isValidEthereumAddress(this.config.contracts.ethereum.escrowFactory)
    ) {
      throw new Error("Invalid Ethereum EscrowFactory address");
    }

    if (
      !this.isValidEthereumAddress(
        this.config.contracts.ethereum.limitOrderProtocol
      )
    ) {
      throw new Error("Invalid Ethereum LimitOrderProtocol address");
    }

    // Validate chain IDs
    const validEthChainIds = [1, 3, 4, 5, 42, 137, 56, 11155111]; // Mainnet, testnets, Polygon, BSC, Sepolia
    if (!validEthChainIds.includes(this.config.ethereum.chainId)) {
      console.warn(
        `Warning: Unusual Ethereum chain ID: ${this.config.ethereum.chainId}`
      );
    }
  }

  /**
   * Check if a string is a valid Ethereum address
   */
  private isValidEthereumAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Update configuration at runtime (for testing)
   */
  updateConfig(updates: Partial<RelayerConfig>): void {
    this.config = { ...this.config, ...updates };
    this.validateConfig();
  }
}
