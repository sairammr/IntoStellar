/**
 * @fileoverview Core relayer service that orchestrates cross-chain atomic swaps
 */

import { EventEmitter } from "events";
import { Logger } from "../utils/Logger";
import { SecretManager } from "./SecretManager";
import { Config } from "../config/Config";
import { TimelockManager } from "../utils/TimelockManager";
import { TimelockData } from "../types/Events";
import { CrossChainOrchestrator } from "./CrossChainOrchestrator";

export interface EscrowCreatedEvent {
  hashLock: string;
  orderHash: string;
  maker: string;
  taker: string;
  token: string;
  amount: string;
  safetyDeposit: string;
  timelocks: TimelockData;
  chain: "ethereum" | "stellar";
  blockNumber?: number;
  transactionHash: string;
  timestamp: number;
}

export interface SwapStatus {
  hashLock: string;
  ethereumEscrow?: EscrowCreatedEvent;
  stellarEscrow?: EscrowCreatedEvent;
  secretRevealed: boolean;
  secretValue?: string;
  completed: boolean;
  cancelled: boolean;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Core service that manages the cross-chain swap lifecycle
 */
export class RelayerService extends EventEmitter {
  private logger = Logger.getInstance();
  private config = Config.getInstance();
  private secretManager: SecretManager;
  private timelockManager = new TimelockManager();
  private crossChainOrchestrator: CrossChainOrchestrator;
  private activeSwaps = new Map<string, SwapStatus>();
  private running = false;

  constructor(secretManager: SecretManager) {
    super();
    this.secretManager = secretManager;
    this.crossChainOrchestrator = new CrossChainOrchestrator();
    this.setupEventHandlers();
  }

  /**
   * Start the relayer service
   */
  async start(): Promise<void> {
    this.logger.info("Starting RelayerService...");
    this.running = true;

    // Start periodic cleanup
    this.startPeriodicCleanup();

    this.logger.info("RelayerService started successfully");
  }

  /**
   * Stop the relayer service
   */
  async stop(): Promise<void> {
    this.logger.info("Stopping RelayerService...");
    this.running = false;
    this.removeAllListeners();
    this.logger.info("RelayerService stopped");
  }

