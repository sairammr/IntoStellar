"use client";
import { useState, useEffect } from "react";
import { stellarContract } from "../lib/stellar-contract";
import { connect, disconnect, getPublicKey, kit } from "../lib/stellar-wallets-kit";
import * as Client from "../packages/create_escrow/dist";
import * as xdr from "@stellar/stellar-base";
import Server from "@stellar/stellar-sdk";
import freighterApi, { signAuthEntry, signTransaction } from "@stellar/freighter-api";

interface Timelocks {
  finality_delay: number;
  src_withdrawal_delay: number;
  src_public_withdrawal_delay: number;
  src_cancellation_delay: number;
  src_public_cancellation_delay: number;
  dst_withdrawal_delay: number;
  dst_public_withdrawal_delay: number;
  dst_cancellation_delay: number;
}

interface CreateEscrowParams {
  orderHash: Buffer;
  hashLock: Buffer;
  maker: string;
  taker: string;
  token: string;
  amount: bigint;
  safetyDeposit: bigint;
  timelocks: Timelocks;
}

interface CreateDstEscrowParams extends CreateEscrowParams {
  caller: string;
}

interface GetEscrowAddressParams {
  hashLock: Buffer;
}

interface EscrowExistsParams {
  hashLock: Buffer;
}

interface UseEscrowContractReturn {
  result: any;
  loading: boolean;
  error: string | null;
  walletAddress: string;
  isConnected: boolean;
  isInitialized: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  createSrcEscrow: (params: CreateEscrowParams) => Promise<void>;
  createDstEscrow: (params: CreateDstEscrowParams) => Promise<void>;
  getEscrowAddress: (params: GetEscrowAddressParams) => Promise<void>;
  escrowExists: (params: EscrowExistsParams) => Promise<void>;
  clearError: () => void;
  clearResult: () => void;
}

