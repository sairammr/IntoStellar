/**
 * @fileoverview Stellar wallet for transaction signing and account management
 */

import StellarSdk from "@stellar/stellar-sdk";
import { Logger } from "../utils/Logger";
import { Config } from "../config/Config";
import { StellarProvider, StellarAccountInfo } from "./StellarProvider";

const { Keypair, Transaction, Networks, Operation, Memo } = StellarSdk;

export interface StellarWalletConfig {
  privateKey: string;
  accountId: string;
  networkPassphrase: string;
}

export interface StellarTransactionOptions {
  fee?: string;
  timeout?: number;
  memo?: string;
  memoType?: "text" | "id" | "hash" | "return";
}

export interface StellarContractCallOptions {
  functionName: string;
  args: any[];
  fee?: string;
  timeout?: number;
  memo?: string;
}

/**
 * Stellar wallet for transaction signing and account management
 */
export class StellarWallet {
  private logger = Logger.getInstance();
  private config = Config.getInstance();
  private keypair: any;
  private accountId: string;
  private networkPassphrase: string;
  private provider: StellarProvider;
  private accountInfo?: StellarAccountInfo;

  constructor(
    provider: StellarProvider,
    config?: Partial<StellarWalletConfig>
  ) {
    const walletConfig = config || this.config.stellar;

    this.keypair = Keypair.fromSecret(walletConfig.privateKey);
    this.accountId = walletConfig.accountId || "";
    this.networkPassphrase = walletConfig.networkPassphrase || "";
    this.provider = provider;

    this.logger.info("StellarWallet initialized", {
      accountId: this.accountId,
      network: this.getNetworkName(),
    });
  }

  /**
   * Get the current network name
   */
  getNetworkName(): string {
    switch (this.networkPassphrase) {
      case Networks.PUBLIC:
        return "public";
      case Networks.TESTNET:
        return "testnet";
      case Networks.FUTURENET:
        return "futurenet";
      default:
        return "custom";
    }
  }

  /**
   * Get the account ID
   */
  getAccountId(): string {
    return this.accountId;
  }

  /**
   * Get the public key
   */
  getPublicKey(): string {
    return this.keypair.publicKey();
  }

  /**
   * Load account information
   */
  async loadAccount(): Promise<StellarAccountInfo> {
    try {
      this.accountInfo = await this.provider.getAccountInfo(this.accountId);
      return this.accountInfo;
    } catch (error) {
      this.logger.error("Failed to load account:", error);
      throw error;
    }
  }

  /**
   * Get current account sequence number
   */
  async getSequenceNumber(): Promise<string> {
    if (!this.accountInfo) {
      await this.loadAccount();
    }
    return this.accountInfo!.sequence;
  }

  /**
   * Get account balances
   */
  async getBalances(): Promise<
    Array<{
      asset_type: string;
      asset_code?: string;
      asset_issuer?: string;
      balance: string;
      limit?: string;
    }>
  > {
    if (!this.accountInfo) {
      await this.loadAccount();
    }
    return this.accountInfo!.balances;
  }

  /**
   * Get native XLM balance
   */
  async getNativeBalance(): Promise<string> {
    const balances = await this.getBalances();
    const nativeBalance = balances.find((b) => b.asset_type === "native");
    return nativeBalance ? nativeBalance.balance : "0";
  }

  /**
   * Get asset balance
   */
  async getAssetBalance(
    assetCode: string,
    assetIssuer: string
  ): Promise<string> {
    const balances = await this.getBalances();
    const assetBalance = balances.find(
      (b) => b.asset_code === assetCode && b.asset_issuer === assetIssuer
    );
    return assetBalance ? assetBalance.balance : "0";
  }