  /**
   * Handle escrow creation on either chain
   */
  async handleEscrowCreated(event: EscrowCreatedEvent): Promise<void> {
    const { hashLock, chain } = event;

    this.logger.info(`Escrow created on ${chain}`, {
      hashLock,
      chain,
      transactionHash: event.transactionHash,
    });

    // Get or create swap status
    let swapStatus = this.activeSwaps.get(hashLock);
    if (!swapStatus) {
      swapStatus = {
        hashLock,
        secretRevealed: false,
        completed: false,
        cancelled: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.activeSwaps.set(hashLock, swapStatus);
    }

    // Update with escrow info
    if (chain === "ethereum") {
      swapStatus.ethereumEscrow = event;
    } else {
      swapStatus.stellarEscrow = event;
    }
    swapStatus.updatedAt = Date.now();

    // 🚀 CRITICAL FIX: Automatically create corresponding escrow on the other chain
    try {
      await this.crossChainOrchestrator.handleEscrowCreated(event);
      this.logger.info("Cross-chain escrow creation initiated", {
        hashLock,
        chain,
      });
    } catch (error) {
      this.logger.error("Failed to create cross-chain escrow", {
        hashLock,
        chain,
        error,
      });
      // Don't fail the entire process, just log the error
    }

    // Check if both escrows are ready
    await this.checkSwapReadiness(hashLock);
  }

  /**
   * Check if both escrows are ready and initiate secret distribution
   */
  private async checkSwapReadiness(hashLock: string): Promise<void> {
    const swapStatus = this.activeSwaps.get(hashLock);
    if (!swapStatus) return;

    const { ethereumEscrow, stellarEscrow } = swapStatus;

    // Both escrows must exist
    if (!ethereumEscrow || !stellarEscrow) {
      this.logger.debug(`Waiting for both escrows to be created`, { hashLock });
      return;
    }

    // Validate escrow parameters match
    if (!this.validateEscrowsMatch(ethereumEscrow, stellarEscrow)) {
      swapStatus.error = "Escrow parameters do not match";
      swapStatus.cancelled = true;
      this.logger.error(`Escrow validation failed`, {
        hashLock,
        error: swapStatus.error,
      });
      return;
    }

    this.logger.info(
      `Both escrows ready, waiting for secret distribution delay`,
      { hashLock }
    );

    // Wait for finality/safety period before revealing secret
    setTimeout(async () => {
      await this.distributeSecret(hashLock);
    }, this.config.monitoring.secretDistributionDelay);
  }

  /**
   * Distribute the secret to complete the swap with 7-stage timelock validation
   */
  private async distributeSecret(hashLock: string): Promise<void> {
    const swapStatus = this.activeSwaps.get(hashLock);
    if (!swapStatus || swapStatus.secretRevealed || swapStatus.cancelled) {
      return;
    }

    // Must have both escrows to proceed
    if (!swapStatus.ethereumEscrow || !swapStatus.stellarEscrow) {
      this.logger.debug("Waiting for both escrows to be created", { hashLock });
      return;
    }

    try {
      const currentTime = Date.now();

      // Validate timelock compatibility
      if (
        !this.timelockManager.validateTimelocks(
          swapStatus.ethereumEscrow.timelocks
        )
      ) {
        throw new Error("Invalid Ethereum timelock configuration");
      }
      if (
        !this.timelockManager.validateTimelocks(
          swapStatus.stellarEscrow.timelocks
        )
      ) {
        throw new Error("Invalid Stellar timelock configuration");
      }

      // Check if we should distribute the secret now
      const shouldDistribute = this.timelockManager.shouldDistributeSecret(
        swapStatus.ethereumEscrow.timelocks,
        swapStatus.stellarEscrow.timelocks,
        currentTime
      );

      if (!shouldDistribute) {
        this.logger.debug("Not yet time to distribute secret", {
          hashLock,
          currentTime,
          ethereumTimelocks: swapStatus.ethereumEscrow.timelocks,
          stellarTimelocks: swapStatus.stellarEscrow.timelocks,
        });

        // Schedule for retry later
        setTimeout(() => this.distributeSecret(hashLock), 30000); // Check again in 30 seconds
        return;
      }

      this.logger.info(`Distributing secret for swap`, { hashLock });

      // Get the secret from secret manager
      const secret = await this.secretManager.revealSecret(hashLock);
      if (!secret) {
        throw new Error("Secret not found for hash lock");
      }

      swapStatus.secretRevealed = true;
      swapStatus.secretValue = secret;
      swapStatus.updatedAt = Date.now();

      // Log timelock status for debugging
      this.timelockManager.logStatus(
        hashLock,
        swapStatus.ethereumEscrow.timelocks,
        currentTime
      );

      this.logger.info(`Secret distributed successfully`, { hashLock });

      // Emit event for monitoring
      this.emit("secretDistributed", { hashLock, secret });

      // Monitor withdrawal completion
      this.monitorWithdrawals(hashLock);
    } catch (error) {
      this.logger.error(`Failed to distribute secret`, error);
      swapStatus.error = `Secret distribution failed: ${error}`;
      swapStatus.cancelled = true;
    }
  }

  /**
   * Monitor withdrawals on both chains
   */
  private monitorWithdrawals(hashLock: string): void {
    const swapStatus = this.activeSwaps.get(hashLock);
    if (!swapStatus) return;

    // Set up timeout for withdrawal monitoring
    const timeout = setTimeout(() => {
      const status = this.activeSwaps.get(hashLock);
      if (status && !status.completed) {
        this.logger.warn(`Withdrawal timeout reached`, { hashLock });
        // Could trigger recovery mechanisms here
      }
    }, 300000); // 5 minutes

    // Listen for withdrawal events
    const withdrawalHandler = (event: { hashLock: string; chain: string }) => {
      if (event.hashLock === hashLock) {
        clearTimeout(timeout);
        this.handleWithdrawal(hashLock, event.chain);
      }
    };

    this.on("withdrawal", withdrawalHandler);

    // Clean up listener after timeout
    setTimeout(() => {
      this.off("withdrawal", withdrawalHandler);
    }, 600000); // 10 minutes
  }

  /**
   * Handle withdrawal completion
   */
  private handleWithdrawal(hashLock: string, chain: string): void {
    const swapStatus = this.activeSwaps.get(hashLock);
    if (!swapStatus) return;

    this.logger.info(`Withdrawal detected on ${chain}`, { hashLock, chain });

    // Mark as completed if this is the first withdrawal
    if (!swapStatus.completed) {
      swapStatus.completed = true;
      swapStatus.updatedAt = Date.now();

      this.logger.info(`Swap completed successfully`, { hashLock });
      this.emit("swapCompleted", { hashLock, chain });
    }
  }

  /**
   * Validate that escrow parameters match between chains
   */
  private validateEscrowsMatch(
    eth: EscrowCreatedEvent,
    stellar: EscrowCreatedEvent
  ): boolean {
    // Check that essential parameters match
    if (eth.hashLock !== stellar.hashLock) {
      this.logger.error("Hash locks do not match", {
        ethHashLock: eth.hashLock,
        stellarHashLock: stellar.hashLock,
      });
      return false;
    }

    // Check amounts (accounting for potential decimal differences)
    const ethAmount = BigInt(eth.amount);
    const stellarAmount = BigInt(stellar.amount);

    // Add reasonable tolerance for decimal conversion differences
    const tolerance = ethAmount / BigInt(1000); // 0.1% tolerance
    const diff =
      ethAmount > stellarAmount
        ? ethAmount - stellarAmount
        : stellarAmount - ethAmount;

    if (diff > tolerance) {
      this.logger.error("Amounts do not match within tolerance", {
        ethAmount: eth.amount,
        stellarAmount: stellar.amount,
        difference: diff.toString(),
      });
      return false;
    }

    return true;
  }

  /**
   * Set up event handlers for the relayer service
   */
  private setupEventHandlers(): void {
    this.on("escrowCreated", this.handleEscrowCreated.bind(this));

    this.on("error", (error) => {
      this.logger.error("RelayerService error:", error);
    });
  }

  /**
   * Start periodic cleanup of old swaps
   */
  private startPeriodicCleanup(): void {
    const cleanup = () => {
      if (!this.running) return;

      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      for (const [hashLock, swap] of this.activeSwaps.entries()) {
        if (now - swap.createdAt > maxAge) {
          this.logger.debug(`Cleaning up old swap`, {
            hashLock,
            age: now - swap.createdAt,
          });
          this.activeSwaps.delete(hashLock);
        }
      }

      // Schedule next cleanup
      setTimeout(cleanup, 60 * 60 * 1000); // Every hour
    };

    // Start first cleanup in 1 hour
    setTimeout(cleanup, 60 * 60 * 1000);
  }

  /**
   * Get status of all active swaps
   */
  getActiveSwaps(): SwapStatus[] {
    return Array.from(this.activeSwaps.values());
  }

  /**
   * Get status of a specific swap
   */
  getSwapStatus(hashLock: string): SwapStatus | undefined {
    return this.activeSwaps.get(hashLock);
  }

  /**
   * Get a specific swap (alias for getSwapStatus)
   */
  getSwap(hashLock: string): SwapStatus | undefined {
    return this.getSwapStatus(hashLock);
  }

  /**
   * Get service statistics (alias for getStatistics)
   */
  getStats() {
    return this.getStatistics();
  }

  /**
   * Manually reveal a secret for a swap (admin function)
   */
  async manualSecretReveal(hashLock: string, secret: string): Promise<boolean> {
    const swap = this.activeSwaps.get(hashLock);
    if (!swap) {
      throw new Error(`Swap with hashLock ${hashLock} not found`);
    }

    if (swap.secretRevealed) {
      throw new Error(`Secret for swap ${hashLock} already revealed`);
    }

    // Validate the secret matches the hash lock
    const crypto = require("crypto");
    const hash = crypto
      .createHash("sha256")
      .update(Buffer.from(secret, "hex"))
      .digest("hex");
    if (`0x${hash}` !== hashLock) {
      throw new Error("Secret does not match hash lock");
    }

    this.logger.info(`Manual secret reveal for swap ${hashLock}`);

    // Update swap status
    swap.secretRevealed = true;
    swap.secretValue = secret;
    swap.updatedAt = Date.now();

    // Emit the secret revealed event
    await this.secretManager.revealSecret(hashLock);
    this.emit("secretRevealed", { hashLock, secret });

    return true;
  }

  /**
   * Get statistics about the relayer service
   */
  getStatistics(): {
    activeSwaps: number;
    completedSwaps: number;
    cancelledSwaps: number;
    totalSwaps: number;
  } {
    const swaps = Array.from(this.activeSwaps.values());
    return {
      activeSwaps: swaps.filter((s) => !s.completed && !s.cancelled).length,
      completedSwaps: swaps.filter((s) => s.completed).length,
      cancelledSwaps: swaps.filter((s) => s.cancelled).length,
      totalSwaps: swaps.length,
    };
  }

  async getStatus(): Promise<{
    activeSwaps: number;
    completedSwaps: number;
    cancelledSwaps: number;
    totalSwaps: number;
    orchestratorStatus: {
      ethereumConnected: boolean;
      ethereumAddress: string;
      ethereumFactoryAddress: string;
    };
  }> {
    const orchestratorStatus = await this.crossChainOrchestrator.getStatus();
    const stats = this.getStatistics();

    return {
      activeSwaps: stats.activeSwaps,
      completedSwaps: stats.completedSwaps,
      cancelledSwaps: stats.cancelledSwaps,
      totalSwaps: stats.totalSwaps,
      orchestratorStatus: {
        ethereumConnected: orchestratorStatus.ethereumConnected,
        ethereumAddress: orchestratorStatus.ethereumAddress,
        ethereumFactoryAddress: orchestratorStatus.ethereumFactoryAddress,
      },
    };
  }
}
