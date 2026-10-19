import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: ToastVariant;
  title?: string;
  message: string;
  onClose?: () => void;
}

interface VariantConfig {
  containerClass: string;
  icon: React.ReactNode;
  closeBtnClass: string;
}

const variantMap: Record<ToastVariant, VariantConfig> = {
  success: {
    containerClass: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" aria-hidden="true" />,
    closeBtnClass: 'text-emerald-700 hover:bg-emerald-100 focus-visible:ring-emerald-500',
  },
  error: {
    containerClass: 'border-rose-200 bg-rose-50 text-rose-900',
    icon: <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0" aria-hidden="true" />,
    closeBtnClass: 'text-rose-700 hover:bg-rose-100 focus-visible:ring-rose-500',
  },
  warning: {
    containerClass: 'border-amber-200 bg-amber-50 text-amber-900',
    icon: <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" aria-hidden="true" />,
    closeBtnClass: 'text-amber-700 hover:bg-amber-100 focus-visible:ring-amber-500',
  },
  info: {
    containerClass: 'border-sky-200 bg-sky-50 text-sky-900',
    icon: <Info className="h-5 w-5 text-sky-600 flex-shrink-0" aria-hidden="true" />,
    closeBtnClass: 'text-sky-700 hover:bg-sky-100 focus-visible:ring-sky-500',
  },
};

export const Toast: React.FC<ToastProps> = ({
  variant = 'info',
  title,
  message,
  onClose,
  className = '',
  ...props
}) => {
  const config = variantMap[variant];
  const role = variant === 'error' ? 'alert' : 'status';

  return (
    <div
      role={role}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      className={`flex w-full max-w-md items-start gap-3 rounded-lg border p-4 shadow-sm transition-all ${config.containerClass} ${className}`}
      {...props}
    >
      <div className="pt-0.5">{config.icon}</div>

      <div className="min-w-0 flex-1">
        {title && (
          <h4 className="text-sm font-semibold leading-5">{title}</h4>
        )}
        <p className={`text-sm leading-5 ${title ? 'mt-0.5 opacity-90' : ''}`}>
          {message}
        </p>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close notification"
          className={`-mr-1 -mt-1 inline-flex h-7 w-7 items-center justify-center rounded-md p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 ${config.closeBtnClass}`}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
