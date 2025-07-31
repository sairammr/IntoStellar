'use client';

import { useState } from 'react';
import Link from 'next/link';
import ThreeScene from './components/ThreeScene';
import Navbar from './components/Navbar';

export default function Home() {
  const [isHovered, setIsHovered] = useState(false);

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
          <Link href="/wallet">
            <button
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              className={`
                relative px-16 py-4 text-lg font-medium text-white
                border border-white/30 bg-white/5 backdrop-blur-md
                transition-all duration-500 ease-out
                overflow-hidden
                group
                hover:bg-white/10 hover:border-white/50
                ${isHovered ? 'scale-105' : 'scale-100'}
              `}
            >
              {/* Button Content */}
              <div className="flex items-center justify-center gap-2 relative z-10">
                <span className="tracking-widest font-mono">ENTER</span>
                <div className={`
                  w-4 h-4 border-r-2 border-t-2 border-white
                  transform transition-transform duration-300
                  ${isHovered ? 'translate-x-1 -translate-y-1' : 'translate-x-0 -translate-y-0'}
                `} />
              </div>
              
              {/* Glow Effect */}
              <div 
                className={`
                  absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0
                  transform -skew-x-12
                  transition-transform duration-1000 ease-out
                  ${isHovered ? 'translate-x-full' : '-translate-x-full'}
                `}
              />
              
              {/* Border Glow */}
              <div 
                className={`
                  absolute inset-0 border border-white/50
                  transition-opacity duration-300
                  ${isHovered ? 'opacity-100' : 'opacity-0'}
                `}
              />
            </button>
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
