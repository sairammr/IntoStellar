"use client";
import React, { useState } from "react";
import { stellarContract } from "../lib/stellar-contract";
import { connect, disconnect, getPublicKey, kit } from "../lib/stellar-wallets-kit";
import * as Client from "../packages/create_escrow/dist";
import * as xdr from "@stellar/stellar-base";
import Server from "@stellar/stellar-sdk";
import freighterApi, { signAuthEntry, signTransaction } from "@stellar/freighter-api";

export default function EscrowTestPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testType, setTestType] = useState<string>("");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // Check if wallet is already connected on page load
  React.useEffect(() => {
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
      }
    };

    checkWalletConnection();
  }, []);

  const connectWallet = async () => {
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
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = async () => {
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
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  const testCreateSrcEscrow = async () => {
    if (!isConnected || !walletAddress) {
      setError("Please connect your wallet first");
      return;
    }
    
    setLoading(true);
    setError(null);
    setResult(null);


    try {
      // Mock parameters for testing
      const params = {
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

      const contract = new Client.Client({
        ...Client.networks.testnet,
        rpcUrl: "https://soroban-testnet.stellar.org",
        signTransaction: async (tx: string) => {
          const { address } = await kit.getAddress();
          const { signedTxXdr } = await kit.signTransaction(tx, {
            address,
            networkPassphrase: 'Test SDF Network ; September 2015'
          });
          return { signedTxXdr, signerAddress: address };
        },
      });
      
      // Create 32-byte buffers for order_hash and hash_lock
      const orderHashBuffer = Buffer.alloc(32);
      const hashLockBuffer = Buffer.alloc(32);
      // Use a random 32-bit integer for uniqueness
      const uniqueId = Math.floor(Math.random() * 0xffffffff);
      orderHashBuffer.fill(1);
      orderHashBuffer.writeUInt32LE(uniqueId, 0);
      hashLockBuffer.fill(2);
      hashLockBuffer.writeUInt32LE(uniqueId, 0);
      // Use the connected wallet address for maker and taker
      const makerAddress = walletAddress;
      const takerAddress = walletAddress;
      // Use CLI-style timelocks for testing
      const timelocks = {
        finality_delay: 10,
        src_withdrawal_delay: 20,
        src_public_withdrawal_delay: 30,
        src_cancellation_delay: 40,
        src_public_cancellation_delay: 50,
        dst_withdrawal_delay: 60,
        dst_public_withdrawal_delay: 70,
        dst_cancellation_delay: 80,
      };
      const response = await contract.create_src_escrow({

        order_hash: orderHashBuffer,
        hash_lock: hashLockBuffer,
        maker: makerAddress,
        taker: takerAddress,
        token: walletAddress,
        amount: BigInt(params.amount),
        safety_deposit: BigInt(params.safetyDeposit),
        timelocks,
      });
      
      // Log the full response for debugging
      console.log("Contract Response:", response);

// Now sign with Freighter
// const signedXDR = await FreighterApi.signTransaction(response.toXDR(), {
//     networkPassphrase: 'Test SDF Network ; September 2015'
// }); 
      // Check if additional signatu
      // res are needed
      // console.log("Signed XDR:", signedXDR);
      
      const whoElseNeedsToSign = response.needsNonInvokerSigningBy();
      console.log("Who else needs to sign:", whoElseNeedsToSign);
      
      // If additional signatures are needed, sign them
      if (whoElseNeedsToSign && whoElseNeedsToSign.length > 0) {
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
                
                // The signedAuthEntry is a serialized Buffer object: {type: 'Buffer', data: Array}
                // We need to reconstruct the Buffer and convert it to base64
                let signedAuthEntryBase64: string;
                
                
                  const buffer = Buffer.from(signedResult?.signedAuthEntry?.data);
                  signedAuthEntryBase64 = buffer.toString('base64');
                  
                  console.log("Reconstructed buffer:", buffer);
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
            const signedTx = await response.signAndSend({

              signTransaction: async (tx: string) => {
                
                const signedTx = await freighterApi.signTransaction(tx, {
                  address: walletAddress,
                  networkPassphrase: 'Test SDF Network ; September 2015'
                })
                console.log("Signed Tx:", signedTx);
                return { 
                  signedTxXdr: signedTx?.signedTxXdr || "", 
                  signerAddress: walletAddress // Use the main wallet address
                };
              }}
             
            )


          console.log("Submitted Transaction:",signedTx );

        } catch (signError) {
          console.error("Error:", signError); 
        }
      } else {
        console.log("No additional signatures needed");
      }

      
      setResult({
        response,

        message: "Escrow created and submitted successfully! Check the console for transaction details."
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };


  const testCreateDstEscrow = async () => {
    if (!isConnected || !walletAddress) {
      setError("Please connect your wallet first");
      return;
    }
    
    setLoading(true);
    setError(null);
    setResult(null);
    setTestType("create_dst_escrow");

    try {
      // Mock parameters for testing
      const params = {
        orderHash: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        hashLock: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        maker: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        taker: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
        token: "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
        amount: "1000000000", // 10 XLM in stroops
        safetyDeposit: "100000000", // 1 XLM in stroops
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

      const contract = new Client.Client({
        ...Client.networks.testnet,
        rpcUrl: "https://soroban-testnet.stellar.org",
        signTransaction: async (tx: string) => {
          const { address } = await kit.getAddress();
          const { signedTxXdr } = await kit.signTransaction(tx, {
            address,
            networkPassphrase: 'Test SDF Network ; September 2015'
          });
          return { signedTxXdr, signerAddress: address };
        },
      });
      
      // Create 32-byte buffers for order_hash and hash_lock
      const orderHashBuffer = Buffer.alloc(32);
      const hashLockBuffer = Buffer.alloc(32);
      // Use a random 32-bit integer for uniqueness
      const uniqueId = Math.floor(Math.random() * 0xffffffff);
      orderHashBuffer.fill(1);
      orderHashBuffer.writeUInt32LE(uniqueId, 0);
      hashLockBuffer.fill(2);
      hashLockBuffer.writeUInt32LE(uniqueId, 0);
      // Use the connected wallet address for maker and taker
      const makerAddress = walletAddress;
      const takerAddress = walletAddress;
      // Use CLI-style timelocks for testing
      const timelocks = {
        finality_delay: 10,
        src_withdrawal_delay: 20,
        src_public_withdrawal_delay: 30,
        src_cancellation_delay: 40,
        src_public_cancellation_delay: 50,
        dst_withdrawal_delay: 60,
        dst_public_withdrawal_delay: 70,
        dst_cancellation_delay: 80,
      };
      const response = await contract.create_dst_escrow({
        order_hash: orderHashBuffer,
        hash_lock: hashLockBuffer,
        maker: makerAddress,
        taker: takerAddress,
        token: walletAddress,
        amount: BigInt(params.amount),
        safety_deposit: BigInt(params.safetyDeposit),
        timelocks,
        caller: walletAddress,
      });
      
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  const testGetEscrowAddress = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setTestType("get_escrow_address");

    try {
      const contract = new Client.Client({
        ...Client.networks.testnet,
        rpcUrl: "https://soroban-testnet.stellar.org",
        signTransaction: async (tx: string) => {
          const { address } = await kit.getAddress();
          const { signedTxXdr } = await kit.signTransaction(tx, {
            address,
            networkPassphrase: 'Test SDF Network ; September 2015'
          });
          return { signedTxXdr, signerAddress: address };
        },
      });
      
      // Create 32-byte buffer for hash_lock
      const hashLockBuffer = Buffer.alloc(32);
      hashLockBuffer.fill(2); // Fill with 2s for testing
      
      const response = await contract.get_escrow_address({
        hash_lock: hashLockBuffer
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  const testEscrowExists = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setTestType("escrow_exists");

    try {
      const contract = new Client.Client({
        ...Client.networks.testnet,
        rpcUrl: "https://soroban-testnet.stellar.org",
        signTransaction: async (tx: string) => {
          const { address } = await kit.getAddress();
          const { signedTxXdr } = await kit.signTransaction(tx, {
            address,
            networkPassphrase: 'Test SDF Network ; September 2015'
          });
          return { signedTxXdr, signerAddress: address };
        },
      });
      
      // Create 32-byte buffer for hash_lock
      const hashLockBuffer = Buffer.alloc(32);
      hashLockBuffer.fill(2); // Fill with 2s for testing
      
      const response = await contract.escrow_exists({
        hash_lock: hashLockBuffer
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setTestType("test_connection");

    try {
      const response = await stellarContract.testConnection();
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">
          Escrow Contract Test
        </h1>

        <div className="mb-8 p-6 bg-gray-800 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Contract Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <strong>Contract Type:</strong>
              <p className="text-sm text-gray-300">Create Escrow Factory Contract</p>
            </div>
            <div>
              <strong>Network:</strong>
              <p className="text-sm text-gray-300">Testnet</p>
            </div>
          </div>
        </div>

        {/* Wallet Status */}
        <div className="mb-8 p-6 bg-gray-800 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Wallet Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <strong>Status:</strong>
              <p className={`text-sm ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                {isConnected ? 'Connected' : 'Not Connected'}
              </p>
            </div>
            {isConnected && (
              <div>
                <strong>Address:</strong>
                <p className="text-sm text-gray-300 break-all">{walletAddress}</p>
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-4">
            <button
              onClick={connectWallet}
              disabled={loading || isConnected}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              Connect Wallet
            </button>
            {isConnected && (
              <button
                onClick={disconnectWallet}
                disabled={loading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
              >
                Disconnect Wallet
              </button>
            )}
          </div>
        </div>

        {/* Test Buttons */}
        <div className="mb-8 p-6 bg-gray-800 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Escrow Contract Functions</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              onClick={testCreateSrcEscrow}
              disabled={loading || !isConnected}
              className="px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              Create Source Escrow
            </button>

            <button
              onClick={testCreateDstEscrow}
              disabled={loading || !isConnected}
              className="px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              Create Destination Escrow
            </button>

            <button
              onClick={testGetEscrowAddress}
              disabled={loading || !isConnected}
              className="px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              Get Escrow Address
            </button>

            <button
              onClick={testEscrowExists}
              disabled={loading || !isConnected}
              className="px-4 py-3 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              Check Escrow Exists
            </button>

            <button
              onClick={testConnection}
              disabled={loading || !isConnected}
              className="px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              Test Connection
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="p-6 bg-gray-800 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Test Results</h2>

          {loading && (
            <div className="p-4 rounded-lg border border-blue-600 bg-blue-900/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                <span className="font-semibold">Testing {testType}...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg border border-red-600 bg-red-900/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg text-red-400">❌</span>
                <span className="font-semibold">Error</span>
              </div>
              <div className="text-red-300 text-sm">{error}</div>
            </div>
          )}

          {result && (
            <div className="p-4 rounded-lg border border-green-600 bg-green-900/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg text-green-400">✅</span>
                <span className="font-semibold">Success</span>
              </div>
              <div className="text-gray-300 text-sm">
                <strong>Result:</strong>
                <pre className="mt-2 p-3 bg-gray-700 rounded text-xs overflow-x-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {!result && !error && !loading && (
            <p className="text-gray-400 text-center py-8">
              Click any button above to test the escrow contract functions.
            </p>
          )}
        </div>
      </div>
    </div>
  );
} 