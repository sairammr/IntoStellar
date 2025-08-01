import { useState, useCallback } from 'react';
import { Keypair, Networks, TransactionBuilder, Operation } from '@stellar/stellar-sdk';

interface CreateAccountOptions {
  destination: string;
  startingBalance: string;
  source?: string;
  network?: 'testnet' | 'mainnet';
}

interface AccountCreationResult {
  success: boolean;
  accountId?: string;
  secretKey?: string;
  error?: string;
  transactionHash?: string;
}

interface UseStellarAccountReturn {
  createAccount: (options: CreateAccountOptions) => Promise<AccountCreationResult>;
  createAccountWithFriendbot: (destinationKeypair: Keypair) => Promise<AccountCreationResult>;
  isLoading: boolean;
  error: string | null;
}

export const useStellarAccount = (): UseStellarAccountReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createAccount = useCallback(async (options: CreateAccountOptions): Promise<AccountCreationResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const { destination, startingBalance, source, network = 'testnet' } = options;

      // Validate inputs
      if (!destination) {
        throw new Error('Destination account ID is required');
      }
      if (!startingBalance || parseFloat(startingBalance) <= 0) {
        throw new Error('Starting balance must be greater than 0');
      }

      // For now, we'll use Friendbot for account creation
      // In production, you would implement the full createAccount operation
      console.log('Creating account with destination:', destination);
      console.log('Starting balance:', startingBalance);
      console.log('Network:', network);
      
      // Generate a new keypair for the destination
      const destinationKeypair = Keypair.fromPublicKey(destination);
      
      // Use Friendbot for funding (testnet only)
      const response = await fetch(
        `https://friendbot.stellar.org?addr=${encodeURIComponent(destination)}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fund account: ${response.statusText}`);
      }

      const fundingResult = await response.json();
      console.log('Friendbot funding result:', fundingResult);

      return {
        success: true,
        accountId: destination,
        transactionHash: fundingResult.hash
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create account';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createAccountWithFriendbot = useCallback(async (destinationKeypair: Keypair): Promise<AccountCreationResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const destinationPublicKey = destinationKeypair.publicKey();
      const destinationSecretKey = destinationKeypair.secret();

      // Use Friendbot to fund the account (testnet only)
      const response = await fetch(
        `https://friendbot.stellar.org?addr=${encodeURIComponent(destinationPublicKey)}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fund account: ${response.statusText}`);
      }

      const fundingResult = await response.json();
      console.log('Friendbot funding result:', fundingResult);

      return {
        success: true,
        accountId: destinationPublicKey,
        secretKey: destinationSecretKey,
        transactionHash: fundingResult.hash
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create account with Friendbot';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    createAccount,
    createAccountWithFriendbot,
    isLoading,
    error
  };
}; 