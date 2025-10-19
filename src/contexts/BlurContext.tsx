'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface BlurContextType {
  isBlurred: boolean;
  toggleBlur: () => void;
}

const BlurContext = createContext<BlurContextType | undefined>(undefined);

export function BlurProvider({ children }: { children: React.ReactNode }) {
  const [isBlurred, setIsBlurred] = useState(true); // Default to blurred

  // Load blur state from localStorage on mount
  useEffect(() => {
    const savedBlurState = localStorage.getItem('tradr-blur-amounts');
    if (savedBlurState !== null) {
      setIsBlurred(savedBlurState === 'true');
    }
  }, []);

  const toggleBlur = () => {
    setIsBlurred((prev) => {
      const newState = !prev;
      localStorage.setItem('tradr-blur-amounts', String(newState));
      return newState;
    });
  };

  return (
    <BlurContext.Provider value={{ isBlurred, toggleBlur }}>
      {children}
    </BlurContext.Provider>
  );
}

export function useBlur() {
  const context = useContext(BlurContext);
  if (context === undefined) {
    throw new Error('useBlur must be used within a BlurProvider');
  }
  return context;
}
