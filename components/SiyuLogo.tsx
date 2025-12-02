import React from 'react';

interface SiyuLogoProps {
  size?: 'small' | 'large';
  className?: string;
}

export const SiyuLogo: React.FC<SiyuLogoProps> = ({ size = 'large', className = '' }) => {
  const baseClasses = "font-brand font-black tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]";
  const sizeClasses = size === 'large' ? "text-6xl md:text-8xl" : "text-3xl";

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <h1 className={`${baseClasses} ${sizeClasses}`}>
        Siyu
      </h1>
      <div className="h-1 w-full max-w-[100px] bg-gradient-to-r from-transparent via-green-500 to-transparent mt-2 animate-pulse" />
    </div>
  );
};