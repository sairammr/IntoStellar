"use client";

import React, { useState, useEffect } from "react";
import {
  BASE_FEE,
  Contract,
  Networks,
  rpc as StellarRpc,
  Transaction,
  TransactionBuilder,
  Keypair,
  xdr,
} from "@stellar/stellar-sdk";
import { useStellarAccount } from "../hooks/useStellarAccount";

export default function SorobanTestPage() {
  const contractId = "CAU57EES7GKWLXDN7FETUMSQHOLBUQMXMSMIMNM6V32IVNMDUEV7MW6G";
  const { createAccountWithFriendbot, isLoading: isCreatingAccount } = useStellarAccount();
  
  const [keypair, setKeypair] = useState<Keypair | null>(null);
  const [accountAddress, setAccountAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>("0");
  const [writeStatus, setWriteStatus] = useState<string | null>(null);

  // Initialize wallet on component mount
  useEffect(() => {
    initializeWallet();
  }, []);

  const initializeWallet = async () => {
    try {
      // Create a new keypair
      const newKeypair = Keypair.random();
      setKeypair(newKeypair);
      
      // Fund the account using Friendbot
      const result = await createAccountWithFriendbot(newKeypair);
      
      if (result.success && result.accountId) {
        setAccountAddress(result.accountId);
        const balance = await getStellarBalance(result.accountId);
        setBalance(balance);
        setWriteStatus("Wallet created and funded successfully");
      } else {
        setWriteStatus(`Failed to create wallet: ${result.error}`);
      }
    } catch (error) {
      console.error("Failed to initialize wallet:", error);
      setWriteStatus(`Failed to initialize wallet: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const getStellarBalance = async (address: string): Promise<string> => {
    try {
      const server = new StellarRpc.Server("https://horizon-testnet.stellar.org");
      const account = await server.getAccount(address);
      const xlmBalance = (account as any).balances?.find((b: any) => b.asset_type === "native");
      return xlmBalance ? xlmBalance.balance : "0";
    } catch (error) {
      console.error("Failed to get Stellar balance:", error);
      return "0";
    }
  };

  const testContractCall = async () => {
    if (!keypair || !accountAddress) {
      setWriteStatus("Please create a wallet first");
      return;
    }

    setWriteStatus("Calling hello contract function...");

    try {
      const server = new StellarRpc.Server("https://soroban-testnet.stellar.org");
      const account = await server.getAccount(accountAddress);

      const contract = new Contract(contractId);

      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(contract.call("hello", xdr.ScVal.scvString("hello")))
        .setTimeout(100)
        .build();

      const preparedTx = await server.prepareTransaction(tx);

      // Sign the transaction with our keypair
      preparedTx.sign(keypair);

      const txResult = await server.sendTransaction(preparedTx);

      if (txResult.status !== "PENDING") {
        throw new Error("Transaction failed to submit");
      }

      const hash = txResult.hash;
      let getResponse = await server.getTransaction(hash);

      // Poll `getTransaction` until the status is not "NOT_FOUND"
      while (getResponse.status === "NOT_FOUND") {
        console.log("Waiting for transaction confirmation...");
        getResponse = await server.getTransaction(hash);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (getResponse.status === "SUCCESS") {
        // Make sure the transaction's resultMetaXDR is not empty
        if (!getResponse.resultMetaXdr) {
          throw new Error("Empty resultMetaXDR in getTransaction response");
        }

        // Extract the return value from the transaction result
        const returnValue = getResponse.resultMetaXdr
          .v3()
          .sorobanMeta()
          ?.returnValue();
        
        if (returnValue) {
          const greeting = returnValue.toString();
          setWriteStatus(`Contract call successful! Greeting: ${greeting} | Hash: ${hash}`);
        } else {
          setWriteStatus(`Contract call successful! Hash: ${hash}`);
        }
      } else {
        throw new Error(`Transaction failed: ${getResponse.resultXdr}`);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setWriteStatus(`Contract call failed: ${errorMessage}`);
    }
  };

  const refreshBalance = async () => {
    if (!accountAddress) return;
    
    try {
      const newBalance = await getStellarBalance(accountAddress);
      setBalance(newBalance);
      setWriteStatus("Balance refreshed");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setWriteStatus(`Failed to refresh balance: ${errorMessage}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">
          🔗 Soroban Test Page
        </h1>

        <div className="mb-8 p-6 bg-gray-800 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Contract Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <strong>Contract ID:</strong>
              <p className="text-sm text-gray-300 break-all">{contractId}</p>
            </div>
            <div>
              <strong>Network:</strong>
              <p className="text-sm text-gray-300">Testnet</p>
            </div>
          </div>
        </div>

        <div className="mb-8 p-6 bg-gray-800 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Wallet Status</h2>
          <div className="p-4 bg-gray-700 rounded-lg">
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-gray-400">Status:</span>{" "}
                <span className={accountAddress ? "text-green-400" : "text-red-400"}>
                  {accountAddress ? "Connected (Funded)" : "Not Created"}
                </span>
              </p>
              {accountAddress && (
                <>
                  <p>
                    <span className="text-gray-400">Address:</span>{" "}
                    <span className="text-xs break-all">{accountAddress}</span>
                  </p>
                  <p>
                    <span className="text-gray-400">Balance:</span>{" "}
                    <span className="text-green-400">{balance} XLM</span>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mb-8 p-6 bg-gray-800 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={initializeWallet}
              disabled={isCreatingAccount}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              {isCreatingAccount ? "Creating..." : "Create New Wallet"}
            </button>

            <button
              onClick={refreshBalance}
              disabled={!accountAddress}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              Refresh Balance
            </button>

            <button
              onClick={testContractCall}
              disabled={!accountAddress}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              Test Contract
            </button>
          </div>
        </div>

        {/* Status */}
        {writeStatus && (
          <div className="p-6 bg-gray-800 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Status</h2>
            <div className="p-4 bg-blue-900/20 border border-blue-600 rounded-lg">
              <p className="text-blue-300">{writeStatus}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 