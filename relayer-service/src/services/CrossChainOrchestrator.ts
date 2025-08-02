/**
 * @fileoverview Cross-chain orchestration service for automatic escrow creation
 */

import { ethers } from "ethers";
import { Logger } from "../utils/Logger";
import { Config } from "../config/Config";
import { EscrowCreatedEvent } from "./RelayerService";
import { StellarProvider } from "./StellarProvider";
import { StellarWallet } from "./StellarWallet";
import { StellarContractClient } from "./StellarContractClient";

export interface CrossChainSwapParams {
  orderHash: string;
  hashLock: string;
  maker: string;
  taker: string;
  token: string;
  amount: string;
  safetyDeposit: string;
  timelocks: {
    finalityDelay: number;
    srcWithdrawalDelay: number;
    srcPublicWithdrawalDelay: number;
    srcCancellationDelay: number;
    srcPublicCancellationDelay: number;
    dstWithdrawalDelay: number;
    dstPublicWithdrawalDelay: number;
    dstCancellationDelay: number;
  };
}

/**
 * Orchestrates cross-chain escrow creation and management
 */
export class CrossChainOrchestrator {
  private logger = Logger.getInstance();
  private config = Config.getInstance();

  // Ethereum components
  private ethereumProvider!: ethers.Provider;
  private ethereumWallet!: ethers.Wallet;
  private ethereumEscrowFactory!: ethers.Contract;

  // Stellar components
  private stellarProvider!: StellarProvider;
  private stellarWallet!: StellarWallet;
  private stellarContractClient!: StellarContractClient;

  constructor() {
    this.initializeEthereum();
    this.initializeStellar();
  }

  /**
   * Initialize Ethereum connection
   */
  private initializeEthereum(): void {
    try {
      // Initialize provider
      this.ethereumProvider = new ethers.JsonRpcProvider(
        this.config.ethereum.rpcUrl
      );

      // Initialize wallet
      this.ethereumWallet = new ethers.Wallet(
        this.config.ethereum.privateKey,
        this.ethereumProvider
      );

      // Initialize escrow factory contract
      this.ethereumEscrowFactory = new ethers.Contract(
        this.config.contracts.ethereum.escrowFactory,
        [
          "function createSrcEscrow(bytes32 orderHash, bytes32 hashLock, address maker, address taker, address token, uint256 amount, uint256 safetyDeposit, uint32 finalityDelay, uint32 srcWithdrawalDelay, uint32 srcPublicWithdrawalDelay, uint32 srcCancellationDelay, uint32 srcPublicCancellationDelay, uint32 dstWithdrawalDelay, uint32 dstPublicWithdrawalDelay, uint32 dstCancellationDelay) external returns (address)",
          "function createDstEscrow(bytes32 orderHash, bytes32 hashLock, address maker, address taker, address token, uint256 amount, uint256 safetyDeposit, uint32 finalityDelay, uint32 srcWithdrawalDelay, uint32 srcPublicWithdrawalDelay, uint32 srcCancellationDelay, uint32 srcPublicCancellationDelay, uint32 dstWithdrawalDelay, uint32 dstPublicWithdrawalDelay, uint32 dstCancellationDelay) external returns (address)",
        ],
        this.ethereumWallet
      );

      this.logger.info("Ethereum connection initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize Ethereum connection:", error);
      throw error;
    }
  }

  /**
   * Initialize Stellar connection
   */
  private initializeStellar(): void {
    try {
      // Initialize Stellar provider
      this.stellarProvider = new StellarProvider();

      // Initialize Stellar wallet
      this.stellarWallet = new StellarWallet(this.stellarProvider);

      // Initialize Stellar contract client
      this.stellarContractClient = new StellarContractClient(
        this.stellarProvider,
        this.stellarWallet
      );

      this.logger.info("Stellar connection initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize Stellar connection:", error);
      throw error;
    }
  }

  /**
   * Handle escrow creation event and create corresponding escrow on the other chain
   */
  async handleEscrowCreated(event: EscrowCreatedEvent): Promise<void> {
    try {
      this.logger.info("Processing cross-chain escrow creation", {
        hashLock: event.hashLock,
        sourceChain: event.chain,
      });

      if (event.chain === "ethereum") {
        // Ethereum escrow created -> create Stellar escrow
        await this.createStellarEscrow(event);
      } else {
        // Stellar escrow created -> create Ethereum escrow
        await this.createEthereumEscrow(event);
      }
    } catch (error) {
      this.logger.error("Failed to handle cross-chain escrow creation:", error);
      throw error;
    }
  }

