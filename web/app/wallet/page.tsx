'use client';

import { useState } from 'react';
import { Keypair } from '@stellar/stellar-sdk';
import { useStellarAccount } from '../hooks/useStellarAccount';
import InterstellarButton from '../components/InterstellarButton';

interface WalletInfo {
  publicKey: string;
  secretKey: string;
  funded: boolean;
  balance?: string;
}

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const { createAccountWithFriendbot, isLoading, error } = useStellarAccount();

  const createAndFundWallet = async () => {
    try {
      // Generate a new keypair
      const keypair = Keypair.random();
      const publicKey = keypair.publicKey();
      const secretKey = keypair.secret();

      console.log('Generated new keypair:', { publicKey, secretKey });

      // Use the hook to create and fund the account
      const result = await createAccountWithFriendbot(keypair);

      if (result.success) {
        const balance = '10000.0000000'; // Friendbot typically funds with 10,000 XLM

        const newWallet: WalletInfo = {
          publicKey: result.accountId || publicKey,
          secretKey: result.secretKey || secretKey,
          funded: true,
          balance
        };

        setWallet(newWallet);
      } else {
        console.error('Failed to create wallet:', result.error);
      }
    } catch (err) {
      console.error('Error creating wallet:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            🌟 Stellar Wallet Creator
          </h1>
          <p className="text-xl text-gray-300">
            Create and fund your Stellar testnet wallet instantly
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <InterstellarButton
              onClick={createAndFundWallet}
              disabled={isLoading}
              loading={isLoading}
              loadingText="CREATING WALLET..."
              className="px-8 py-4 text-xl"
            >
              CREATE & FUND WALLET
            </InterstellarButton>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
              <p className="text-red-200 font-medium">Error: {error}</p>
            </div>
          )}

          {wallet && (
            <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-green-200 mb-4">
                ✅ Wallet Created Successfully!
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-black/20 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-2">Public Key</h3>
                  <p className="text-green-300 font-mono text-sm break-all">
                    {wallet.publicKey}
                  </p>
                </div>

                <div className="bg-black/20 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-2">Secret Key</h3>
                  <p className="text-red-300 font-mono text-sm break-all">
                    {wallet.secretKey}
                  </p>
                  <p className="text-yellow-300 text-xs mt-2">
                    ⚠️ Keep this secret! Store it safely.
                  </p>
                </div>
              </div>

              <div className="mt-6 bg-blue-500/20 border border-blue-500/50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-blue-200 mb-2">Account Status</h3>
                <div className="flex items-center justify-between">
                  <span className="text-white">Funding Status:</span>
                  <span className="text-green-300 font-semibold">
                    {wallet.funded ? '✅ Funded' : '❌ Not Funded'}
                  </span>
                </div>
                {wallet.balance && (
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-white">Balance:</span>
                    <span className="text-green-300 font-semibold">
                      {wallet.balance} XLM
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-6 bg-purple-500/20 border border-purple-500/50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-purple-200 mb-2">Next Steps</h3>
                <ul className="text-white text-sm space-y-1">
                  <li>• Save your secret key securely</li>
                  <li>• Use the public key to receive payments</li>
                  <li>• Explore the Stellar testnet explorer</li>
                  <li>• Try sending transactions between accounts</li>
                </ul>
              </div>
            </div>
          )}

          <div className="mt-8 text-center">
            <p className="text-gray-400 text-sm">
              This creates a testnet wallet using the official Stellar SDK and funds it with ~10,000 XLM via Friendbot
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 