export const useEscrowContract = (): UseEscrowContractReturn => {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  useEffect(() => {
    const checkWalletConnection = async () => {
      try {
        const address = await getPublicKey();
        if (address) {
          setWalletAddress(address);
          setIsConnected(true);
          stellarContract.setPublicKey(address);
        }
      } catch (error) {
        console.log("No wallet connected");
      } finally {
        setIsInitialized(true);
      }
    };

    checkWalletConnection();
  }, []);

  const clearError = () => setError(null);
  const clearResult = () => setResult(null);

  const connectWallet = async () => {
    if (loading) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      await connect(async () => {
        const address = await getPublicKey();
        if (address) {
          stellarContract.setPublicKey(address);
          setWalletAddress(address);
          setIsConnected(true);
          
          const response = await stellarContract.testConnection();
          setResult(response);
        } else {
          throw new Error("Failed to get wallet address");
        }
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      console.error("Wallet connection failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = async () => {
    if (loading) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      await disconnect(async () => {
        setWalletAddress("");
        setIsConnected(false);
        setResult({ success: true, message: "Wallet disconnected successfully" });
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      console.error("Wallet disconnection failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const validateWalletConnection = (): boolean => {
    if (!isConnected || !walletAddress) {
      setError("Please connect your wallet first");
      return false;
    }
    return true;
  };

  const createContractClient = () => {
    return new Client.Client({
      ...Client.networks.testnet,
      rpcUrl: "https://soroban-testnet.stellar.org",
      signTransaction: async (tx: string) => {
        try {
          const { address } = await kit.getAddress();
          const { signedTxXdr } = await kit.signTransaction(tx, {
            address,
            networkPassphrase: 'Test SDF Network ; September 2015'
          });
          return { signedTxXdr, signerAddress: address };
        } catch (error) {
          console.error("Transaction signing failed:", error);
          throw new Error("Failed to sign transaction");
        }
      },
    });
  };

  const handleAuthEntrySigning = async (response: any, whoElseNeedsToSign: string[]) => {
    if (!whoElseNeedsToSign || whoElseNeedsToSign.length === 0) {
      return;
    }

    try {
      await response.signAuthEntries({
        address: whoElseNeedsToSign[0],
        signAuthEntry: async (preimageXDR: string) => {
          try {
            const signedResult = await signAuthEntry(preimageXDR, {
              networkPassphrase: 'Test SDF Network ; September 2015'
            });
            
            let signedAuthEntryBase64: string;
            
            if (Buffer.isBuffer(signedResult?.signedAuthEntry)) {
              signedAuthEntryBase64 = signedResult.signedAuthEntry.toString('base64');
            } else if (typeof signedResult?.signedAuthEntry === 'string') {
              signedAuthEntryBase64 = signedResult.signedAuthEntry;
            } else if (signedResult?.signedAuthEntry && typeof signedResult.signedAuthEntry === 'object' && 'data' in signedResult.signedAuthEntry) {
              const buffer = Buffer.from((signedResult.signedAuthEntry as any).data);
              signedAuthEntryBase64 = buffer.toString('base64');
            } else {
              throw new Error("Unexpected signedAuthEntry format");
            }
            
            return {
              signedAuthEntry: signedAuthEntryBase64,
              signerAddress: whoElseNeedsToSign[0]
            };
          } catch (error) {
            console.error("Error signing auth entry:", error);
            throw error;
          }
        }
      });

      const signedTx = await response.signAndSend({
        signTransaction: async (tx: string) => {
          try {
            const signedTx = await freighterApi.signTransaction(tx, {
              address: walletAddress,
              networkPassphrase: 'Test SDF Network ; September 2015'
            });
            return { 
              signedTxXdr: signedTx?.signedTxXdr || "", 
              signerAddress: walletAddress
            };
          } catch (error) {
            console.error("Main transaction signing failed:", error);
            throw new Error("Failed to sign main transaction");
          }
        }
      });

      return signedTx;
    } catch (error) {
      console.error("Auth entry signing failed:", error);
      throw error;
    }
  };

  const createSrcEscrow = async (params: CreateEscrowParams) => {
    if (!validateWalletConnection() || loading) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const contract = createContractClient();

      const response = await contract.create_src_escrow({
        order_hash: params.orderHash,
        hash_lock: params.hashLock,
        maker: params.maker,
        taker: params.taker,
        token: params.token,
        amount: params.amount,
        safety_deposit: params.safetyDeposit,
        timelocks: params.timelocks,
      });
      
      const whoElseNeedsToSign = response.needsNonInvokerSigningBy();
      const signedTx = await handleAuthEntrySigning(response, whoElseNeedsToSign);
      
      setResult({
        response,
        signedTx,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      console.error("Create source escrow failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const createDstEscrow = async (params: CreateDstEscrowParams) => {
    if (!validateWalletConnection() || loading) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const contract = createContractClient();

      const response = await contract.create_dst_escrow({
        order_hash: params.orderHash,
        hash_lock: params.hashLock,
        maker: params.maker,
        taker: params.taker,
        token: params.token,
        amount: params.amount,
        safety_deposit: params.safetyDeposit,
        timelocks: params.timelocks,
        caller: params.caller,
      });
      
      setResult({
        response,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      console.error("Create destination escrow failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const getEscrowAddress = async (params: GetEscrowAddressParams) => {
    if (!validateWalletConnection() || loading) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const contract = createContractClient();
      
      const response = await contract.get_escrow_address({
        hash_lock: params.hashLock
      });
      
      setResult({
        response,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      console.error("Get escrow address failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const escrowExists = async (params: EscrowExistsParams) => {
    if (!validateWalletConnection() || loading) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const contract = createContractClient();
      
      const response = await contract.escrow_exists({
        hash_lock: params.hashLock
      });
      
      setResult({
        response,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      console.error("Check escrow exists failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return {
    result,
    loading,
    error,
    walletAddress,
    isConnected,
    isInitialized,
    connectWallet,
    disconnectWallet,
    createSrcEscrow,
    createDstEscrow,
    getEscrowAddress,
    escrowExists,
    clearError,
    clearResult,
  };
};
