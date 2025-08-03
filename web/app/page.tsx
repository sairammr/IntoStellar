'use client';

import { useState } from 'react';
import Link from 'next/link';
import ThreeScene from './components/ThreeScene';
import Navbar from './components/Navbar';
import InterstellarButton from './components/InterstellarButton';

export default function Home() {

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* 3D Background */}
      <ThreeScene />
      
      {/* Navbar */}
      <Navbar />
      
      {/* Content Overlay */}
      <div className="relative z-10 flex items-end justify-center min-h-screen pb-20">
                     {/* Bottom Button */}
             <div className="text-center">
               <Link href="/swap-typeform">
                 <InterstellarButton className="px-16">
                   ENTER
                 </InterstellarButton>
               </Link>  
             </div>
      </div>
      
      {/* Floating Elements */}
      <div className="absolute top-10 left-10 text-white/30 text-sm">
        <div className="animate-pulse">✦</div>
      </div>
      <div className="absolute top-20 right-20 text-white/30 text-sm">
        <div className="animate-pulse delay-1000">✦</div>
      </div>
      <div className="absolute bottom-20 left-20 text-white/30 text-sm">
        <div className="animate-pulse delay-2000">✦</div>
      </div>
      <div className="absolute bottom-10 right-10 text-white/30 text-sm">
        <div className="animate-pulse delay-3000">✦</div>
      </div>
    </div>
  );
}
