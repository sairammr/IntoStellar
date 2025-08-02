/**
 * @fileoverview Stellar event monitor for escrow creation and lifecycle events
 */

import { Horizon } from "@stellar/stellar-sdk";
import StellarSdk from "@stellar/stellar-sdk";
const { Server } = StellarSdk;
import { Logger } from "../utils/Logger";
import { Config } from "../config/Config";
import { RelayerService, EscrowCreatedEvent } from "../services/RelayerService";
import { StellarProvider } from "../services/StellarProvider";
import { XDRDecoder, DecodedContractEvent } from "../utils/XDRDecoder";

export interface StellarEventMonitorConfig {
  horizonUrl: string;
  networkPassphrase: string;
  escrowFactoryId: string;
  startLedger?: number;
  pollInterval?: number;
}

/**
 * Monitors Stellar events related to escrow creation and lifecycle
 */
export class StellarEventMonitor {
  private logger = Logger.getInstance();
  private config = Config.getInstance();
  private relayerService: RelayerService;
  private stellarProvider: StellarProvider;
  private xdrDecoder: XDRDecoder;
  private running = false;
  private lastProcessedLedger = 0;
  private eventStreamCloser?: () => void;

  constructor(relayerService: RelayerService) {
    this.relayerService = relayerService;
    this.stellarProvider = new StellarProvider();
    this.xdrDecoder = new XDRDecoder();
  }

  /**
   * Start monitoring Stellar events
   */
  async start(): Promise<void> {
    this.logger.info("Starting Stellar event monitor...");

    try {
      // Get current ledger number
      const currentLedger = await this.stellarProvider.getCurrentLedger();
      this.lastProcessedLedger = Math.max(0, currentLedger - 10); // Start 10 ledgers back for safety

      this.logger.info("Stellar event monitor started", {
        currentLedger,
        startLedger: this.lastProcessedLedger,
      });

      this.running = true;

      // Start monitoring contract events
      this.startEventMonitoring();

      // Start periodic ledger sync
      this.startLedgerSync();
    } catch (error) {
      this.logger.error("Failed to start Stellar event monitor:", error);
      throw error;
    }
  }

  /**
   * Stop monitoring Stellar events
   */
  async stop(): Promise<void> {
    this.logger.info("Stopping Stellar event monitor...");
    this.running = false;

    // Close event streams
    if (this.eventStreamCloser) {
      this.eventStreamCloser();
    }

    this.logger.info("Stellar event monitor stopped");
  }

  /**
   * Start monitoring contract events
   */
  private startEventMonitoring(): void {
    try {
      const server = this.stellarProvider.getServer();

      // Monitor contract call operations for the escrow factory
      this.eventStreamCloser = server
        .operations()
        .forAccount(this.config.contracts.stellar.escrowFactory)
        .cursor("now")
        .stream({
          onmessage: (operation: any) => {
            this.handleOperation(operation);
          },
          onerror: (error: any) => {
            this.logger.error("Stellar event stream error:", error);
            // Attempt to reconnect
            if (this.running) {
              setTimeout(() => this.startEventMonitoring(), 5000);
            }
          },
        });

      this.logger.debug("Started Stellar event monitoring");
    } catch (error) {
      this.logger.error("Error starting Stellar event monitoring:", error);
    }
  }

  /**
   * Start periodic ledger synchronization
   */
  private startLedgerSync(): void {
    const syncLedgers = async () => {
      if (!this.running) return;

      try {
        const currentLedger = await this.stellarProvider.getCurrentLedger();
        const confirmedLedger = Math.max(0, currentLedger - 3); // Wait for 3 ledgers for finality

        if (confirmedLedger > this.lastProcessedLedger) {
          await this.syncLedgersBetween(
            this.lastProcessedLedger + 1,
            confirmedLedger
          );
          this.lastProcessedLedger = confirmedLedger;
        }
      } catch (error) {
        this.logger.error("Error during ledger sync:", error);
      }

      // Schedule next sync
      if (this.running) {
        setTimeout(syncLedgers, this.config.monitoring.eventSyncInterval);
      }
    };

    // Start first sync
    setTimeout(syncLedgers, 2000);
  }

  /**
   * Sync ledgers between specific ledger numbers
   */
  private async syncLedgersBetween(
    fromLedger: number,
    toLedger: number
  ): Promise<void> {
    this.logger.debug("Syncing ledgers", { fromLedger, toLedger });

    try {
      // Query operations for the escrow factory in the ledger range
      for (let ledger = fromLedger; ledger <= toLedger; ledger++) {
        await this.processLedger(ledger);
      }

      this.logger.debug("Completed ledger sync", { fromLedger, toLedger });
    } catch (error) {
      this.logger.error("Error syncing ledgers:", error);
    }
  }

