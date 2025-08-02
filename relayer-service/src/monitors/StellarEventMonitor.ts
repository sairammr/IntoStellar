/**
 * Monitors Stellar events related to escrow creation and lifecycle
 */
import { Logger } from "../utils/Logger";
import { Config } from "../config/Config";
import { StellarProvider } from "../services/StellarProvider";
import { RelayerService } from "../services/RelayerService";
import { SecretManager } from "../services/SecretManager";
import { EscrowCreatedEvent } from "../types/Events";
import { XDRDecoder } from "../utils/XDRDecoder";
import { xdr } from "@stellar/stellar-sdk";

export interface StellarEventMonitorConfig {
  horizonUrl: string;
  networkPassphrase: string;
  contractAddresses: string[];
  pollInterval: number;
}

export class StellarEventMonitor {
  private logger = Logger.getInstance();
  private config = Config.getInstance();
  private stellarProvider: StellarProvider;
  private relayerService: RelayerService;
  private running = false;
  private lastProcessedLedger = 0;
  private eventStreamCloser?: () => void;
  private xdrDecoder = new XDRDecoder();

  constructor() {
    this.stellarProvider = new StellarProvider();
    const secretManager = new SecretManager();
    this.relayerService = new RelayerService(secretManager);
  }

  async start(): Promise<void> {
    if (this.running) {
      this.logger.warn("StellarEventMonitor is already running");
      return;
    }

    this.logger.info("Starting StellarEventMonitor...");
    this.running = true;

    try {
      // Start monitoring for new events
      this.startEventMonitoring();

      // Start syncing historical ledgers
      this.startLedgerSync();

      this.logger.info("StellarEventMonitor started successfully");
    } catch (error) {
      this.running = false;
      this.logger.error("Failed to start StellarEventMonitor:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.running) {
      this.logger.warn("StellarEventMonitor is not running");
      return;
    }

    this.logger.info("Stopping StellarEventMonitor...");
    this.running = false;

    if (this.eventStreamCloser) {
      this.eventStreamCloser();
      this.eventStreamCloser = undefined;
    }

    this.logger.info("StellarEventMonitor stopped successfully");
  }

  private startEventMonitoring(): void {
    // For now, we'll use a simplified polling approach
    // In production, you might want to use Stellar's streaming API
    const pollInterval = 5000; // 5 seconds

    const poll = async () => {
      if (!this.running) return;

      try {
        // Get the latest ledger
        const latestLedger = await this.stellarProvider.getCurrentLedger();

        if (latestLedger > this.lastProcessedLedger) {
          await this.syncLedgersBetween(
            this.lastProcessedLedger + 1,
            latestLedger
          );
          this.lastProcessedLedger = latestLedger;
        }
      } catch (error) {
        this.logger.error("Error polling Stellar events:", error);
      }

      // Schedule next poll
      setTimeout(poll, pollInterval);
    };

    poll();
  }

  private startLedgerSync(): void {
    const syncLedgers = async () => {
      if (!this.running) return;

      try {
        // Get the latest ledger
        const latestLedger = await this.stellarProvider.getCurrentLedger();

        // If we haven't processed any ledgers yet, start from the latest
        if (this.lastProcessedLedger === 0) {
          this.lastProcessedLedger = latestLedger;
          this.logger.info(
            `Starting Stellar monitoring from ledger ${latestLedger}`
          );
        } else if (latestLedger > this.lastProcessedLedger) {
          // Process new ledgers
          await this.syncLedgersBetween(
            this.lastProcessedLedger + 1,
            latestLedger
          );
          this.lastProcessedLedger = latestLedger;
        }
      } catch (error) {
        this.logger.error("Error syncing Stellar ledgers:", error);
      }

      // Schedule next sync
      setTimeout(syncLedgers, 5000);
    };

    syncLedgers();
  }

  /**
   * Sync ledgers between fromLedger and toLedger
   */
  private async syncLedgersBetween(
    fromLedger: number,
    toLedger: number
  ): Promise<void> {
    this.logger.debug(`Syncing Stellar ledgers ${fromLedger} to ${toLedger}`);

    for (let ledgerSeq = fromLedger; ledgerSeq <= toLedger; ledgerSeq++) {
      if (!this.running) break;

      try {
        await this.processLedger(ledgerSeq);
      } catch (error) {
        this.logger.error(`Error processing ledger ${ledgerSeq}:`, error);
      }
    }
  }

  /**
   * Process a single ledger
   */
  private async processLedger(ledgerSeq: number): Promise<void> {
    try {
      this.logger.debug(`Processing ledger ${ledgerSeq}`);

      // Fetch operations for this ledger
      const operations = await this.fetchOperationsForLedger(ledgerSeq);

      // Process each operation
      for (const operation of operations) {
        if (!this.running) break;

        if (this.isContractOperation(operation)) {
          await this.handleContractOperation(operation, ledgerSeq);
        }
      }
    } catch (error) {
      this.logger.error(`Error processing ledger ${ledgerSeq}:`, error);
    }
  }

  /**
   * Fetch operations for a specific ledger
   */
  private async fetchOperationsForLedger(ledgerSeq: number): Promise<any[]> {
    try {
      // Use Horizon API to fetch operations for the ledger
      const response = await fetch(
        `${this.config.stellar.horizonUrl}/operations?ledger=${ledgerSeq}&type=invoke_host_function&limit=200`
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch operations for ledger ${ledgerSeq}: ${response.statusText}`
        );
      }

      const data = (await response.json()) as any;
      return data._embedded?.records || [];
    } catch (error) {
      this.logger.error(
        `Failed to fetch operations for ledger ${ledgerSeq}:`,
        error
      );
      return [];
    }
  }

  /**
   * Check if an operation is a contract operation
   */
  private isContractOperation(operation: any): boolean {
    return (
      operation.type === "invoke_host_function" &&
      operation.function === "HostFunctionTypeInvokeContract"
    );
  }

  /**
   * Handle a contract operation
   */
  private async handleContractOperation(
    operation: any,
    ledgerSeq: number
  ): Promise<void> {
    try {
      this.logger.debug("Processing contract operation", {
        operationId: operation.id,
        transactionHash: operation.transaction_hash,
        ledger: ledgerSeq,
      });

      // Check if this operation is from our contracts
      if (this.isFromOurContracts(operation)) {
        await this.processContractEvent(operation, ledgerSeq);
      }
    } catch (error) {
      this.logger.error("Error handling contract operation:", error);
    }
  }

  /**
   * Check if operation is from our contracts
   */
  private isFromOurContracts(operation: any): boolean {
    const ourContracts = [
      this.config.contracts.stellar.escrowFactory,
      this.config.contracts.stellar.limitOrderProtocol,
      this.config.contracts.stellar.resolver,
    ];

    // Check if the operation involves any of our contracts
    return ourContracts.some((contractId) =>
      operation.parameters?.some(
        (param: any) =>
          param.value && this.decodeParameter(param.value) === contractId
      )
    );
  }

  /**
   * Decode a base64 parameter
   */
  private decodeParameter(base64Value: string): string {
    try {
      const buffer = Buffer.from(base64Value, "base64");
      return buffer.toString("hex");
    } catch (error) {
      return "";
    }
  }

  /**
   * Process a contract event
   */
  private async processContractEvent(
    operation: any,
    ledgerSeq: number
  ): Promise<void> {
    try {
      // Get transaction details
      const transaction = await this.stellarProvider.getTransaction(
        operation.transaction_hash
      );

      // Extract function name and parameters
      const functionName = this.extractFunctionName(operation);

      this.logger.info("Processing contract event", {
        functionName,
        transactionHash: operation.transaction_hash,
        ledger: ledgerSeq,
      });

      // Handle different function types
      switch (functionName) {
        case "post_interaction":
          await this.handlePostInteraction(operation, transaction, ledgerSeq);
          break;
        case "withdraw":
          await this.handleWithdraw(operation, transaction, ledgerSeq);
          break;
        case "cancel":
          await this.handleCancel(operation, transaction, ledgerSeq);
          break;
        default:
          this.logger.debug("Unknown function:", functionName);
      }
    } catch (error) {
      this.logger.error("Error processing contract event:", error);
    }
  }

  /**
   * Extract function name from operation
   */
  private extractFunctionName(operation: any): string {
    try {
      // Try to extract from function field
      if (operation.function) {
        return operation.function;
      }

      // Try to extract from parameters using XDR decoding
      if (operation.parameters && operation.parameters.length > 0) {
        // First parameter might contain function name
        const firstParam = operation.parameters[0];
        if (firstParam && firstParam.value) {
          try {
            // Decode the XDR parameter
            const decoded = this.xdrDecoder.decodeScVal(
              xdr.ScVal.fromXDR(firstParam.value, "base64")
            );
            if (typeof decoded === "string") {
              return decoded;
            }
          } catch (error) {
            this.logger.debug(
              "Failed to decode function name from XDR:",
              error
            );
          }
        }
      }

      return "unknown";
    } catch (error) {
      return "unknown";
    }
  }

  /**
   * Extract escrow details from operation parameters using XDR decoding
   */
  private extractEscrowDetails(operation: any): {
    hashLock: string;
    token: string;
    amount: string;
    safetyDeposit: string;
    maker: string;
    taker: string;
    escrowAddress: string;
  } {
    try {
      // Initialize with default values
      let hashLock =
        "0x0000000000000000000000000000000000000000000000000000000000000000";
      let token = "0x0000000000000000000000000000000000000000";
      let amount = "0";
      let safetyDeposit = "0";
      let maker = "0x0000000000000000000000000000000000000000";
      let taker = "0x0000000000000000000000000000000000000000";
      let escrowAddress = "0x0000000000000000000000000000000000000000";

      // Try to extract from operation parameters
      if (operation.parameters && operation.parameters.length > 1) {
        // Skip first parameter (function name)
        for (let i = 1; i < operation.parameters.length; i++) {
          const param = operation.parameters[i];
          if (param && param.value) {
            try {
              const decoded = this.xdrDecoder.decodeScVal(
                xdr.ScVal.fromXDR(param.value, "base64")
              );

              // Based on the parameter position and type, extract the appropriate value
              // This is a simplified extraction - in practice you'd need to know the exact parameter order
              if (typeof decoded === "string" && decoded.startsWith("0x")) {
                if (decoded.length === 66) {
                  // 32 bytes + 0x prefix
                  hashLock = decoded;
                } else if (decoded.length === 42) {
                  // 20 bytes + 0x prefix
                  if (
                    escrowAddress ===
                    "0x0000000000000000000000000000000000000000"
                  ) {
                    escrowAddress = decoded;
                  } else if (
                    token === "0x0000000000000000000000000000000000000000"
                  ) {
                    token = decoded;
                  } else if (
                    maker === "0x0000000000000000000000000000000000000000"
                  ) {
                    maker = decoded;
                  } else if (
                    taker === "0x0000000000000000000000000000000000000000"
                  ) {
                    taker = decoded;
                  }
                }
              } else if (
                typeof decoded === "string" &&
                !decoded.startsWith("0x")
              ) {
                // This might be a numeric value as string
                if (amount === "0") {
                  amount = decoded;
                } else if (safetyDeposit === "0") {
                  safetyDeposit = decoded;
                }
              }
            } catch (error) {
              this.logger.debug(`Failed to decode parameter ${i}:`, error);
            }
          }
        }
      }

      return {
        hashLock,
        token,
        amount,
        safetyDeposit,
        maker,
        taker,
        escrowAddress,
      };
    } catch (error) {
      this.logger.error("Error extracting escrow details:", error);
      return {
        hashLock:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        token: "0x0000000000000000000000000000000000000000",
        amount: "0",
        safetyDeposit: "0",
        maker: "0x0000000000000000000000000000000000000000",
        taker: "0x0000000000000000000000000000000000000000",
        escrowAddress: "0x0000000000000000000000000000000000000000",
      };
    }
  }

  /**
   * Handle post_interaction event (escrow creation)
   */
  private async handlePostInteraction(
    operation: any,
    transaction: any,
    ledgerSeq: number
  ): Promise<void> {
    try {
      // Extract escrow details from operation parameters
      const escrowEvent: EscrowCreatedEvent = {
        escrowAddress: this.extractEscrowAddress(operation),
        hashLock: this.extractHashLock(operation),
        orderHash:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        maker: this.extractMaker(operation),
        taker: this.extractTaker(operation),
        token: this.extractToken(operation),
        amount: this.extractAmount(operation),
        safetyDeposit: this.extractSafetyDeposit(operation),
        timelocks: {
          finality: 300,
          srcWithdrawal: 3600,
          srcPublicWithdrawal: 7200,
          srcCancellation: 14400,
          srcPublicCancellation: 21600,
          dstWithdrawal: 3600,
          dstPublicWithdrawal: 7200,
          dstCancellation: 28800,
          deployedAt: new Date(transaction.createdAt).getTime(),
        },
        chain: "stellar",
        transactionHash: transaction.hash,
        blockNumber: ledgerSeq,
        timestamp: new Date(transaction.createdAt).getTime(),
      };

      this.logger.info("Detected Stellar escrow creation", {
        escrowAddress: escrowEvent.escrowAddress,
        hashLock: escrowEvent.hashLock,
        transactionHash: escrowEvent.transactionHash,
      });

      // Emit the event to the relayer service
      this.relayerService.emit("escrowCreated", escrowEvent);
    } catch (error) {
      this.logger.error("Error handling post_interaction event:", error);
    }
  }

  /**
   * Handle withdraw event
   */
  private async handleWithdraw(
    operation: any,
    transaction: any,
    _ledgerSeq: number
  ): Promise<void> {
    try {
      const hashLock = this.extractHashLock(operation);
      const secret = this.extractSecret(operation);

      this.logger.info("Detected Stellar withdrawal", {
        hashLock,
        transactionHash: transaction.hash,
      });

      // Emit the withdrawal event
      this.relayerService.emit("withdrawal", {
        escrowAddress: this.extractEscrowAddress(operation),
        hashLock,
        secret,
        withdrawnBy: operation.source_account,
        isPublicWithdrawal: false,
        chain: "stellar",
        transactionHash: transaction.hash,
        timestamp: new Date(transaction.createdAt).getTime(),
      });
    } catch (error) {
      this.logger.error("Error handling withdrawal event:", error);
    }
  }

  /**
   * Handle cancel event
   */
  private async handleCancel(
    operation: any,
    transaction: any,
    _ledgerSeq: number
  ): Promise<void> {
    try {
      const hashLock = this.extractHashLock(operation);

      this.logger.info("Detected Stellar cancellation", {
        hashLock,
        transactionHash: transaction.hash,
      });

      // Emit the cancellation event
      this.relayerService.emit("cancellation", {
        escrowAddress: this.extractEscrowAddress(operation),
        hashLock,
        cancelledBy: operation.source_account,
        refundTo: operation.source_account,
        isPublicCancellation: false,
        chain: "stellar",
        transactionHash: transaction.hash,
        timestamp: new Date(transaction.createdAt).getTime(),
      });
    } catch (error) {
      this.logger.error("Error handling cancellation event:", error);
    }
  }

  /**
   * Get the current status of the monitor
   */
  async getStatus(): Promise<{
    running: boolean;
    lastProcessedLedger: number;
    horizonUrl: string;
    providerConnected: boolean;
  }> {
    return {
      running: this.running,
      lastProcessedLedger: this.lastProcessedLedger,
      horizonUrl: this.config.stellar.horizonUrl,
      providerConnected: await this.stellarProvider.isConnected(),
    };
  }

  // Updated extraction methods that use the new XDR decoding
  private extractHashLock(operation: any): string {
    return this.extractEscrowDetails(operation).hashLock;
  }

  private extractToken(operation: any): string {
    return this.extractEscrowDetails(operation).token;
  }

  private extractAmount(operation: any): string {
    return this.extractEscrowDetails(operation).amount;
  }

  private extractSafetyDeposit(operation: any): string {
    return this.extractEscrowDetails(operation).safetyDeposit;
  }

  private extractSecret(operation: any): string {
    // Try to extract secret from operation parameters
    try {
      if (operation.parameters && operation.parameters.length > 0) {
        for (const param of operation.parameters) {
          if (param && param.value) {
            try {
              const decoded = this.xdrDecoder.decodeScVal(
                xdr.ScVal.fromXDR(param.value, "base64")
              );
              if (
                typeof decoded === "string" &&
                decoded.startsWith("0x") &&
                decoded.length === 66
              ) {
                return decoded;
              }
            } catch (error) {
              // Continue to next parameter
            }
          }
        }
      }
    } catch (error) {
      this.logger.debug("Failed to extract secret:", error);
    }
    return "0x0000000000000000000000000000000000000000000000000000000000000000";
  }

  private extractEscrowAddress(operation: any): string {
    return this.extractEscrowDetails(operation).escrowAddress;
  }

  private extractMaker(operation: any): string {
    return this.extractEscrowDetails(operation).maker;
  }

  private extractTaker(operation: any): string {
    return this.extractEscrowDetails(operation).taker;
  }
}
