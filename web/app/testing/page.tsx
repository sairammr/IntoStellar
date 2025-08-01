"use client";

import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { StellarSdk, Networks } from "@stellar/stellar-sdk";

interface SwapState {
  step: number;
  status: string;
  error?: string;
  data?: any;
}

interface ContractAddresses {
  ethereumEscrowFactory: string;
  stellarEscrowFactory: string;
  fusionPlusEscrow: string;
}

export default function TestingPage() {
  const [swapState, setSwapState] = useState<SwapState>({
    step: 0,
    status: "Ready to start",
  });
  const [contracts, setContracts] = useState<ContractAddresses>({
    ethereumEscrowFactory: "",
    stellarEscrowFactory: "",
    fusionPlusEscrow: "",
  });
  const [swapParams, setSwapParams] = useState({
    ethAmount: "0.01",
    xlmAmount: "10",
    secret: "",
    secretHash: "",
    orderHash: "",
  });
  const [walletInfo, setWalletInfo] = useState({
    ethAddress: "",
    stellarAddress: "",
    ethBalance: "0",
    xlmBalance: "0",
  });

  // Initialize wallets and check balances
  useEffect(() => {
    initializeWallets();
  }, []);

  const initializeWallets = async () => {
    try {
      // Check if MetaMask is available
      if (typeof window.ethereum !== "undefined") {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        const balance = await provider.getBalance(address);

        setWalletInfo((prev) => ({
          ...prev,
          ethAddress: address,
          ethBalance: ethers.formatEther(balance),
        }));
      }

      // For Stellar, we'll use the CLI-generated address
      // In production, you'd integrate with a Stellar wallet
      setWalletInfo((prev) => ({
        ...prev,
        stellarAddress:
          "GD2RAKWBEOJ3P5YPURRWW6FRAYJYUQ2PH3GX6ITBM5VKML4O5TLAWWXC",
      }));
    } catch (error) {
      console.error("Failed to initialize wallets:", error);
    }
  };

  const generateSecret = () => {
    const secret = ethers.randomBytes(32);
    const secretHash = ethers.keccak256(secret);
    const orderHash = ethers.keccak256(
      ethers.toUtf8Bytes(Date.now().toString())
    );

    setSwapParams({
      ...swapParams,
      secret: ethers.hexlify(secret),
      secretHash: secretHash,
      orderHash: orderHash,
    });
  };

  const deployContracts = async () => {
    setSwapState({ step: 1, status: "Deploying contracts..." });

    try {
      // This would call your deployment scripts
      // For now, we'll simulate the deployment
      setSwapState({
        step: 1,
        status: "Contracts deployed successfully",
        data: {
          ethereumEscrowFactory: "0x1234567890123456789012345678901234567890",
          stellarEscrowFactory:
            "CBUXHMGZEAROJBXIPIOUNEJETLD2MAVSPTP6ZYEDZTFPQ43HFA5GJCB4",
          fusionPlusEscrow:
            "CCRKWXGKBTJIEDOGG75VFY2GXXNHOMBECRNUKLPEMDONGYGGN5NJRDPK",
        },
      });
    } catch (error) {
      setSwapState({
        step: 1,
        status: "Deployment failed",
        error: error.message,
      });
    }
  };

  const createEthereumOrder = async () => {
    setSwapState({ step: 2, status: "Creating Ethereum order..." });

    try {
      if (!window.ethereum) {
        throw new Error("MetaMask not found");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // This would interact with the actual 1inch Fusion+ contracts
      // For now, we'll simulate the order creation
      setSwapState({
        step: 2,
        status: "Ethereum order created successfully",
        data: { orderHash: swapParams.orderHash },
      });
    } catch (error) {
      setSwapState({
        step: 2,
        status: "Order creation failed",
        error: error.message,
      });
    }
  };

  const createStellarEscrow = async () => {
    setSwapState({ step: 3, status: "Creating Stellar escrow..." });

    try {
      // This would call the Stellar contract via the relayer
      const response = await fetch(
        "http://localhost:3000/api/create-stellar-escrow",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderHash: swapParams.orderHash,
            secretHash: swapParams.secretHash,
            amount: parseFloat(swapParams.xlmAmount) * 1000000, // Convert to stroops
            maker: walletInfo.ethAddress,
            taker: walletInfo.stellarAddress,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to create Stellar escrow");
      }

      const result = await response.json();
      setSwapState({
        step: 3,
        status: "Stellar escrow created successfully",
        data: { stellarEscrowAddress: result.escrowAddress },
      });
    } catch (error) {
      setSwapState({
        step: 3,
        status: "Stellar escrow creation failed",
        error: error.message,
      });
    }
  };

  const depositETH = async () => {
    setSwapState({ step: 4, status: "Depositing ETH..." });

    try {
      if (!window.ethereum) {
        throw new Error("MetaMask not found");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // This would call the actual Ethereum escrow contract
      const amount = ethers.parseEther(swapParams.ethAmount);

      // Simulate the deposit transaction
      setSwapState({
        step: 4,
        status: "ETH deposited successfully",
        data: {
          transactionHash:
            "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        },
      });
    } catch (error) {
      setSwapState({
        step: 4,
        status: "ETH deposit failed",
        error: error.message,
      });
    }
  };

  const depositXLM = async () => {
    setSwapState({ step: 5, status: "Depositing XLM..." });

    try {
      // This would call the Stellar contract
      const response = await fetch("http://localhost:3000/api/deposit-xlm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          escrowAddress: swapState.data?.stellarEscrowAddress,
          amount: parseFloat(swapParams.xlmAmount) * 1000000,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to deposit XLM");
      }

      setSwapState({
        step: 5,
        status: "XLM deposited successfully",
        data: { ...swapState.data, xlmDeposited: true },
      });
    } catch (error) {
      setSwapState({
        step: 5,
        status: "XLM deposit failed",
        error: error.message,
      });
    }
  };

  const claimXLM = async () => {
    setSwapState({ step: 6, status: "Claiming XLM..." });

    try {
      const response = await fetch("http://localhost:3000/api/claim-xlm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          escrowAddress: swapState.data?.stellarEscrowAddress,
          secret: swapParams.secret,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to claim XLM");
      }

      setSwapState({
        step: 6,
        status: "XLM claimed successfully",
        data: { ...swapState.data, xlmClaimed: true },
      });
    } catch (error) {
      setSwapState({
        step: 6,
        status: "XLM claim failed",
        error: error.message,
      });
    }
  };

  const claimETH = async () => {
    setSwapState({ step: 7, status: "Claiming ETH..." });

    try {
      // This would call the Ethereum escrow contract with the revealed secret
      const response = await fetch("http://localhost:3000/api/claim-eth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: swapParams.secret,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to claim ETH");
      }

      setSwapState({
        step: 7,
        status: "ETH claimed successfully - Swap completed!",
        data: { ...swapState.data, ethClaimed: true },
      });
    } catch (error) {
      setSwapState({
        step: 7,
        status: "ETH claim failed",
        error: error.message,
      });
    }
  };

  const resetSwap = () => {
    setSwapState({ step: 0, status: "Ready to start" });
    setSwapParams({
      ethAmount: "0.01",
      xlmAmount: "10",
      secret: "",
      secretHash: "",
      orderHash: "",
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">
          🌉 ETH → XLM Cross-Chain Swap Testing
        </h1>

        {/* Wallet Information */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Wallet Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-lg font-medium text-blue-400">
                Ethereum (Sepolia)
              </h3>
              <p className="text-sm text-gray-300">
                Address: {walletInfo.ethAddress || "Not connected"}
              </p>
              <p className="text-sm text-gray-300">
                Balance: {walletInfo.ethBalance} ETH
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-purple-400">
                Stellar (Testnet)
              </h3>
              <p className="text-sm text-gray-300">
                Address: {walletInfo.stellarAddress}
              </p>
              <p className="text-sm text-gray-300">
                Balance: {walletInfo.xlmBalance} XLM
              </p>
            </div>
          </div>
        </div>

        {/* Swap Parameters */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Swap Parameters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                ETH Amount
              </label>
              <input
                type="number"
                value={swapParams.ethAmount}
                onChange={(e) =>
                  setSwapParams({ ...swapParams, ethAmount: e.target.value })
                }
                className="w-full bg-gray-700 rounded px-3 py-2"
                step="0.001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                XLM Amount
              </label>
              <input
                type="number"
                value={swapParams.xlmAmount}
                onChange={(e) =>
                  setSwapParams({ ...swapParams, xlmAmount: e.target.value })
                }
                className="w-full bg-gray-700 rounded px-3 py-2"
                step="1"
              />
            </div>
          </div>
          <button
            onClick={generateSecret}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
          >
            Generate Secret & Hash
          </button>
          {swapParams.secret && (
            <div className="mt-4 text-sm">
              <p>
                <strong>Secret:</strong> {swapParams.secret}
              </p>
              <p>
                <strong>Secret Hash:</strong> {swapParams.secretHash}
              </p>
              <p>
                <strong>Order Hash:</strong> {swapParams.orderHash}
              </p>
            </div>
          )}
        </div>

        {/* Swap Progress */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Swap Progress</h2>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm">Step {swapState.step}/7</span>
              <span className="text-sm">{swapState.status}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(swapState.step / 7) * 100}%` }}
              ></div>
            </div>
          </div>
          {swapState.error && (
            <div className="bg-red-900 border border-red-700 rounded p-3 mb-4">
              <p className="text-red-200">Error: {swapState.error}</p>
            </div>
          )}
          {swapState.data && (
            <div className="bg-green-900 border border-green-700 rounded p-3">
              <pre className="text-sm text-green-200 overflow-x-auto">
                {JSON.stringify(swapState.data, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={deployContracts}
              disabled={swapState.step > 0}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded"
            >
              1. Deploy Contracts
            </button>
            <button
              onClick={createEthereumOrder}
              disabled={swapState.step < 1 || swapState.step > 1}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded"
            >
              2. Create ETH Order
            </button>
            <button
              onClick={createStellarEscrow}
              disabled={swapState.step < 2 || swapState.step > 2}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 px-4 py-2 rounded"
            >
              3. Create XLM Escrow
            </button>
            <button
              onClick={depositETH}
              disabled={swapState.step < 3 || swapState.step > 3}
              className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 px-4 py-2 rounded"
            >
              4. Deposit ETH
            </button>
            <button
              onClick={depositXLM}
              disabled={swapState.step < 4 || swapState.step > 4}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 px-4 py-2 rounded"
            >
              5. Deposit XLM
            </button>
            <button
              onClick={claimXLM}
              disabled={swapState.step < 5 || swapState.step > 5}
              className="bg-pink-600 hover:bg-pink-700 disabled:bg-gray-600 px-4 py-2 rounded"
            >
              6. Claim XLM
            </button>
            <button
              onClick={claimETH}
              disabled={swapState.step < 6 || swapState.step > 6}
              className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 px-4 py-2 rounded"
            >
              7. Claim ETH
            </button>
            <button
              onClick={resetSwap}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
            >
              Reset Swap
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-gray-800 rounded-lg p-6 mt-8">
          <h2 className="text-2xl font-semibold mb-4">Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Connect MetaMask to Sepolia testnet</li>
            <li>Generate a secret and hash for the swap</li>
            <li>Deploy the contracts (one-time setup)</li>
            <li>Create an Ethereum order on 1inch Fusion+</li>
            <li>Create corresponding Stellar escrow</li>
            <li>Deposit ETH into Ethereum escrow</li>
            <li>Deposit XLM into Stellar escrow</li>
            <li>Reveal secret to claim XLM</li>
            <li>Use secret to claim ETH</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
