/**
 * @fileoverview Stellar provider for RPC calls and network interaction
 */

import { Horizon, Networks } from "@stellar/stellar-sdk";
import { Logger } from "../utils/Logger";
import { Config } from "../config/Config";
import { XDRDecoder, DecodedContractEvent } from "../utils/XDRDecoder";

export interface StellarNetworkConfig {
  horizonUrl: string;
  networkPassphrase: string;
  allowHttp?: boolean;
}

export interface StellarAccountInfo {
  accountId: string;
  sequence: string;
  balances: Array<{
    asset_type: string;
    asset_code?: string;
    asset_issuer?: string;
    balance: string;
    limit?: string;
  }>;
  thresholds: {
    low_threshold: number;
    med_threshold: number;
    high_threshold: number;
  };
  flags: {
    auth_required: boolean;
    auth_revocable: boolean;
    auth_immutable: boolean;
  };
}

export interface StellarTransactionResult {
  hash: string;
  ledger: number;
  createdAt: string;
  feePaid: string;
  operationCount: number;
  envelopeXdr: string;
  resultXdr: string;
  resultMetaXdr: string;
  feeMetaXdr: string;
  memoType: string;
  memo?: string;
  signatures: string[];
}

export interface StellarContractCallResult {
  success: boolean;
  transactionHash: string;
  ledger: number;
  events?: any[];
  returnValue?: string;
  error?: string;
}

/**
 * Stellar provider for network interaction and RPC calls
 */
export class StellarProvider {
  private logger = Logger.getInstance();
  private config = Config.getInstance();
  private server: Horizon.Server;
  private networkPassphrase: string;
  private xdrDecoder: XDRDecoder;

  constructor(config?: Partial<StellarNetworkConfig>) {
    const stellarConfig = config || this.config.stellar;

    this.server = new Horizon.Server(
      stellarConfig.horizonUrl || "https://horizon-testnet.stellar.org",
      {
        allowHttp: stellarConfig.allowHttp || false,
      }
    );
    this.networkPassphrase = stellarConfig.networkPassphrase || "";
    this.xdrDecoder = new XDRDecoder();

    this.logger.info("StellarProvider initialized", {
      horizonUrl: stellarConfig.horizonUrl,
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
   * Get the current ledger number
   */
  async getCurrentLedger(): Promise<number> {
    try {
      const response = await this.server
        .ledgers()
        .order("desc")
        .limit(1)
        .call();
      if (response.records && response.records.length > 0) {
        return response.records[0].sequence;
      }
      throw new Error("No ledger found");
    } catch (error) {
      this.logger.error("Failed to get current ledger:", error);
      throw error;
    }
  }

  /**
   * Get account information
   */
  async getAccountInfo(accountId: string): Promise<StellarAccountInfo> {
    try {
      const account = await this.server.loadAccount(accountId);
      return {
        accountId: account.id,
        sequence: account.sequence,
        balances: account.balances,
        thresholds: account.thresholds,
        flags: account.flags,
      };
    } catch (error) {
      this.logger.error("Failed to get account info:", error);
      throw error;
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(hash: string): Promise<StellarTransactionResult> {
    try {
      const transaction = await this.server
        .transactions()
        .transaction(hash)
        .call();
      return {
        hash: transaction.hash,
        ledger: transaction.ledger_attr,
        createdAt: transaction.created_at,
        feePaid: transaction.fee_charged.toString(),
        operationCount: transaction.operation_count,
        envelopeXdr: transaction.envelope_xdr,
        resultXdr: transaction.result_xdr,
        resultMetaXdr: transaction.result_meta_xdr,
        feeMetaXdr: transaction.fee_meta_xdr,
        memoType: transaction.memo_type,
        memo: transaction.memo,
        signatures: transaction.signatures,
      };
    } catch (error) {
      this.logger.error("Failed to get transaction:", error);
      throw error;
    }
  }

  /**
   * Get account operations
   */
  async getAccountOperations(
    accountId: string,
    limit: number = 10,
    cursor?: string
  ): Promise<Horizon.ServerApi.OperationRecord[]> {
    try {
      let builder = this.server.operations().forAccount(accountId).limit(limit);
      if (cursor) {
        builder = builder.cursor(cursor);
      }
      const response = await builder.call();
      return response.records;
    } catch (error) {
      this.logger.error("Failed to get account operations:", error);
      throw error;
    }
  }

  /**
   * Get contract events from transaction
   */
  async getContractEvents(
    transactionHash: string
  ): Promise<DecodedContractEvent[]> {
    try {
      const transaction = await this.getTransaction(transactionHash);
      if (transaction.resultMetaXdr) {
        return this.xdrDecoder.decodeContractEvents(transaction.resultMetaXdr);
      }
      return [];
    } catch (error) {
      this.logger.error("Failed to get contract events:", error);
      return [];
    }
  }

  /**
   * Submit a transaction
   */
  async submitTransaction(transaction: any): Promise<StellarTransactionResult> {
    try {
      const response = await this.server.submitTransaction(transaction);
      return {
        hash: response.hash,
        ledger: response.ledger || 0,
        createdAt: new Date().toISOString(),
        feePaid: "0", // Default fee
        operationCount: 1,
        envelopeXdr: response.envelope_xdr,
        resultXdr: response.result_xdr,
        resultMetaXdr: response.result_meta_xdr,
        feeMetaXdr: "",
        memoType: "none",
        signatures: [],
      };
    } catch (error) {
      this.logger.error("Failed to submit transaction:", error);
      throw error;
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(
    hash: string,
    timeoutSeconds: number = 30
  ): Promise<StellarTransactionResult> {
    const startTime = Date.now();
    const timeoutMs = timeoutSeconds * 1000;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const transaction = await this.getTransaction(hash);

        // Check if transaction is successful
        if (transaction.resultXdr) {
          return transaction;
        }
      } catch (error) {
        // Transaction not found yet, continue waiting
        this.logger.debug(`Transaction ${hash} not found yet, retrying...`);
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error(
      `Transaction ${hash} not confirmed within ${timeoutSeconds} seconds`
    );
  }

  /**
   * Check if connected to Stellar network
   */
  async isConnected(): Promise<boolean> {
    try {
      await this.server.loadAccount(
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
      );
      return false; // If we get here, we're connected but the account doesn't exist
    } catch (error: any) {
      if (error.response?.status === 404) {
        return true; // 404 means we're connected but account doesn't exist
      }
      return false; // Other errors mean we're not connected
    }
  }
}
