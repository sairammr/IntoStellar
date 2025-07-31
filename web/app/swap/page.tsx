'use client';

import { useState } from 'react';
import { Wallet } from '@stellar/typescript-wallet-sdk';
import InterstellarButton from '../components/InterstellarButton';

interface SwapForm {
  fromAsset: string;
  fromAmount: string;
  toAsset: string;
  toAmount: string;
  slippage: number;
}

export default function SwapPage() {
  const [swapForm, setSwapForm] = useState<SwapForm>({
    fromAsset: 'USDC',
    fromAmount: '',
    toAsset: 'XLM',
    toAmount: '',
    slippage: 0.5
  });
  const [isLoading, setIsLoading] = useState(false);
  const [swapStatus, setSwapStatus] = useState<string>('');

  const handleSwap = async () => {
    setIsLoading(true);
    setSwapStatus('Initiating swap...');
    
    try {
      // Simulate swap process
      await new Promise(resolve => setTimeout(resolve, 2000));
      setSwapStatus('Swap completed successfully!');
    } catch (error) {
      setSwapStatus('Swap failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const popularAssets = [
    { symbol: 'USDC', name: 'USD Coin' },
    { symbol: 'USDT', name: 'Tether' },
    { symbol: 'BTC', name: 'Bitcoin' },
    { symbol: 'ETH', name: 'Ethereum' },
    { symbol: 'SOL', name: 'Solana' },
    { symbol: 'ADA', name: 'Cardano' },
  ];

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Interstellar Background Elements */}
      <div className="absolute inset-0">
        {/* Wormhole Effect */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 border border-white/10 rounded-full animate-pulse"></div>
        <div className="absolute top-1/4 left-1/4 w-48 h-48 border border-white/20 rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-1/4 left-1/4 w-32 h-32 border border-white/30 rounded-full animate-pulse" style={{animationDelay: '2s'}}></div>
        
        {/* Tesseract Grid Lines */}
        <div className="absolute inset-0 opacity-5">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute border-l border-white/20"
              style={{
                left: `${(i * 5)}%`,
                height: '100%',
                animationDelay: `${i * 0.1}s`
              }}
            />
          ))}
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute border-t border-white/20"
              style={{
                top: `${(i * 5)}%`,
                width: '100%',
                animationDelay: `${i * 0.1}s`
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-4 font-mono tracking-wider">
            INTERSTELLAR SWAP
          </h1>
          <p className="text-lg text-gray-400 font-mono">
            Transcend dimensions, convert any asset to Stellar
          </p>
        </div>

        {/* Center: Swap Interface */}
        <div className="flex justify-center mb-16">
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-8 border border-white/20 max-w-md shadow-2xl">
            {/* Interstellar Quote */}
            <div className="mb-6 p-4 border-l-2 border-white/30 bg-black/20">
              <p className="text-white/80 font-mono text-sm italic">
                "Love is the one thing we're capable of perceiving that transcends dimensions of time and space."
              </p>
              <p className="text-white/60 font-mono text-xs mt-2">- Interstellar</p>
            </div>
            {/* From Asset */}
            <div className="mb-6">
              <label className="block text-white/60 text-sm font-mono mb-3 tracking-wide">FROM</label>
              <div className="flex items-center space-x-3">
                <div className="flex-1">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={swapForm.fromAmount}
                    onChange={(e) => setSwapForm({...swapForm, fromAmount: e.target.value})}
                    className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white placeholder-white/30 font-mono focus:outline-none focus:border-white/30 transition-colors text-sm"
                  />
                </div>
                <div className="flex items-center space-x-2 bg-black/20 border border-white/10 rounded-lg px-3 py-2 min-w-[100px]">
                  <select
                    value={swapForm.fromAsset}
                    onChange={(e) => setSwapForm({...swapForm, fromAsset: e.target.value})}
                    className="bg-transparent text-white font-mono focus:outline-none text-sm"
                  >
                    {popularAssets.map(asset => (
                      <option key={asset.symbol} value={asset.symbol} className="bg-black">
                        {asset.symbol}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Swap Arrow */}
            <div className="flex justify-center mb-6">
              <div className="w-6 h-6 border border-white/20 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </div>
            </div>

            {/* To Asset */}
            <div className="mb-6">
              <label className="block text-white/60 text-sm font-mono mb-3 tracking-wide">TO</label>
              <div className="flex items-center space-x-3">
                <div className="flex-1">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={swapForm.toAmount}
                    onChange={(e) => setSwapForm({...swapForm, toAmount: e.target.value})}
                    className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white placeholder-white/30 font-mono focus:outline-none focus:border-white/30 transition-colors text-sm"
                  />
                </div>
                <div className="flex items-center space-x-2 bg-black/20 border border-white/10 rounded-lg px-3 py-2 min-w-[100px]">
                  <span className="text-white font-mono text-sm">XLM</span>
                </div>
              </div>
            </div>

            {/* Slippage Settings */}
            <div className="mb-6">
              <label className="block text-white/60 text-sm font-mono mb-3 tracking-wide">SLIPPAGE</label>
              <div className="flex space-x-2">
                {[0.1, 0.5, 1.0].map(slippage => (
                  <button
                    key={slippage}
                    onClick={() => setSwapForm({...swapForm, slippage})}
                    className={`px-3 py-1 rounded-lg font-mono text-xs transition-colors ${
                      swapForm.slippage === slippage
                        ? 'bg-white/10 text-white border border-white/20'
                        : 'bg-black/20 text-white/60 hover:text-white border border-transparent'
                    }`}
                  >
                    {slippage}%
                  </button>
                ))}
              </div>
            </div>

            {/* Swap Button */}
            <InterstellarButton
              onClick={handleSwap}
              disabled={!swapForm.fromAmount || !swapForm.toAmount}
              loading={isLoading}
              loadingText="PROCESSING"
              className="w-full"
            >
              SWAP
            </InterstellarButton>

            {/* Status */}
            {swapStatus && (
              <div className="mt-4 p-3 rounded-lg bg-black/20 border border-white/10">
                <p className="text-white/60 font-mono text-center text-xs">{swapStatus}</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom: Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/20 shadow-xl">
            <h3 className="text-white font-mono font-bold mb-4 tracking-wide">MISSION PARAMETERS</h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-white/60 font-mono">Exchange Rate</span>
                <span className="text-white font-mono">1 USDC = 0.85 XLM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60 font-mono">Network Fee</span>
                <span className="text-white font-mono">0.00001 XLM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60 font-mono">Processing Time</span>
                <span className="text-white font-mono">~3-5 seconds</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60 font-mono">Minimum Swap</span>
                <span className="text-white font-mono">1 USDC</span>
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/20 shadow-xl">
            <h3 className="text-white font-mono font-bold mb-4 tracking-wide">STELLAR CAPABILITIES</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-white/60 rounded-full mt-2"></div>
                <div>
                  <span className="text-white font-mono font-medium">Instant Settlement</span>
                  <p className="text-white/60 font-mono text-xs mt-1">Transcend time with 3-5 second transactions</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-white/60 rounded-full mt-2"></div>
                <div>
                  <span className="text-white font-mono font-medium">Ultra Low Fees</span>
                  <p className="text-white/60 font-mono text-xs mt-1">Fixed fee of 0.00001 XLM per transaction</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-white/60 rounded-full mt-2"></div>
                <div>
                  <span className="text-white font-mono font-medium">Cross-Chain Support</span>
                  <p className="text-white/60 font-mono text-xs mt-1">Navigate between blockchain dimensions</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/20 shadow-xl">
            <h3 className="text-white font-mono font-bold mb-4 tracking-wide">SUPPORTED DIMENSIONS</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {popularAssets.map(asset => (
                <div key={asset.symbol} className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-white/60 rounded-full"></div>
                  <span className="text-white font-mono">{asset.symbol}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 