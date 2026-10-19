import React from 'react';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
  ...props
}) => {
  return (
    <section
      aria-label={title}
      className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center sm:p-12 ${className}`}
      {...props}
    >
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          {icon}
        </div>
      )}

      <h3 className="text-base font-semibold text-slate-900">{title}</h3>

      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-slate-500 leading-relaxed">
          {description}
        </p>
      )}

      {action && <div className="mt-6 flex items-center gap-3">{action}</div>}
    </section>
  );
};
