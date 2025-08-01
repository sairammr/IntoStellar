"use client";
import React, { useState, useEffect } from "react";
import { connect, disconnect, getPublicKey } from "../lib/stellar-wallets-kit";
import {
  stellarContract,
  CreateEscrowParams,
  TimelockParams,
} from "../lib/stellar-contract";

interface TestResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  timestamp?: string;
}

export default function TestStellarPage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  // Form states
  const [orderHash, setOrderHash] = useState(
    "0101010101010101010101010101010101010101010101010101010101010101"
  );
  const [hashLock, setHashLock] = useState(
    "0202020202020202020202020202020202020202020202020202020202020202"
  );
  const [maker, setMaker] = useState(
    "GAFVHOGVUA5A6WZAAMCAYCNHA6ZRLGJ2WFLARJWXHXP6QIJCEI56JMBQ"
  );
  const [taker, setTaker] = useState(
    "GD2RAKWBEOJ3P5YPURRWW6FRAYJYUQ2PH3GX6ITBM5VKML4O5TLAWWXC"
  );
  const [token, setToken] = useState(
    "GAFVHOGVUA5A5WZAAMCAYCNHA6ZRLGJ2WFLARJWXHXP6QIJCEI56JMBQ"
  );
  const [amount, setAmount] = useState("100000000");
  const [safetyDeposit, setSafetyDeposit] = useState("10000000");

  // Timelock states
  const [finalityDelay, setFinalityDelay] = useState(10);
  const [srcWithdrawalDelay, setSrcWithdrawalDelay] = useState(20);
  const [srcPublicWithdrawalDelay, setSrcPublicWithdrawalDelay] = useState(30);
  const [srcCancellationDelay, setSrcCancellationDelay] = useState(40);
  const [srcPublicCancellationDelay, setSrcPublicCancellationDelay] =
    useState(50);
  const [dstWithdrawalDelay, setDstWithdrawalDelay] = useState(60);
  const [dstPublicWithdrawalDelay, setDstPublicWithdrawalDelay] = useState(70);
  const [dstCancellationDelay, setDstCancellationDelay] = useState(80);

  useEffect(() => {
    checkWalletConnection();
  }, []);

  const checkWalletConnection = async () => {
    const address = await getPublicKey();
    if (address) {
      setWalletAddress(address);
      setIsConnected(true);
      stellarContract.setPublicKey(address);
    }
  };

  const handleConnect = async () => {
    try {
      await connect(async () => {
        await checkWalletConnection();
      });
    } catch (error) {
      addResult({
        success: false,
        message: "Failed to connect wallet",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setWalletAddress(null);
      setIsConnected(false);
      addResult({
        success: true,
        message: "Wallet disconnected successfully",
      });
    } catch (error) {
      addResult({
        success: false,
        message: "Failed to disconnect wallet",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const addResult = (result: TestResult) => {
    setResults((prev) => [
      ...prev,
      { ...result, timestamp: new Date().toISOString() },
    ]);
  };

  const clearResults = () => {
    setResults([]);
  };

  const getTimelockParams = (): TimelockParams => ({
    finalityDelay,
    srcWithdrawalDelay,
    srcPublicWithdrawalDelay,
    srcCancellationDelay,
    srcPublicCancellationDelay,
    dstWithdrawalDelay,
    dstPublicWithdrawalDelay,
    dstCancellationDelay,
  });

  const getEscrowParams = (): CreateEscrowParams => ({
    orderHash,
    hashLock,
    maker,
    taker,
    token,
    amount,
    safetyDeposit,
    timelocks: getTimelockParams(),
  });

  const testCreateSrcEscrow = async () => {
    if (!isConnected) {
      addResult({
        success: false,
        message: "Please connect wallet first",
      });
      return;
    }

    setLoading(true);
    try {
      const params = getEscrowParams();
      const result = await stellarContract.createSrcEscrow(params);

      addResult({
        success: true,
        message: "Source escrow created successfully",
        data: {
          hash: result.hash,
          escrowAddress: result.escrowAddress,
          params,
        },
      });
    } catch (error) {
      addResult({
        success: false,
        message: "Failed to create source escrow",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  const testCreateDstEscrow = async () => {
    if (!isConnected) {
      addResult({
        success: false,
        message: "Please connect wallet first",
      });
      return;
    }

    setLoading(true);
    try {
      const params = getEscrowParams();
      const result = await stellarContract.createDstEscrow(params);

      addResult({
        success: true,
        message: "Destination escrow created successfully",
        data: {
          hash: result.hash,
          escrowAddress: result.escrowAddress,
          params,
        },
      });
    } catch (error) {
      addResult({
        success: false,
        message: "Failed to create destination escrow",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  const testGetEscrowAddress = async () => {
    if (!isConnected) {
      addResult({
        success: false,
        message: "Please connect wallet first",
      });
      return;
    }

    setLoading(true);
    try {
      const escrowAddress = await stellarContract.getEscrowAddress(
        orderHash,
        hashLock
      );

      addResult({
        success: true,
        message: "Escrow address retrieved successfully",
        data: {
          orderHash,
          hashLock,
          escrowAddress,
        },
      });
    } catch (error) {
      addResult({
        success: false,
        message: "Failed to get escrow address",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  const testEscrowExists = async () => {
    if (!isConnected) {
      addResult({
        success: false,
        message: "Please connect wallet first",
      });
      return;
    }

    setLoading(true);
    try {
      const exists = await stellarContract.escrowExists(orderHash, hashLock);

      addResult({
        success: true,
        message: `Escrow exists check completed`,
        data: {
          orderHash,
          hashLock,
          exists,
        },
      });
    } catch (error) {
      addResult({
        success: false,
        message: "Failed to check if escrow exists",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setLoading(true);
    try {
      const result = await stellarContract.testConnection();
      addResult({
        success: true,
        message: "Wallet connection test successful",
        data: result,
      });
    } catch (error) {
      addResult({
        success: false,
        message: "Wallet connection test failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateRandomHash = () => {
    const hash = Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
    return hash;
  };

  const generateRandomOrderHash = () => {
    setOrderHash(generateRandomHash());
  };

  const generateRandomHashLock = () => {
    setHashLock(generateRandomHash());
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">
          🌟 Stellar Factory Contract Tester
        </h1>

        <div className="mb-8 p-6 bg-gray-800 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Contract Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <strong>Factory Contract ID:</strong>
              <p className="text-sm text-gray-300 break-all">
                CB6YENCF3FP7JGU5K7CQY5T35K3JWCESH5I2PWOMZCKKMP5RZNN7NPMQ
              </p>
            </div>
            <div>
              <strong>Network:</strong>
              <p className="text-sm text-gray-300">Testnet</p>
            </div>
          </div>
        </div>

        {/* Wallet Connection */}
        <div className="mb-8 p-6 bg-gray-800 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Wallet Connection</h2>
          <div className="flex items-center gap-4">
            {!isConnected ? (
              <button
                onClick={handleConnect}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
              >
                Connect Wallet
              </button>
            ) : (
              <div className="flex items-center gap-4">
                <div className="text-green-400">
                  ✅ Connected: {walletAddress?.slice(0, 8)}...
                  {walletAddress?.slice(-8)}
                </div>
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Form Parameters */}
        <div className="mb-8 p-6 bg-gray-800 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Escrow Parameters</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Order Hash
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={orderHash}
                  onChange={(e) => setOrderHash(e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="Order hash (32 bytes hex)"
                />
                <button
                  onClick={generateRandomOrderHash}
                  className="px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm"
                >
                  Random
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Hash Lock
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={hashLock}
                  onChange={(e) => setHashLock(e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="Hash lock (32 bytes hex)"
                />
                <button
                  onClick={generateRandomHashLock}
                  className="px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm"
                >
                  Random
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Maker Address
              </label>
              <input
                type="text"
                value={maker}
                onChange={(e) => setMaker(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                placeholder="Maker Stellar address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Taker Address
              </label>
              <input
                type="text"
                value={taker}
                onChange={(e) => setTaker(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                placeholder="Taker Stellar address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Token Address
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                placeholder="Token Stellar address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Amount</label>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                placeholder="Amount (stroops)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Safety Deposit
              </label>
              <input
                type="text"
                value={safetyDeposit}
                onChange={(e) => setSafetyDeposit(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                placeholder="Safety deposit (stroops)"
              />
            </div>
          </div>
        </div>

        {/* Timelock Parameters */}
        <div className="mb-8 p-6 bg-gray-800 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Timelock Parameters</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Finality Delay
              </label>
              <input
                type="number"
                value={finalityDelay}
                onChange={(e) => setFinalityDelay(Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Src Withdrawal
              </label>
              <input
                type="number"
                value={srcWithdrawalDelay}
                onChange={(e) => setSrcWithdrawalDelay(Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Src Public Withdrawal
              </label>
              <input
                type="number"
                value={srcPublicWithdrawalDelay}
                onChange={(e) =>
                  setSrcPublicWithdrawalDelay(Number(e.target.value))
                }
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Src Cancellation
              </label>
              <input
                type="number"
                value={srcCancellationDelay}
                onChange={(e) =>
                  setSrcCancellationDelay(Number(e.target.value))
                }
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Src Public Cancellation
              </label>
              <input
                type="number"
                value={srcPublicCancellationDelay}
                onChange={(e) =>
                  setSrcPublicCancellationDelay(Number(e.target.value))
                }
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Dst Withdrawal
              </label>
              <input
                type="number"
                value={dstWithdrawalDelay}
                onChange={(e) => setDstWithdrawalDelay(Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Dst Public Withdrawal
              </label>
              <input
                type="number"
                value={dstPublicWithdrawalDelay}
                onChange={(e) =>
                  setDstPublicWithdrawalDelay(Number(e.target.value))
                }
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Dst Cancellation
              </label>
              <input
                type="number"
                value={dstCancellationDelay}
                onChange={(e) =>
                  setDstCancellationDelay(Number(e.target.value))
                }
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Test Buttons */}
        <div className="mb-8 p-6 bg-gray-800 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Contract Functions</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={testCreateSrcEscrow}
              disabled={loading || !isConnected}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              {loading ? "Creating..." : "Create Source Escrow"}
            </button>

            <button
              onClick={testCreateDstEscrow}
              disabled={loading || !isConnected}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              {loading ? "Creating..." : "Create Destination Escrow"}
            </button>

            <button
              onClick={testGetEscrowAddress}
              disabled={loading || !isConnected}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              {loading ? "Checking..." : "Get Escrow Address"}
            </button>

            <button
              onClick={testEscrowExists}
              disabled={loading || !isConnected}
              className="px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              {loading ? "Checking..." : "Check Escrow Exists"}
            </button>

            <button
              onClick={testConnection}
              disabled={loading || !isConnected}
              className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              {loading ? "Testing..." : "Test Wallet Connection"}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="p-6 bg-gray-800 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Test Results</h2>
            <button
              onClick={clearResults}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-sm"
            >
              Clear Results
            </button>
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {results.length === 0 ? (
              <p className="text-gray-400 text-center py-8">
                No test results yet. Run some tests to see results here.
              </p>
            ) : (
              results.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${
                    result.success
                      ? "bg-green-900/20 border-green-600"
                      : "bg-red-900/20 border-red-600"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`text-lg ${
                            result.success ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {result.success ? "✅" : "❌"}
                        </span>
                        <span className="font-semibold">{result.message}</span>
                      </div>

                      {result.error && (
                        <div className="text-red-300 text-sm mb-2">
                          <strong>Error:</strong> {result.error}
                        </div>
                      )}

                      {result.data && (
                        <div className="text-gray-300 text-sm">
                          <strong>Data:</strong>
                          <pre className="mt-1 p-2 bg-gray-700 rounded text-xs overflow-x-auto">
                            {JSON.stringify(result.data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>

                    <span className="text-xs text-gray-400 ml-4">
                      {new Date(
                        result.timestamp || Date.now()
                      ).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
