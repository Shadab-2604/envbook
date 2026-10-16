'use client';

import React, { useState, forwardRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  label?: string;
  error?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ id, label, error, leftIcon, className = '', disabled, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
      <div className="w-full flex flex-col gap-1">
        {label && (
          <label htmlFor={id} className="font-label-ui text-label-ui text-text-secondary font-medium">
            {label}
          </label>
        )}
        <div className="relative rounded border border-border-muted bg-surface-panel transition-all duration-150 focus-within:border-accent-emerald focus-within:ring-1 focus-within:ring-accent-emerald">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
              {leftIcon}
            </div>
          )}
          <input
            {...props}
            ref={ref}
            id={id}
            type={showPassword ? 'text' : 'password'}
            disabled={disabled}
            className={`w-full py-2 bg-transparent text-text-primary placeholder:text-text-muted/60 border-0 focus:ring-0 focus:outline-none font-mono text-sm ${
              leftIcon ? 'pl-9' : 'pl-3'
            } pr-10 ${className}`}
          />
          <button
            type="button"
            tabIndex={0}
            onClick={() => setShowPassword(!showPassword)}
            disabled={disabled}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            title={showPassword ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-text-primary focus:outline-none focus:text-accent-emerald transition-colors"
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4 text-accent-emerald" aria-hidden="true" />
            ) : (
              <Eye className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {error && <span className="text-xs text-status-danger font-sans">{error}</span>}
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';
