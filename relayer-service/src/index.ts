/**
 * @fileoverview Main entry point for the Fusion+ Cross-Chain Relayer Service
 *
 * This service monitors events on both Ethereum and Stellar networks to facilitate
 * atomic swaps between the two chains using the 1inch Fusion+ protocol.
 */

import dotenv from "dotenv";
import { RelayerService } from "./services/RelayerService";
import { EthereumEventMonitor } from "./monitors/EthereumEventMonitor";
import { StellarEventMonitor } from "./monitors/StellarEventMonitor";
import { SecretManager } from "./services/SecretManager";
import { Logger } from "./utils/Logger";
import { Config } from "./config/Config";

// Load environment variables
dotenv.config();

/**
 * Main application class that orchestrates the relayer service
 */
class FusionPlusRelayer {
  private relayerService: RelayerService;
  private ethereumMonitor: EthereumEventMonitor;
  private stellarMonitor: StellarEventMonitor;
  private secretManager: SecretManager;
  private logger = Logger.getInstance();

  constructor() {
    this.logger.info("Initializing Fusion+ Cross-Chain Relayer Service");

    // Initialize core services
    this.secretManager = new SecretManager();
    this.relayerService = new RelayerService(this.secretManager);

    // Initialize event monitors
    this.ethereumMonitor = new EthereumEventMonitor(this.relayerService);
    this.stellarMonitor = new StellarEventMonitor(this.relayerService);
  }

  /**
   * Start the relayer service
   */
  async start(): Promise<void> {
    try {
      this.logger.info("Starting Fusion+ Relayer Service...");

      // Validate configuration
      await this.validateConfig();

      // Start secret manager
      await this.secretManager.initialize();

      // Start event monitors
      await this.ethereumMonitor.start();
      await this.stellarMonitor.start();

      // Start the main relayer service
      await this.relayerService.start();

      this.logger.info("🚀 Fusion+ Relayer Service started successfully!");

      // Setup graceful shutdown
      this.setupGracefulShutdown();
    } catch (error) {
      this.logger.error("Failed to start relayer service:", error);
      process.exit(1);
    }
  }

  /**
   * Stop the relayer service gracefully
   */
  async stop(): Promise<void> {
    this.logger.info("Stopping Fusion+ Relayer Service...");

    try {
      await this.ethereumMonitor.stop();
      await this.stellarMonitor.stop();
      await this.relayerService.stop();
      await this.secretManager.cleanup();

      this.logger.info("✅ Fusion+ Relayer Service stopped gracefully");
    } catch (error) {
      this.logger.error("Error during shutdown:", error);
    }
  }

  /**
   * Validate configuration before starting
   */
  private async validateConfig(): Promise<void> {
    const config = Config.getInstance();

    if (!config.ethereum.rpcUrl) {
      throw new Error("Ethereum RPC URL not configured");
    }

    if (!config.stellar.horizonUrl) {
      throw new Error("Stellar Horizon URL not configured");
    }

    if (!config.contracts.ethereum.escrowFactory) {
      throw new Error("Ethereum EscrowFactory address not configured");
    }

    if (!config.contracts.stellar.escrowFactory) {
      throw new Error("Stellar EscrowFactory address not configured");
    }

    this.logger.info("Configuration validated successfully");
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const signals = ["SIGINT", "SIGTERM", "SIGQUIT"] as const;

    signals.forEach((signal) => {
      process.on(signal, async () => {
        this.logger.info(`Received ${signal}, initiating graceful shutdown...`);
        await this.stop();
        process.exit(0);
      });
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      this.logger.error("Uncaught exception:", error);
      this.stop().finally(() => process.exit(1));
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      this.logger.error(
        "Unhandled promise rejection at:",
        promise,
        "reason:",
        reason
      );
      this.stop().finally(() => process.exit(1));
    });
  }
}

// Start the application
async function main() {
  const relayer = new FusionPlusRelayer();
  await relayer.start();
}

// Only run if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Failed to start application:", error);
    process.exit(1);
  });
}

export { FusionPlusRelayer };
