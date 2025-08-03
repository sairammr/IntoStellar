"use client";
import { useState, useEffect } from "react";
import { stellarContract } from "../lib/stellar-contract";
import { connect, disconnect, getPublicKey, kit } from "../lib/stellar-wallets-kit";
import * as Client from "../packages/create_escrow/dist";
import * as xdr from "@stellar/stellar-base";
import Server from "@stellar/stellar-sdk";
import freighterApi, { signAuthEntry, signTransaction } from "@stellar/freighter-api";

interface EscrowParams {
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

interface UseEscrowContractReturn {
  // State
  result: any;
  loading: boolean;
  error: string | null;
  testType: string;
  walletAddress: string;
  isConnected: boolean;
  isInitialized: boolean;

  // Wallet functions
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;

  // Contract functions
  createSrcEscrow: (params?: Partial<EscrowParams>) => Promise<void>;
  createDstEscrow: (params?: Partial<EscrowParams>) => Promise<void>;
  getEscrowAddress: () => Promise<void>;
  escrowExists: () => Promise<void>;
  connection: () => Promise<void>;
  
  // Utility functions
  clearError: () => void;
  clearResult: () => void;
}

export const useEscrowContract = (): UseEscrowContractReturn => {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testType, setTestType] = useState<string>("");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Check if wallet is already connected on page load
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
    setTestType("connect_wallet");

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
    setTestType("disconnect_wallet");

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

  const createRandomBuffers = () => {
    const orderHashBuffer = Buffer.alloc(32);
    const hashLockBuffer = Buffer.alloc(32);
    const uniqueId = Math.floor(Math.random() * 0xffffffff);
    
    orderHashBuffer.fill(1);
    orderHashBuffer.writeUInt32LE(uniqueId, 0);
    hashLockBuffer.fill(2);
    hashLockBuffer.writeUInt32LE(uniqueId, 0);
    
    return { orderHashBuffer, hashLockBuffer };
  };

  const getDefaultTimelocks = () => ({
    finality_delay: 10,
    src_withdrawal_delay: 20,
    src_public_withdrawal_delay: 30,
    src_cancellation_delay: 40,
    src_public_cancellation_delay: 50,
    dst_withdrawal_delay: 60,
    dst_public_withdrawal_delay: 70,
    dst_cancellation_delay: 80,
  });

