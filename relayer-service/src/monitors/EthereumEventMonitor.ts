/**
 * @fileoverview Ethereum event monitor for escrow creation and lifecycle events
 */

import { ethers } from "ethers";
import { Logger } from "../utils/Logger";
import { Config } from "../config/Config";
import { RelayerService, EscrowCreatedEvent } from "../services/RelayerService";

// EscrowFactory ABI (minimal interface for events)
const ESCROW_FACTORY_ABI = [
  "event SrcEscrowCreated((bytes32 orderHash, bytes32 hashlock, address maker, (uint160) taker, address token, uint256 amount, uint256 safetyDeposit, (uint32 finality, uint32 srcWithdrawal, uint32 srcCancellation, uint32 dstWithdrawal, uint32 dstCancellation, uint32 deployedAt) timelocks), (address maker, uint256 amount, address token, uint128 safetyDeposit, uint256 chainId))",
  "event DstEscrowCreated(address indexed escrow, bytes32 indexed hashlock, (uint160) indexed taker)",
];

// Base Escrow ABI for withdrawal/cancellation events
const BASE_ESCROW_ABI = [
  "event Withdrawal(bytes32 secret)",
  "event EscrowCancelled()",
];

export interface EthereumEventMonitorConfig {
  provider: ethers.Provider;
  escrowFactoryAddress: string;
  startBlock?: number;
  pollInterval?: number;
}

/**
 * Monitors Ethereum events related to escrow creation and lifecycle
 */
export class EthereumEventMonitor {
  private logger = Logger.getInstance();
  private config = Config.getInstance();
  private relayerService: RelayerService;
  private provider: ethers.Provider;
  private escrowFactory: ethers.Contract;
  private running = false;
  private lastProcessedBlock = 0;

  constructor(relayerService: RelayerService) {
    this.relayerService = relayerService;
    this.initializeProvider();
    this.initializeContracts();
  }

  /**
   * Start monitoring Ethereum events
   */
  async start(): Promise<void> {
    this.logger.info("Starting Ethereum event monitor...");

    try {
      // Get current block number
      const currentBlock = await this.provider.getBlockNumber();
      this.lastProcessedBlock =
        currentBlock - this.config.ethereum.confirmations;

      this.logger.info("Ethereum event monitor started", {
        currentBlock,
        startBlock: this.lastProcessedBlock,
        confirmations: this.config.ethereum.confirmations,
      });

      this.running = true;

      // Start listening for real-time events
      this.startRealtimeListening();

      // Start historical event sync
      this.startHistoricalSync();
    } catch (error) {
      this.logger.error("Failed to start Ethereum event monitor:", error);
      throw error;
    }
  }

  /**
   * Stop monitoring Ethereum events
   */
  async stop(): Promise<void> {
    this.logger.info("Stopping Ethereum event monitor...");
    this.running = false;

    // Remove all event listeners
    this.escrowFactory.removeAllListeners();

    this.logger.info("Ethereum event monitor stopped");
  }

  /**
   * Initialize Ethereum provider
   */
  private initializeProvider(): void {
    const ethConfig = this.config.ethereum;

    if (ethConfig.wsUrl) {
      // Use WebSocket provider for real-time events
      this.provider = new ethers.WebSocketProvider(ethConfig.wsUrl);
    } else {
      // Use JSON-RPC provider
      this.provider = new ethers.JsonRpcProvider(ethConfig.rpcUrl);
    }

    this.logger.debug("Initialized Ethereum provider", {
      chainId: ethConfig.chainId,
      hasWebSocket: !!ethConfig.wsUrl,
    });
  }

  /**
   * Initialize contract instances
   */
  private initializeContracts(): void {
    this.escrowFactory = new ethers.Contract(
      this.config.contracts.ethereum.escrowFactory,
      ESCROW_FACTORY_ABI,
      this.provider
    );

    this.logger.debug("Initialized Ethereum contracts", {
      escrowFactory: this.config.contracts.ethereum.escrowFactory,
    });
  }

  /**
   * Start listening for real-time events
   */
  private startRealtimeListening(): void {
    // Listen for SrcEscrowCreated events
    this.escrowFactory.on(
      "SrcEscrowCreated",
      async (immutables, dstComplement, event) => {
        try {
          await this.handleSrcEscrowCreated(immutables, dstComplement, event);
        } catch (error) {
          this.logger.error("Error handling SrcEscrowCreated event:", error);
        }
      }
    );

    // Listen for DstEscrowCreated events
    this.escrowFactory.on(
      "DstEscrowCreated",
      async (escrowAddress, hashLock, taker, event) => {
        try {
          await this.handleDstEscrowCreated(
            escrowAddress,
            hashLock,
            taker,
            event
          );
        } catch (error) {
          this.logger.error("Error handling DstEscrowCreated event:", error);
        }
      }
    );

    this.logger.debug("Started real-time event listening");
  }

