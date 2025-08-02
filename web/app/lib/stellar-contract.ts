import { rpc, xdr, TransactionBuilder, Networks } from "@stellar/stellar-sdk";
import { signTransaction } from "./stellar-wallets-kit";
import * as Client from "../packages/hello_world/dist";

// Contract configuration
const FACTORY_CONTRACT_ID =
  "CB6YENCF3FP7JGU5K7CQY5T35K3JWCESH5I2PWOMZCKKMP5RZNN7NPMQ";
const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

// Initialize Soroban RPC client
const sorobanRpc = new rpc.Server(RPC_URL);

export interface TimelockParams {
  finalityDelay: number;
  srcWithdrawalDelay: number;
  srcPublicWithdrawalDelay: number;
  srcCancellationDelay: number;
  srcPublicCancellationDelay: number;
  dstWithdrawalDelay: number;
  dstPublicWithdrawalDelay: number;
  dstCancellationDelay: number;
}

export interface CreateEscrowParams {
  orderHash: string;
  hashLock: string;
  maker: string;
  taker: string;
  token: string;
  amount: string;
  safetyDeposit: string;
  timelocks: TimelockParams;
}

export class StellarContractClient {
  private publicKey: string | null = null;

  setPublicKey(publicKey: string) {
    this.publicKey = publicKey;
  }

  async hello() {
    const client = new Client.Client({
      ...Client.networks.testnet,
      rpcUrl: "https://soroban-testnet.stellar.org:443",
    });
    const result = await client.hello({ to: "hello" });
    return result;
  }
  private async getAccount() {
    if (!this.publicKey) {
      throw new Error("Public key not set. Please connect wallet first.");
    }
    return await sorobanRpc.getAccount(this.publicKey);
  }

