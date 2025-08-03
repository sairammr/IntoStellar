"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function Navbar() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Fade in after a short delay
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 1000); // 1 second delay

    return () => clearTimeout(timer);
  }, []);

  return (
    <nav
      className={`
        fixed top-0 left-0 right-0 z-50 px-8 py-6
        transition-all duration-1000 ease-out
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}
      `}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <span className="text-xl font-thin text-white tracking-wider font-mono">
            INTOSTELLAR
          </span>
        </Link>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center space-x-8">
          
          <Link
            href="/swap-typeform"
            className="text-white/80 hover:text-white transition-colors duration-300 text-sm tracking-wide font-mono"
          >
            SWAP
          </Link>
          
         
          <Link
            href="/starter-pack"
            className="text-white/80 hover:text-white transition-colors duration-300 text-sm tracking-wide font-mono"
          >
            STARTER PACK
          </Link>
          <Link
            href="https://github.com/sairammr/intostellar"
            className="text-white/80 hover:text-white transition-colors duration-300 text-sm tracking-wide font-mono"
          >
            DOCS
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden">
          <button className="text-white/80 hover:text-white transition-colors duration-300">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}
