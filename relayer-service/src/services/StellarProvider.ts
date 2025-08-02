/**
 * @fileoverview Stellar provider for RPC calls and network interaction
 */

import { Horizon } from "@stellar/stellar-sdk";
import StellarSdk from "@stellar/stellar-sdk";
import { Logger } from "../utils/Logger";
import { Config } from "../config/Config";
import {
  XDRDecoder,
  DecodedContractEvent,
  DecodedFunctionCall,
  DecodedTransactionResult,
} from "../utils/XDRDecoder";

const { Server, Networks } = StellarSdk;

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
  private server: typeof Server;
  private networkPassphrase: string;
  private xdrDecoder: XDRDecoder;

  constructor(config?: Partial<StellarNetworkConfig>) {
    const stellarConfig = config || this.config.stellar;

    this.server = new Server(stellarConfig.horizonUrl, {
      allowHttp: stellarConfig.allowHttp || false,
    });
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
   * Get current ledger sequence
   */
  async getCurrentLedger(): Promise<number> {
    try {
      const ledger = await this.server.ledgers().order("desc").limit(1).call();

      return parseInt(ledger.records[0].sequence);
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
        accountId: account.accountId(),
        sequence: account.sequenceNumber(),
        balances: account.balances,
        thresholds: account.thresholds,
        flags: account.flags,
      };
    } catch (error) {
      this.logger.error(`Failed to get account info for ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Get transaction by hash
   */
  async getTransaction(hash: string): Promise<StellarTransactionResult> {
    try {
      const transaction = await this.server
        .transactions()
        .transaction(hash)
        .call();

      return {
        hash: transaction.hash,
        ledger: parseInt(transaction.ledger_attr),
        createdAt: transaction.created_at,
        feePaid: transaction.fee_paid,
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
      this.logger.error(`Failed to get transaction ${hash}:`, error);
      throw error;
    }
  }

  /**
   * Get operations for an account
   */
  async getAccountOperations(
    accountId: string,
    limit: number = 10,
    cursor?: string
  ): Promise<Horizon.ServerApi.OperationRecord[]> {
    try {
      const operations = await this.server
        .operations()
        .forAccount(accountId)
        .limit(limit)
        .cursor(cursor || "now")
        .call();

      return operations.records;
    } catch (error) {
      this.logger.error(`Failed to get operations for ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Get contract events from a transaction
   */
  async getContractEvents(
    transactionHash: string
  ): Promise<DecodedContractEvent[]> {
    try {
      const transaction = await this.getTransaction(transactionHash);

      // Parse contract events from resultMetaXdr using XDR decoder
      const events = this.xdrDecoder.decodeContractEvents(
        transaction.resultMetaXdr
      );

      // Add transaction metadata to events
      return events.map((event) => ({
        ...event,
        contractId: event.contractId || transaction.hash, // Fallback if not set
        ledger: event.ledger || transaction.ledger,
        timestamp: event.timestamp || new Date(transaction.createdAt).getTime(),
      }));
    } catch (error) {
      this.logger.error(
        `Failed to get contract events for ${transactionHash}:`,
        error
      );
      return [];
    }
  }

  /**
   * Submit a transaction to the network
   */
  async submitTransaction(transaction: any): Promise<StellarTransactionResult> {
    try {
      const result = await this.server.submitTransaction(transaction);

      return {
        hash: result.hash,
        ledger: parseInt(result.ledger),
        createdAt: new Date().toISOString(),
        feePaid: result.fee_paid,
        operationCount: transaction.operations.length,
        envelopeXdr: result.envelope_xdr,
        resultXdr: result.result_xdr,
        resultMetaXdr: result.result_meta_xdr,
        feeMetaXdr: result.fee_meta_xdr,
        memoType: transaction.memo?.type || "none",
        memo: transaction.memo?.value,
        signatures: transaction.signatures.map((sig: any) => sig.signature()),
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
   * Parse contract events from XDR
   */
  private parseContractEventsFromXDR(resultMetaXdr: string): any[] {
    try {
      // This is a placeholder implementation
      // In practice, you'd need to properly decode the XDR to extract contract events
      // Stellar contract events are embedded in the transaction result metadata

      // For now, return empty array - implement proper XDR decoding
      this.logger.debug(
        "Parsing contract events from XDR (placeholder implementation)"
      );

      return [];
    } catch (error) {
      this.logger.error("Failed to parse contract events from XDR:", error);
      return [];
    }
  }

  /**
   * Get server instance for direct access
   */
  getServer(): typeof Server {
    return this.server;
  }

  /**
   * Get network passphrase
   */
  getNetworkPassphrase(): string {
    return this.networkPassphrase;
  }

  /**
   * Check if provider is connected
   */
  async isConnected(): Promise<boolean> {
    try {
      await this.getCurrentLedger();
      return true;
    } catch (error) {
      return false;
    }
  }
}
