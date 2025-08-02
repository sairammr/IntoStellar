'use client';

import { useState, useRef, useEffect } from 'react';
import { Keypair } from '@stellar/stellar-sdk';
import InterstellarButton from '../components/InterstellarButton';
import Image from 'next/image';
import { useStellarAccount } from '../hooks/useStellarAccount';

interface WalletInfo {
  publicKey: string;
  privateKey: string;
  isFunded: boolean;
  isDeployed: boolean;
  balance?: string;
}

export default function StarterPackPage() {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { createAccountWithFriendbot } = useStellarAccount();

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  const createWallet = () => {
    const keypair = Keypair.random();
    setWallet({
      publicKey: keypair.publicKey(),
      privateKey: keypair.secret(),
      isFunded: false,
      isDeployed: false
    });
  };

  const fundWallet = async () => {
    if (!wallet) return;
    
    setIsLoading(true);
    try {
      const keypair = Keypair.fromSecret(wallet.privateKey);
      const result = await createAccountWithFriendbot(keypair);
      
      if (result.success) {
        setWallet(prev => prev ? { 
          ...prev, 
          isFunded: true,
          balance: '10000.0000000' // Friendbot funds with 10,000 XLM
        } : null);
      } else {
        console.error('Funding failed:', result.error);
      }
    } catch (error) {
      console.error('Funding failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deployWallet = async () => {
    if (!wallet || !wallet.isFunded) return;
    
    setIsLoading(true);
    try {
      // Simulate deployment process
      await new Promise(resolve => setTimeout(resolve, 3000));
      setWallet(prev => prev ? { ...prev, isDeployed: true } : null);
    } catch (error) {
      console.error('Deployment failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrivateKeyHold = () => {
    console.log('Hold started');
    setHoldProgress(0);
    
    // Start progress animation
    const startTime = Date.now();
    const duration = 1000; // 1 second
    
    progressTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * 100, 100);
      setHoldProgress(progress);
    }, 16); // ~60fps
    
    holdTimerRef.current = setTimeout(() => {
      console.log('Revealing private key');
      setShowPrivateKey(true);
      setHoldProgress(0);
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    }, 1000);
  };

  const handlePrivateKeyRelease = () => {
    console.log('Hold released');
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setHoldProgress(0);
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Image Background */}
      <div className="fixed inset-0 z-0">
        <Image
          src="/13404.jpg"
          alt="Stellar background"
          fill
          className="object-cover opacity-40"
          priority
        />
        <div className="absolute inset-0 bg-black/50"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 h-screen flex items-center justify-center p-4">
        <div className={`
          max-w-md w-full bg-white/5 backdrop-blur-md rounded-2xl p-8 border border-white/10
          transition-all duration-1000 ease-out
          ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
        `}>
          <div className="text-center space-y-6">
            <h1 className="text-3xl md:text-4xl font-bold text-white font-mono">
              Stellar Starter Pack
            </h1>
            <p className="text-white/70 font-mono">
              Create your first Stellar wallet and get started
            </p>

            {!wallet ? (
              <InterstellarButton
                onClick={createWallet}
                className="w-full"
              >
                Enter into Stellar
              </InterstellarButton>
            ) : (
              <div className="space-y-4">
                {/* Public Key */}
                <div className="bg-white/10 border border-white/20 rounded-lg p-4">
                  <h3 className="text-white/70 text-sm mb-2">Public Key</h3>
                  <p className="text-white font-mono text-sm break-all">
                    {wallet.publicKey}
                  </p>
                </div>

                {/* Private Key */}
                <div className="bg-white/10 border border-white/20 rounded-lg p-4">
                  <h3 className="text-white/70 text-sm mb-2">Private Key</h3>
                  <div className="relative">
                    <p className="text-white font-mono text-sm break-all mb-2">
                      {showPrivateKey ? wallet.privateKey : '••••••••••••••••••••••••••••••••'}
                    </p>
                    {!showPrivateKey && (
                      <button
                        className="w-full py-2 px-3 bg-black/50 hover:bg-black/60 rounded text-white/70 text-xs transition-colors relative overflow-hidden"
                        onMouseDown={handlePrivateKeyHold}
                        onMouseUp={handlePrivateKeyRelease}
                        onTouchStart={handlePrivateKeyHold}
                        onTouchEnd={handlePrivateKeyRelease}
                        onMouseLeave={handlePrivateKeyRelease}
                        onTouchCancel={handlePrivateKeyRelease}
                      >
                        <div className="relative z-10">Hold for 1s to reveal</div>
                        {holdProgress > 0 && (
                          <div 
                            className="absolute inset-0 bg-green-500/20 transition-all duration-100 ease-out"
                            style={{ width: `${holdProgress}%` }}
                          />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Deploy Wallet Button */}
                {!wallet.isFunded ? (
                  <InterstellarButton
                    onClick={fundWallet}
                    loading={isLoading}
                    loadingText="DEPLOYING..."
                    className="w-full"
                  >
                    Deploy Wallet
                  </InterstellarButton>
                ) : (
                  <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3">
                    <p className="text-green-400 text-sm font-mono">✓ Wallet Deployed</p>
                    {wallet.balance && (
                      <p className="text-green-300 text-xs font-mono">Balance: {wallet.balance} XLM</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 