"use client";
import React, { useState } from "react";
import { stellarContract } from "../lib/stellar-contract";

export default function HelloTestPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testHello = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await stellarContract.hello();
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
          Hello Contract Test
        </h1>

        <div className="mb-8 p-6 bg-gray-800 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Contract Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <strong>Contract Type:</strong>
              <p className="text-sm text-gray-300">Hello World Contract</p>
            </div>
            <div>
              <strong>Network:</strong>
              <p className="text-sm text-gray-300">Testnet</p>
            </div>
          </div>
        </div>

        {/* Test Button */}
        <div className="mb-8 p-6 bg-gray-800 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Test Hello Function</h2>
          
          <button
            onClick={testHello}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
          >
            {loading ? "Calling..." : "Call Hello Function"}
          </button>
        </div>

        {/* Results */}
        <div className="p-6 bg-gray-800 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Test Results</h2>

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
              Click the button above to test the hello function.
            </p>
          )}
        </div>
      </div>
    </div>
  );
} 