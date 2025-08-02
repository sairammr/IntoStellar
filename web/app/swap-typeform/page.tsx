'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import InterstellarButton from '../components/InterstellarButton';

interface SwapForm {
  ethAddress: string;
  walletAddress: string; // Stellar address
  direction: string;
  fromAsset: string;
  fromAmount: string;
}

interface ConversionRate {
  fromAmount: string;
  toAmount: string;
  rate: string;
  gasEstimate: string;
  ethPriceUSD?: string;
  xlmPriceUSD?: string;
  source?: string;
  loading: boolean;
  error: string | null;
}

interface Question {
  id: string;
  title: string;
  subtitle: string;
  type: 'connect' | 'direction' | 'asset' | 'amount' | 'slippage' | 'wallet' | 'confirm';
  options?: string[];
}

const questions: Question[] = [
  {
    id: 'connect',
    title: 'Connect your wallets',
    subtitle: 'Link your Ethereum (Metamask) and Stellar (Freighter) wallets to continue',
    type: 'connect'
  },
  {
    id: 'direction',
    title: 'Which direction do you want to swap?',
    subtitle: 'Choose your swap direction',
    type: 'direction',
    options: ['ETH → XLM', 'XLM → ETH']
  },
  {
    id: 'fromAsset',
    title: 'Select the asset you are swapping',
    subtitle: 'Select the asset you want to convert (only ETH available)',
    type: 'asset',
    options: ['USDC', 'USDT', 'BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'LINK']
  },
  {
    id: 'fromAmount',
    title: 'How much do you want to swap?',
    subtitle: 'Enter the amount of ETH you want to convert to XLM',
    type: 'amount'
  },
  {
    id: 'wallet',
    title: 'Where should we send your XLM?',
    subtitle: 'Enter your Stellar wallet address',
    type: 'wallet'
  },
  {
    id: 'confirm',
    title: 'Ready to transcend dimensions?',
    subtitle: 'Review your swap details and conversion rate before proceeding',
    type: 'confirm'
  }
];

export default function SwapTypeformPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [swapForm, setSwapForm] = useState<SwapForm>({
    ethAddress: '',
    walletAddress: '',
    direction: '',
    fromAsset: '',
    fromAmount: ''
  });
  const [conversionRate, setConversionRate] = useState<ConversionRate>({
    fromAmount: '',
    toAmount: '',
    rate: '',
    gasEstimate: '',
    loading: false,
    error: null
  });
  const [isLoading, setIsLoading] = useState(false);
  

  const [isLoaded, setIsLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(console.error);
    }
    
    // Trigger fade in after a short delay
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        
        // Check if current question is answered
        const currentQuestion = questions[currentStep];
        let hasAnswer = false;
        
        switch (currentQuestion.type) {
          case 'connect':
            hasAnswer = !!swapForm.ethAddress && !!swapForm.walletAddress;
            break;
          case 'direction':
            hasAnswer = !!swapForm.direction;
            break;
          case 'asset':
            hasAnswer = !!swapForm.fromAsset;
            break;
          case 'amount':
            hasAnswer = !!swapForm.fromAmount && parseFloat(swapForm.fromAmount) > 0;
            break;
          case 'wallet':
            hasAnswer = !!swapForm.walletAddress && swapForm.walletAddress.length > 0;
            break;
          case 'confirm':
            hasAnswer = true; // Always valid on confirm step
            break;
          default:
            hasAnswer = false;
        }
        
        if (hasAnswer) {
          if (currentStep < questions.length - 1) {
            handleNext();
          } else if (currentStep === questions.length - 1 && !isLoading) {
            handleSwap();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [currentStep, swapForm, isLoading]);

  const handleNext = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleInputChange = (value: string | number) => {
    const currentQuestion = questions[currentStep];
    console.log('Input change:', { field: currentQuestion.id, value, currentStep });
    setSwapForm(prev => ({
      ...prev,
      [currentQuestion.id]: value
    }));

    // Fetch conversion rate when amount changes
    if (currentQuestion.id === 'fromAmount' && typeof value === 'string') {
      getConversionRate(value);
    }
  };

  const hasValidAnswer = () => {
    const currentQuestion = questions[currentStep];
    
    switch (currentQuestion.type) {
      case 'connect':
        return !!swapForm.ethAddress && !!swapForm.walletAddress;
      case 'asset':
        return !!swapForm[currentQuestion.id as keyof SwapForm];
      case 'amount':
        return !!swapForm.fromAmount && parseFloat(swapForm.fromAmount) > 0;
      case 'wallet':
        return !!swapForm.walletAddress && swapForm.walletAddress.length > 0;
      case 'confirm':
        return true; // Always valid on confirm step
      default:
        return false;
    }
  };

  // 1inch API integration via our API route
  const getConversionRate = async (amount: string) => {
    if (!amount || parseFloat(amount) <= 0) {
      setConversionRate(prev => ({ ...prev, loading: false, error: null }));
      return;
    }

    setConversionRate(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Call our API route instead of 1inch directly
      const response = await fetch(`/api/1inch/quote?amount=${amount}`);

      if (!response.ok) {
        throw new Error('Failed to fetch conversion rate');
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      const { data } = result;
      
      setConversionRate({
        fromAmount: data.fromAmount,
        toAmount: data.toAmount,
        rate: data.rate,
        gasEstimate: data.gasEstimate.toString(),
        ethPriceUSD: data.ethPriceUSD?.toString(),
        xlmPriceUSD: data.xlmPriceUSD?.toString(),
        source: data.source,
        loading: false,
        error: null
      });
    } catch (error) {
      console.error('Error fetching conversion rate:', error);
      setConversionRate(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch rate'
      }));
    }
  };

  const router = useRouter();

  const handleSwap = () => {
    router.push(`/swap-typeform/progress?direction=${encodeURIComponent(swapForm.direction)}`);
  };


  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;

  const isEthToXlm = swapForm.direction === 'ETH → XLM';

  const renderQuestion = () => {
    switch (currentQuestion.type) {
      case 'connect':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Ethereum Wallet */}
            <div className="p-6 rounded-lg border-2 border-white/20 bg-white/5 text-center text-white/80 space-y-4">
              <h3 className="text-xl font-bold">Ethereum Wallet</h3>
              {swapForm.ethAddress ? (
                <p className="font-mono break-all text-sm">{swapForm.ethAddress}</p>
              ) : (
                <InterstellarButton onClick={async () => {
                  if ((window as any).ethereum) {
                    try {
                      const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
                      setSwapForm(prev => ({ ...prev, ethAddress: accounts[0] }));
                    } catch (err) {
                      console.error(err);
                    }
                  } else {
                    alert('MetaMask not detected');
                  }
                }}>Connect Metamask</InterstellarButton>
              )}
            </div>
            {/* Stellar Wallet */}
            <div className="p-6 rounded-lg border-2 border-white/20 bg-white/5 text-center text-white/80 space-y-4">
              <h3 className="text-xl font-bold">Stellar Wallet</h3>
              {swapForm.walletAddress ? (
                <p className="font-mono break-all text-sm">{swapForm.walletAddress}</p>
              ) : (
                <InterstellarButton onClick={async () => {
                  try {
                    const { connect: connectStellar, getPublicKey } = await import('../lib/stellar-wallets-kit');
                    await connectStellar();
                    const pk = await getPublicKey();
                    if (pk) setSwapForm(prev => ({ ...prev, walletAddress: pk }));
                  } catch (err) {
                    console.error(err);
                  }
                }}>Connect Freighter</InterstellarButton>
              )}
            </div>
          </div>
        );
      case 'direction':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentQuestion.options?.map((option) => (
              <button
                key={option}
                onClick={() => handleInputChange(option)}
                className={`
                  p-6 rounded-lg border-2 transition-all duration-300
                  ${swapForm.direction === option
                    ? 'border-white/50 bg-white/10 text-white'
                    : 'border-white/20 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10'
                  }
                `}
              >
                <div className="text-xl font-bold mb-2">{option}</div>
                <div className="text-sm opacity-70">
                  {option === 'ETH → XLM' ? 'Ethereum to Stellar' : 'Stellar to Ethereum'}
                </div>
              </button>
            ))}
          </div>
        );
      case 'asset':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {currentQuestion.options?.map((option) => (
              <button
                key={option}
                onClick={() => (isEthToXlm ? option === 'ETH' : option === 'XLM') ? handleInputChange(option) : null}
                disabled={isEthToXlm ? option !== 'ETH' : option !== 'XLM'}
                className={`
                  p-4 rounded-lg border-2 transition-all duration-300
                  ${(isEthToXlm ? option === 'ETH' : option === 'XLM')
                    ? swapForm.fromAsset === option
                      ? 'border-white/50 bg-white/10 text-white'
                      : 'border-white/20 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10'
                    : 'border-white/10 bg-white/5 text-white/30 cursor-not-allowed opacity-50'
                  }
                `}
              >
                <div className="text-lg font-bold mb-1">{option}</div>
                <div className="text-xs opacity-70">
                  {option === 'ETH' ? 'Available' : 'Coming Soon'}
                </div>
              </button>
            ))}
          </div>
        );

      case 'amount':
        return (
          <div className="max-w-md mx-auto">
            <input
              type="number"
              placeholder={isEthToXlm ? 'ETH amount' : 'XLM amount'}
              value={swapForm.fromAmount}
              onChange={(e) => handleInputChange(e.target.value)}
              className="w-full px-6 py-3 text-xl text-center bg-white/10 border border-white/30 rounded-lg text-white placeholder-white/50 font-mono focus:outline-none focus:border-white/50 transition-colors"
            />
          </div>
        );

      case 'slippage':
        return null; // Slippage step removed

      case 'wallet':
        return (
          <div className="max-w-md mx-auto">
            <input
              type="text"
              placeholder="G..."
              value={swapForm.walletAddress}
              onChange={(e) => {
                console.log('Wallet input change:', e.target.value);
                setSwapForm(prev => ({
                  ...prev,
                  walletAddress: e.target.value
                }));
              }}
              className="w-full px-6 py-3 text-base text-center bg-black/40 border border-white/50 rounded-lg text-white placeholder-white/50 font-mono focus:outline-none focus:border-white/70 focus:bg-black/60 transition-colors"
            />
          </div>
        );

      case 'confirm':
        return (
          <div className="max-w-md mx-auto space-y-4">
            <div className="bg-white/10 border border-white/20 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-white/70 text-sm">Direction:</span>
                <span className="text-white font-mono text-sm">{swapForm.direction}</span>
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-white/70 text-sm">From:</span>
                <span className="text-white font-mono text-sm">{swapForm.fromAmount} {swapForm.fromAsset}</span>
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-white/70 text-sm">To:</span>
                <span className="text-white font-mono text-sm">
                  {conversionRate.loading ? 'Loading...' : conversionRate.toAmount ? `${conversionRate.toAmount} ${isEthToXlm ? 'XLM' : 'ETH'}` : '~0'}
                </span>
              </div>
              {conversionRate.rate && (
                <div className="flex justify-between items-center mb-3">
                  <span className="text-white/70 text-sm">Rate:</span>
                  <span className="text-white font-mono text-sm">
                    {isEthToXlm ? `1 ETH = ${conversionRate.rate} XLM` : `1 XLM = ${conversionRate.rate} ETH`}
                  </span>
                </div>
              )}
              {conversionRate.ethPriceUSD && (
                <div className="flex justify-between items-center mb-3">
                  <span className="text-white/70 text-sm">ETH Price:</span>
                  <span className="text-white font-mono text-sm">${conversionRate.ethPriceUSD}</span>
                </div>
              )}
              {conversionRate.xlmPriceUSD && (
                <div className="flex justify-between items-center mb-3">
                  <span className="text-white/70 text-sm">XLM Price:</span>
                  <span className="text-white font-mono text-sm">${conversionRate.xlmPriceUSD}</span>
                </div>
              )}
              {conversionRate.gasEstimate && (
                <div className="flex justify-between items-center mb-3">
                  <span className="text-white/70 text-sm">Gas:</span>
                  <span className="text-white font-mono text-sm">~{conversionRate.gasEstimate} ETH</span>
                </div>
              )}
              {conversionRate.error && (
                <div className="flex justify-between items-center mb-3">
                  <span className="text-red-400 text-sm">Error:</span>
                  <span className="text-red-300 font-mono text-xs">{conversionRate.error}</span>
                </div>
              )}
              <div className="flex justify-between items-center mb-3">
                <span className="text-white/70 text-sm">Network:</span>
                <span className="text-white font-mono text-sm">{isEthToXlm ? 'Ethereum → Stellar' : 'Stellar → Ethereum'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/70 text-sm">Wallet:</span>
                <span className="text-white font-mono text-xs">{swapForm.walletAddress.slice(0, 8)}...{swapForm.walletAddress.slice(-8)}</span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Video Background */}
      <div className="fixed inset-0 z-0">
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover opacity-40"
        >
          <source src="/lightspeed_compressed.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/50"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 h-screen flex items-center justify-center p-4 overflow-hidden">
        <div className={`
          max-w-4xl w-full bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 max-h-[90vh] overflow-y-auto
          transition-all duration-1000 ease-out
          ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
        `}>
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-white/60 font-mono text-sm">
                Step {currentStep + 1} of {questions.length}
              </span>
              <span className="text-white/60 font-mono text-sm">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div 
                className="bg-white h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>

          {/* Question */}
          <div className="text-center">
            <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white mb-4 font-mono">
              {currentQuestion.title}
            </h1>
            <p className="text-lg md:text-xl text-white/70 font-mono mb-8">
              {currentQuestion.subtitle}
            </p>

            {/* Question Content */}
            <div className="mb-8">
              {renderQuestion()}
            </div>

            {/* Navigation */}
            <div className="flex justify-center items-center space-x-4 mb-4">
              {currentStep > 0 && (
                <button
                  onClick={handleBack}
                  className="px-6 py-2 text-white/70 hover:text-white transition-colors font-mono text-sm"
                >
                  ← Back
                </button>
              )}

              {currentStep < questions.length - 1 ? (
                <InterstellarButton
                  onClick={handleNext}
                  disabled={!hasValidAnswer()}
                  className="px-8 py-3 text-base"
                >
                  Continue
                </InterstellarButton>
              ) : (
                <InterstellarButton
                  onClick={handleSwap}
                  disabled={isLoading || !hasValidAnswer()}
                  loading={isLoading}
                  loadingText="PROCESSING..."
                  className="px-8 py-3 text-base"
                >
                  Execute Swap
                </InterstellarButton>
              )}
            </div>

            {/* Keyboard Hint */}
            <div className="mb-4 text-center">
              <p className="text-white/40 font-mono text-xs">
                Press <kbd className="px-2 py-1 bg-white/10 rounded text-xs">Space</kbd> or <kbd className="px-2 py-1 bg-white/10 rounded text-xs">Enter</kbd> to continue
              </p>
            </div>

            {/* Status */}
            
          </div>
        </div>
      </div>
    </div>
  );
} 