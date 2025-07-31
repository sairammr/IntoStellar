'use client';

import { useState } from 'react';

interface InterstellarButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

export default function InterstellarButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  loadingText = 'PROCESSING',
  className = '',
  type = 'button'
}: InterstellarButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative px-8 py-4 text-lg font-medium text-white
        border border-white/30 bg-white/5 backdrop-blur-md
        transition-all duration-500 ease-out
        overflow-hidden
        group
        hover:bg-white/10 hover:border-white/50
        ${disabled || loading
          ? 'cursor-not-allowed opacity-50'
          : 'hover:scale-105'
        }
        ${className}
      `}
    >
      {/* Button Content */}
      <div className="flex items-center justify-center gap-2 relative z-10">
        <span className="tracking-widest font-mono">
          {loading ? loadingText : children}
        </span>
        {!loading && (
          <div className={`
            w-4 h-4 border-r-2 border-t-2 border-white
            transform transition-transform duration-300
            group-hover:translate-x-1 group-hover:-translate-y-1
          `} />
        )}
        {loading && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
        )}
      </div>
      
      {/* Glow Effect */}
      <div 
        className={`
          absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0
          transform -skew-x-12
          transition-transform duration-1000 ease-out
          group-hover:translate-x-full
          -translate-x-full
        `}
      />
      
      {/* Border Glow */}
      <div 
        className={`
          absolute inset-0 border border-white/50
          transition-opacity duration-300
          group-hover:opacity-100
          opacity-0
        `}
      />
    </button>
  );
} 