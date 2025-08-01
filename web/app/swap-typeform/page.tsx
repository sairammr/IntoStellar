'use client';

import { useState, useRef, useEffect } from 'react';
import InterstellarButton from '../components/InterstellarButton';

interface SwapForm {
  fromAsset: string;
  fromAmount: string;
  toAsset: string;
  slippage: number;
  walletAddress: string;
}

interface Question {
  id: string;
  title: string;
  subtitle: string;
  type: 'asset' | 'amount' | 'slippage' | 'wallet' | 'confirm';
  options?: string[];
}

const questions: Question[] = [
  {
    id: 'fromAsset',
    title: 'What are you swapping FROM?',
    subtitle: 'Select the asset you want to convert',
    type: 'asset',
    options: ['USDC', 'USDT', 'BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'LINK']
  },
  {
    id: 'fromAmount',
    title: 'How much do you want to swap?',
    subtitle: 'Enter the amount you want to convert',
    type: 'amount'
  },
  {
    id: 'toAsset',
    title: 'What are you swapping TO?',
    subtitle: 'Select the destination asset (Stellar)',
    type: 'asset',
    options: ['XLM']
  },
  {
    id: 'slippage',
    title: 'What slippage tolerance do you prefer?',
    subtitle: 'Higher tolerance = faster execution, Lower tolerance = better rates',
    type: 'slippage',
    options: ['0.1%', '0.5%', '1.0%', '2.0%']
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
    subtitle: 'Review your swap details before proceeding',
    type: 'confirm'
  }
];

export default function SwapTypeformPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [swapForm, setSwapForm] = useState<SwapForm>({
    fromAsset: '',
    fromAmount: '',
    toAsset: 'XLM',
    slippage: 0.5,
    walletAddress: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [swapStatus, setSwapStatus] = useState<string>('');
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
        const hasAnswer = swapForm[currentQuestion.id as keyof SwapForm];
        
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
  };

  const hasValidAnswer = () => {
    const currentQuestion = questions[currentStep];
    
    switch (currentQuestion.type) {
      case 'asset':
        return !!swapForm[currentQuestion.id as keyof SwapForm];
      case 'amount':
        return !!swapForm.fromAmount && parseFloat(swapForm.fromAmount) > 0;
      case 'slippage':
        return !!swapForm.slippage;
      case 'wallet':
        return !!swapForm.walletAddress && swapForm.walletAddress.length > 0;
      case 'confirm':
        return true; // Always valid on confirm step
      default:
        return false;
    }
  };

  const handleSwap = async () => {
    setIsLoading(true);
    setSwapStatus('Initiating interstellar transfer...');
    
    try {
      // Simulate swap process
      await new Promise(resolve => setTimeout(resolve, 3000));
      setSwapStatus('Transfer completed successfully! Your assets have transcended dimensions.');
    } catch (error) {
      setSwapStatus('Transfer failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;

  const renderQuestion = () => {
    switch (currentQuestion.type) {
      case 'asset':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {currentQuestion.options?.map((option) => (
              <button
                key={option}
                onClick={() => handleInputChange(option)}
                className={`
                  p-4 rounded-lg border-2 transition-all duration-300
                  ${swapForm[currentQuestion.id as keyof SwapForm] === option
                    ? 'border-white/50 bg-white/10 text-white'
                    : 'border-white/20 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10'
                  }
                `}
              >
                <div className="text-lg font-bold mb-1">{option}</div>
                <div className="text-xs opacity-70">Asset</div>
              </button>
            ))}
          </div>
        );

      case 'amount':
        return (
          <div className="max-w-md mx-auto">
            <input
              type="number"
              placeholder="0.00"
              value={swapForm.fromAmount}
              onChange={(e) => handleInputChange(e.target.value)}
              className="w-full px-6 py-3 text-xl text-center bg-white/10 border border-white/30 rounded-lg text-white placeholder-white/50 font-mono focus:outline-none focus:border-white/50 transition-colors"
            />
          </div>
        );

      case 'slippage':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {currentQuestion.options?.map((option) => (
              <button
                key={option}
                onClick={() => handleInputChange(parseFloat(option.replace('%', '')))}
                className={`
                  p-3 rounded-lg border-2 transition-all duration-300
                  ${swapForm.slippage === parseFloat(option.replace('%', ''))
                    ? 'border-white/50 bg-white/10 text-white'
                    : 'border-white/20 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10'
                  }
                `}
              >
                <div className="text-lg font-bold">{option}</div>
              </button>
            ))}
          </div>
        );

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
                <span className="text-white/70 text-sm">From:</span>
                <span className="text-white font-mono text-sm">{swapForm.fromAmount} {swapForm.fromAsset}</span>
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-white/70 text-sm">To:</span>
                <span className="text-white font-mono text-sm">~{parseFloat(swapForm.fromAmount || '0') * 0.85} XLM</span>
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-white/70 text-sm">Slippage:</span>
                <span className="text-white font-mono text-sm">{swapForm.slippage}%</span>
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
            {swapStatus && (
              <div className="mt-4 p-3 rounded-lg bg-white/10 border border-white/20">
                <p className="text-white/80 font-mono text-center text-sm">{swapStatus}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 