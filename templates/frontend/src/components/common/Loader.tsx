import React from 'react';
import { Loader2 } from 'lucide-react';

export type LoaderSize = 'sm' | 'md' | 'lg';

export interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: LoaderSize;
  text?: string;
  fullScreen?: boolean;
}

const sizeMap: Record<LoaderSize, { icon: string; text: string }> = {
  sm: {
    icon: 'w-4 h-4',
    text: 'text-xs',
  },
  md: {
    icon: 'w-6 h-6',
    text: 'text-sm',
  },
  lg: {
    icon: 'w-10 h-10',
    text: 'text-base',
  },
};

export const Loader: React.FC<LoaderProps> = ({
  size = 'md',
  text,
  fullScreen = false,
  className = '',
  ...props
}) => {
  const currentSize = sizeMap[size];

  const content = (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex flex-col items-center justify-center gap-2 ${className}`}
      {...props}
    >
      <Loader2
        className={`animate-spin text-brand-600 ${currentSize.icon}`}
        aria-hidden="true"
      />
      {text && (
        <span className={`font-medium text-slate-600 ${currentSize.text}`}>
          {text}
        </span>
      )}
      <span className="sr-only">{text || 'Loading...'}</span>
    </div>
  );

  if (fullScreen) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm"
        aria-modal="true"
        role="dialog"
      >
        {content}
      </div>
    );
  }

  return content;
};