  /**
   * Create and sign a transaction
   */
  async createTransaction(
    operations: any[],
    options: StellarTransactionOptions = {}
  ): Promise<any> {
    try {
      const sequence = await this.getSequenceNumber();

      const transaction = new Transaction(operations, {
        fee: options.fee || "100",
        networkPassphrase: this.networkPassphrase,
        sequence: sequence,
      });

      // Add memo if provided
      if (options.memo) {
        transaction.addMemo(Memo.text(options.memo));
      }

      // Sign the transaction
      transaction.sign(this.keypair);

      return transaction;
    } catch (error) {
      this.logger.error("Failed to create transaction:", error);
      throw error;
    }
  }

  /**
   * Submit a transaction to the network
   */
  async submitTransaction(transaction: any): Promise<string> {
    try {
      const result = await this.provider.submitTransaction(transaction);

      this.logger.info("Transaction submitted successfully", {
        hash: result.hash,
        ledger: result.ledger,
      });

      return result.hash;
    } catch (error) {
      this.logger.error("Failed to submit transaction:", error);
      throw error;
    }
  }

  /**
   * Create and submit a transaction in one step
   */
  async createAndSubmitTransaction(
    operations: any[],
    options: StellarTransactionOptions = {}
  ): Promise<string> {
    const transaction = await this.createTransaction(operations, options);
    return await this.submitTransaction(transaction);
  }

  /**
   * Call a Stellar smart contract
   */
  async callContract(
    contractId: string,
    options: StellarContractCallOptions
  ): Promise<string> {
    try {
      this.logger.info("Calling Stellar contract", {
        contractId,
        functionName: options.functionName,
      });

      // Create invoke contract operation
      const operation = Operation.invokeHostFunction({
        hostFunction: {
          type: "invoke",
          contractId: contractId,
          functionName: options.functionName,
          args: options.args,
        },
        auth: [], // Add auth if needed
      });

      // Create and submit transaction
      const transactionHash = await this.createAndSubmitTransaction(
        [operation],
        {
          fee: options.fee || "100000", // Higher fee for contract calls
          memo: options.memo,
        }
      );

      this.logger.info("Contract call submitted", {
        contractId,
        functionName: options.functionName,
        transactionHash,
      });

      return transactionHash;
    } catch (error) {
      this.logger.error("Failed to call contract:", error);
      throw error;
    }
  }

