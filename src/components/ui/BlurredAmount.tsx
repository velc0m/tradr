'use client';

import { useBlur } from '@/contexts/BlurContext';

interface BlurredAmountProps {
  amount: number;
  className?: string;
  showSign?: boolean;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export function BlurredAmount({
  amount,
  className = '',
  showSign = false,
  minimumFractionDigits = 2,
  maximumFractionDigits = 2,
}: BlurredAmountProps) {
  const { isBlurred } = useBlur();

  if (isBlurred) {
    return <span className={className}>***</span>;
  }

  const sign = showSign && amount >= 0 ? '+' : '';
  const formattedAmount = amount.toLocaleString('en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
  });

  return (
    <span className={className}>
      {sign}${formattedAmount}
    </span>
  );
}
