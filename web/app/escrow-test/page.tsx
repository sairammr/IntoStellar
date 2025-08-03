"use client";
import React from "react";
import { useEscrowContract } from "../hooks/useEscrowContract";

export default function EscrowTestPage() {
  const {
    result,
    loading,
    error,
    testType,
    walletAddress,
    isConnected,
    connectWallet,
    disconnectWallet,
    createSrcEscrow,
    createDstEscrow,
    getEscrowAddress,
    escrowExists,
    connection,
  } = useEscrowContract();

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
              onClick={() => createSrcEscrow()}
              disabled={loading || !isConnected}
              className="px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              Create Source Escrow
            </button>

            <button
              onClick={() => createDstEscrow()}
              disabled={loading || !isConnected}
              className="px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              Create Destination Escrow
            </button>

            <button
              onClick={() => getEscrowAddress()}
              disabled={loading || !isConnected}
              className="px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              Get Escrow Address
            </button>

            <button
              onClick={() => escrowExists()}
              disabled={loading || !isConnected}
              className="px-4 py-3 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              Check Escrow Exists
            </button>

            <button
              onClick={() => connection()}
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