  /**
   * Start historical event synchronization
   */
  private startHistoricalSync(): void {
    const syncHistoricalEvents = async () => {
      if (!this.running) return;

      try {
        const currentBlock = await this.provider.getBlockNumber();
        const confirmedBlock =
          currentBlock - this.config.ethereum.confirmations;

        if (confirmedBlock > this.lastProcessedBlock) {
          await this.syncEventsBetweenBlocks(
            this.lastProcessedBlock + 1,
            confirmedBlock
          );
          this.lastProcessedBlock = confirmedBlock;
        }
      } catch (error) {
        this.logger.error("Error during historical sync:", error);
      }

      // Schedule next sync
      if (this.running) {
        setTimeout(
          syncHistoricalEvents,
          this.config.monitoring.eventSyncInterval
        );
      }
    };

    // Start first sync
    setTimeout(syncHistoricalEvents, 1000);
  }

  /**
   * Sync events between specific block numbers
   */
  private async syncEventsBetweenBlocks(
    fromBlock: number,
    toBlock: number
  ): Promise<void> {
    this.logger.debug("Syncing events between blocks", { fromBlock, toBlock });

    try {
      // Query SrcEscrowCreated events
      const srcEscrowFilter = this.escrowFactory.filters.SrcEscrowCreated();
      const srcEvents = await this.escrowFactory.queryFilter(
        srcEscrowFilter,
        fromBlock,
        toBlock
      );

      for (const event of srcEvents) {
        if (event.args) {
          await this.handleSrcEscrowCreated(
            event.args[0],
            event.args[1],
            event
          );
        }
      }

      // Query DstEscrowCreated events
      const dstEscrowFilter = this.escrowFactory.filters.DstEscrowCreated();
      const dstEvents = await this.escrowFactory.queryFilter(
        dstEscrowFilter,
        fromBlock,
        toBlock
      );

      for (const event of dstEvents) {
        if (event.args) {
          await this.handleDstEscrowCreated(
            event.args[0],
            event.args[1],
            event.args[2],
            event
          );
        }
      }

      this.logger.debug("Completed event sync", {
        fromBlock,
        toBlock,
        srcEvents: srcEvents.length,
        dstEvents: dstEvents.length,
      });
    } catch (error) {
      this.logger.error("Error syncing events between blocks:", error);
    }
  }

  /**
   * Handle SrcEscrowCreated event
   */
  private async handleSrcEscrowCreated(
    immutables: any,
    dstComplement: any,
    event: ethers.EventLog
  ): Promise<void> {
    try {
      const escrowEvent: EscrowCreatedEvent = {
        hashLock: immutables.hashlock,
        maker: immutables.maker,
        resolver: immutables.taker.toString(), // Convert from packed address
        token: immutables.token,
        amount: immutables.amount.toString(),
        safetyDeposit: immutables.safetyDeposit.toString(),
        chain: "ethereum",
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        timestamp: Date.now(),
      };

      this.logger.info("Detected SrcEscrowCreated event", {
        hashLock: escrowEvent.hashLock,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
      });

      // Emit to relayer service
      this.relayerService.emit("escrowCreated", escrowEvent);
    } catch (error) {
      this.logger.error("Error processing SrcEscrowCreated event:", error);
    }
  }

  /**
   * Handle DstEscrowCreated event
   */
  private async handleDstEscrowCreated(
    escrowAddress: string,
    hashLock: string,
    taker: any,
    event: ethers.EventLog
  ): Promise<void> {
    try {
      // We need to get more details about the escrow from the escrow contract itself
      // For now, we'll just log it as we primarily care about SrcEscrowCreated for cross-chain
      this.logger.info("Detected DstEscrowCreated event", {
        escrowAddress,
        hashLock,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
      });

      // You could query the escrow contract for full details if needed
      // and emit an escrowCreated event
    } catch (error) {
      this.logger.error("Error processing DstEscrowCreated event:", error);
    }
  }

  /**
   * Monitor withdrawals for a specific escrow
   */
  async monitorEscrowWithdrawals(
    escrowAddress: string,
    hashLock: string
  ): Promise<void> {
    try {
      const escrowContract = new ethers.Contract(
        escrowAddress,
        BASE_ESCROW_ABI,
        this.provider
      );

      // Listen for withdrawal events
      escrowContract.on("Withdrawal", (secret: string) => {
        this.logger.info("Detected withdrawal", {
          escrowAddress,
          hashLock,
          secret,
        });

        this.relayerService.emit("withdrawal", {
          hashLock,
          chain: "ethereum",
          secret,
          escrowAddress,
        });
      });

      // Listen for cancellation events
      escrowContract.on("EscrowCancelled", () => {
        this.logger.info("Detected escrow cancellation", {
          escrowAddress,
          hashLock,
        });

        this.relayerService.emit("cancellation", {
          hashLock,
          chain: "ethereum",
          escrowAddress,
        });
      });
    } catch (error) {
      this.logger.error("Error setting up escrow monitoring:", error);
    }
  }

  /**
   * Get current status
   */
  getStatus(): {
    running: boolean;
    lastProcessedBlock: number;
    provider: string;
  } {
    return {
      running: this.running,
      lastProcessedBlock: this.lastProcessedBlock,
      provider: this.config.ethereum.rpcUrl,
    };
  }
}