  /**
   * Create Stellar escrow when Ethereum escrow is detected
   */
  private async createStellarEscrow(
    ethereumEvent: EscrowCreatedEvent
  ): Promise<void> {
    try {
      this.logger.info("Creating Stellar escrow for Ethereum escrow", {
        hashLock: ethereumEvent.hashLock,
      });

      // Convert Ethereum parameters to Stellar format
      const stellarParams: CrossChainSwapParams = {
        orderHash: ethereumEvent.orderHash,
        hashLock: ethereumEvent.hashLock,
        maker: ethereumEvent.maker,
        taker: ethereumEvent.taker,
        token: ethereumEvent.token,
        amount: ethereumEvent.amount,
        safetyDeposit: ethereumEvent.safetyDeposit,
        timelocks: {
          finalityDelay: ethereumEvent.timelocks.finality,
          srcWithdrawalDelay: ethereumEvent.timelocks.srcWithdrawal,
          srcPublicWithdrawalDelay: ethereumEvent.timelocks.srcPublicWithdrawal,
          srcCancellationDelay: ethereumEvent.timelocks.srcCancellation,
          srcPublicCancellationDelay:
            ethereumEvent.timelocks.srcPublicCancellation,
          dstWithdrawalDelay: ethereumEvent.timelocks.dstWithdrawal,
          dstPublicWithdrawalDelay: ethereumEvent.timelocks.dstPublicWithdrawal,
          dstCancellationDelay: ethereumEvent.timelocks.dstCancellation,
        },
      };

      // Create Stellar escrow using the contract client
      const transactionHash =
        await this.stellarContractClient.createSourceEscrow(stellarParams);

      this.logger.info("Stellar escrow created successfully", {
        hashLock: ethereumEvent.hashLock,
        transactionHash,
      });
    } catch (error) {
      this.logger.error("Failed to create Stellar escrow:", error);
      throw error;
    }
  }

  /**
   * Create Ethereum escrow when Stellar escrow is detected
   */
  private async createEthereumEscrow(
    stellarEvent: EscrowCreatedEvent
  ): Promise<void> {
    try {
      this.logger.info("Creating Ethereum escrow for Stellar escrow", {
        hashLock: stellarEvent.hashLock,
      });

      // Convert Stellar parameters to Ethereum format
      const ethereumParams: CrossChainSwapParams = {
        orderHash: stellarEvent.orderHash,
        hashLock: stellarEvent.hashLock,
        maker: stellarEvent.maker,
        taker: stellarEvent.taker,
        token: stellarEvent.token,
        amount: stellarEvent.amount,
        safetyDeposit: stellarEvent.safetyDeposit,
        timelocks: {
          finalityDelay: stellarEvent.timelocks.finality,
          srcWithdrawalDelay: stellarEvent.timelocks.srcWithdrawal,
          srcPublicWithdrawalDelay: stellarEvent.timelocks.srcPublicWithdrawal,
          srcCancellationDelay: stellarEvent.timelocks.srcCancellation,
          srcPublicCancellationDelay:
            stellarEvent.timelocks.srcPublicCancellation,
          dstWithdrawalDelay: stellarEvent.timelocks.dstWithdrawal,
          dstPublicWithdrawalDelay: stellarEvent.timelocks.dstPublicWithdrawal,
          dstCancellationDelay: stellarEvent.timelocks.dstCancellation,
        },
      };

      // Create Ethereum escrow
      const tx = await this.ethereumEscrowFactory.createSrcEscrow(
        ethereumParams.orderHash,
        ethereumParams.hashLock,
        ethereumParams.maker,
        ethereumParams.taker,
        ethereumParams.token,
        ethereumParams.amount,
        ethereumParams.safetyDeposit,
        ethereumParams.timelocks.finalityDelay,
        ethereumParams.timelocks.srcWithdrawalDelay,
        ethereumParams.timelocks.srcPublicWithdrawalDelay,
        ethereumParams.timelocks.srcCancellationDelay,
        ethereumParams.timelocks.srcPublicCancellationDelay,
        ethereumParams.timelocks.dstWithdrawalDelay,
        ethereumParams.timelocks.dstPublicWithdrawalDelay,
        ethereumParams.timelocks.dstCancellationDelay,
        {
          gasLimit: 500000, // Adjust as needed
        }
      );

      this.logger.info("Ethereum escrow creation transaction submitted", {
        hashLock: stellarEvent.hashLock,
        transactionHash: tx.hash,
      });

      // Wait for transaction confirmation
      const receipt = await tx.wait();
      this.logger.info("Ethereum escrow creation confirmed", {
        hashLock: stellarEvent.hashLock,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });
    } catch (error) {
      this.logger.error("Failed to create Ethereum escrow:", error);
      throw error;
    }
  }