  /**
   * Process a specific ledger for escrow events
   */
  private async processLedger(ledgerSeq: number): Promise<void> {
    try {
      const server = this.stellarProvider.getServer();
      const operations = await server
        .operations()
        .forLedger(ledgerSeq.toString())
        .limit(200)
        .call();

      for (const operation of operations.records) {
        if (this.isEscrowFactoryOperation(operation)) {
          await this.handleOperation(operation);
        }
      }
    } catch (error) {
      this.logger.error(`Error processing ledger ${ledgerSeq}:`, error);
    }
  }

  /**
   * Check if an operation is related to our escrow factory
   */
  private isEscrowFactoryOperation(
    operation: Horizon.ServerApi.OperationRecord
  ): boolean {
    // Check if it's an invoke contract operation
    if (operation.type !== "invoke_host_function") {
      return false;
    }

    const invokeOp =
      operation as Horizon.HorizonApi.InvokeHostFunctionOperationResponse;

    // Check if the contract being called is our escrow factory
    // Note: You'll need to adapt this based on how Stellar contract calls are structured
    return (
      invokeOp.source_account === this.config.contracts.stellar.escrowFactory ||
      (invokeOp as any).contract === this.config.contracts.stellar.escrowFactory
    );
  }

  /**
   * Handle a Stellar operation
   */
  private async handleOperation(
    operation: Horizon.ServerApi.OperationRecord
  ): Promise<void> {
    try {
      if (operation.type === "invoke_host_function") {
        await this.handleContractInvocation(
          operation as Horizon.HorizonApi.InvokeHostFunctionOperationResponse
        );
      }
    } catch (error) {
      this.logger.error("Error handling Stellar operation:", error);
    }
  }

  /**
   * Handle contract invocation operations
   */
  private async handleContractInvocation(
    operation: Horizon.HorizonApi.InvokeHostFunctionOperationResponse
  ): Promise<void> {
    try {
      // Get the transaction details to access events
      const transaction = await this.stellarProvider.getTransaction(
        operation.transaction_hash
      );

      // Parse contract events from the transaction
      await this.parseContractEvents(transaction, operation);
    } catch (error) {
      this.logger.error("Error handling contract invocation:", error);
    }
  }

  /**
   * Parse contract events from a transaction
   */
  private async parseContractEvents(
    transaction: any,
    operation: Horizon.HorizonApi.InvokeHostFunctionOperationResponse
  ): Promise<void> {
    try {
      // Get contract events from the transaction using XDR decoder
      const events = await this.stellarProvider.getContractEvents(
        transaction.hash
      );

      // Process events
      for (const event of events) {
        await this.processContractEvent(event, transaction, operation);
      }

      // Fallback: try to infer from operation if no events found
      if (events.length === 0) {
        await this.processOperationFallback(transaction, operation);
      }
    } catch (error) {
      this.logger.error("Error parsing contract events:", error);
    }
  }

  /**
   * Process a contract event
   */
  private async processContractEvent(
    event: DecodedContractEvent,
    transaction: any,
    operation: any
  ): Promise<void> {
    try {
      // Map event types to our handlers
      switch (event.type) {
        case "EscrowCreated":
        case "escrow_created":
          await this.handleEscrowCreatedEvent(transaction, operation, event);
          break;
        case "Withdrawal":
        case "withdrawal":
          await this.handleWithdrawalEvent(transaction, operation, event);
          break;
        case "Cancellation":
        case "cancellation":
          await this.handleCancellationEvent(transaction, operation, event);
          break;
        default:
          this.logger.debug("Unknown contract event type", {
            type: event.type,
          });
      }
    } catch (error) {
      this.logger.error("Error processing contract event:", error);
    }
  }

  /**
   * Fallback processing when no events are found
   */
  private async processOperationFallback(
    transaction: any,
    operation: any
  ): Promise<void> {
    try {
      const functionName = this.extractFunctionName(operation);

      if (
        functionName === "create_src_escrow" ||
        functionName === "create_dst_escrow"
      ) {
        await this.handleEscrowCreatedEvent(transaction, operation);
      } else if (functionName === "withdraw") {
        await this.handleWithdrawalEvent(transaction, operation);
      } else if (functionName === "cancel") {
        await this.handleCancellationEvent(transaction, operation);
      }
    } catch (error) {
      this.logger.error("Error in operation fallback processing:", error);
    }
  }

  /**
   * Extract function name from contract invocation
   */
  private extractFunctionName(
    operation: Horizon.HorizonApi.InvokeHostFunctionOperationResponse
  ): string {
    // This is a placeholder implementation
    // In practice, you'd decode the XDR to get the actual function name

    // For now, we'll try to infer from operation parameters or metadata
    // You'll need to implement proper XDR decoding here

    return "unknown";
  }

