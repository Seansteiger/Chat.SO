import React from 'react';

export interface StatusTicksProps {
  status?: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Telegram & Signal-grade vector message delivery & read receipt ticks.
 * Features optical double-check alignment, hairline stroke geometry, and glowing sky-blue read state.
 */
export const StatusTicks: React.FC<StatusTicksProps> = ({
  status = 'SENT',
  className = '',
  size = 'md',
}) => {
  const normStatus = (status || 'SENT').toUpperCase();

  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  }[size];

  if (normStatus === 'PENDING') {
    return (
      <span
        title="Sending..."
        className={`inline-flex items-center justify-center ${sizeClasses} ${className}`}
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full text-slate-400 animate-spin opacity-80"
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeDasharray="28"
            strokeDashoffset="12"
          />
        </svg>
      </span>
    );
  }

  if (normStatus === 'SENT') {
    return (
      <span
        title="Sent"
        className={`inline-flex items-center justify-center ${sizeClasses} ${className}`}
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full text-slate-400 dark:text-slate-400 transition-colors"
        >
          <path
            d="M3.75 8.25L6.5 11L12.25 5.25"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  const isRead = normStatus === 'READ';

  return (
    <span
      title={isRead ? 'Read' : 'Delivered'}
      className={`inline-flex items-center justify-center ${sizeClasses} ${className}`}
    >
      <svg
        viewBox="0 0 18 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`w-full h-full transition-all duration-200 ${
          isRead
            ? 'text-[#0284c7] dark:text-[#38bdf8] tick-glow-read'
            : 'text-slate-400 dark:text-slate-400'
        }`}
      >
        {/* First / Background Checkmark */}
        <path
          d="M2 8.25L5 11.25L10.75 5.25"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Second / Foreground Checkmark (Optical offset by 4.5px) */}
        <path
          d="M6.5 8.25L9.5 11.25L15.25 5.25"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
};
