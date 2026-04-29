import React from 'react';

const Logo = ({ size = "medium", className = "" }) => {
  const sizeClasses = {
    small: "w-8 h-8",
    medium: "w-10 h-10", 
    large: "w-12 h-12"
  };

  const textSizes = {
    small: "text-lg",
    medium: "text-xl",
    large: "text-2xl"
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Modern Stellar Logo - represents network connectivity and payment flow */}
      <div className={`${sizeClasses[size]} relative flex items-center justify-center`}>
        {/* Outer ring - represents Stellar network */}
        <div className="absolute inset-0 rounded-full border-2 border-gradient-to-r from-pink-400 to-purple-400 opacity-80"></div>
        
        {/* Inner star shape - represents payment transactions */}
        <svg 
          className="w-5 h-5 text-white relative z-10"
          viewBox="0 0 24 24" 
          fill="currentColor"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
        
        {/* Animated pulse effect */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-400 to-purple-400 opacity-20 animate-pulse"></div>
      </div>
      
      {/* Brand name with improved typography */}
      <div className="flex flex-col">
        <span className={`${textSizes[size]} font-bold text-white leading-tight`}>
          Stellar<span className="bg-gradient-to-r from-pink-300 to-purple-300 bg-clip-text text-transparent">Pay</span>
        </span>
        {size === "large" && (
          <span className="text-xs text-gray-400 font-medium">Secure Payments</span>
        )}
      </div>
    </div>
  );
};

export default Logo;