  // Simplified version for now - we'll implement the full XDR encoding later
  async createSrcEscrow(params: CreateEscrowParams) {
    if (!this.publicKey) {
      throw new Error("Public key not set. Please connect wallet first.");
    }

    // Validate parameters
    this.validateParams(params);

    try {
      // For now, return a mock response while we work on the XDR encoding
      // TODO: Implement actual contract call with proper XDR encoding
      console.log("Creating source escrow with params:", params);

      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      return {
        hash: "mock_transaction_hash_" + Date.now(),
        result: "mock_result",
        escrowAddress:
          "mock_escrow_address_" + Math.random().toString(36).substring(7),
        note: "This is a mock response. Real implementation coming soon.",
      };
    } catch (error) {
      console.error("Error creating source escrow:", error);
      throw new Error(
        `Failed to create source escrow: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async createDstEscrow(params: CreateEscrowParams) {
    if (!this.publicKey) {
      throw new Error("Public key not set. Please connect wallet first.");
    }

    // Validate parameters
    this.validateParams(params);

    try {
      // For now, return a mock response while we work on the XDR encoding
      // TODO: Implement actual contract call with proper XDR encoding
      console.log("Creating destination escrow with params:", params);

      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      return {
        hash: "mock_transaction_hash_" + Date.now(),
        result: "mock_result",
        escrowAddress:
          "mock_escrow_address_" + Math.random().toString(36).substring(7),
        note: "This is a mock response. Real implementation coming soon.",
      };
    } catch (error) {
      console.error("Error creating destination escrow:", error);
      throw new Error(
        `Failed to create destination escrow: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getEscrowAddress(orderHash: string, hashLock: string) {
    if (!this.publicKey) {
      throw new Error("Public key not set. Please connect wallet first.");
    }

    // Validate parameters
    if (!this.validateOrderHash(orderHash)) {
      throw new Error("Invalid order hash format");
    }
    if (!this.validateHashLock(hashLock)) {
      throw new Error("Invalid hash lock format");
    }

    try {
      // For now, return a mock response
      // TODO: Implement actual contract call
      console.log("Getting escrow address for:", { orderHash, hashLock });

      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return "mock_escrow_address_" + orderHash.slice(0, 8);
    } catch (error) {
      console.error("Error getting escrow address:", error);
      throw new Error(
        `Failed to get escrow address: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async escrowExists(orderHash: string, hashLock: string) {
    if (!this.publicKey) {
      throw new Error("Public key not set. Please connect wallet first.");
    }

    // Validate parameters
    if (!this.validateOrderHash(orderHash)) {
      throw new Error("Invalid order hash format");
    }
    if (!this.validateHashLock(hashLock)) {
      throw new Error("Invalid hash lock format");
    }

    try {
      // For now, return a mock response
      // TODO: Implement actual contract call
      console.log("Checking if escrow exists for:", { orderHash, hashLock });

      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return Math.random() > 0.5; // Random true/false for testing
    } catch (error) {
      console.error("Error checking escrow exists:", error);
      throw new Error(
        `Failed to check escrow exists: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private validateParams(params: CreateEscrowParams) {
    if (!this.validateOrderHash(params.orderHash)) {
      throw new Error("Invalid order hash format");
    }
    if (!this.validateHashLock(params.hashLock)) {
      throw new Error("Invalid hash lock format");
    }
    if (!this.validateStellarAddress(params.maker)) {
      throw new Error("Invalid maker address format");
    }
    if (!this.validateStellarAddress(params.taker)) {
      throw new Error("Invalid taker address format");
    }
    if (!this.validateStellarAddress(params.token)) {
      throw new Error("Invalid token address format");
    }
    if (!this.validateAmount(params.amount)) {
      throw new Error("Invalid amount format");
    }
    if (!this.validateAmount(params.safetyDeposit)) {
      throw new Error("Invalid safety deposit format");
    }
    this.validateTimelocks(params.timelocks);
  }

  private validateTimelocks(timelocks: TimelockParams) {
    const delays = [
      timelocks.finalityDelay,
      timelocks.srcWithdrawalDelay,
      timelocks.srcPublicWithdrawalDelay,
      timelocks.srcCancellationDelay,
      timelocks.srcPublicCancellationDelay,
      timelocks.dstWithdrawalDelay,
      timelocks.dstPublicWithdrawalDelay,
      timelocks.dstCancellationDelay,
    ];

    for (let i = 0; i < delays.length - 1; i++) {
      if (delays[i] >= delays[i + 1]) {
        throw new Error(
          `Timelock delays must be in ascending order. Delay ${i} (${
            delays[i]
          }) must be less than delay ${i + 1} (${delays[i + 1]})`
        );
      }
    }
  }

  // Helper method to validate Stellar address format
  validateStellarAddress(address: string): boolean {
    return /^G[A-Z2-7]{55}$/.test(address);
  }

  // Helper method to validate hex string
  validateHexString(hex: string, length: number): boolean {
    return /^[0-9a-fA-F]+$/.test(hex) && hex.length === length;
  }

  // Helper method to validate order hash
  validateOrderHash(orderHash: string): boolean {
    return this.validateHexString(orderHash, 64);
  }

  // Helper method to validate hash lock
  validateHashLock(hashLock: string): boolean {
    return this.validateHexString(hashLock, 64);
  }

  // Helper method to validate amount (positive integer string)
  validateAmount(amount: string): boolean {
    return /^\d+$/.test(amount) && parseInt(amount) > 0;
  }

  // Get contract information
  getContractInfo() {
    return {
      factoryContractId: FACTORY_CONTRACT_ID,
      rpcUrl: RPC_URL,
      networkPassphrase: NETWORK_PASSPHRASE,
      isMock: true,
      note: "Currently using mock implementation. Real blockchain integration coming soon.",
    };
  }

  // Method to test wallet connection
  async testConnection() {
    if (!this.publicKey) {
      throw new Error("Public key not set. Please connect wallet first.");
    }

    try {
      // Try to get account details
      const account = await this.getAccount();
      return {
        success: true,
        publicKey: this.publicKey,
        accountId: account.accountId(),
        note: "Wallet connection successful!",
      };
    } catch (error) {
      // If account doesn't exist, that's okay - just return basic connection info
      console.warn("Account not found on network, but wallet is connected:", error);
      return {
        success: true,
        publicKey: this.publicKey,
        accountId: this.publicKey,
        note: "Wallet connected but account may not exist on network yet.",
      };
    }
  }
}

export const stellarContract = new StellarContractClient();