  /**
   * Distribute secret across chains when withdrawal is detected
   */
  async distributeSecret(
    hashLock: string,
    secret: string,
    sourceChain: "ethereum" | "stellar"
  ): Promise<void> {
    try {
      this.logger.info("Distributing secret across chains", {
        hashLock,
        sourceChain,
        secret: secret.substring(0, 10) + "...", // Log partial secret for security
      });

      if (sourceChain === "ethereum") {
        // Secret revealed on Ethereum -> withdraw on Stellar
        await this.withdrawOnStellar(hashLock, secret);
      } else {
        // Secret revealed on Stellar -> withdraw on Ethereum
        await this.withdrawOnEthereum(hashLock, secret);
      }
    } catch (error) {
      this.logger.error("Failed to distribute secret:", error);
      throw error;
    }
  }

  /**
   * Withdraw on Stellar using secret from Ethereum
   */
  private async withdrawOnStellar(
    hashLock: string,
    secret: string
  ): Promise<void> {
    try {
      // Get escrow address from factory
      const escrowAddress = await this.stellarContractClient.getEscrowAddress(
        hashLock
      );

      if (!escrowAddress) {
        throw new Error(`Escrow not found for hash lock: ${hashLock}`);
      }

      // Withdraw from Stellar escrow
      const transactionHash =
        await this.stellarContractClient.withdrawFromEscrow(
          escrowAddress,
          secret
        );

      this.logger.info("Stellar withdrawal completed", {
        hashLock,
        escrowAddress,
        transactionHash,
      });
    } catch (error) {
      this.logger.error("Failed to withdraw on Stellar:", error);
      throw error;
    }
  }

  /**
   * Withdraw on Ethereum using secret from Stellar
   */
  private async withdrawOnEthereum(
    hashLock: string,
    secret: string
  ): Promise<void> {
    try {
      // This would require the Ethereum escrow contract address
      // For now, we'll log the action - implement when escrow address tracking is added
      this.logger.info("Ethereum withdrawal requested", {
        hashLock,
        secret: secret.substring(0, 10) + "...",
      });

      // TODO: Implement Ethereum withdrawal
      // const escrowAddress = await this.getEthereumEscrowAddress(hashLock);
      // await this.ethereumEscrowContract.withdraw(secret);
    } catch (error) {
      this.logger.error("Failed to withdraw on Ethereum:", error);
      throw error;
    }
  }

  /**
   * Monitor Stellar escrow events
   */
  async startStellarEventMonitoring(): Promise<void> {
    try {
      this.logger.info("Starting Stellar event monitoring");

      // Monitor escrow factory events
      await this.stellarContractClient.monitorContractEvents(
        this.stellarContractClient.getEscrowFactoryId(),
        ["escrow_created", "withdrawal", "cancellation"],
        (event) => {
          this.handleStellarContractEvent(event);
        }
      );

      this.logger.info("Stellar event monitoring started successfully");
    } catch (error) {
      this.logger.error("Failed to start Stellar event monitoring:", error);
      throw error;
    }
  }

  /**
   * Handle Stellar contract events
   */
  private handleStellarContractEvent(event: any): void {
    try {
      this.logger.info("Received Stellar contract event", {
        type: event.type,
        contractId: event.contractId,
        functionName: event.functionName,
        transactionHash: event.transactionHash,
      });

      // Emit event to relayer service
      // This would be handled by the main relayer service
      this.logger.debug("Stellar contract event processed", event);
    } catch (error) {
      this.logger.error("Error handling Stellar contract event:", error);
    }
  }

