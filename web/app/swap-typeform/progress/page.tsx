'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import InterstellarButton from '../../components/InterstellarButton';

const STEPS = [
  'Preparing swap',
  'Fetching conversion rate',
  'Submitting transaction',
  'Awaiting confirmation',
  'Swap complete'
];

export default function SwapProgressPage() {
  const params = useSearchParams();
  const router = useRouter();

  const direction = params.get('direction') ?? 'ETH → XLM';

  const [step, setStep] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // background video autoplay
  useEffect(() => {
    if (videoRef.current) videoRef.current.play().catch(console.error);
    const t = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(t);
  }, []);

  // animate steps
  useEffect(() => {
    if (step >= STEPS.length - 1) return;
    const timer = setTimeout(() => setStep((s) => s + 1), 1500);
    return () => clearTimeout(timer);
  }, [step]);

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* video background */}
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
        <div className="absolute inset-0 bg-black/50" />
      </div>

      {/* content */}
      <div
        className={`relative z-10 flex items-center justify-center h-screen transition-all duration-700 ${
          isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className="w-full max-w-md bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
          <h1 className="text-2xl md:text-4xl font-bold text-center text-white mb-4 font-mono">
            Executing Swap
          </h1>
          <p className="text-sm text-center opacity-70 text-white mb-6 font-mono">Direction: {direction}</p>

          <div className="space-y-3">
            {STEPS.map((s, idx) => (
              <div
                key={s}
                className={`flex items-center space-x-3 p-3 rounded border transition-colors text-white font-mono text-sm ${
                  idx <= step ? 'border-white/40 bg-white/10' : 'border-white/10 bg-white/5 opacity-50'
                }`}
              >
                <span className="w-4 h-4 flex items-center justify-center text-xs">
                  {idx < step ? '✓' : idx === step ? '…' : ''}
                </span>
                <span>{s}</span>
              </div>
            ))}
          </div>

          {step === STEPS.length - 1 && (
            <div className="mt-6 text-center">
              <InterstellarButton onClick={() => router.push('/swap-typeform')}>Start New Swap</InterstellarButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