  const handleAuthEntrySigning = async (response: any, whoElseNeedsToSign: string[]) => {
    if (!whoElseNeedsToSign || whoElseNeedsToSign.length === 0) {
      console.log("No additional signatures needed");
      return;
    }

    console.log("Signing auth entries for address:", whoElseNeedsToSign[0]);
    
    try {
      await response.signAuthEntries({
        address: whoElseNeedsToSign[0],
        signAuthEntry: async (preimageXDR: string, options?: { networkPassphrase?: string; address?: string }) => {
          console.log("Signing auth entry preimage:", preimageXDR);
          
          try {
            const signedResult = await signAuthEntry(preimageXDR, {
              networkPassphrase: 'Test SDF Network ; September 2015'
            });
            
            console.log("Signed result:", signedResult);
            
            // Handle different signedAuthEntry formats
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
            
            console.log("Buffer as base64:", signedAuthEntryBase64);
            
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

      // Sign and send the main transaction
      const signedTx = await response.signAndSend({
        signTransaction: async (tx: string) => {
          try {
            const signedTx = await freighterApi.signTransaction(tx, {
              address: walletAddress,
              networkPassphrase: 'Test SDF Network ; September 2015'
            });
            console.log("Signed Tx:", signedTx);
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

      console.log("Submitted Transaction:", signedTx);
      return signedTx;
    } catch (error) {
      console.error("Auth entry signing failed:", error);
      throw error;
    }
  };

  const createSrcEscrow = async (params?: Partial<EscrowParams>) => {
    if (!validateWalletConnection()) return;
    if (loading) return;
    
    setLoading(true);
    setError(null);
    setResult(null);
    setTestType("create_src_escrow");

    try {
      // Default parameters for testing
      const defaultParams: EscrowParams = {
        orderHash: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        hashLock: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        maker: walletAddress,
        taker: walletAddress,
        token: walletAddress,
        amount: "1000000000",
        safetyDeposit: "100000000",
        timelocks: {
          finalityDelay: 3600,
          srcWithdrawalDelay: 7200,
          srcPublicWithdrawalDelay: 14400,
          srcCancellationDelay: 10800,
          srcPublicCancellationDelay: 18000,
          dstWithdrawalDelay: 7200,
          dstPublicWithdrawalDelay: 14400,
          dstCancellationDelay: 10800
        }
      };

      const finalParams = { ...defaultParams, ...params };
      const contract = createContractClient();
      const { orderHashBuffer, hashLockBuffer } = createRandomBuffers();
      const timelocks = getDefaultTimelocks();

      const response = await contract.create_src_escrow({
        order_hash: orderHashBuffer,
        hash_lock: hashLockBuffer,
        maker: finalParams.maker,
        taker: finalParams.taker,
        token: finalParams.token,
        amount: BigInt(finalParams.amount),
        safety_deposit: BigInt(finalParams.safetyDeposit),
        timelocks,
      });
      
      console.log("Contract Response:", response);

      const whoElseNeedsToSign = response.needsNonInvokerSigningBy();
      console.log("Who else needs to sign:", whoElseNeedsToSign);
      
      const signedTx = await handleAuthEntrySigning(response, whoElseNeedsToSign);
      
      setResult({
        response,
        signedTx,
        message: "Escrow created and submitted successfully! Check the console for transaction details."
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      console.error("Create source escrow failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const createDstEscrow = async (params?: Partial<EscrowParams>) => {
    if (!validateWalletConnection()) return;
    if (loading) return;
    
    setLoading(true);
    setError(null);
    setResult(null);
    setTestType("create_dst_escrow");

    try {
      const defaultParams: EscrowParams = {
        orderHash: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        hashLock: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        maker: walletAddress,
        taker: walletAddress,
        token: walletAddress,
        amount: "1000000000",
        safetyDeposit: "100000000",
        timelocks: {
          finalityDelay: 3600,
          srcWithdrawalDelay: 7200,
          srcPublicWithdrawalDelay: 14400,
          srcCancellationDelay: 10800,
          srcPublicCancellationDelay: 18000,
          dstWithdrawalDelay: 7200,
          dstPublicWithdrawalDelay: 14400,
          dstCancellationDelay: 10800
        }
      };

      const finalParams = { ...defaultParams, ...params };
      const contract = createContractClient();
      const { orderHashBuffer, hashLockBuffer } = createRandomBuffers();
      const timelocks = getDefaultTimelocks();

      const response = await contract.create_dst_escrow({
        order_hash: orderHashBuffer,
        hash_lock: hashLockBuffer,
        maker: finalParams.maker,
        taker: finalParams.taker,
        token: finalParams.token,
        amount: BigInt(finalParams.amount),
        safety_deposit: BigInt(finalParams.safetyDeposit),
        timelocks,
        caller: walletAddress,
      });
      
      setResult({
        response,
        message: "Destination escrow created successfully!"
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      console.error("Create destination escrow failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const getEscrowAddress = async () => {
    if (!validateWalletConnection()) return;
    if (loading) return;
    
    setLoading(true);
    setError(null);
    setResult(null);
    setTestType("get_escrow_address");

    try {
      const contract = createContractClient();
      const hashLockBuffer = Buffer.alloc(32);
      hashLockBuffer.fill(2);
      
      const response = await contract.get_escrow_address({
        hash_lock: hashLockBuffer
      });
      
      setResult({
        response,
        message: "Escrow address retrieved successfully!"
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      console.error("Get escrow address failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const escrowExists = async () => {
    if (!validateWalletConnection()) return;
    if (loading) return;
    
    setLoading(true);
    setError(null);
    setResult(null);
    setTestType("escrow_exists");

    try {
      const contract = createContractClient();
      const hashLockBuffer = Buffer.alloc(32);
      hashLockBuffer.fill(2);
      
      const response = await contract.escrow_exists({
        hash_lock: hashLockBuffer
      });
      
      setResult({
        response,
        message: "Escrow existence check completed!"
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      console.error("Check escrow exists failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const connection = async () => {
    if (loading) return;
    
    setLoading(true);
    setError(null);
    setResult(null);
    setTestType("test_connection");

    try {
      const response = await stellarContract.testConnection();
      setResult({
        response,
        message: "Connection test completed successfully!"
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      console.error("Connection test failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return {
    // State
    result,
    loading,
    error,
    testType,
    walletAddress,
    isConnected,
    isInitialized,

    // Wallet functions
    connectWallet,
    disconnectWallet,

    // Contract functions
    createSrcEscrow,
    createDstEscrow,
    getEscrowAddress,
    escrowExists,
    connection,
    
    // Utility functions
    clearError,
    clearResult,
  };
}; 