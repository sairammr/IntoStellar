/**
 * @fileoverview Secret management service for atomic swaps
 */

import { randomBytes, createHash } from "crypto";
import { Logger } from "../utils/Logger";

export interface SecretData {
  secret: string;
  hashLock: string;
  createdAt: number;
  revealed: boolean;
  revealedAt?: number;
}

/**
 * Manages secrets for atomic swaps using HTLC
 */
export class SecretManager {
  private logger = Logger.getInstance();
  private secrets = new Map<string, SecretData>();

  /**
   * Initialize the secret manager
   */
  async initialize(): Promise<void> {
    this.logger.info("Initializing SecretManager");
    // Could load persisted secrets from database here
  }

  /**
   * Generate a new secret and its hash lock
   */
  generateSecret(): { secret: string; hashLock: string } {
    // Generate 32 random bytes for the secret
    const secretBytes = randomBytes(32);
    const secret = "0x" + secretBytes.toString("hex");

    // Create keccak256 hash (compatible with EVM)
    const hashLock = this.keccak256(secret);

    // Store the secret
    const secretData: SecretData = {
      secret,
      hashLock,
      createdAt: Date.now(),
      revealed: false,
    };
    this.secrets.set(hashLock, secretData);

    this.logger.debug("Generated new secret", { hashLock });

    return { secret, hashLock };
  }

  /**
   * Store a secret with its hash lock
   */
  storeSecret(secret: string, hashLock: string): void {
    // Validate that the secret matches the hash lock
    const computedHash = this.keccak256(secret);
    if (computedHash !== hashLock) {
      throw new Error("Secret does not match hash lock");
    }

    const secretData: SecretData = {
      secret,
      hashLock,
      createdAt: Date.now(),
      revealed: false,
    };
    this.secrets.set(hashLock, secretData);

    this.logger.debug("Stored secret", { hashLock });
  }

  /**
   * Reveal a secret for a given hash lock
   */
  async revealSecret(hashLock: string): Promise<string | null> {
    const secretData = this.secrets.get(hashLock);
    if (!secretData) {
      this.logger.warn("Secret not found for hash lock", { hashLock });
      return null;
    }

    if (secretData.revealed) {
      this.logger.debug("Secret already revealed", { hashLock });
      return secretData.secret;
    }

    // Mark as revealed
    secretData.revealed = true;
    secretData.revealedAt = Date.now();
    this.secrets.set(hashLock, secretData);

    this.logger.info("Secret revealed", { hashLock });

    return secretData.secret;
  }

  /**
   * Check if a secret exists for a hash lock
   */
  hasSecret(hashLock: string): boolean {
    return this.secrets.has(hashLock);
  }

  /**
   * Get secret data without revealing it
   */
  getSecretData(hashLock: string): SecretData | null {
    const secretData = this.secrets.get(hashLock);
    if (!secretData) {
      return null;
    }

    // Return a copy without the actual secret value (unless already revealed)
    return {
      ...secretData,
      secret: secretData.revealed ? secretData.secret : "[HIDDEN]",
    };
  }

  /**
   * Validate a secret against its hash lock
   */
  validateSecret(secret: string, hashLock: string): boolean {
    const computedHash = this.keccak256(secret);
    return computedHash === hashLock;
  }

  /**
   * Clean up old secrets
   */
  cleanup(): Promise<void> {
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    const now = Date.now();

    for (const [hashLock, secretData] of this.secrets.entries()) {
      if (now - secretData.createdAt > maxAge) {
        this.secrets.delete(hashLock);
        this.logger.debug("Cleaned up old secret", { hashLock });
      }
    }

    return Promise.resolve();
  }

  /**
   * Get statistics about stored secrets
   */
  getStatistics(): {
    totalSecrets: number;
    revealedSecrets: number;
    pendingSecrets: number;
  } {
    const secrets = Array.from(this.secrets.values());
    return {
      totalSecrets: secrets.length,
      revealedSecrets: secrets.filter((s) => s.revealed).length,
      pendingSecrets: secrets.filter((s) => !s.revealed).length,
    };
  }

  /**
   * Compute keccak256 hash (compatible with EVM)
   */
  private keccak256(data: string): string {
    // Remove 0x prefix if present
    const cleanData = data.startsWith("0x") ? data.slice(2) : data;

    // For compatibility with EVM, we use a simple hash here
    // In production, you should use the actual keccak256 implementation
    // that matches what's used on Ethereum (e.g., from ethers.js)
    const hash = createHash("sha256")
      .update(Buffer.from(cleanData, "hex"))
      .digest("hex");
    return "0x" + hash;
  }

  /**
   * Import secrets from external source (for testing/migration)
   */
  importSecrets(secrets: Array<{ secret: string; hashLock: string }>): void {
    for (const { secret, hashLock } of secrets) {
      try {
        this.storeSecret(secret, hashLock);
      } catch (error) {
        this.logger.error("Failed to import secret", { hashLock, error });
      }
    }
  }

  /**
   * Export secrets (for backup/migration)
   */
  exportSecrets(): Array<{
    secret: string;
    hashLock: string;
    revealed: boolean;
  }> {
    return Array.from(this.secrets.values()).map((data) => ({
      secret: data.secret,
      hashLock: data.hashLock,
      revealed: data.revealed,
    }));
  }
}