  /**
   * Handle escrow created event
   */
  private async handleEscrowCreatedEvent(
    transaction: any,
    operation: any,
    event?: any
  ): Promise<void> {
    try {
      // Extract escrow parameters from the operation or event
      // This is a simplified implementation - you'd need to decode XDR properly

      // TODO: Properly decode Stellar event XDR to extract complete timelock information
      // For now, using placeholder values - this needs proper XDR decoding implementation
      const escrowEvent: EscrowCreatedEvent = {
        hashLock: this.extractHashLock(operation, event),
        orderHash: this.extractOrderHash(operation, event),
        maker: this.extractMaker(operation, event),
        taker: this.extractTaker(operation, event),
        token: this.extractToken(operation, event),
        amount: this.extractAmount(operation, event),
        safetyDeposit: this.extractSafetyDeposit(operation, event),
        timelocks: {
          // TODO: Extract actual timelock values from Stellar event XDR
          finality: 300, // 5 minutes
          srcWithdrawal: 3600, // 1 hour
          srcPublicWithdrawal: 7200, // 2 hours
          srcCancellation: 14400, // 4 hours
          srcPublicCancellation: 21600, // 6 hours
          dstWithdrawal: 3600, // 1 hour
          dstPublicWithdrawal: 7200, // 2 hours
          dstCancellation: 28800, // 8 hours
          deployedAt: new Date(transaction.createdAt).getTime(),
        },
        chain: "stellar",
        transactionHash: transaction.hash,
        timestamp: new Date(transaction.createdAt).getTime(),
      };

      this.logger.info("Detected Stellar escrow creation", {
        hashLock: escrowEvent.hashLock,
        transactionHash: transaction.hash,
        ledger: transaction.ledger,
      });

      // Emit to relayer service
      this.relayerService.emit("escrowCreated", escrowEvent);
    } catch (error) {
      this.logger.error("Error processing escrow created event:", error);
    }
  }

  /**
   * Handle withdrawal event
   */
  private async handleWithdrawalEvent(
    transaction: any,
    operation: any,
    event?: any
  ): Promise<void> {
    try {
      const hashLock = this.extractHashLock(operation, event);
      const secret = this.extractSecret(operation, event);

      this.logger.info("Detected Stellar withdrawal", {
        hashLock,
        transactionHash: transaction.hash,
      });

      this.relayerService.emit("withdrawal", {
        hashLock,
        chain: "stellar",
        secret,
        transactionHash: transaction.hash,
      });
    } catch (error) {
      this.logger.error("Error processing withdrawal event:", error);
    }
  }

  /**
   * Handle cancellation event
   */
  private async handleCancellationEvent(
    transaction: any,
    operation: any,
    event?: any
  ): Promise<void> {
    try {
      const hashLock = this.extractHashLock(operation, event);

      this.logger.info("Detected Stellar cancellation", {
        hashLock,
        transactionHash: transaction.hash,
      });

      this.relayerService.emit("cancellation", {
        hashLock,
        chain: "stellar",
        transactionHash: transaction.hash,
      });
    } catch (error) {
      this.logger.error("Error processing cancellation event:", error);
    }
  }

  // Enhanced extraction methods with event support
  private extractHashLock(
    operation: any,
    event?: DecodedContractEvent
  ): string {
    // Try to extract from event first, then fallback to operation
    if (event?.data?.hashLock) return event.data.hashLock;
    if (event?.data?.hash_lock) return event.data.hash_lock;

    // Implement proper parameter extraction from XDR
    return "0x" + "0".repeat(64); // Placeholder
  }

  private extractOrderHash(
    operation: any,
    event?: DecodedContractEvent
  ): string {
    if (event?.data?.orderHash) return event.data.orderHash;
    if (event?.data?.order_hash) return event.data.order_hash;
    return "0x" + "0".repeat(64); // Placeholder
  }

  private extractMaker(operation: any, event?: DecodedContractEvent): string {
    if (event?.data?.maker) return event.data.maker;
    return (
      operation.source_account ||
      "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
    );
  }

  private extractTaker(operation: any, event?: DecodedContractEvent): string {
    if (event?.data?.taker) return event.data.taker;
    return "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"; // Placeholder
  }

  private extractToken(operation: any, event?: DecodedContractEvent): string {
    if (event?.data?.token) return event.data.token;
    return "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"; // Placeholder
  }

  private extractAmount(operation: any, event?: DecodedContractEvent): string {
    if (event?.data?.amount) return event.data.amount.toString();
    return "1000000"; // Placeholder
  }

  private extractSafetyDeposit(
    operation: any,
    event?: DecodedContractEvent
  ): string {
    if (event?.data?.safetyDeposit) return event.data.safetyDeposit.toString();
    if (event?.data?.safety_deposit)
      return event.data.safety_deposit.toString();
    return "100000"; // Placeholder
  }

  private extractSecret(operation: any, event?: DecodedContractEvent): string {
    if (event?.data?.secret) return event.data.secret;
    return "0x" + "0".repeat(64); // Placeholder
  }

  /**
   * Get current status
   */
  getStatus(): {
    running: boolean;
    lastProcessedLedger: number;
    horizonUrl: string;
    providerConnected: boolean;
  } {
    return {
      running: this.running,
      lastProcessedLedger: this.lastProcessedLedger,
      horizonUrl: this.config.stellar.horizonUrl,
      providerConnected: this.stellarProvider?.isConnected() || false,
    };
  }
}