  /**
   * Call a Stellar smart contract with retry mechanism
   */
  async callContractWithRetry(
    contractId: string,
    options: StellarContractCallOptions,
    maxRetries: number = 3
  ): Promise<string> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.callContract(contractId, options);
      } catch (error) {
        if (attempt === maxRetries) throw error;

        this.logger.warn(
          `Contract call failed, retrying (${attempt}/${maxRetries})`,
          {
            contractId,
            functionName: options.functionName,
            error: error instanceof Error ? error.message : "Unknown error",
          }
        );

        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * Math.pow(2, attempt - 1))
        );
      }
    }

    throw new Error(`Contract call failed after ${maxRetries} attempts`);
  }

  /**
   * Create source escrow on Stellar with enhanced error handling
   */
  async createSourceEscrow(
    factoryContractId: string,
    params: {
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
  ): Promise<string> {
    try {
      this.logger.info("Creating source escrow on Stellar", {
        orderHash: params.orderHash,
        hashLock: params.hashLock,
      });

      // Call the factory's post_interaction function
      // This will trigger escrow creation through the LOP integration
      const args = [
        params.orderHash,
        params.hashLock,
        params.maker,
        params.taker,
        params.token,
        params.amount,
        params.safetyDeposit,
        params.timelocks.finalityDelay,
        params.timelocks.srcWithdrawalDelay,
        params.timelocks.srcPublicWithdrawalDelay,
        params.timelocks.srcCancellationDelay,
        params.timelocks.srcPublicCancellationDelay,
        params.timelocks.dstWithdrawalDelay,
        params.timelocks.dstPublicWithdrawalDelay,
        params.timelocks.dstCancellationDelay,
      ];

      const transactionHash = await this.callContractWithRetry(
        factoryContractId,
        {
          functionName: "post_interaction", // ✅ Matches our Factory contract
          args,
          fee: "200000", // Higher fee for escrow creation
          memo: `Create escrow: ${params.hashLock}`,
        },
        3 // Retry up to 3 times
      );

      this.logger.info("Source escrow created on Stellar", {
        orderHash: params.orderHash,
        hashLock: params.hashLock,
        transactionHash,
      });

      return transactionHash;
    } catch (error) {
      this.logger.error("Failed to create source escrow:", error);
      throw error;
    }
  }

  /**
   * Create destination escrow on Stellar
   */
  async createDestinationEscrow(
    factoryContractId: string,
    params: {
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
  ): Promise<string> {
    try {
      this.logger.info("Creating destination escrow on Stellar", {
        orderHash: params.orderHash,
        hashLock: params.hashLock,
      });

      // For destination escrow, we need to call the factory's post_interaction
      // with different parameters indicating it's a destination escrow
      const args = [
        params.orderHash,
        params.hashLock,
        params.maker,
        params.taker,
        params.token,
        params.amount,
        params.safetyDeposit,
        params.timelocks.finalityDelay,
        params.timelocks.srcWithdrawalDelay,
        params.timelocks.srcPublicWithdrawalDelay,
        params.timelocks.srcCancellationDelay,
        params.timelocks.srcPublicCancellationDelay,
        params.timelocks.dstWithdrawalDelay,
        params.timelocks.dstPublicWithdrawalDelay,
        params.timelocks.dstCancellationDelay,
      ];

      const transactionHash = await this.callContractWithRetry(
        factoryContractId,
        {
          functionName: "post_interaction", // ✅ Matches our Factory contract
          args,
          fee: "200000",
          memo: `Create dst escrow: ${params.hashLock}`,
        },
        3
      );

      this.logger.info("Destination escrow created on Stellar", {
        orderHash: params.orderHash,
        hashLock: params.hashLock,
        transactionHash,
      });

      return transactionHash;
    } catch (error) {
      this.logger.error("Failed to create destination escrow:", error);
      throw error;
    }
  }

  /**
   * Withdraw from escrow with secret
   */
  async withdrawFromEscrow(
    escrowContractId: string,
    secret: string
  ): Promise<string> {
    try {
      this.logger.info("Withdrawing from Stellar escrow", {
        escrowContractId,
        secret: secret.substring(0, 10) + "...",
      });

      const transactionHash = await this.callContractWithRetry(
        escrowContractId,
        {
          functionName: "withdraw", // ✅ Matches our FusionPlusEscrow contract
          args: [secret],
          fee: "150000",
          memo: `Withdraw: ${secret.substring(0, 10)}...`,
        },
        3
      );

      this.logger.info("Withdrawal from Stellar escrow successful", {
        escrowContractId,
        transactionHash,
      });

      return transactionHash;
    } catch (error) {
      this.logger.error("Failed to withdraw from escrow:", error);
      throw error;
    }
  }

  /**
   * Cancel escrow
   */
  async cancelEscrow(escrowContractId: string): Promise<string> {
    try {
      this.logger.info("Cancelling Stellar escrow", {
        escrowContractId,
      });

      const transactionHash = await this.callContractWithRetry(
        escrowContractId,
        {
          functionName: "cancel", // ✅ Matches our FusionPlusEscrow contract
          args: [],
          fee: "100000",
          memo: "Cancel escrow",
        },
        3
      );

      this.logger.info("Stellar escrow cancellation successful", {
        escrowContractId,
        transactionHash,
      });

      return transactionHash;
    } catch (error) {
      this.logger.error("Failed to cancel escrow:", error);
      throw error;
    }
  }

  /**
   * Get account info
   */
  getAccountInfo(): StellarAccountInfo | undefined {
    return this.accountInfo;
  }

  /**
   * Refresh account info
   */
  async refreshAccount(): Promise<void> {
    await this.loadAccount();
  }
}