  /**
   * Handle transaction failure and initiate recovery
   */
  async handleTransactionFailure(
    hashLock: string,
    sourceChain: "ethereum" | "stellar",
    error: Error
  ): Promise<void> {
    try {
      this.logger.error("Transaction failed, initiating recovery", {
        hashLock,
        sourceChain,
        error: error.message,
      });

      // Store failure for monitoring
      await this.storeFailureRecord(hashLock, sourceChain, error);

      // Implement rollback logic based on failure type
      if (error.message.includes("insufficient balance")) {
        await this.handleInsufficientBalanceFailure(hashLock, sourceChain);
      } else if (error.message.includes("timelock expired")) {
        await this.handleTimelockExpiryFailure(hashLock, sourceChain);
      } else {
        await this.handleGenericFailure(hashLock, sourceChain);
      }

      // Notify monitoring systems
      this.notifyFailure(hashLock, sourceChain, error);
    } catch (recoveryError) {
      this.logger.error("Failed to handle transaction failure:", recoveryError);
      throw recoveryError;
    }
  }

  /**
   * Store failure record for monitoring
   */
  private async storeFailureRecord(
    hashLock: string,
    sourceChain: "ethereum" | "stellar",
    error: Error
  ): Promise<void> {
    // In a real implementation, this would store to a database
    this.logger.info("Storing failure record", {
      hashLock,
      sourceChain,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle insufficient balance failure
   */
  private async handleInsufficientBalanceFailure(
    hashLock: string,
    sourceChain: "ethereum" | "stellar"
  ): Promise<void> {
    this.logger.warn("Handling insufficient balance failure", {
      hashLock,
      sourceChain,
    });

    // Cancel escrow on source chain if destination creation failed
    if (sourceChain === "ethereum") {
      // Cancel Ethereum escrow
      this.logger.info(
        "Cancelling Ethereum escrow due to insufficient balance"
      );
      // await this.cancelEthereumEscrow(hashLock);
    } else {
      // Cancel Stellar escrow
      this.logger.info("Cancelling Stellar escrow due to insufficient balance");
      // await this.cancelStellarEscrow(hashLock);
    }
  }

  /**
   * Handle timelock expiry failure
   */
  private async handleTimelockExpiryFailure(
    hashLock: string,
    sourceChain: "ethereum" | "stellar"
  ): Promise<void> {
    this.logger.warn("Handling timelock expiry failure", {
      hashLock,
      sourceChain,
    });

    // Call cancel() to refund on both chains
    if (sourceChain === "ethereum") {
      // Cancel Ethereum escrow
      this.logger.info("Cancelling Ethereum escrow due to timelock expiry");
      // await this.cancelEthereumEscrow(hashLock);
    } else {
      // Cancel Stellar escrow
      this.logger.info("Cancelling Stellar escrow due to timelock expiry");
      // await this.cancelStellarEscrow(hashLock);
    }
  }

  /**
   * Handle generic failure
   */
  private async handleGenericFailure(
    hashLock: string,
    sourceChain: "ethereum" | "stellar"
  ): Promise<void> {
    this.logger.warn("Handling generic failure", {
      hashLock,
      sourceChain,
    });

    // Log the failure and wait for manual intervention
    this.logger.error("Generic failure requires manual intervention", {
      hashLock,
      sourceChain,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Notify failure to monitoring systems
   */
  private notifyFailure(
    hashLock: string,
    sourceChain: "ethereum" | "stellar",
    error: Error
  ): void {
    // In a real implementation, this would send alerts
    this.logger.error("FAILURE ALERT", {
      hashLock,
      sourceChain,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get orchestrator status
   */
  async getStatus(): Promise<{
    ethereumConnected: boolean;
    ethereumAddress: string;
    ethereumFactoryAddress: string;
    stellarConnected: boolean;
    stellarAddress: string;
    stellarFactoryAddress: string;
  }> {
    return {
      ethereumConnected: !!this.ethereumProvider,
      ethereumAddress: this.ethereumWallet?.address || "",
      ethereumFactoryAddress: this.config.contracts.ethereum.escrowFactory,
      stellarConnected: (await this.stellarProvider?.isConnected()) || false,
      stellarAddress: this.stellarWallet?.getAccountId() || "",
      stellarFactoryAddress: this.config.contracts.stellar.escrowFactory,
    };
  }
}
