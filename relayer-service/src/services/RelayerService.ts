/**
 * @fileoverview Core relayer service that orchestrates cross-chain atomic swaps
 */

import { EventEmitter } from "events";
import { Logger } from "../utils/Logger";
import { SecretManager } from "./SecretManager";
import { Config } from "../config/Config";

export interface EscrowCreatedEvent {
  hashLock: string;
  maker: string;
  resolver: string;
  token: string;
  amount: string;
  safetyDeposit: string;
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
  private activeSwaps = new Map<string, SwapStatus>();
  private running = false;

  constructor(secretManager: SecretManager) {
    super();
    this.secretManager = secretManager;
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
   * Distribute the secret to complete the swap
   */
  private async distributeSecret(hashLock: string): Promise<void> {
    const swapStatus = this.activeSwaps.get(hashLock);
    if (!swapStatus || swapStatus.secretRevealed || swapStatus.cancelled) {
      return;
    }

    try {
      this.logger.info(`Distributing secret for swap`, { hashLock });

      // Get the secret from secret manager
      const secret = await this.secretManager.revealSecret(hashLock);
      if (!secret) {
        throw new Error("Secret not found for hash lock");
      }

      swapStatus.secretRevealed = true;
      swapStatus.secretValue = secret;
      swapStatus.updatedAt = Date.now();

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
}
